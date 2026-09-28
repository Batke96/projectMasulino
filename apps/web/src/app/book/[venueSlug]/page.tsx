import { notFound } from "next/navigation";
import { formatMinorUnits } from "@masulino/contracts";
import { t } from "@masulino/i18n";
import { allocate } from "@masulino/indoor-play";
import { listPublicNotices } from "@masulino/notices";
import { publicAvailability, publicPackages, resolvePublishedVenue } from "@masulino/reservations";
import { Alert, Badge } from "@masulino/ui";
import { GuestBookingForm } from "./guest-form";

export const dynamic = "force-dynamic";

export default async function PublicVenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ date?: string; children?: string; adults?: string; package?: string }>;
}) {
  const { venueSlug } = await params;
  const query = await searchParams;
  const venue = await resolvePublishedVenue(venueSlug);
  if (!venue) notFound();
  const packages = await publicPackages(venueSlug);
  const selected = packages.find((pkg) => pkg.id === query.package) ?? packages[0];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: venue.timezone });
  const localDate = query.date ?? shiftIsoDate(today, 14);
  const childrenCount = Number(query.children ?? 6);
  const adultCount = Number(query.adults ?? 2);
  const notices = await listPublicNotices(venue.tenantId, venue.locationId, today);
  const availability =
    selected && Number.isInteger(childrenCount) && Number.isInteger(adultCount)
      ? await publicAvailability({
          slug: venueSlug,
          localDate,
          childrenCount,
          adultCount,
          packageId: selected.id,
          allocate,
        }).catch(() => null)
      : null;
  return (
    <>
      <div>
        <p className="text-sm text-muted">{venue.tenantName}</p>
        <h1 className="text-2xl font-semibold">
          {t("guest.title")} · {venue.locationName}
        </h1>
      </div>
      {notices.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t("notice.title")}</h2>
          {notices.map((notice) => (
            <article key={notice.id} className="rounded-[var(--radius)] border border-line bg-surface p-4">
              <h3 className="font-semibold">{notice.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{notice.body}</p>
            </article>
          ))}
        </section>
      ) : null}
      <Alert tone="warn">{t("guest.advisory")}</Alert>
      {selected ? (
        <p className="text-sm text-muted">
          {t("price.fixture")}: {formatMinorUnits(selected.priceMinor, selected.currency)}
        </p>
      ) : null}
      {availability ? (
        <section className="grid gap-2">
          <h2 className="font-semibold">{t("guest.slots")}</h2>
          {availability.closed ? <p>{t("guest.closed")}</p> : null}
          <ul className="flex flex-wrap gap-2">
            {availability.slots.map((slot) => (
              <li key={slot.localTime}>
                <Badge>
                  {slot.localTime} · {slot.available ? t("guest.available") : t("guest.unavailable")}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {packages.length === 0 || !selected ? (
        <p>{t("guest.closed")}</p>
      ) : (
        <GuestBookingForm venueSlug={venue.publicSlug} localDate={localDate} packages={packages} />
      )}
    </>
  );
}

function shiftIsoDate(isoDate: string, days: number): string {
  const parts = isoDate.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return isoDate;
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}
