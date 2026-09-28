import { t } from "@masulino/i18n";

export default function AccessDeniedPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg content-center gap-3 px-4">
      <h1 className="text-3xl font-semibold">{t("access.title")}</h1>
      <p className="text-muted">{t("access.body")}</p>
    </main>
  );
}
