"use client";

import { useState } from "react";
import { t } from "@masulino/i18n";
import { Alert, Button, TextField } from "@masulino/ui";
import { authClient } from "../../lib/auth-client";

export function LoginForm() {
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(false);
        const data = new FormData(event.currentTarget);
        const result = await authClient.signIn.email({
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        });
        setPending(false);
        if (result.error) {
          setError(true);
          return;
        }
        window.location.href = "/app";
      }}
    >
      {error ? <Alert>{t("login.error")}</Alert> : null}
      <TextField label={t("login.email")} name="email" type="email" autoComplete="username" required />
      <TextField
        label={t("login.password")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? t("common.loading") : t("login.submit")}
      </Button>
    </form>
  );
}
