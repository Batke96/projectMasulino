import { t } from "@masulino/i18n";
import { previewBookingLink } from "@masulino/reservations";
import { Alert, Button } from "@masulino/ui";
import { exchangeLinkAction } from "../../../server/guest-actions";

export const dynamic = "force-dynamic";

export default async function OpenBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; invalid?: string }>;
}) {
  const query = await searchParams;
  const token = query.token ?? "";
  const ready = token ? (await previewBookingLink(token)) === "ready" : false;
  if (!ready || query.invalid) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{t("guest.manageTitle")}</h1>
        <Alert>{t("guest.invalid")}</Alert>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("guest.manageTitle")}</h1>
      <p>{t("guest.previewNote")}</p>
      <form action={exchangeLinkAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit">{t("guest.openAction")}</Button>
      </form>
    </>
  );
}
