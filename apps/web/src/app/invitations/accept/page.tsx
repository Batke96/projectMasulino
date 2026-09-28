import { t } from "@masulino/i18n";
import { Button, TextField } from "@masulino/ui";
import { acceptInviteAction } from "../../../server/actions";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-4 px-4">
      <h1 className="text-3xl font-semibold">{t("invite.title")}</h1>
      <form action={acceptInviteAction} className="grid gap-4">
        <TextField label="Token" name="token" defaultValue={params.token ?? ""} required />
        <Button type="submit">{t("mfa.submit")}</Button>
      </form>
    </main>
  );
}
