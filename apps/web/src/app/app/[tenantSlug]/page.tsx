import Link from "next/link";
import { notFound } from "next/navigation";
import { t } from "@masulino/i18n";
import { EmptyState, Shell } from "@masulino/ui";
import { logoutAction } from "../../../server/actions";
import { locationsFor } from "../../../server/queries";
import { requireActor, requireStaffSession } from "../../../server/session";

export const dynamic = "force-dynamic";

export default async function TenantHome({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const staff = await requireStaffSession();
  const membership = staff.memberships.find((item) => item.tenant_slug === tenantSlug);
  if (!membership || membership.status !== "active") notFound();
  const actor = await requireActor(membership.tenant_id);
  const locations = await locationsFor(actor);
  return (
    <Shell
      title={t("app.name")}
      tenantName={membership.tenant_name}
      nav={
        <form action={logoutAction}>
          <button className="text-sm underline" type="submit">
            {t("shell.logout")}
          </button>
        </form>
      }
    >
      <h1 className="text-2xl font-semibold">{t("shell.home")}</h1>
      <p className="text-muted">{t("home.lead")}</p>
      {locations.length === 0 ? <EmptyState title={t("home.noLocations")} /> : null}
      <ul className="grid gap-3">
        {locations.map((location) => (
          <li key={location.id}>
            <Link className="font-medium underline" href={`/app/${tenantSlug}/${location.slug}`}>
              {location.name}
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
