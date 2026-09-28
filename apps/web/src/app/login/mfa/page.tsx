"use client";

import { useState } from "react";
import { t } from "@masulino/i18n";
import { Alert, Button, TextField } from "@masulino/ui";
import { authClient } from "../../../lib/auth-client";

export default function MfaPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-semibold">{t("mfa.title")}</h1>
        <p className="mt-2 text-muted">{t("mfa.lead")}</p>
      </div>
      <MfaForm />
    </main>
  );
}

function MfaForm() {
  const [error, setError] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") ?? "");
        const result = await authClient.twoFactor.verifyTotp({ code });
        if (result.error) {
          setError(true);
          return;
        }
        window.location.href = "/app";
      }}
    >
      {error ? <Alert>{t("login.error")}</Alert> : null}
      <TextField label={t("mfa.code")} name="code" inputMode="numeric" autoComplete="one-time-code" required />
      <Button type="submit">{t("mfa.submit")}</Button>
    </form>
  );
}
