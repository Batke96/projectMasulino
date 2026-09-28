import { t } from "@masulino/i18n";
import { readGuestReservation } from "@masulino/reservations";
import { Alert } from "@masulino/ui";
import { readBookingSession } from "../../../server/guest-cookies";
import { ManageBooking } from "./manage-booking";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const session = await readBookingSession();
  if (!session) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{t("guest.manageTitle")}</h1>
        <Alert>{t("guest.denied")}</Alert>
      </>
    );
  }
  let booking: Awaited<ReturnType<typeof readGuestReservation>> | null = null;
  try {
    booking = await readGuestReservation(session);
  } catch {
    booking = null;
  }
  if (!booking) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{t("guest.manageTitle")}</h1>
        <Alert>{t("guest.denied")}</Alert>
      </>
    );
  }
  return <ManageBooking booking={booking} />;
}
