import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { drainOutbox } from "@masulino/core";
import { closePools, rows, withTenant } from "@masulino/database";
import { allocate, defaultPreparationTasks } from "@masulino/indoor-play";
import {
  approveNotice,
  createNotice,
  listPublicNotices,
  previewNotice,
  publishNotice,
} from "@masulino/notices";
import {
  applyGuestPatch,
  cancelReservation,
  createGuestBooking,
  createStaffBooking,
  exchangeBookingLink,
  generatePreparationSheet,
  handleOutboxJob,
  previewBookingLink,
  publicAvailability,
  readGuestReservation,
  readPreparationSheet,
  rescheduleReservation,
  revokeGuestLinks,
  routeGuestToStaff,
} from "@masulino/reservations";
import { admin, lockFixture, manager, reset, seed, staff, unlockFixture, type Fixture } from "./test/fixture";

const allocateArgs = {
  allocate,
  preparationTasks: defaultPreparationTasks,
};

function guestCaller(fixture: Fixture) {
  return {
    kind: "guest" as const,
    tenantId: fixture.tenantA,
    locationId: fixture.locationA,
    capabilityId: randomUUID(),
  };
}

function bookingInput(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    locationId: fixture.locationA,
    idempotencyKey: randomUUID(),
    localDate: "2026-11-02",
    localTime: "11:00",
    childrenCount: 4,
    adultCount: 2,
    packageId: fixture.packageId,
    organizerName: "Familie Gast",
    organizerEmail: "gast@example.test",
    organizerPhone: "030999",
    sourceChannel: "guest_web" as const,
    notes: "",
    mode: "confirm" as const,
    ...overrides,
  };
}

