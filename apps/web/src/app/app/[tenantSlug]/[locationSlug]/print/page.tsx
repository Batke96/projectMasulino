import Link from "next/link";
import { notFound } from "next/navigation";
import { t, type MessageKey } from "@masulino/i18n";
import { readPreparationSheet } from "@masulino/reservations";
import { Badge, Button, EmptyState, Shell } from "@masulino/ui";
import { generateSheetAction } from "../../../../../server/mvp-actions";
import { logoutAction } from "../../../../../server/actions";
import { locationBySlug } from "../../../../../server/queries";
import { requireActor, requireStaffSession } from "../../../../../server/session";

export const dynamic = "force-dynamic";

export default async function PrintPage({
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
  const location = await locationBySlug(actor, locationSlug);
  if (!location) notFound();
  const localDate = query.date ?? new Date().toLocaleDateString("en-CA", { timeZone: location.timezone });
  const sheet = await readPreparationSheet({ actor, locationId: location.id, localDate });
  return (
    <Shell
      title={t("print.title")}
      tenantName={membership.tenant_name}
      locationName={location.name}
      nav={
        <div className="flex items-center gap-4 text-sm print:hidden">
          <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}?date=${localDate}`}>
            {t("shell.daily")}
          </Link>
          <form action={logoutAction}>
            <button className="underline" type="submit">
              {t("shell.logout")}
            </button>
          </form>
        </div>
      }
    >
      <h1 className="text-2xl font-semibold">{t("print.title")}</h1>
      <form action={generateSheetAction} className="print:hidden">
        <input type="hidden" name="tenantId" value={actor.tenantId} />
        <input type="hidden" name="locationId" value={location.id} />
        <input type="hidden" name="localDate" value={localDate} />
        <Button type="submit" variant="secondary">
          {sheet ? t("print.refresh") : t("print.generate")}
        </Button>
      </form>
      {!sheet ? <EmptyState title={t("print.empty")} /> : null}
      {sheet ? (
        <section className="grid gap-4">
          <p>
            {t("print.generated")}: {sheet.generatedAt}
          </p>
          {sheet.stale ? <p className="text-warn">{t("print.stale")}</p> : null}
          {sheet.lines.length === 0 ? <EmptyState title={t("daily.empty")} /> : null}
          <div className="grid gap-3">
            {sheet.lines.map((line) => (
              <article key={line.id} className="rounded-[var(--radius)] border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {line.localTime} · {line.organizerName}
                  </h2>
                  <Badge>{t(statusLabel(line.status))}</Badge>
                </div>
                <p className="mt-2 text-sm">
                  {line.reference} · {t("print.version")} {line.version}
                </p>
                <p className="text-sm">
                  {t("daily.party")}: {line.childrenCount} / {line.adultCount}
                </p>
                <p className="text-sm">
                  {t("daily.tables")}: {line.tables.join(", ") || "—"}
                </p>
                <p className="text-sm">
                  {t("daily.package")}: {line.packageName}
                </p>
                <p className="text-sm">
                  {t("booking.phone")}: {line.organizerPhone}
                </p>
                <p className="text-sm">
                  {t("daily.tasks")}: {line.tasks.join(", ") || "—"}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </Shell>
  );
}

function statusLabel(status: string): MessageKey {
  switch (status) {
    case "requested":
      return "status.requested";
    case "confirmed":
      return "status.confirmed";
    case "completed":
      return "status.completed";
    case "cancelled":
      return "status.cancelled";
    case "no_show":
      return "status.no_show";
    default:
      return "status.draft";
  }
}
