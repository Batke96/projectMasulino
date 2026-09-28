import type { Action } from "@masulino/contracts";
import { authorize, type ActorContext } from "@masulino/core";
import { rows, withTenant } from "@masulino/database";
import { sql } from "drizzle-orm";

export async function locationsFor(actor: ActorContext) {
  const locations = await withTenant(actor.tenantId, async (tx) =>
    rows<{ id: string; slug: string; name: string; timezone: string }>(
      tx,
      sql`select id, slug, name, timezone from locations where status = 'active' order by name`,
    ),
  );
  const doors: Action[] = [
    "reservations.booking.read",
    "workforce.availability.read",
    "workforce.schedule.read",
    "operations.checklist.read",
  ];
  return locations.filter((location) =>
    doors.some((action) => authorize({ ...actor, locationId: location.id }, action).allow),
  );
}

export async function packagesFor(actor: ActorContext, locationId: string) {
  return withTenant(actor.tenantId, async (tx) =>
    rows<{ id: string; name: string; price_minor: number; currency: string }>(
      tx,
      sql`
        select id, name, price_minor, currency
        from packages
        where location_id = ${locationId} and status = 'active'
        order by name
      `,
    ),
  );
}

export async function locationBySlug(actor: ActorContext, slug: string) {
  const locations = await locationsFor(actor);
  return locations.find((location) => location.slug === slug) ?? null;
}

export async function peopleAt(actor: ActorContext, locationId: string) {
  return withTenant(actor.tenantId, async (tx) =>
    rows<{ id: string; display_name: string | null }>(
      tx,
      sql`
        select distinct p.id, p.display_name
        from memberships m
        join principals p on p.id = m.principal_id
        join grants g on g.membership_id = m.id
        where m.status = 'active' and (g.location_id = ${locationId} or g.location_id is null)
        order by p.display_name
      `,
    ),
  );
}

export async function locationRecord(actor: ActorContext, slug: string) {
  const found = await withTenant(actor.tenantId, async (tx) =>
    rows<{ id: string; slug: string; name: string; timezone: string }>(
      tx,
      sql`select id, slug, name, timezone from locations where slug = ${slug} and status = 'active' limit 1`,
    ),
  );
  return found[0] ?? null;
}
