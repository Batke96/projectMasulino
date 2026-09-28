import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMinorUnits } from "@masulino/contracts";
import { authorize } from "@masulino/core";
import { t, type MessageKey } from "@masulino/i18n";
import { dailyView, listDeliveries } from "@masulino/reservations";
import { Badge, Button, EmptyState, Shell } from "@masulino/ui";
import { cancelBookingAction, logoutAction } from "../../../../server/actions";
import { retryDeliveryAction } from "../../../../server/mvp-actions";
import { locationBySlug } from "../../../../server/queries";
import { requireActor, requireStaffSession } from "../../../../server/session";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; locationSlug: string }>;
  searchParams: Promise<{ date?: string; created?: string }>;
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
  const canReadBookings = authorize({ ...actor, locationId: location.id }, "reservations.booking.read").allow;
  const canCreate = authorize({ ...actor, locationId: location.id }, "reservations.booking.create").allow;
  const canCancel = authorize({ ...actor, locationId: location.id }, "reservations.booking.cancel").allow;
  const canRetry = authorize({ ...actor, locationId: location.id }, "reservations.booking.update").allow;
  const canReadNotices = authorize({ ...actor, locationId: location.id }, "content.notice.read").allow;
  const canWorkforce =
    authorize({ ...actor, locationId: location.id }, "workforce.schedule.read").allow ||
    authorize({ ...actor, locationId: location.id }, "workforce.availability.read").allow;
  const canChecklist = authorize({ ...actor, locationId: location.id }, "operations.checklist.read").allow;
  if (!canReadBookings) {
    return (
      <Shell
        title={t("shell.work")}
        tenantName={membership.tenant_name}
        locationName={location.name}
        nav={
          <form action={logoutAction}>
            <button className="underline" type="submit">
              {t("shell.logout")}
            </button>
          </form>
        }
      >
        {canWorkforce || canChecklist ? (
          <>
            <h1 className="text-2xl font-semibold">{t("shell.work")}</h1>
            <div className="flex flex-wrap gap-4 text-sm">
              {canWorkforce ? (
                <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/workforce`}>
                  {t("shell.workforce")}
                </Link>
              ) : null}
              {canChecklist ? (
                <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/checklists`}>
                  {t("shell.checklists")}
                </Link>
              ) : null}
            </div>
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
  const rows = await dailyView({ actor, locationId: location.id, localDate });
  const deliveries = await listDeliveries({ actor, locationId: location.id, localDate });
  return (
    <Shell
      title={t("daily.title")}
      tenantName={membership.tenant_name}
      locationName={location.name}
      nav={
        <div className="flex items-center gap-4 text-sm">
          {canCreate ? (
            <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/bookings/new?date=${localDate}`}>
              {t("shell.newBooking")}
            </Link>
          ) : null}
          <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/print?date=${localDate}`}>
            {t("shell.print")}
          </Link>
          {canReadNotices ? (
            <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/notices`}>
              {t("shell.notices")}
            </Link>
          ) : null}
          {canWorkforce ? (
            <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/workforce`}>
              {t("shell.workforce")}
            </Link>
          ) : null}
          {canChecklist ? (
            <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/checklists`}>
              {t("shell.checklists")}
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button className="underline" type="submit">
              {t("shell.logout")}
            </button>
          </form>
        </div>
      }
    >
      <h1 className="text-2xl font-semibold">{t("daily.title")}</h1>
      <form className="flex items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span>{t("daily.date")}</span>
          <input className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" type="date" name="date" defaultValue={localDate} />
        </label>
        <Button type="submit" variant="secondary">
          {t("common.save")}
        </Button>
      </form>
      {query.created ? <p className="text-ok">{t("booking.success")}: {query.created}</p> : null}
      {deliveries.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("delivery.title")}</h2>
          <ul className="grid gap-2">
            {deliveries.map((delivery) => (
              <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-sm">
                <span>
                  {delivery.reference} · {t(deliveryKind(delivery.kind))} · {t(deliveryStatus(delivery.status))}
                </span>
                {canRetry && delivery.status === "failed" ? (
                  <form action={retryDeliveryAction}>
                    <input type="hidden" name="tenantId" value={actor.tenantId} />
                    <input type="hidden" name="deliveryId" value={delivery.id} />
                    <button className="text-danger underline" type="submit">
                      {t("delivery.retry")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {rows.length === 0 ? <EmptyState title={t("daily.empty")} /> : null}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-3 py-2">{t("daily.time")}</th>
              <th className="px-3 py-2">{t("daily.organizer")}</th>
              <th className="px-3 py-2">{t("daily.party")}</th>
              <th className="px-3 py-2">{t("daily.tables")}</th>
              <th className="px-3 py-2">{t("daily.package")}</th>
              <th className="px-3 py-2">{t("daily.status")}</th>
              <th className="px-3 py-2">{t("daily.tasks")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line align-top">
                <td className="px-3 py-3">{row.localTime}</td>
                <td className="px-3 py-3">
                  <div>{row.organizerName}</div>
                  <div className="text-muted">{row.organizerPhone}</div>
                  <div className="text-muted">{row.reference}</div>
                </td>
                <td className="px-3 py-3">
                  {row.childrenCount} / {row.adultCount}
                </td>
                <td className="px-3 py-3">{row.tables.join(", ") || "—"}</td>
                <td className="px-3 py-3">
                  <div>{row.packageName}</div>
                  <div className="text-muted">{formatMinorUnits(row.priceMinor, row.currency)}</div>
                </td>
                <td className="px-3 py-3">
                  <Badge>{t(statusLabel(row.status))}</Badge>
                  {canCancel && (row.status === "confirmed" || row.status === "requested") ? (
                    <form action={cancelBookingAction} className="mt-2">
                      <input type="hidden" name="tenantId" value={actor.tenantId} />
                      <input type="hidden" name="reservationId" value={row.id} />
                      <input type="hidden" name="expectedVersion" value={row.version} />
                      <button className="text-danger underline" type="submit">
                        {t("common.cancelBooking")}
                      </button>
                    </form>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  {row.tasks.filter((task) => task.status === "open").map((task) => task.title).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function deliveryKind(kind: string): MessageKey {
  switch (kind) {
    case "reminder":
      return "delivery.kind.reminder";
    case "cancellation":
      return "delivery.kind.cancellation";
    default:
      return "delivery.kind.confirmation";
  }
}

function deliveryStatus(status: string): MessageKey {
  switch (status) {
    case "previewed":
      return "delivery.previewed";
    case "failed":
      return "delivery.failed";
    case "cancelled":
      return "delivery.cancelled";
    default:
      return "delivery.queued";
  }
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
