import { redirect } from "next/navigation";
import { getStaffSession } from "../server/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const staff = await getStaffSession();
  redirect(staff ? "/app" : "/login");
}
