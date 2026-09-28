import Link from "next/link";
import { t } from "@masulino/i18n";
import { Alert } from "@masulino/ui";

export const dynamic = "force-dynamic";

export default async function BookingDonePage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; token?: string; replayed?: string }>;
}) {
  const query = await searchParams;
  const reference = query.reference ?? "";
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("guest.saved")}</h1>
      {query.replayed ? <Alert tone="warn">{t("guest.replayed")}</Alert> : null}
      {reference ? (
        <p>
          {t("booking.reference")}: {reference}
        </p>
      ) : null}
      {query.token ? (
        <p>
          <Link className="underline" href={`/book/open?token=${encodeURIComponent(query.token)}`}>
            {t("guest.openLink")}
          </Link>
        </p>
      ) : null}
    </>
  );
}
