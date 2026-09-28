import type { ReactNode } from "react";
import { t } from "@masulino/i18n";

export const metadata = {
  title: "Buchung",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicBookingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-warn-bg">
      <header className="bg-ink text-surface">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-4">
          <p className="text-xs uppercase tracking-wide">{t("guest.kicker")}</p>
          <p className="text-lg font-semibold">{t("guest.lead")}</p>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
