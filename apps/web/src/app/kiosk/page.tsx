import { cookies } from "next/headers";
import { t } from "@masulino/i18n";
import { kioskDeviceReady } from "@masulino/workforce";
import { BindKioskForm, KioskPunchForm } from "./kiosk-forms";

export const dynamic = "force-dynamic";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const query = await searchParams;
  const token = (await cookies()).get("masulino_kiosk_device")?.value;
  const ready = token ? await kioskDeviceReady(token) : false;
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-6 px-4">
      <div>
        <p className="text-sm text-muted">{t("kiosk.title")}</p>
        <h1 className="text-3xl font-semibold">{t("kiosk.locked")}</h1>
        <p className="mt-2 text-muted">{t("kiosk.lead")}</p>
      </div>
      {ready ? <KioskPunchForm /> : <BindKioskForm invalid={query.invalid === "1"} />}
    </main>
  );
}