describe.sequential("booking mvp", () => {
  beforeEach(async () => {
    await lockFixture();
    await reset();
  });

  afterEach(async () => {
    await unlockFixture();
  });

  afterAll(async () => {
    await closePools();
  });

  it("confirms at most one booking when a guest and a staff user race", async () => {
    const fixture = await seed();
    const input = bookingInput(fixture, {
      localTime: "14:00",
      childrenCount: 8,
      sourceChannel: "staff_phone",
    });
    const [guestResult, staffResult] = await Promise.all([
      createGuestBooking({
        caller: guestCaller(fixture),
        input: { ...input, sourceChannel: "guest_web", idempotencyKey: "race-guest-01", organizerEmail: "race-guest@example.test" },
        correlationId: randomUUID(),
        ...allocateArgs,
      }),
      createStaffBooking({
        actor: staff(fixture),
        input: { ...input, idempotencyKey: "race-staff-01", organizerEmail: "race-staff@example.test" },
        correlationId: randomUUID(),
        ...allocateArgs,
      }),
    ]);
    const results = [guestResult, staffResult];
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    const allocations = await withTenant(fixture.tenantA, async (tx) => rows(tx, sql`select id from allocations`));
    expect(allocations).toHaveLength(1);
  });

  it("replays a guest booking and keeps availability free of other guests", async () => {
    const fixture = await seed();
    const caller = guestCaller(fixture);
    const input = bookingInput(fixture, { idempotencyKey: "guest-replay-01", organizerEmail: "hidden@example.test" });
    const created = await createGuestBooking({
      caller,
      input,
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    const replay = await createGuestBooking({ caller, input, correlationId: randomUUID(), ...allocateArgs });
    expect(created.ok && replay.ok && created.booking.id === replay.booking.id && replay.replayed).toBe(true);
    await expect(
      createGuestBooking({
        caller,
        input: { ...input, notes: "anders" },
        correlationId: randomUUID(),
        ...allocateArgs,
      }),
    ).rejects.toMatchObject({ code: "idempotency_mismatch" });
    const availability = await publicAvailability({
      slug: "a-berlin",
      localDate: "2026-11-02",
      childrenCount: 4,
      adultCount: 2,
      packageId: fixture.packageId,
      allocate,
    });
    const encoded = JSON.stringify(availability);
    expect(encoded).not.toContain("hidden@example.test");
    expect(encoded).not.toContain("Familie Gast");
    expect(availability.slots.some((slot) => slot.localTime === "11:00" && slot.available === false)).toBe(true);
  });

  it("rejects guessed, expired, replayed, and wrong-purpose links without consuming a preview", async () => {
    const fixture = await seed();
    const created = await createGuestBooking({
      caller: guestCaller(fixture),
      input: bookingInput(fixture),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!created.ok || !created.booking.exchangeToken) throw new Error("missing token");
    const token = created.booking.exchangeToken;
    expect(await previewBookingLink(token)).toBe("ready");
    const before = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ consumed_at: Date | null }>(
        tx,
        sql`select consumed_at from booking_access_tokens where purpose = 'exchange'`,
      ),
    );
    expect(before[0]?.consumed_at).toBeNull();
    await expect(readGuestReservation(created.booking.reference)).rejects.toMatchObject({ code: "not_found" });
    await expect(readGuestReservation("gast@example.test")).rejects.toMatchObject({ code: "not_found" });
    const session = await exchangeBookingLink(token, randomUUID());
    const view = await readGuestReservation(session.sessionToken);
    expect(view.reference).toBe(created.booking.reference);
    expect(view.organizerEmail).toBe("gast@example.test");
    await expect(exchangeBookingLink(token, randomUUID())).rejects.toMatchObject({ code: "conflict" });
    await expect(exchangeBookingLink(session.sessionToken, randomUUID())).rejects.toMatchObject({ code: "forbidden" });

    const expiring = await createGuestBooking({
      caller: guestCaller(fixture),
      input: bookingInput(fixture, { localTime: "16:00", organizerEmail: "late@example.test" }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!expiring.ok || !expiring.booking.exchangeToken) throw new Error("missing token");
    const client = await admin();
    await client.query(
      `update booking_access_tokens set expires_at = now() - interval '1 minute' where reservation_id = $1 and purpose = 'exchange'`,
      [expiring.booking.id],
    );
    await client.end();
    await expect(exchangeBookingLink(expiring.booking.exchangeToken, randomUUID())).rejects.toMatchObject({
      message: "expired",
    });
    const still = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ consumed_at: Date | null }>(
        tx,
        sql`select consumed_at from booking_access_tokens where reservation_id = ${expiring.booking.id} and purpose = 'exchange'`,
      ),
    );
    expect(still[0]?.consumed_at).toBeNull();

    const revocable = await createGuestBooking({
      caller: guestCaller(fixture),
      input: bookingInput(fixture, { localDate: "2026-11-03", organizerEmail: "revoke@example.test" }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!revocable.ok || !revocable.booking.exchangeToken) throw new Error("missing token");
    await revokeGuestLinks({
      actor: staff(fixture),
      reservationId: revocable.booking.id,
      correlationId: randomUUID(),
    });
    await expect(exchangeBookingLink(revocable.booking.exchangeToken, randomUUID())).rejects.toMatchObject({
      message: "revoked",
    });
  });

  it("updates only phone and notes for a guest and keeps a failed move", async () => {
    const fixture = await seed();
    const created = await createGuestBooking({
      caller: guestCaller(fixture),
      input: bookingInput(fixture, { localTime: "10:00" }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!created.ok || !created.booking.exchangeToken) throw new Error("missing token");
    const session = await exchangeBookingLink(created.booking.exchangeToken, randomUUID());
    const patched = await applyGuestPatch({
      sessionToken: session.sessionToken,
      patch: { expectedVersion: 1, organizerPhone: "030111", notes: "Fenster" },
      correlationId: randomUUID(),
    });
    expect(patched.version).toBe(2);
    const routed = await routeGuestToStaff({
      sessionToken: session.sessionToken,
      expectedVersion: 2,
      kind: "cancel",
      message: "<b>bitte storno</b>",
      correlationId: randomUUID(),
    });
    expect(routed.routedToStaff).toBe(true);
    const kept = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ status: string; local_time: string }>(
        tx,
        sql`
          select status, to_char(starts_at at time zone 'Europe/Berlin', 'HH24:MI') as local_time
          from reservations where id = ${created.booking.id}
        `,
      ),
    );
    expect(kept[0]).toMatchObject({ status: "confirmed", local_time: "10:00" });

    await createStaffBooking({
      actor: staff(fixture),
      input: bookingInput(fixture, {
        sourceChannel: "staff_phone",
        localTime: "14:00",
        childrenCount: 8,
        organizerEmail: "block@example.test",
      }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    const blocker = await createStaffBooking({
      actor: staff(fixture),
      input: bookingInput(fixture, {
        sourceChannel: "staff_phone",
        localTime: "10:00",
        childrenCount: 8,
        localDate: "2026-11-04",
        organizerEmail: "origin@example.test",
      }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!blocker.ok) throw new Error("blocker missing");
    await createStaffBooking({
      actor: staff(fixture),
      input: bookingInput(fixture, {
        sourceChannel: "staff_phone",
        localTime: "14:00",
        childrenCount: 8,
        localDate: "2026-11-04",
        organizerEmail: "taken@example.test",
      }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    await expect(
      rescheduleReservation({
        actor: staff(fixture),
        input: {
          reservationId: blocker.booking.id,
          expectedVersion: blocker.booking.version,
          localDate: "2026-11-04",
          localTime: "14:00",
        },
        correlationId: randomUUID(),
        allocate,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const original = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ local_time: string; allocations: number }>(
        tx,
        sql`
          select to_char(r.starts_at at time zone 'Europe/Berlin', 'HH24:MI') as local_time,
                 (select count(*)::int from allocations a where a.reservation_id = r.id) as allocations
          from reservations r where r.id = ${blocker.booking.id}
        `,
      ),
    );
    expect(original[0]).toMatchObject({ local_time: "10:00", allocations: 1 });
  });

  it("previews a confirmation once, drops a cancelled reminder, and fails a disabled module", async () => {
    const fixture = await seed();
    const created = await createStaffBooking({
      actor: staff(fixture),
      input: bookingInput(fixture, { sourceChannel: "staff_phone", localDate: "2026-06-15" }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!created.ok) throw new Error("booking missing");
    await drainOutbox("test", handleOutboxJob);
    await drainOutbox("test", handleOutboxJob);
    const previews = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ kind: string; status: string }>(
        tx,
        sql`select kind, status from notification_deliveries where reservation_id = ${created.booking.id}`,
      ),
    );
    expect(previews.filter((row) => row.kind === "confirmation" && row.status === "previewed")).toHaveLength(1);
    expect(previews.filter((row) => row.kind === "reminder" && row.status === "previewed")).toHaveLength(1);

    const future = await createStaffBooking({
      actor: staff(fixture),
      input: bookingInput(fixture, { sourceChannel: "staff_phone", localDate: "2026-12-01", localTime: "12:00" }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!future.ok) throw new Error("future missing");
    await cancelReservation({
      actor: staff(fixture),
      reservationId: future.booking.id,
      expectedVersion: future.booking.version,
      correlationId: randomUUID(),
    });
    await drainOutbox("test", handleOutboxJob);
    const reminder = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ status: string; preview_text: string | null }>(
        tx,
        sql`select status, preview_text from notification_deliveries where reservation_id = ${future.booking.id} and kind = 'reminder'`,
      ),
    );
    expect(reminder[0]).toMatchObject({ status: "cancelled", preview_text: null });

    const gated = await createStaffBooking({
      actor: staff(fixture),
      input: bookingInput(fixture, { sourceChannel: "staff_phone", localDate: "2026-11-05", localTime: "15:00" }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!gated.ok) throw new Error("gated missing");
    const client = await admin();
    await client.query(`update module_entitlements set enabled = false where tenant_id = $1 and module_id = 'reservations'`, [
      fixture.tenantA,
    ]);
    await client.query(
      `update outbox_jobs
       set max_attempts = 1, available_at = now()
       where tenant_id = $1 and status = 'pending' and payload->>'reservationId' = $2`,
      [fixture.tenantA, gated.booking.id],
    );
    await client.end();
    await drainOutbox("test", handleOutboxJob);
    const failed = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ status: string; preview_text: string | null }>(
        tx,
        sql`select status, preview_text from notification_deliveries where reservation_id = ${gated.booking.id}`,
      ),
    );
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((row) => row.status === "failed" && row.preview_text === null)).toBe(true);
  });

  it("marks a preparation sheet stale and keeps draft notices private", async () => {
    const fixture = await seed();
    const created = await createStaffBooking({
      actor: staff(fixture),
      input: bookingInput(fixture, { sourceChannel: "staff_phone", organizerEmail: "sheet@example.test" }),
      correlationId: randomUUID(),
      ...allocateArgs,
    });
    if (!created.ok) throw new Error("sheet booking missing");
    await generatePreparationSheet({
      actor: staff(fixture),
      locationId: fixture.locationA,
      localDate: "2026-11-02",
      correlationId: randomUUID(),
    });
    await cancelReservation({
      actor: staff(fixture),
      reservationId: created.booking.id,
      expectedVersion: created.booking.version,
      correlationId: randomUUID(),
    });
    const sheet = await readPreparationSheet({
      actor: staff(fixture),
      locationId: fixture.locationA,
      localDate: "2026-11-02",
    });
    expect(sheet?.stale).toBe(true);
    expect(JSON.stringify(sheet?.lines)).not.toContain("sheet@example.test");

    const draft = await createNotice({
      actor: manager(fixture),
      input: {
        locationId: fixture.locationA,
        title: "Geheimer Entwurf",
        body: "<script>alert(1)</script>Nur intern",
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
      },
      correlationId: randomUUID(),
    });
    expect(await listPublicNotices(fixture.tenantA, fixture.locationA, "2026-09-28")).toEqual([]);
    await previewNotice({ actor: manager(fixture), noticeId: draft.id, correlationId: randomUUID() });
    expect(await listPublicNotices(fixture.tenantA, fixture.locationA, "2026-09-28")).toEqual([]);
    await expect(
      publishNotice({ actor: manager(fixture), noticeId: draft.id, correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "conflict" });
    await approveNotice({ actor: manager(fixture), noticeId: draft.id, correlationId: randomUUID() });
    await publishNotice({ actor: manager(fixture), noticeId: draft.id, correlationId: randomUUID() });
    const published = await listPublicNotices(fixture.tenantA, fixture.locationA, "2026-09-28");
    expect(published.map((notice) => notice.title)).toEqual(["Geheimer Entwurf"]);
    expect(published[0]?.body).toBe("Nur intern");
    await expect(
      publishNotice({ actor: staff(fixture), noticeId: draft.id, correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
