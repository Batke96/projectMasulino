import { notFound } from "next/navigation";
import { authorize } from "@masulino/core";
import { t } from "@masulino/i18n";
import { Shell } from "@masulino/ui";
import { locationRecord, packagesFor } from "../../../../../../server/queries";
import { requireActor, requireStaffSession } from "../../../../../../server/session";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; locationSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { tenantSlug, locationSlug } = await params;
  const query = await searchParams;
  const staff = await requireStaffSession();
  const membership = staff.memberships.find((item) => item.tenant_slug === tenantSlug);
  if (!membership || membership.status !== "active") notFound();
  const actor = await requireActor(membership.tenant_id);
  const location = await locationRecord(actor, locationSlug);
  if (!location) notFound();
  if (!authorize({ ...actor, locationId: location.id }, "reservations.booking.create").allow) {
    return (
      <Shell title={t("booking.title")} tenantName={membership.tenant_name}>
        <h1 className="text-2xl font-semibold">{t("access.title")}</h1>
        <p>{t("access.body")}</p>
      </Shell>
    );
  }
  const packages = await packagesFor(actor, location.id);
  const localDate =
    query.date ?? new Date().toLocaleDateString("en-CA", { timeZone: location.timezone });
  return (
    <Shell title={t("booking.title")} tenantName={membership.tenant_name} locationName={location.name}>
      <h1 className="text-2xl font-semibold">{t("booking.title")}</h1>
      <p className="text-sm text-muted">{t("price.fixture")}</p>
      <BookingForm
        tenantId={actor.tenantId}
        locationId={location.id}
        localDate={localDate}
        packages={packages.map((pkg) => ({ id: pkg.id, name: pkg.name }))}
      />
    </Shell>
  );
}
