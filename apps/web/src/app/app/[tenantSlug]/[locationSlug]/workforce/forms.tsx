"use client";

import { useActionState } from "react";
import { t } from "@masulino/i18n";
import { Button, SelectField, TextField } from "@masulino/ui";
import {
  capabilityAction,
  enrollKioskAction,
  recordLeaveAction,
  saveAvailabilityAction,
} from "../../../../../server/workforce-actions";

export function AvailabilityForm({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(saveAvailabilityAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="locationId" value={locationId} />
      <SelectField label={t("workforce.weekday")} name="weekday" defaultValue="1">
        <option value="1">{t("weekday.mon")}</option>
        <option value="2">{t("weekday.tue")}</option>
        <option value="3">{t("weekday.wed")}</option>
        <option value="4">{t("weekday.thu")}</option>
        <option value="5">{t("weekday.fri")}</option>
        <option value="6">{t("weekday.sat")}</option>
        <option value="0">{t("weekday.sun")}</option>
      </SelectField>
      <TextField label={t("workforce.start")} name="start" type="time" required defaultValue="09:00" />
      <TextField label={t("workforce.end")} name="end" type="time" required defaultValue="17:00" />
      <p className="text-sm text-muted">{t("workforce.history")}</p>
      {state?.error ? <p className="text-sm text-danger">{t("error.validation")}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{t("workforce.saved")}</p> : null}
      <Button type="submit" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function LeaveForm({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(recordLeaveAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="locationId" value={locationId} />
      <TextField label={t("workforce.leaveStart")} name="startsOn" type="date" required />
      <TextField label={t("workforce.leaveEnd")} name="endsOn" type="date" required />
      <SelectField label={t("workforce.leaveStatus")} name="status" defaultValue="requested">
        <option value="requested">{t("workforce.requested")}</option>
        <option value="recorded">{t("workforce.recorded")}</option>
      </SelectField>
      <TextField label={t("workforce.reason")} name="reason" required maxLength={500} />
      {state?.error ? <p className="text-sm text-danger">{t("error.validation")}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{t("workforce.saved")}</p> : null}
      <Button type="submit" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function CapabilityForm({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(capabilityAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="kind" value="in" />
      <p className="text-sm text-muted">{t("workforce.capabilityHelp")}</p>
      {state?.token ? (
        <p className="break-all rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-sm" data-testid="punch-capability">
          {state.token}
        </p>
      ) : null}
      {state?.error ? <p className="text-sm text-danger">{t("error.forbidden")}</p> : null}
      <Button type="submit" disabled={pending}>
        {t("workforce.capability")}
      </Button>
    </form>
  );
}

export function EnrollKioskForm({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(enrollKioskAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="locationId" value={locationId} />
      <p className="text-sm text-muted">{t("kiosk.lead")}</p>
      {state?.token ? (
        <p className="break-all rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-sm" data-testid="kiosk-token">
          {state.token}
        </p>
      ) : null}
      {state?.error ? <p className="text-sm text-danger">{t("error.forbidden")}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("kiosk.bind")}
      </Button>
    </form>
  );
}
