import Link from "next/link";
import { t } from "@masulino/i18n";
import { EmptyState, Shell } from "@masulino/ui";
import { logoutAction } from "../../server/actions";
import { requireStaffSession } from "../../server/session";

export const dynamic = "force-dynamic";

export default async function TenantPickerPage() {
  const staff = await requireStaffSession();
  return (
    <Shell
      title={t("app.name")}
      nav={
        <form action={logoutAction}>
          <button className="text-sm underline" type="submit">
            {t("shell.logout")}
          </button>
        </form>
      }
    >
      <h1 className="text-2xl font-semibold">{t("tenant.choose")}</h1>
      {staff.memberships.length === 0 ? <EmptyState title={t("tenant.empty")} /> : null}
      <ul className="grid gap-3">
        {staff.memberships.map((membership) => (
          <li key={membership.tenant_id} className="rounded-[var(--radius)] border border-line bg-surface p-4">
            {membership.status === "active" ? (
              <Link className="font-medium underline" href={`/app/${membership.tenant_slug}`}>
                {membership.tenant_name}
              </Link>
            ) : (
              <p>
                {membership.tenant_name} — {t("tenant.revoked")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
