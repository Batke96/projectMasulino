"use client";

import { useActionState, useState } from "react";
import { t } from "@masulino/i18n";
import { Alert, Button, SelectField, TextField } from "@masulino/ui";
import { createBookingAction } from "../../../../../../server/actions";

export function BookingForm({
  tenantId,
  locationId,
  localDate,
  packages,
}: {
  tenantId: string;
  locationId: string;
  localDate: string;
  packages: { id: string; name: string }[];
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(createBookingAction, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state?.error === "conflict" ? (
        <Alert tone="warn">
          <p>{t("booking.conflict")}</p>
          {state.alternatives && state.alternatives.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {state.alternatives.map((slot) => (
                <li key={slot}>{slot}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state?.error && state.error !== "conflict" ? <Alert>{t("error.generic")}</Alert> : null}
      <TextField label={t("booking.date")} name="localDate" type="date" defaultValue={localDate} required />
      <TextField label={t("booking.time")} name="localTime" type="time" defaultValue="14:00" required />
      <TextField label={t("booking.children")} name="childrenCount" type="number" min={1} defaultValue={8} required />
      <TextField label={t("booking.adults")} name="adultCount" type="number" min={0} defaultValue={4} required />
      <SelectField label={t("booking.package")} name="packageId" required defaultValue={packages[0]?.id}>
        {packages.map((pkg) => (
          <option key={pkg.id} value={pkg.id}>
            {pkg.name}
          </option>
        ))}
      </SelectField>
      <TextField label={t("booking.name")} name="organizerName" required />
      <TextField label={t("booking.email")} name="organizerEmail" type="email" required />
      <TextField label={t("booking.phone")} name="organizerPhone" required />
      <TextField label={t("booking.honoree")} name="honoreeFirstName" />
      <SelectField label={t("booking.channel")} name="sourceChannel" defaultValue="staff_phone">
        <option value="staff_phone">{t("channel.staff_phone")}</option>
        <option value="staff_walk_in">{t("channel.staff_walk_in")}</option>
        <option value="staff_other">{t("channel.staff_other")}</option>
      </SelectField>
      <label className="grid gap-1 text-sm">
        <span>{t("booking.notes")}</span>
        <textarea name="notes" maxLength={500} className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="mode" value="confirm" disabled={pending}>
          {t("booking.confirm")}
        </Button>
        <Button type="submit" name="mode" value="request" variant="secondary" disabled={pending}>
          {t("booking.request")}
        </Button>
      </div>
    </form>
  );
}
