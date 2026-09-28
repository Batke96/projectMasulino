import Link from "next/link";
import { notFound } from "next/navigation";
import { authorize } from "@masulino/core";
import { t, type MessageKey } from "@masulino/i18n";
import { Shell } from "@masulino/ui";
import {
  listLeave,
  listLocationAvailability,
  listPunches,
  readAvailability,
  readWeek,
  defaultPlanMonday,
} from "@masulino/workforce";
import { logoutAction } from "../../../../../server/actions";
import { locationRecord } from "../../../../../server/queries";
import { clockAction, correctionAction } from "../../../../../server/workforce-actions";
import { requireActor, requireStaffSession } from "../../../../../server/session";
import { AvailabilityForm, CapabilityForm, LeaveForm } from "./forms";

export const dynamic = "force-dynamic";

function weekdayLabel(day: number): MessageKey {
  switch (day) {
    case 1:
      return "weekday.mon";
    case 2:
      return "weekday.tue";
    case 3:
      return "weekday.wed";
    case 4:
      return "weekday.thu";
    case 5:
      return "weekday.fri";
    case 6:
      return "weekday.sat";
    default:
      return "weekday.sun";
  }
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function punchLabel(kind: string, punchedAt: string, timeZone: string): string {
  const when = new Intl.DateTimeFormat("de-DE", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(punchedAt));
  return `${kind === "in" ? t("workforce.clockIn") : t("workforce.clockOut")} · ${when}`;
}

export default async function WorkforcePage({
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
  const scoped = { ...actor, locationId: location.id };
  const canRead =
    authorize(scoped, "workforce.availability.read").allow ||
    authorize(scoped, "workforce.schedule.read").allow ||
    authorize(scoped, "workforce.time.read").allow;
  if (!canRead) {
    return (
      <Shell title={t("shell.workforce")} tenantName={membership.tenant_name} locationName={location.name}>
        <h1 className="text-2xl font-semibold">{t("access.title")}</h1>
        <p>{t("access.body")}</p>
      </Shell>
    );
  }
  const canWrite = authorize(scoped, "workforce.availability.write").allow;
  const canRecord = authorize(scoped, "workforce.time.record").allow;
  const canTime = authorize(scoped, "workforce.time.read").allow;
  const week = defaultPlanMonday(location.timezone);
  const plan = authorize(scoped, "workforce.schedule.read").allow
    ? await readWeek({ actor, locationId: location.id, weekStartsOn: week })
    : null;
  const ownAvailability = canWrite ? await readAvailability(actor, location.id) : null;
  const locationAvailability = authorize(scoped, "workforce.availability.read").allow && !canWrite
    ? await listLocationAvailability(actor, location.id).catch(() => [])
    : [];
  const leave = canWrite ? await listLeave(actor, location.id) : [];
  const punches = canTime ? await listPunches(actor, location.id) : [];
  return (
    <Shell
      title={t("shell.workforce")}
      tenantName={membership.tenant_name}
      locationName={location.name}
      nav={
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/workforce/plan`}>
            {t("shell.plan")}
          </Link>
          <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/checklists`}>
            {t("shell.checklists")}
          </Link>
          <form action={logoutAction}>
            <button className="underline" type="submit">
              {t("shell.logout")}
            </button>
          </form>
        </div>
      }
    >
      <h1 className="text-2xl font-semibold">{t("shell.workforce")}</h1>
      {canWrite ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t("workforce.availability")}</h2>
          {ownAvailability ? (
            <p className="text-sm text-muted">
              {t("workforce.version")} {ownAvailability.version}:{" "}
              {ownAvailability.windows
                .map((window) => `${t(weekdayLabel(window.weekday))} ${clock(window.startMinute)}–${clock(window.endMinute)}`)
                .join(", ")}
            </p>
          ) : null}
          <AvailabilityForm tenantId={actor.tenantId} locationId={location.id} />
        </section>
      ) : null}
      {locationAvailability.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("workforce.availability")}</h2>
          <ul className="grid gap-1 text-sm">
            {locationAvailability.map((item) => (
              <li key={item.principalId}>
                {item.displayName ?? item.principalId}:{" "}
                {item.windows.map((window) => `${t(weekdayLabel(window.weekday))} ${clock(window.startMinute)}–${clock(window.endMinute)}`).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canWrite ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t("workforce.leave")}</h2>
          <LeaveForm tenantId={actor.tenantId} locationId={location.id} />
          <ul className="grid gap-1 text-sm">
            {leave.map((item) => (
              <li key={item.id}>
                {item.startsOn}–{item.endsOn} · {item.status === "recorded" ? t("workforce.recorded") : t("workforce.requested")} · {item.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {plan ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("plan.published")}</h2>
          {plan.published ? (
            <ul className="grid gap-1 text-sm">
              {plan.published.shifts.map((shift) => (
                <li key={shift.id}>
                  {t("plan.shift")}: {shift.localDate} {clock(shift.startMinute)}–{clock(shift.endMinute)}
                  {shift.displayName ? ` · ${shift.displayName}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("plan.empty")}</p>
          )}
        </section>
      ) : null}
      {canRecord ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t("workforce.clockIn")}</h2>
          <form action={clockAction} className="flex flex-wrap gap-3">
            <input type="hidden" name="tenantId" value={actor.tenantId} />
            <input type="hidden" name="locationId" value={location.id} />
            <button className="rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-semibold text-accent-ink" name="kind" type="submit" value="in">
              {t("workforce.clockIn")}
            </button>
            <button className="rounded-[var(--radius)] border border-line bg-surface px-4 py-2 text-sm font-semibold" name="kind" type="submit" value="out">
              {t("workforce.clockOut")}
            </button>
          </form>
          <ul className="grid gap-3">
            {punches.map((punch) => {
              const label = punchLabel(punch.kind, punch.punchedAt, location.timezone);
              return (
                <li key={punch.id} className="grid gap-2 rounded-[var(--radius)] border border-line bg-surface px-3 py-3 text-sm">
                  <p data-testid="punch-line">{label}</p>
                  {punch.corrections.length > 0 ? (
                    <p className="text-muted">{t("workforce.correction")}</p>
                  ) : null}
                  <form action={correctionAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <input type="hidden" name="tenantId" value={actor.tenantId} />
                    <input type="hidden" name="punchId" value={punch.id} />
                    <input type="hidden" name="localDate" value={punch.localDate} />
                    <label className="grid gap-1">
                      <span>{t("workforce.correctionTime")}</span>
                      <input className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="localTime" type="time" required />
                    </label>
                    <label className="grid gap-1">
                      <span>{t("workforce.reason")}</span>
                      <input className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="reason" required maxLength={500} />
                    </label>
                    <button className="underline" type="submit">
                      {t("workforce.correction")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <CapabilityForm tenantId={actor.tenantId} locationId={location.id} />
        </section>
      ) : null}
    </Shell>
  );
}
