import Link from "next/link";
import { notFound } from "next/navigation";
import { authorize } from "@masulino/core";
import { t, type MessageKey } from "@masulino/i18n";
import { listStaffNotices } from "@masulino/notices";
import { Badge, Button, EmptyState, Shell } from "@masulino/ui";
import { transitionNoticeAction } from "../../../../../server/mvp-actions";
import { logoutAction } from "../../../../../server/actions";
import { locationBySlug } from "../../../../../server/queries";
import { requireActor, requireStaffSession } from "../../../../../server/session";
import { NoticeForm } from "./notice-form";

export const dynamic = "force-dynamic";

export default async function NoticesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; locationSlug: string }>;
}) {
  const { tenantSlug, locationSlug } = await params;
  const staff = await requireStaffSession();
  const membership = staff.memberships.find((item) => item.tenant_slug === tenantSlug);
  if (!membership || membership.status !== "active") notFound();
  const actor = await requireActor(membership.tenant_id);
  const location = await locationBySlug(actor, locationSlug);
  if (!location) notFound();
  const scoped = { ...actor, locationId: location.id };
  if (!authorize(scoped, "content.notice.read").allow) notFound();
  const notices = await listStaffNotices(actor, location.id);
  const canManage = authorize(scoped, "content.notice.manage").allow;
  const canPublish = authorize(scoped, "content.notice.publish").allow;
  return (
    <Shell
      title={t("notice.title")}
      tenantName={membership.tenant_name}
      locationName={location.name}
      nav={
        <div className="flex items-center gap-4 text-sm">
          <Link className="underline" href={`/app/${tenantSlug}/${locationSlug}`}>
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
      <h1 className="text-2xl font-semibold">{t("notice.title")}</h1>
      <p className="text-sm text-muted">{t("notice.staffOnly")}</p>
      {canManage ? <NoticeForm tenantId={actor.tenantId} locationId={location.id} /> : null}
      {notices.length === 0 ? <EmptyState title={t("notice.empty")} /> : null}
      <div className="grid gap-3">
        {notices.map((notice) => (
          <article key={notice.id} className="rounded-[var(--radius)] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{notice.title}</h2>
              <Badge>{t(statusKey(notice.status))}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {notice.startsOn} – {notice.endsOn}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{notice.body}</p>
            <form action={transitionNoticeAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="tenantId" value={actor.tenantId} />
              <input type="hidden" name="noticeId" value={notice.id} />
              {canManage && notice.status === "draft" ? (
                <Button type="submit" name="step" value="preview" variant="secondary">
                  {t("notice.previewAction")}
                </Button>
              ) : null}
              {canPublish && notice.status === "preview" ? (
                <Button type="submit" name="step" value="approve" variant="secondary">
                  {t("notice.approve")}
                </Button>
              ) : null}
              {canPublish && notice.status === "approved" ? (
                <Button type="submit" name="step" value="publish">
                  {t("notice.publish")}
                </Button>
              ) : null}
            </form>
          </article>
        ))}
      </div>
    </Shell>
  );
}

function statusKey(status: string): MessageKey {
  switch (status) {
    case "preview":
      return "notice.preview";
    case "approved":
      return "notice.approved";
    case "published":
      return "notice.published";
    default:
      return "notice.draft";
  }
}
