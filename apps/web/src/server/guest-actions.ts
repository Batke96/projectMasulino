"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  guestBookingSchema,
  guestPatchSchema,
  guestStaffRequestSchema,
  isAppError,
} from "@masulino/contracts";
import { allocate, defaultPreparationTasks } from "@masulino/indoor-play";
import {
  applyGuestPatch,
  createGuestBooking,
  exchangeBookingLink,
  resolvePublishedVenue,
  routeGuestToStaff,
} from "@masulino/reservations";
import { ensureCapability, readBookingSession, writeBookingSession } from "./guest-cookies";

type GuestFormValues = {
  localDate: string;
  localTime: string;
  childrenCount: number;
  adultCount: number;
  packageId: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  honoreeFirstName?: string;
  notes: string;
};

export async function createGuestBookingAction(
  _state: { error?: string; alternatives?: string[]; values?: GuestFormValues } | null,
  formData: FormData,
) {
  const parsed = guestBookingSchema.safeParse({
    venueSlug: formData.get("venueSlug"),
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
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return { error: "validation" };
  const venue = await resolvePublishedVenue(parsed.data.venueSlug);
  if (!venue) return { error: "not_found" };
  const capabilityId = await ensureCapability();
  try {
    const result = await createGuestBooking({
      caller: { kind: "guest", tenantId: venue.tenantId, locationId: venue.locationId, capabilityId },
      input: {
        ...parsed.data,
        locationId: venue.locationId,
        sourceChannel: "guest_web",
        mode: "confirm",
      },
      correlationId: randomUUID(),
      allocate,
      preparationTasks: defaultPreparationTasks,
    });
    if (!result.ok) {
      return {
        error: "conflict",
        alternatives: result.alternatives.map((slot) => slot.localTime),
        values: parsed.data,
      };
    }
    const token = result.booking.exchangeToken;
    const query = new URLSearchParams({ reference: result.booking.reference });
    if (token) query.set("token", token);
    if (result.replayed) query.set("replayed", "1");
    redirect(`/book/${parsed.data.venueSlug}/done?${query.toString()}`);
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function exchangeLinkAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  try {
    const exchanged = await exchangeBookingLink(token, randomUUID());
    await writeBookingSession(exchanged.sessionToken);
  } catch (error) {
    if (isAppError(error)) redirect("/book/open?invalid=1");
    throw error;
  }
  redirect("/book/manage");
}

export async function guestPatchAction(
  _state: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  const session = await readBookingSession();
  if (!session) return { error: "not_found" };
  const parsed = guestPatchSchema.safeParse({
    expectedVersion: Number(formData.get("expectedVersion")),
    organizerPhone: formData.get("organizerPhone"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await applyGuestPatch({ sessionToken: session, patch: parsed.data, correlationId: randomUUID() });
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function guestStaffRequestAction(
  _state: { error?: string; routed?: boolean } | null,
  formData: FormData,
) {
  const session = await readBookingSession();
  if (!session) return { error: "not_found" };
  const parsed = guestStaffRequestSchema.safeParse({
    expectedVersion: Number(formData.get("expectedVersion")),
    kind: formData.get("kind"),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await routeGuestToStaff({ sessionToken: session, ...parsed.data, correlationId: randomUUID() });
    return { routed: true };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}
