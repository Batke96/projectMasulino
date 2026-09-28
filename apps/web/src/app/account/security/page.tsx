"use client";

import { useState } from "react";
import { t } from "@masulino/i18n";
import { Alert, Button, TextField } from "@masulino/ui";
import { authClient } from "../../../lib/auth-client";

export default function SecurityPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-semibold">{t("mfa.enroll.title")}</h1>
        <p className="mt-2 text-muted">{t("mfa.enroll.lead")}</p>
      </div>
      {done ? <Alert tone="ok">{t("booking.success")}</Alert> : null}
      {error ? <Alert>{t("login.error")}</Alert> : null}
      {!secret ? (
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const password = String(new FormData(event.currentTarget).get("password") ?? "");
            const result = await authClient.twoFactor.enable({ password, method: "totp" });
            if (result.error || !result.data || !("totpURI" in result.data)) {
              setError(true);
              return;
            }
            setSecret(result.data.totpURI);
          }}
        >
          <TextField label={t("login.password")} name="password" type="password" required />
          <Button type="submit">{t("mfa.enroll.title")}</Button>
        </form>
      ) : (
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
            setDone(true);
            window.location.href = "/app";
          }}
        >
          <p className="break-all text-sm">
            {t("mfa.secret")}: {secret}
          </p>
          <TextField label={t("mfa.code")} name="code" inputMode="numeric" required />
          <Button type="submit">{t("mfa.submit")}</Button>
        </form>
      )}
    </main>
  );
}
