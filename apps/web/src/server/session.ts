import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensurePrincipal, listMemberships, loadActor, privilegedRoles, type ActorContext } from "@masulino/core";
import { getAuth } from "./auth";

export async function getStaffSession() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const principalId = await ensurePrincipal({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });
  const memberships = await listMemberships(principalId, session.user.id);
  return {
    user: session.user,
    principalId,
    mfaEnabled: Boolean(session.user.twoFactorEnabled),
    memberships,
  };
}

export async function requireStaffSession() {
  const staff = await getStaffSession();
  if (!staff) redirect("/login");
  return staff;
}

export async function requireActor(tenantId: string): Promise<ActorContext> {
  const staff = await requireStaffSession();
  const actor = await loadActor({
    principalId: staff.principalId,
    tenantId,
    mfaSatisfied: staff.mfaEnabled,
  });
  if (!actor || actor.membershipStatus !== "active") redirect("/access-denied");
  const privileged = actor.grants.some((grant) =>
    (privilegedRoles as readonly string[]).includes(grant.roleKey),
  );
  if (privileged && !staff.mfaEnabled) redirect("/account/security");
  return actor;
}
