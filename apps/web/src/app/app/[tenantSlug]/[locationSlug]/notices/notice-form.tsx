"use client";

import { useActionState } from "react";
import { t } from "@masulino/i18n";
import { Button, TextField } from "@masulino/ui";
import { createNoticeAction } from "../../../../../server/mvp-actions";

export function NoticeForm({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(createNoticeAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="locationId" value={locationId} />
      <TextField label={t("notice.heading")} name="title" required />
      <TextField label={t("notice.start")} name="startsOn" type="date" required />
      <TextField label={t("notice.end")} name="endsOn" type="date" required />
      <label className="grid gap-1 text-sm">
        <span>{t("notice.body")}</span>
        <textarea name="body" required maxLength={2000} className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" />
      </label>
      {state?.error ? <p className="text-sm text-danger">{t("error.validation")}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{t("notice.draft")}</p> : null}
      <Button type="submit" disabled={pending}>
        {t("notice.create")}
      </Button>
    </form>
  );
}
