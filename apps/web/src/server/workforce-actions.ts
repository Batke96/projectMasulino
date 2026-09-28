"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  assignChecklistSchema,
  completeChecklistSchema,
  isAppError,
  openIssueSchema,
  proposeWeekSchema,
  recordLeaveSchema,
  recordPunchSchema,
  requestCorrectionSchema,
  resolveIssueSchema,
  saveAvailabilitySchema,
} from "@masulino/contracts";
import { assignChecklist, completeChecklist, openIssue, resolveIssue } from "@masulino/operations";
import {
  enrollKioskDevice,
  issuePunchCapability,
  kioskDeviceReady,
  proposeWeek,
  publishPlan,
  recordLeave,
  recordPhonePunch,
  requestTimeCorrection,
  saveAvailability,
  submitKioskPunch,
} from "@masulino/workforce";
import { confirmedBookingFacts } from "./booking-facts";
import { requireActor } from "./session";

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export async function saveAvailabilityAction(
  _state: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const startMinute = minutes(String(formData.get("start") ?? ""));
  const endMinute = minutes(String(formData.get("end") ?? ""));
  const parsed = saveAvailabilitySchema.safeParse({
    locationId: formData.get("locationId"),
    windows: [
      {
        weekday: Number(formData.get("weekday")),
        startMinute,
        endMinute,
      },
    ],
  });
  if (!parsed.success || startMinute === null || endMinute === null) return { error: "validation" };
  try {
    await saveAvailability({ actor, input: parsed.data, correlationId: randomUUID() });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function recordLeaveAction(
  _state: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = recordLeaveSchema.safeParse({
    locationId: formData.get("locationId"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    status: formData.get("status"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await recordLeave({ actor, input: parsed.data, correlationId: randomUUID() });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function clockAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = recordPunchSchema.parse({
    locationId: formData.get("locationId"),
    kind: formData.get("kind"),
  });
  await recordPhonePunch({
    actor,
    locationId: parsed.locationId,
    kind: parsed.kind,
    correlationId: randomUUID(),
  });
  revalidatePath("/app", "layout");
}

export async function correctionAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = requestCorrectionSchema.parse({
    punchId: formData.get("punchId"),
    localDate: formData.get("localDate"),
    localTime: formData.get("localTime"),
    reason: formData.get("reason"),
  });
  await requestTimeCorrection({ actor, ...parsed, correlationId: randomUUID() });
  revalidatePath("/app", "layout");
}

export async function capabilityAction(
  _state: { token?: string; error?: string } | null,
  formData: FormData,
) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const locationId = String(formData.get("locationId") ?? "");
  const kind = formData.get("kind") === "out" ? "out" : "in";
  try {
    const issued = await issuePunchCapability({
      actor,
      locationId,
      kind,
      correlationId: randomUUID(),
    });
    return { token: issued.token };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function proposePlanAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = proposeWeekSchema.parse({
    locationId: formData.get("locationId"),
    weekStartsOn: formData.get("weekStartsOn"),
  });
  await proposeWeek({
    actor,
    locationId: parsed.locationId,
    weekStartsOn: parsed.weekStartsOn,
    correlationId: randomUUID(),
    loadBookings: confirmedBookingFacts,
  });
  revalidatePath("/app", "layout");
}

export async function publishPlanAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  await publishPlan({
    actor,
    planId: String(formData.get("planId") ?? ""),
    correlationId: randomUUID(),
  });
  revalidatePath("/app", "layout");
}

export async function enrollKioskAction(
  _state: { token?: string; error?: string } | null,
  formData: FormData,
) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  try {
    const enrolled = await enrollKioskDevice({
      actor,
      locationId: String(formData.get("locationId") ?? ""),
      correlationId: randomUUID(),
    });
    return { token: enrolled.token };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function assignChecklistAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = assignChecklistSchema.parse({
    locationId: formData.get("locationId"),
    kind: formData.get("kind"),
    localDate: formData.get("localDate"),
    title: formData.get("title"),
    assigneePrincipalId: formData.get("assigneePrincipalId"),
  });
  await assignChecklist({ actor, input: parsed, correlationId: randomUUID() });
  revalidatePath("/app", "layout");
}

export async function completeChecklistAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = completeChecklistSchema.parse({
    checklistId: formData.get("checklistId"),
    note: formData.get("note"),
  });
  await completeChecklist({
    actor,
    checklistId: parsed.checklistId,
    note: parsed.note,
    correlationId: randomUUID(),
  });
  revalidatePath("/app", "layout");
}

export async function openIssueAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = openIssueSchema.parse({
    locationId: formData.get("locationId"),
    description: formData.get("description"),
  });
  await openIssue({ actor, input: parsed, correlationId: randomUUID() });
  revalidatePath("/app", "layout");
}

export async function resolveIssueAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = resolveIssueSchema.parse({ issueId: formData.get("issueId") });
  await resolveIssue({ actor, issueId: parsed.issueId, correlationId: randomUUID() });
  revalidatePath("/app", "layout");
}

export async function bindKioskAction(
  _state: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  const token = String(formData.get("token") ?? "").trim();
  if (!(await kioskDeviceReady(token))) return { error: "invalid" };
  (await cookies()).set("masulino_kiosk_device", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/kiosk",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/kiosk");
}

export async function kioskPunchAction(
  _state: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  const deviceToken = (await cookies()).get("masulino_kiosk_device")?.value ?? "";
  const capabilityToken = String(formData.get("capability") ?? "").trim();
  try {
    await submitKioskPunch({
      deviceToken,
      capabilityToken,
      correlationId: randomUUID(),
    });
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { error: "invalid" };
    throw error;
  }
}
