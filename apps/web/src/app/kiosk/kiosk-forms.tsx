"use client";

import { useActionState } from "react";
import { t } from "@masulino/i18n";
import { Button, TextField } from "@masulino/ui";
import { bindKioskAction, kioskPunchAction } from "../../server/workforce-actions";

export function BindKioskForm() {
  const [state, action, pending] = useActionState(bindKioskAction, null);
  return (
    <form action={action} className="grid gap-3">
      <TextField label={t("kiosk.device")} name="token" required autoComplete="off" />
      {state?.error ? <p className="text-sm text-danger">{t("kiosk.invalid")}</p> : null}
      <Button type="submit" disabled={pending}>
        {t("kiosk.bind")}
      </Button>
    </form>
  );
}

export function KioskPunchForm() {
  const [state, action, pending] = useActionState(kioskPunchAction, null);
  return (
    <form action={action} className="grid gap-3">
      {state?.ok ? <p className="text-ok">{t("kiosk.saved")}</p> : null}
      {state?.error ? <p className="text-sm text-danger">{t("kiosk.invalid")}</p> : null}
      <TextField label={t("kiosk.code")} name="capability" required autoComplete="off" />
      <Button type="submit" disabled={pending}>
        {t("kiosk.punch")}
      </Button>
    </form>
  );
}
