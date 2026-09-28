import Link from "next/link";
import { notFound } from "next/navigation";
import { authorize } from "@masulino/core";
import { t, type MessageKey } from "@masulino/i18n";
import { Shell } from "@masulino/ui";
import { listChecklists, listIssues } from "@masulino/operations";
import { logoutAction } from "../../../../../server/actions";
import { locationRecord, peopleAt } from "../../../../../server/queries";
import {
  assignChecklistAction,
  completeChecklistAction,
  openIssueAction,
  resolveIssueAction,
} from "../../../../../server/workforce-actions";
import { requireActor, requireStaffSession } from "../../../../../server/session";

export const dynamic = "force-dynamic";

function kindLabel(kind: string): MessageKey {
  if (kind === "cleaning") return "checklist.kind.cleaning";
  if (kind === "maintenance") return "checklist.kind.maintenance";
  return "checklist.kind.closing";
}

export default async function ChecklistsPage({
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
  if (!authorize(scoped, "operations.checklist.read").allow) {
    return (
      <Shell title={t("checklist.title")} tenantName={membership.tenant_name} locationName={location.name}>
        <h1 className="text-2xl font-semibold">{t("access.title")}</h1>
        <p>{t("access.body")}</p>
      </Shell>
    );
  }
  const lists = await listChecklists(actor, location.id);
  const issues = await listIssues(actor, location.id);
  const canManage = authorize(scoped, "operations.checklist.manage").allow;
  const canComplete = authorize(scoped, "operations.checklist.complete").allow;
  const people = canManage ? await peopleAt(actor, location.id) : [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: location.timezone });
  return (
    <Shell
      title={t("checklist.title")}
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
      <h1 className="text-2xl font-semibold">{t("checklist.title")}</h1>
      {canManage ? (
        <form action={assignChecklistAction} className="grid gap-3">
          <input type="hidden" name="tenantId" value={actor.tenantId} />
          <input type="hidden" name="locationId" value={location.id} />
          <label className="grid gap-1 text-sm">
            <span>{t("checklist.kind")}</span>
            <select className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="kind" defaultValue="closing">
              <option value="closing">{t("checklist.kind.closing")}</option>
              <option value="cleaning">{t("checklist.kind.cleaning")}</option>
              <option value="maintenance">{t("checklist.kind.maintenance")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>{t("daily.date")}</span>
            <input className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="localDate" type="date" required defaultValue={today} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>{t("notice.heading")}</span>
            <input className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="title" required maxLength={120} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>{t("checklist.person")}</span>
            <select className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="assigneePrincipalId" required>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.display_name ?? person.id}
                </option>
              ))}
            </select>
          </label>
          <button className="w-fit rounded-[var(--radius)] border border-line bg-surface px-4 py-2 text-sm font-semibold" type="submit">
            {t("checklist.assign")}
          </button>
        </form>
      ) : null}
      {lists.length === 0 ? <p>{t("checklist.empty")}</p> : null}
      <ul className="grid gap-3">
        {lists.map((list) => (
          <li key={list.id} className="grid gap-2 rounded-[var(--radius)] border border-line bg-surface px-3 py-3 text-sm">
            <p>
              {t(kindLabel(list.kind))} · {list.localDate} · {list.title}
            </p>
            {list.note ? (
              <p>
                {t("checklist.done")}: {list.note}
              </p>
            ) : canComplete ? (
              <form action={completeChecklistAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="tenantId" value={actor.tenantId} />
                <input type="hidden" name="checklistId" value={list.id} />
                <label className="grid gap-1">
                  <span>{t("checklist.note")}</span>
                  <input className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="note" required maxLength={500} />
                </label>
                <button className="underline" type="submit">
                  {t("checklist.complete")}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("checklist.issue")}</h2>
        {canComplete ? (
          <form action={openIssueAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tenantId" value={actor.tenantId} />
            <input type="hidden" name="locationId" value={location.id} />
            <label className="grid gap-1 text-sm">
              <span>{t("checklist.issue")}</span>
              <input className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2" name="description" required maxLength={500} />
            </label>
            <button className="underline" type="submit">
              {t("common.save")}
            </button>
          </form>
        ) : null}
        <ul className="grid gap-2 text-sm">
          {issues.map((issue) => (
            <li key={issue.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {issue.description} · {issue.status === "resolved" ? t("checklist.resolved") : t("checklist.open")}
              </span>
              {canManage && issue.status === "open" ? (
                <form action={resolveIssueAction}>
                  <input type="hidden" name="tenantId" value={actor.tenantId} />
                  <input type="hidden" name="issueId" value={issue.id} />
                  <button className="underline" type="submit">
                    {t("checklist.resolve")}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
