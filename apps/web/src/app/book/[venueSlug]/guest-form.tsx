"use client";

import { useActionState, useState } from "react";
import { t } from "@masulino/i18n";
import { Alert, Button, SelectField, TextField } from "@masulino/ui";
import { createGuestBookingAction } from "../../../server/guest-actions";

export function GuestBookingForm({
  venueSlug,
  localDate,
  packages,
}: {
  venueSlug: string;
  localDate: string;
  packages: { id: string; name: string }[];
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(createGuestBookingAction, null);
  const entered = state?.values;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="venueSlug" value={venueSlug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state?.error === "conflict" ? (
        <Alert tone="warn">
          <p>{t("booking.conflict")}</p>
          {state.alternatives && state.alternatives.length > 0 ? (
            <p className="mt-2">
              {t("booking.alternatives")}: {state.alternatives.join(", ")}
            </p>
          ) : null}
        </Alert>
      ) : null}
      {state?.error === "rate_limited" ? <Alert>{t("error.rate_limited")}</Alert> : null}
      {state?.error && state.error !== "conflict" && state.error !== "rate_limited" ? (
        <Alert>{t("error.validation")}</Alert>
      ) : null}
      <TextField
        key={entered?.localDate ?? "date"}
        label={t("booking.date")}
        name="localDate"
        type="date"
        defaultValue={entered?.localDate ?? localDate}
        required
      />
      <TextField
        key={entered?.localTime ?? "time"}
        label={t("booking.time")}
        name="localTime"
        type="time"
        defaultValue={entered?.localTime ?? "11:00"}
        required
      />
      <TextField
        key={String(entered?.childrenCount ?? "children")}
        label={t("booking.children")}
        name="childrenCount"
        type="number"
        min={1}
        defaultValue={entered?.childrenCount ?? 6}
        required
      />
      <TextField
        key={String(entered?.adultCount ?? "adults")}
        label={t("booking.adults")}
        name="adultCount"
        type="number"
        min={0}
        defaultValue={entered?.adultCount ?? 2}
        required
      />
      <SelectField label={t("booking.package")} name="packageId" required defaultValue={entered?.packageId ?? packages[0]?.id}>
        {packages.map((pkg) => (
          <option key={pkg.id} value={pkg.id}>
            {pkg.name}
          </option>
        ))}
      </SelectField>
      <TextField key={entered?.organizerName ?? "name"} label={t("booking.name")} name="organizerName" defaultValue={entered?.organizerName} required />
      <TextField
        key={entered?.organizerEmail ?? "email"}
        label={t("booking.email")}
        name="organizerEmail"
        type="email"
        defaultValue={entered?.organizerEmail}
        required
      />
      <TextField
        key={entered?.organizerPhone ?? "phone"}
        label={t("booking.phone")}
        name="organizerPhone"
        defaultValue={entered?.organizerPhone}
        required
      />
      <TextField
        key={entered?.honoreeFirstName ?? "honoree"}
        label={t("booking.honoree")}
        name="honoreeFirstName"
        defaultValue={entered?.honoreeFirstName}
      />
      <label className="grid gap-1 text-sm">
        <span>{t("booking.notes")}</span>
        <textarea name="notes" maxLength={500} className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" />
      </label>
      <p className="text-sm text-muted">{t("guest.noAccount")}</p>
      <Button type="submit" disabled={pending}>
        {t("guest.submit")}
      </Button>
    </form>
  );
}
