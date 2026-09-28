import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { AppError } from "@masulino/contracts";
import type { ActorContext } from "@masulino/core";
import { closePools, rows, withTenant } from "@masulino/database";
import {
  assignChecklist,
  completeChecklist,
  openIssue,
  resolveIssue,
} from "@masulino/operations";
import {
  approveTimeCorrection,
  enrollKioskDevice,
  issuePunchCapability,
  listLocationAvailability,
  proposeWeek,
  publishPlan,
  readAvailability,
  readWeek,
  recordLeave,
  recordPhonePunch,
  requestTimeCorrection,
  revokeKioskDevice,
  saveAvailability,
  submitKioskPunch,
} from "@masulino/workforce";
import { confirmedBookingFacts } from "./src/server/booking-facts";
import { admin, lockFixture, reset, seed, unlockFixture, type Fixture } from "./test/fixture";

const workforceOn = { core: true, reservations: true, content: true, workforce: true, operations: true };

function employee(fixture: Fixture, principalId = fixture.principalA, locationId = fixture.locationA): ActorContext {
  return {
    principalId,
    tenantId: fixture.tenantA,
    membershipStatus: "active",
    grants: [{ roleKey: "employee", locationId }],
    entitlements: workforceOn,
    mfaSatisfied: true,
  };
}

function manager(fixture: Fixture, principalId: string, locationId = fixture.locationA): ActorContext {
  return {
    principalId,
    tenantId: fixture.tenantA,
    membershipStatus: "active",
    grants: [{ roleKey: "location_manager", locationId }],
    entitlements: workforceOn,
    mfaSatisfied: true,
  };
}

function owner(fixture: Fixture, principalId: string): ActorContext {
  return {
    principalId,
    tenantId: fixture.tenantA,
    membershipStatus: "active",
    grants: [{ roleKey: "tenant_owner", locationId: null }],
    entitlements: workforceOn,
    mfaSatisfied: true,
  };
}

async function enableModules(tenantId: string, workforce: boolean, operations: boolean) {
  await withTenant(tenantId, async (tx) => {
    await tx.execute(sql`
      insert into module_entitlements (tenant_id, module_id, enabled) values
        (${tenantId}, 'workforce', ${workforce}),
        (${tenantId}, 'operations', ${operations})
      on conflict (tenant_id, module_id) do update set enabled = excluded.enabled
    `);
  });
}

