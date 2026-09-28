import Link from "next/link";
import { notFound } from "next/navigation";
import { authorize } from "@masulino/core";
import { t, type MessageKey } from "@masulino/i18n";
import { Shell } from "@masulino/ui";
import { defaultPlanMonday, readWeek, type PlanWarning } from "@masulino/workforce";
import { logoutAction } from "../../../../../../server/actions";
import { locationRecord } from "../../../../../../server/queries";
import { proposePlanAction, publishPlanAction } from "../../../../../../server/workforce-actions";
import { requireActor, requireStaffSession } from "../../../../../../server/session";
import { EnrollKioskForm } from "../forms";

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

function warningText(warning: PlanWarning): string {
  if (warning.code === "coverage_gap") return t("plan.coverage");
  if (warning.code === "overlap") return t("plan.overlap");
  return t("plan.break");
}

export default async function PlanPage({
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
  if (!authorize(scoped, "workforce.schedule.read").allow) {
    return (
      <Shell title={t("plan.title")} tenantName={membership.tenant_name} locationName={location.name}>
        <h1 className="text-2xl font-semibold">{t("access.title")}</h1>
        <p>{t("access.body")}</p>
      </Shell>
    );
  }
  const weekStartsOn = defaultPlanMonday(location.timezone);
  const week = await readWeek({ actor, locationId: location.id, weekStartsOn });
  const canPropose = authorize(scoped, "workforce.schedule.propose").allow;
  const canPublish = authorize(scoped, "workforce.schedule.publish").allow;
  const canEnroll = authorize(scoped, "workforce.time.approve").allow;
  return (
    <Shell
      title={t("plan.title")}
      tenantName={membership.tenant_name}
      locationName={location.name}
      nav={
        <div className="flex gap-4 text-sm">
          <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}/workforce`}>
            {t("shell.workforce")}
          </Link>
          <form action={logoutAction}>
            <button className="underline" type="submit">
              {t("shell.logout")}
            </button>
          </form>
        </div>
      }
    >
      <h1 className="text-2xl font-semibold">{t("plan.title")}</h1>
      <p className="text-sm text-muted">
        {t("plan.ready")}: {t(weekdayLabel(week.publicationWeekday))} · {weekStartsOn}
      </p>
      <p className="text-sm text-muted">{t("plan.fixture")}</p>
      {canPropose ? (
        <form action={proposePlanAction}>
          <input type="hidden" name="tenantId" value={actor.tenantId} />
          <input type="hidden" name="locationId" value={location.id} />
          <input type="hidden" name="weekStartsOn" value={weekStartsOn} />
          <button className="rounded-[var(--radius)] border border-line bg-surface px-4 py-2 text-sm font-semibold" type="submit">
            {t("plan.propose")}
          </button>
        </form>
      ) : null}
      {week.draft ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("plan.draft")}</h2>
          <ul className="grid gap-1 text-sm">
            {week.draft.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warningText(warning)}</li>
            ))}
            {week.draft.shifts.map((shift) => (
              <li key={shift.id}>
                {shift.displayName ?? shift.principalId}: {shift.localDate} {clock(shift.startMinute)}–{clock(shift.endMinute)}
              </li>
            ))}
          </ul>
          {canPublish ? (
            <form action={publishPlanAction}>
              <input type="hidden" name="tenantId" value={actor.tenantId} />
              <input type="hidden" name="planId" value={week.draft.id} />
              <button className="rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-semibold text-accent-ink" type="submit">
                {t("plan.publish")}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("plan.published")}</h2>
        {week.published ? (
          <ul className="grid gap-1 text-sm">
            {week.published.shifts.map((shift) => (
              <li key={shift.id}>
                {shift.displayName ?? shift.principalId}: {shift.localDate} {clock(shift.startMinute)}–{clock(shift.endMinute)}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("plan.empty")}</p>
        )}
      </section>
      {canEnroll ? <EnrollKioskForm tenantId={actor.tenantId} locationId={location.id} /> : null}
    </Shell>
  );
}
