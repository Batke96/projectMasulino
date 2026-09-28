import { notFound } from "next/navigation";
import { authorize } from "@masulino/core";
import { t } from "@masulino/i18n";
import { Shell } from "@masulino/ui";
import { locationRecord } from "../../../../../../server/queries";
import { requireActor, requireStaffSession } from "../../../../../../server/session";

export const dynamic = "force-dynamic";

export default async function CompensationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; locationSlug: string }>;
}) {
  const { tenantSlug, locationSlug } = await params;
  const staff = await requireStaffSession();
  const membership = staff.memberships.find((item) => item.tenant_slug === tenantSlug);
  if (!membership || membership.status !== "active") notFound();
  const actor = await requireActor(membership.tenant_id);
  const location = await locationRecord(actor, locationSlug);
  if (!location) notFound();
  const allowed = authorize({ ...actor, locationId: location.id }, "workforce.compensation.read").allow;
  return (
    <Shell title={t("compensation.title")} tenantName={membership.tenant_name} locationName={location.name}>
      {allowed ? (
        <>
          <h1 className="text-2xl font-semibold">{t("compensation.title")}</h1>
          <p>{t("compensation.estimate")}</p>
          <p>{t("compensation.none")}</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{t("access.title")}</h1>
          <p>{t("access.body")}</p>
        </>
      )}
    </Shell>
  );
}
