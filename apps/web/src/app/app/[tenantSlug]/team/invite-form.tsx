"use client";

import { useActionState } from "react";
import { t } from "@masulino/i18n";
import { Alert, Button, SelectField, TextField } from "@masulino/ui";
import { inviteAction } from "../../../../server/actions";

export function InviteForm({
  tenantId,
  locations,
}: {
  tenantId: string;
  locations: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(inviteAction, null);
  return (
    <form action={action} className="grid max-w-lg gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      {state?.error ? <Alert>{t("error.forbidden")}</Alert> : null}
      {state?.path ? (
        <Alert tone="ok">
          {t("invite.preview")} {state.path}
        </Alert>
      ) : null}
      <TextField label={t("login.email")} name="email" type="email" required />
      <SelectField label="Rolle" name="roleKey" defaultValue="reception">
        <option value="reception">Empfang</option>
        <option value="shift_lead">Schichtleitung</option>
        <option value="employee">Mitarbeiter</option>
        <option value="location_manager">Standortleitung</option>
      </SelectField>
      <SelectField label="Standort" name="locationId" defaultValue={locations[0]?.id}>
        <option value="">Gesamter Betrieb</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </SelectField>
      <Button type="submit" disabled={pending}>
        {t("invite.submit")}
      </Button>
    </form>
  );
}
