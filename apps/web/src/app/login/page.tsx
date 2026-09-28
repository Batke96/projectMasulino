import { t } from "@masulino/i18n";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-6 px-4">
      <div>
        <p className="text-sm text-muted">{t("app.name")}</p>
        <h1 className="text-3xl font-semibold">{t("login.title")}</h1>
        <p className="mt-2 text-muted">{t("login.lead")}</p>
      </div>
      <LoginForm />
    </main>
  );
}
