import { notFound } from "next/navigation";
import { authorize } from "@masulino/core";
import { t } from "@masulino/i18n";
import { Shell } from "@masulino/ui";
import { locationsFor } from "../../../../server/queries";
import { requireActor, requireStaffSession } from "../../../../server/session";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const staff = await requireStaffSession();
  const membership = staff.memberships.find((item) => item.tenant_slug === tenantSlug);
  if (!membership || membership.status !== "active") notFound();
  const actor = await requireActor(membership.tenant_id);
  if (!authorize(actor, "core.users.invite").allow) {
    return (
      <Shell title={t("invite.title")} tenantName={membership.tenant_name}>
        <h1 className="text-2xl font-semibold">{t("access.title")}</h1>
        <p>{t("access.body")}</p>
      </Shell>
    );
  }
  const locations = await locationsFor(actor);
  return (
    <Shell title={t("shell.team")} tenantName={membership.tenant_name}>
      <h1 className="text-2xl font-semibold">{t("invite.title")}</h1>
      <InviteForm tenantId={actor.tenantId} locations={locations.map((location) => ({ id: location.id, name: location.name }))} />
    </Shell>
  );
}