describe.sequential("workforce and checklists", () => {
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

  it("keeps availability on the employee and denies colleagues, locations, and tenants", async () => {
    const fixture = await seed();
    await enableModules(fixture.tenantA, true, true);
    const colleagueId = randomUUID();
    const locationOther = randomUUID();
    const locationB = randomUUID();
    const principalB = randomUUID();
    const client = await admin();
    await client.query(
      `insert into principals (id, issuer, subject, email, display_name) values
        ($1, 'urn:masulino:better-auth', 'colleague', 'colleague@example.test', 'Colleague'),
        ($2, 'urn:masulino:better-auth', 'tenant-b', 'b@example.test', 'Tenant B')`,
      [colleagueId, principalB],
    );
    await client.query(
      `insert into locations (id, tenant_id, slug, name, timezone) values
        ($1, $2, 'potsdam', 'Potsdam', 'Europe/Berlin'),
        ($3, $4, 'nord', 'Nord', 'Europe/Berlin')`,
      [locationOther, fixture.tenantA, locationB, fixture.tenantB],
    );
    await client.end();
    await enableModules(fixture.tenantB, true, false);

    const self = employee(fixture);
    const first = await saveAvailability({
      actor: self,
      input: { locationId: fixture.locationA, windows: [{ weekday: 1, startMinute: 540, endMinute: 720 }] },
      correlationId: randomUUID(),
    });
    const second = await saveAvailability({
      actor: self,
      input: { locationId: fixture.locationA, windows: [{ weekday: 1, startMinute: 540, endMinute: 1020 }] },
      correlationId: randomUUID(),
    });
    expect(second.version).toBe(first.version + 1);
    const current = await readAvailability(self, fixture.locationA);
    expect(current?.version).toBe(second.version);
    expect(current?.windows[0]?.endMinute).toBe(1020);
    const stored = await admin();
    const revisions = await stored.query(`select version from availability_revisions where principal_id = $1 order by version`, [
      fixture.principalA,
    ]);
    expect(revisions.rows).toHaveLength(2);
    await stored.end();

    const otherEmployee = employee(fixture, colleagueId);
    await expect(readAvailability(otherEmployee, fixture.locationA, fixture.principalA)).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(listLocationAvailability(otherEmployee, fixture.locationA)).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(readAvailability(self, locationOther)).rejects.toMatchObject({ code: "forbidden" });

    const listed = await listLocationAvailability(manager(fixture, colleagueId), fixture.locationA);
    expect(listed.map((item) => item.principalId)).toContain(fixture.principalA);

    const tenantB = {
      ...employee(fixture, principalB, locationB),
      tenantId: fixture.tenantB,
    };
    await expect(readAvailability(tenantB, fixture.locationA)).rejects.toMatchObject({ code: "forbidden" });
    const hidden = await withTenant(fixture.tenantB, async (tx) =>
      rows(tx, sql`select id from availability_revisions`),
    );
    expect(hidden).toEqual([]);

    const leaveA = await recordLeave({
      actor: self,
      input: {
        locationId: fixture.locationA,
        startsOn: "2026-10-01",
        endsOn: "2026-10-02",
        status: "requested",
        reason: "Fixture-Grund",
      },
      correlationId: randomUUID(),
    });
    await recordLeave({
      actor: self,
      input: {
        locationId: fixture.locationA,
        startsOn: "2026-10-03",
        endsOn: "2026-10-03",
        status: "recorded",
        reason: "Fixture verschoben",
        previousId: leaveA.id,
      },
      correlationId: randomUUID(),
    });
    const leaveRows = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ id: string }>(tx, sql`select id from leave_entries`),
    );
    expect(leaveRows).toHaveLength(2);
  });

  it("publishes one plan version and leaves the previous plan when publish is denied", async () => {
    const fixture = await seed();
    await enableModules(fixture.tenantA, true, true);
    const managerId = randomUUID();
    const locationOther = randomUUID();
    const client = await admin();
    await client.query(
      `insert into principals (id, issuer, subject, email, display_name) values
        ($1, 'urn:masulino:better-auth', 'manager', 'manager@example.test', 'Manager')`,
      [managerId],
    );
    await client.query(
      `insert into locations (id, tenant_id, slug, name, timezone) values ($1, $2, 'potsdam', 'Potsdam', 'Europe/Berlin')`,
      [locationOther, fixture.tenantA],
    );
    const rule = await client.query<{ id: string }>(`select id from venue_rules where location_id = $1`, [
      fixture.locationA,
    ]);
    await client.query(
      `insert into reservations (
        tenant_id, location_id, reference, status, organizer_name, organizer_email, organizer_phone,
        starts_at, ends_at, local_date, children_count, adult_count, package_id, package_name_snapshot,
        price_minor_snapshot, currency_snapshot, rule_id, rule_version_snapshot, source_channel,
        created_by_principal_id
      ) values (
        $1, $2, 'WK-1', 'confirmed', 'Familie Fixture', 'f@example.test', '030',
        '2026-09-28T12:00:00Z', '2026-09-28T14:00:00Z', '2026-09-28', 20, 2, $3, 'Fixture',
        10000, 'EUR', $4, 1, 'staff_phone', $5
      )`,
      [fixture.tenantA, fixture.locationA, fixture.packageId, rule.rows[0]?.id, fixture.principalA],
    );
    await client.end();

    const self = employee(fixture);
    await saveAvailability({
      actor: self,
      input: { locationId: fixture.locationA, windows: [{ weekday: 1, startMinute: 540, endMinute: 1020 }] },
      correlationId: randomUUID(),
    });
    const lead = manager(fixture, managerId);
    const proposed = await proposeWeek({
      actor: lead,
      locationId: fixture.locationA,
      weekStartsOn: "2026-09-28",
      correlationId: randomUUID(),
      loadBookings: confirmedBookingFacts,
    });
    expect(proposed.warnings.some((warning) => warning.code === "coverage_gap")).toBe(true);
    expect(proposed.warnings.some((warning) => warning.code === "break")).toBe(true);
    const before = await readWeek({ actor: self, locationId: fixture.locationA, weekStartsOn: "2026-09-28" });
    expect(before.draft).toBeNull();
    expect(before.published).toBeNull();
    await expect(
      publishPlan({ actor: self, planId: proposed.id, correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const stillDraft = await readWeek({ actor: lead, locationId: fixture.locationA, weekStartsOn: "2026-09-28" });
    expect(stillDraft.draft?.id).toBe(proposed.id);
    expect(stillDraft.published).toBeNull();

    const otherLead = manager(fixture, managerId, locationOther);
    await expect(
      publishPlan({ actor: otherLead, planId: proposed.id, correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const published = await publishPlan({ actor: lead, planId: proposed.id, correlationId: randomUUID() });
    const again = await publishPlan({ actor: lead, planId: proposed.id, correlationId: randomUUID() });
    expect(again.idempotent).toBe(true);
    expect(again.version).toBe(published.version);
    const audits = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ id: string }>(
        tx,
        sql`select id from audit_events where action = 'workforce.schedule.publish' and target_id = ${proposed.id}`,
      ),
    );
    expect(audits).toHaveLength(1);

    const next = await proposeWeek({
      actor: lead,
      locationId: fixture.locationA,
      weekStartsOn: "2026-09-28",
      correlationId: randomUUID(),
      loadBookings: confirmedBookingFacts,
    });
    await expect(publishPlan({ actor: self, planId: next.id, correlationId: randomUUID() })).rejects.toBeInstanceOf(
      AppError,
    );
    const after = await readWeek({ actor: lead, locationId: fixture.locationA, weekStartsOn: "2026-09-28" });
    expect(after.published?.id).toBe(proposed.id);
    expect(after.draft?.id).toBe(next.id);

    await enableModules(fixture.tenantA, false, true);
    await expect(
      proposeWeek({
        actor: { ...lead, entitlements: { ...workforceOn, workforce: true } },
        locationId: fixture.locationA,
        weekStartsOn: "2026-10-05",
        correlationId: randomUUID(),
        loadBookings: confirmedBookingFacts,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const plans = await withTenant(fixture.tenantA, async (tx) =>
      rows(tx, sql`select id from schedule_plans where week_starts_on = '2026-10-05'`),
    );
    expect(plans).toEqual([]);
  });

  it("keeps the original punch and denies self-approval, shift leads, and a disabled module", async () => {
    const fixture = await seed();
    await enableModules(fixture.tenantA, true, true);
    const managerId = randomUUID();
    const client = await admin();
    await client.query(
      `insert into principals (id, issuer, subject, email, display_name) values
        ($1, 'urn:masulino:better-auth', 'manager-time', 'time@example.test', 'Time Manager')`,
      [managerId],
    );
    const membership = randomUUID();
    await client.query(
      `insert into memberships (id, tenant_id, principal_id, status) values ($1, $2, $3, 'active')`,
      [membership, fixture.tenantA, fixture.principalA],
    );
    await client.query(
      `insert into grants (tenant_id, membership_id, role_key, location_id) values ($1, $2, 'employee', $3)`,
      [fixture.tenantA, membership, fixture.locationA],
    );
    await client.end();

    const self = employee(fixture);
    const spring = await recordPhonePunch({
      actor: self,
      locationId: fixture.locationA,
      kind: "in",
      punchedAt: new Date("2026-03-29T01:30:00.000Z"),
      correlationId: randomUUID(),
    });
    expect(spring.localDate).toBe("2026-03-29");
    expect(spring.localTime).toBe("03:30");
    const autumn = await recordPhonePunch({
      actor: self,
      locationId: fixture.locationA,
      kind: "out",
      punchedAt: new Date("2026-10-25T01:30:00.000Z"),
      correlationId: randomUUID(),
    });
    expect(autumn.localDate).toBe("2026-10-25");
    expect(autumn.localTime).toBe("02:30");

    await expect(
      withTenant(fixture.tenantA, async (tx) => {
        await tx.execute(sql`update time_punches set kind = 'out' where id = ${spring.id}`);
      }),
    ).rejects.toThrow();

    const correction = await requestTimeCorrection({
      actor: self,
      punchId: spring.id,
      localDate: "2026-03-29",
      localTime: "09:00",
      reason: "Fixture vergessen",
      correlationId: randomUUID(),
    });
    const original = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ punched_at: Date }>(tx, sql`select punched_at from time_punches where id = ${spring.id}`),
    );
    const shiftLead: ActorContext = {
      ...self,
      principalId: managerId,
      grants: [{ roleKey: "shift_lead", locationId: fixture.locationA }],
    };
    const reception: ActorContext = {
      ...self,
      grants: [{ roleKey: "reception", locationId: fixture.locationA }],
    };
    await expect(
      recordPhonePunch({ actor: reception, locationId: fixture.locationA, kind: "in", correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      approveTimeCorrection({ actor: shiftLead, requestId: correction.id, correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      approveTimeCorrection({ actor: owner(fixture, fixture.principalA), requestId: correction.id, correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "forbidden", message: "self_approval" });

    await approveTimeCorrection({
      actor: owner(fixture, managerId),
      requestId: correction.id,
      correlationId: randomUUID(),
    });
    const after = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ punched_at: Date }>(tx, sql`select punched_at from time_punches where id = ${spring.id}`),
    );
    expect(new Date(after[0]!.punched_at).toISOString()).toBe(new Date(original[0]!.punched_at).toISOString());
    const effective = await withTenant(fixture.tenantA, async (tx) =>
      rows(tx, sql`select id from time_effective_entries where correction_request_id = ${correction.id}`),
    );
    expect(effective).toHaveLength(1);

    await enableModules(fixture.tenantA, false, true);
    await expect(
      recordPhonePunch({
        actor: { ...self, entitlements: { ...workforceOn, workforce: true } },
        locationId: fixture.locationA,
        kind: "in",
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const kept = await admin();
    const still = await kept.query(`select id from time_punches where id = $1`, [spring.id]);
    expect(still.rows).toHaveLength(1);
    await kept.end();

    await enableModules(fixture.tenantA, true, true);
    const enrolled = await enrollKioskDevice({
      actor: manager(fixture, managerId),
      locationId: fixture.locationA,
      correlationId: randomUUID(),
    });
    const capability = await issuePunchCapability({
      actor: self,
      locationId: fixture.locationA,
      kind: "in",
      correlationId: randomUUID(),
    });
    await submitKioskPunch({
      deviceToken: enrolled.token,
      capabilityToken: capability.token,
      correlationId: randomUUID(),
    });
    await expect(
      submitKioskPunch({
        deviceToken: enrolled.token,
        capabilityToken: capability.token,
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await revokeKioskDevice({
      actor: manager(fixture, managerId),
      deviceId: enrolled.id,
      correlationId: randomUUID(),
    });
    const fresh = await issuePunchCapability({
      actor: self,
      locationId: fixture.locationA,
      kind: "out",
      correlationId: randomUUID(),
    });
    await expect(
      submitKioskPunch({
        deviceToken: enrolled.token,
        capabilityToken: fresh.token,
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("completes only an assigned checklist and rejects a disabled operations module", async () => {
    const fixture = await seed();
    await enableModules(fixture.tenantA, true, true);
    const leadId = randomUUID();
    const locationOther = randomUUID();
    const client = await admin();
    await client.query(
      `insert into principals (id, issuer, subject, email, display_name) values
        ($1, 'urn:masulino:better-auth', 'lead', 'lead@example.test', 'Lead')`,
      [leadId],
    );
    await client.query(
      `insert into locations (id, tenant_id, slug, name, timezone) values ($1, $2, 'potsdam', 'Potsdam', 'Europe/Berlin')`,
      [locationOther, fixture.tenantA],
    );
    await client.end();
    const self = employee(fixture);
    const lead = manager(fixture, leadId);
    const assigned = await assignChecklist({
      actor: lead,
      input: {
        locationId: fixture.locationA,
        kind: "closing",
        localDate: "2026-09-28",
        title: "Abschluss",
        assigneePrincipalId: fixture.principalA,
      },
      correlationId: randomUUID(),
    });
    const elsewhere = await assignChecklist({
      actor: owner(fixture, leadId),
      input: {
        locationId: locationOther,
        kind: "cleaning",
        localDate: "2026-09-28",
        title: "Andere Halle",
        assigneePrincipalId: fixture.principalA,
      },
      correlationId: randomUUID(),
    });
    await completeChecklist({
      actor: self,
      checklistId: assigned.id,
      note: "Tische geprüft",
      correlationId: randomUUID(),
    });
    await expect(
      completeChecklist({
        actor: self,
        checklistId: elsewhere.id,
        note: "Nein",
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const reception: ActorContext = {
      ...self,
      grants: [{ roleKey: "reception", locationId: fixture.locationA }],
    };
    await expect(
      completeChecklist({ actor: reception, checklistId: assigned.id, note: "Nein", correlationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const unassigned = await assignChecklist({
      actor: lead,
      input: {
        locationId: fixture.locationA,
        kind: "maintenance",
        localDate: "2026-09-28",
        title: "Wartung",
        assigneeRoleKey: "location_manager",
      },
      correlationId: randomUUID(),
    });
    const shiftLead: ActorContext = {
      principalId: leadId,
      tenantId: fixture.tenantA,
      membershipStatus: "active",
      grants: [{ roleKey: "shift_lead", locationId: fixture.locationA }],
      entitlements: workforceOn,
      mfaSatisfied: true,
    };
    await completeChecklist({
      actor: shiftLead,
      checklistId: unassigned.id,
      note: "Schichtleitung",
      correlationId: randomUUID(),
    });
    const issue = await openIssue({
      actor: self,
      input: { locationId: fixture.locationA, description: "Lampe aus" },
      correlationId: randomUUID(),
    });
    await resolveIssue({ actor: lead, issueId: issue.id, correlationId: randomUUID() });
    const resolved = await withTenant(fixture.tenantA, async (tx) =>
      rows<{ action: string }>(
        tx,
        sql`select action from audit_events where target_id = ${issue.id} and action = 'operations.issue.resolve'`,
      ),
    );
    expect(resolved).toHaveLength(1);

    await enableModules(fixture.tenantA, true, false);
    await expect(
      completeChecklist({
        actor: { ...shiftLead, entitlements: { ...workforceOn, operations: true } },
        checklistId: assigned.id,
        note: "Noch einmal",
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      openIssue({
        actor: { ...self, entitlements: { ...workforceOn, operations: true } },
        input: { locationId: fixture.locationA, description: "Neu" },
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const kept = await admin();
    const still = await kept.query(`select id from checklists where id = $1`, [assigned.id]);
    expect(still.rows).toHaveLength(1);
    await kept.end();
  });
});
