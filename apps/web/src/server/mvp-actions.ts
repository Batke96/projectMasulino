"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isAppError, noticeActionSchema, noticeDraftSchema } from "@masulino/contracts";
import { approveNotice, createNotice, previewNotice, publishNotice } from "@masulino/notices";
import { generatePreparationSheet, retryDelivery } from "@masulino/reservations";
import { requireActor } from "./session";

export async function generateSheetAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  await generatePreparationSheet({
    actor,
    locationId: String(formData.get("locationId") ?? ""),
    localDate: String(formData.get("localDate") ?? ""),
    correlationId: randomUUID(),
  });
  revalidatePath("/app", "layout");
}

export async function retryDeliveryAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  await retryDelivery({
    actor,
    deliveryId: String(formData.get("deliveryId") ?? ""),
    correlationId: randomUUID(),
  });
  revalidatePath("/app");
}

export async function createNoticeAction(
  _state: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = noticeDraftSchema.safeParse({
    locationId: formData.get("locationId"),
    title: formData.get("title"),
    body: formData.get("body"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await createNotice({ actor, input: parsed.data, correlationId: randomUUID() });
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { error: error.code };
    throw error;
  }
}

export async function transitionNoticeAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const actor = await requireActor(tenantId);
  const parsed = noticeActionSchema.parse({ noticeId: formData.get("noticeId") });
  const step = String(formData.get("step") ?? "");
  const args = { actor, noticeId: parsed.noticeId, correlationId: randomUUID() };
  if (step === "preview") await previewNotice(args);
  else if (step === "approve") await approveNotice(args);
  else if (step === "publish") await publishNotice(args);
  revalidatePath("/app");
}
