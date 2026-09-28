"use client";

import { useActionState } from "react";
import { formatMinorUnits } from "@masulino/contracts";
import { t } from "@masulino/i18n";
import { Alert, Button, TextField } from "@masulino/ui";
import { guestPatchAction, guestStaffRequestAction } from "../../../server/guest-actions";
import type { GuestReservationView } from "@masulino/reservations";

export function ManageBooking({ booking }: { booking: GuestReservationView }) {
  const [patchState, patchAction, patchPending] = useActionState(guestPatchAction, null);
  const [requestState, requestAction, requestPending] = useActionState(guestStaffRequestAction, null);
  const version = patchState?.ok ? booking.version + 1 : booking.version;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("guest.manageTitle")}</h1>
        <p className="mt-2">
          {t("booking.reference")}: {booking.reference}
        </p>
        <p>
          {booking.localDate} · {booking.localTime}
        </p>
        <p>
          {booking.organizerName} · {booking.childrenCount} / {booking.adultCount}
        </p>
        <p>{booking.packageName}</p>
        <p className="text-sm text-muted">
          {t("price.fixture")}: {formatMinorUnits(booking.priceMinor, booking.currency)}
        </p>
        <p className="text-sm text-muted">{booking.organizerEmail}</p>
      </div>
      <p className="text-sm">{t("guest.staffOnly")}</p>
      {patchState?.ok ? <Alert tone="ok">{t("guest.updated")}</Alert> : null}
      {patchState?.error === "stale" ? <Alert>{t("error.stale")}</Alert> : null}
      {patchState?.error && patchState.error !== "stale" ? <Alert>{t("error.validation")}</Alert> : null}
      <form action={patchAction} className="grid gap-4">
        <input type="hidden" name="expectedVersion" value={version} />
        <TextField label={t("booking.phone")} name="organizerPhone" defaultValue={booking.organizerPhone} required />
        <label className="grid gap-1 text-sm">
          <span>{t("booking.notes")}</span>
          <textarea
            name="notes"
            maxLength={500}
            defaultValue={booking.notes}
            className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2"
          />
        </label>
        <Button type="submit" disabled={patchPending}>
          {t("guest.saveNarrow")}
        </Button>
      </form>
      {requestState?.routed ? <Alert tone="ok">{t("guest.routed")}</Alert> : null}
      <form action={requestAction} className="grid gap-3">
        <input type="hidden" name="expectedVersion" value={version} />
        <label className="grid gap-1 text-sm">
          <span>{t("guest.changeRequest")}</span>
          <textarea name="message" maxLength={500} className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="kind" value="change" variant="secondary" disabled={requestPending}>
            {t("guest.changeRequest")}
          </Button>
          <Button type="submit" name="kind" value="cancel" variant="danger" disabled={requestPending}>
            {t("guest.cancelRequest")}
          </Button>
        </div>
      </form>
    </div>
  );
}
