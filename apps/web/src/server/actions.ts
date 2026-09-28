"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { isAppError, cancelBookingSchema, createBookingSchema, inviteStaffSchema } from "@masulino/contracts";
import { inviteStaff, acceptInvitation } from "@masulino/core";
import { allocate, defaultPreparationTasks } from "@masulino/indoor-play";
import { cancelReservation, createStaffBooking } from "@masulino/reservations";
import { rows, withTenant } from "@masulino/database";
import { sql } from "drizzle-orm";
import { getAuth } from "./auth";
import { requireActor, requireStaffSession } from "./session";
import { headers } from "next/headers";

export async function logoutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function createBookingAction(
  _state: { error?: string; alternatives?: string[] } | null,
  formData: FormData,
) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = createBookingSchema.safeParse({
    locationId: formData.get("locationId"),
    idempotencyKey: formData.get("idempotencyKey"),
    localDate: formData.get("localDate"),
    localTime: formData.get("localTime"),
    childrenCount: Number(formData.get("childrenCount")),
    adultCount: Number(formData.get("adultCount")),
    packageId: formData.get("packageId"),
    organizerName: formData.get("organizerName"),
    organizerEmail: formData.get("organizerEmail"),
    organizerPhone: formData.get("organizerPhone"),
    honoreeFirstName: String(formData.get("honoreeFirstName") ?? "") || undefined,
    sourceChannel: formData.get("sourceChannel"),
    notes: String(formData.get("notes") ?? ""),
    mode: formData.get("mode") === "request" ? "request" : "confirm",
  });
  if (!parsed.success) return { error: "validation" };
  try {
    const result = await createStaffBooking({
      actor,
      input: parsed.data,
      correlationId: randomUUID(),
      allocate,
      preparationTasks: defaultPreparationTasks,
    });
    if (!result.ok) {
      return {
        error: "conflict",
        alternatives: result.alternatives.map((slot) => `${slot.localTime} · ${slot.combinationName}`),
      };
    }
    const location = await withTenant(tenantId, async (tx) =>
      rows<{ slug: string; tenant_slug: string }>(
        tx,
        sql`
          select l.slug, t.slug as tenant_slug
          from locations l
          join tenants t on t.id = l.tenant_id
          where l.id = ${parsed.data.locationId}
        `,
      ),
    );
    const slug = location[0];
    if (!slug) return { error: "generic" };
    redirect(
      `/app/${slug.tenant_slug}/${slug.slug}?date=${parsed.data.localDate}&created=${result.booking.reference}`,
    );
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function cancelBookingAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = cancelBookingSchema.parse({
    reservationId: formData.get("reservationId"),
    expectedVersion: Number(formData.get("expectedVersion")),
  });
  await cancelReservation({
    actor,
    reservationId: parsed.reservationId,
    expectedVersion: parsed.expectedVersion,
    correlationId: randomUUID(),
  });
}

export async function inviteAction(
  _state: { path?: string; error?: string } | null,
  formData: FormData,
) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const locationId = String(formData.get("locationId") ?? "");
  const parsed = inviteStaffSchema.safeParse({
    email: formData.get("email"),
    roleKey: formData.get("roleKey"),
    locationId: locationId || null,
  });
  if (!parsed.success) return { error: "validation" };
  try {
    const created = await inviteStaff(actor, parsed.data, randomUUID());
    return { path: created.acceptPath };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function acceptInviteAction(formData: FormData) {
  const staff = await requireStaffSession();
  const token = String(formData.get("token") ?? "");
  const result = await acceptInvitation({
    token,
    principalId: staff.principalId,
    subject: staff.user.id,
    email: staff.user.email,
    correlationId: randomUUID(),
  });
  const tenant = await withTenant(result.tenantId, async (tx) =>
    rows<{ slug: string }>(tx, sql`select slug from tenants where id = ${result.tenantId}`),
  );
  redirect(`/app/${tenant[0]?.slug ?? ""}`);
}
