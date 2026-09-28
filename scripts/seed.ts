import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadRootEnv } from "./load-env";

loadRootEnv();

if (process.env.NODE_ENV === "production" || process.env.MASULINO_SEED_CONFIRM !== "synthetic") {
  throw new Error("Refusing to seed. Set MASULINO_SEED_CONFIRM=synthetic and do not run in production.");
}

const migrateUrl = process.env.DATABASE_URL_MIGRATE;
if (!migrateUrl || !migrateUrl.includes("127.0.0.1") && !migrateUrl?.includes("localhost")) {
  throw new Error("Refusing to seed a non-local database");
}

const client = new pg.Client({ connectionString: migrateUrl });
await client.connect();
await client.query(`delete from identity."user" where email like '%@example.test'`);

const { getAuth } = await import("../apps/web/src/server/auth.ts");
const SYNTHETIC_PASSWORD = "Synthetic-Staff-1";

const users = [
  { email: "owner.masulino@example.test", name: "Olivia Owner" },
  { email: "reception.masulino@example.test", name: "Rene Reception" },
  { email: "employee.masulino@example.test", name: "Eva Employee" },
  { email: "manager.masulino@example.test", name: "Mara Manager" },
  { email: "revoked.masulino@example.test", name: "Ria Revoked" },
  { email: "owner.beispiel@example.test", name: "Otto Beispiel" },
];

const auth = getAuth();
const context = await auth.$context;
const created: Record<string, string> = {};
for (const user of users) {
  const hashed = await context.password.hash(SYNTHETIC_PASSWORD);
  const record = await context.internalAdapter.createUser({
    email: user.email,
    name: user.name,
    emailVerified: true,
  });
  await context.internalAdapter.linkAccount({
    userId: record.id,
    accountId: record.id,
    providerId: "credential",
    password: hashed,
  });
  created[user.email] = record.id;
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const locationA = randomUUID();
const locationPotsdam = randomUUID();
const locationB = randomUUID();
const hours = {
  mon: { startMinute: 600, endMinute: 1080 },
  tue: { startMinute: 600, endMinute: 1080 },
  wed: { startMinute: 600, endMinute: 1080 },
  thu: { startMinute: 600, endMinute: 1080 },
  fri: { startMinute: 600, endMinute: 1080 },
  sat: { startMinute: 600, endMinute: 1080 },
  sun: { startMinute: 600, endMinute: 1080 },
};

await client.query("begin");
await client.query(`
  truncate table
    checklist_issues, checklist_completions, checklists, punch_capabilities, kiosk_devices,
    time_effective_entries, time_correction_requests, time_punches, schedule_shifts, schedule_plans,
    leave_entries, availability_windows, availability_revisions, workforce_settings,
    allocations, reservation_tasks, reservations, booking_access_tokens, notification_deliveries,
    preparation_sheets, holiday_notices, published_venues, idempotency_keys, notification_previews,
    rate_buckets, outbox_jobs, combination_resources, combinations, packages, venue_rules,
    closures, resources, staff_invitations, grants, memberships, module_entitlements,
    locations, audit_events, security_events, principals, tenants
  restart identity cascade
`);
await client.query(
  `insert into tenants (id, slug, name) values ($1, 'masulino-spielwelt', 'Masulino Spielwelt'), ($2, 'beispielhalle', 'Beispielhalle Nord')`,
  [tenantA, tenantB],
);
await client.query(
  `insert into locations (id, tenant_id, slug, name, timezone) values
    ($1, $2, 'berlin', 'Berlin', 'Europe/Berlin'),
    ($3, $2, 'potsdam', 'Potsdam', 'Europe/Berlin'),
    ($4, $5, 'nord', 'Halle Nord', 'Europe/Berlin')`,
  [locationA, tenantA, locationPotsdam, locationB, tenantB],
);

const issuer = "urn:masulino:better-auth";
async function principal(userId: string, email: string, name: string) {
  const id = randomUUID();
  await client.query(
    `insert into principals (id, issuer, subject, email, display_name) values ($1, $2, $3, $4, $5)`,
    [id, issuer, userId, email, name],
  );
  return id;
}

const ownerA = await principal(created["owner.masulino@example.test"]!, "owner.masulino@example.test", "Olivia Owner");
const reception = await principal(created["reception.masulino@example.test"]!, "reception.masulino@example.test", "Rene Reception");
const employee = await principal(created["employee.masulino@example.test"]!, "employee.masulino@example.test", "Eva Employee");
const manager = await principal(created["manager.masulino@example.test"]!, "manager.masulino@example.test", "Mara Manager");
const revoked = await principal(created["revoked.masulino@example.test"]!, "revoked.masulino@example.test", "Ria Revoked");
const ownerB = await principal(created["owner.beispiel@example.test"]!, "owner.beispiel@example.test", "Otto Beispiel");

async function membership(tenantId: string, principalId: string, status: string) {
  const id = randomUUID();
  await client.query(
    `insert into memberships (id, tenant_id, principal_id, status) values ($1, $2, $3, $4)`,
    [id, tenantId, principalId, status],
  );
  return id;
}

const ownerMembership = await membership(tenantA, ownerA, "active");
const receptionMembership = await membership(tenantA, reception, "active");
const employeeMembership = await membership(tenantA, employee, "active");
const managerMembership = await membership(tenantA, manager, "active");
await membership(tenantA, revoked, "revoked");
const ownerBMembership = await membership(tenantB, ownerB, "active");

await client.query(
  `insert into grants (tenant_id, membership_id, role_key, location_id) values
    ($1, $2, 'tenant_owner', null),
    ($1, $3, 'reception', $4),
    ($1, $5, 'employee', $4),
    ($1, $8, 'location_manager', $4),
    ($6, $7, 'tenant_owner', null)`,
  [tenantA, ownerMembership, receptionMembership, locationA, employeeMembership, tenantB, ownerBMembership, managerMembership],
);

const moduleIds = [
  "core",
  "reservations",
  "contacts",
  "notifications",
  "workforce",
  "marketing",
  "loyalty",
  "operations",
  "purchasing",
  "content",
] as const;
for (const tenantId of [tenantA, tenantB]) {
  for (const moduleId of moduleIds) {
    const enabled =
      moduleId === "core" ||
      moduleId === "reservations" ||
      moduleId === "content" ||
      (tenantId === tenantA && (moduleId === "workforce" || moduleId === "operations"));
    await client.query(
      `insert into module_entitlements (tenant_id, module_id, enabled) values ($1, $2, $3)`,
      [tenantId, moduleId, enabled],
    );
  }
}
await client.query(
  `insert into workforce_settings (tenant_id, publication_weekday) values ($1, 0)`,
  [tenantA],
);

const tables = [
  ["Tisch 1", 8],
  ["Tisch 2", 8],
  ["Tisch 3", 10],
] as const;
const resourceIds: string[] = [];
for (const [name, capacity] of tables) {
  const id = randomUUID();
  resourceIds.push(id);
  await client.query(
    `insert into resources (id, tenant_id, location_id, name, capacity_children) values ($1, $2, $3, $4, $5)`,
    [id, tenantA, locationA, name, capacity],
  );
}
const combo1 = randomUUID();
const combo3 = randomUUID();
const combo12 = randomUUID();
await client.query(
  `insert into combinations (id, tenant_id, location_id, name, min_children, max_children, max_adults) values
    ($1, $4, $5, 'Tisch 1', 1, 8, 20),
    ($2, $4, $5, 'Tisch 3', 1, 10, 20),
    ($3, $4, $5, 'Tisch 1+2', 9, 16, 30)`,
  [combo1, combo3, combo12, tenantA, locationA],
);
await client.query(
  `insert into combination_resources (tenant_id, combination_id, resource_id) values
    ($1, $2, $3), ($1, $4, $5), ($1, $6, $3), ($1, $6, $7)`,
  [tenantA, combo1, resourceIds[0], combo3, resourceIds[2], combo12, resourceIds[1]],
);
const packageId = randomUUID();
await client.query(
  `insert into packages (
    id, tenant_id, location_id, name, duration_minutes, price_minor, currency, min_children, max_children, fixture
  ) values ($1, $2, $3, 'Geburtstagsfeier Fixture', 120, 25000, 'EUR', 1, 16, true)`,
  [packageId, tenantA, locationA],
);
const ruleId = randomUUID();
await client.query(
  `insert into venue_rules (
    id, tenant_id, location_id, version, status, timezone, buffer_before_minutes, buffer_after_minutes,
    slot_minutes, horizon_days, opening_hours, adult_seating, fixture, published_at
  ) values (
    $1, $2, $3, 1, 'published', 'Europe/Berlin', 30, 30, 30, 90, $4::jsonb, 'not_required', true, now()
  )`,
  [ruleId, tenantA, locationA, JSON.stringify(hours)],
);
const reservationId = randomUUID();
await client.query(
  `insert into reservations (
    id, tenant_id, location_id, reference, status, organizer_name, organizer_email, organizer_phone,
    starts_at, ends_at, local_date, children_count, adult_count, package_id, package_name_snapshot,
    price_minor_snapshot, currency_snapshot, rule_id, rule_version_snapshot, combination_id,
    source_channel, notes, created_by_principal_id
  ) values (
    $1, $2, $3, 'MS-FIXTURE1', 'confirmed', 'Familie Beispiel', 'familie@example.test', '030000000',
    (current_date::timestamp + time '14:00') at time zone 'Europe/Berlin',
    (current_date::timestamp + time '16:00') at time zone 'Europe/Berlin',
    (timezone('Europe/Berlin', now()))::date,
    8, 4, $4, 'Geburtstagsfeier Fixture', 25000, 'EUR', $5, 1, $6, 'staff_phone', '', $7
  )`,
  [reservationId, tenantA, locationA, packageId, ruleId, combo1, reception],
);
await client.query(
  `insert into allocations (tenant_id, location_id, reservation_id, resource_id, occupancy)
   select $1, $2, $3, $4, tstzrange(
     (current_date::timestamp + time '13:30') at time zone 'Europe/Berlin',
     (current_date::timestamp + time '16:30') at time zone 'Europe/Berlin',
     '[)'
   )`,
  [tenantA, locationA, reservationId, resourceIds[0]],
);
await client.query(
  `insert into reservation_tasks (tenant_id, location_id, reservation_id, title, status)
   values ($1, $2, $3, 'Tische vorbereiten', 'open')`,
  [tenantA, locationA, reservationId],
);
await client.query(
  `insert into published_venues (tenant_id, location_id, public_slug, status)
   values ($1, $2, 'masulino-berlin', 'published')`,
  [tenantA, locationA],
);
await client.query(
  `insert into notification_deliveries (
     tenant_id, location_id, reservation_id, kind, status, reservation_version, scheduled_for,
     last_error, job_idempotency_key
   ) values ($1, $2, $3, 'confirmation', 'failed', 1, now(), 'synthetic_failure', 'seed:failed:confirmation')`,
  [tenantA, locationA, reservationId],
);
await client.query(
  `insert into holiday_notices (
     tenant_id, location_id, title, body, starts_on, ends_on, status, published_at
   ) values
     ($1, $2, 'Fixture-Hinweis', 'Die Spielwelt hat am Fixture-Tag geöffnet.', '2020-01-01', '2030-01-01', 'published', now()),
     ($1, $2, 'Geheimer Entwurf', 'Nicht öffentlich.', '2020-01-01', '2030-01-01', 'draft', null)`,
  [tenantA, locationA],
);
await client.query(
  `insert into reservations (
    id, tenant_id, location_id, reference, status, organizer_name, organizer_email, organizer_phone,
    starts_at, ends_at, local_date, children_count, adult_count, package_id, package_name_snapshot,
    price_minor_snapshot, currency_snapshot, rule_id, rule_version_snapshot, source_channel, created_by_principal_id
  ) values (
    $1, $2, $3, 'MS-REQUEST1', 'requested', 'Familie Anfrage', 'anfrage@example.test', '030000001',
    (current_date::timestamp + time '11:00') at time zone 'Europe/Berlin',
    (current_date::timestamp + time '13:00') at time zone 'Europe/Berlin',
    (timezone('Europe/Berlin', now()))::date,
    6, 2, $4, 'Geburtstagsfeier Fixture', 25000, 'EUR', $5, 1, 'staff_walk_in', $6
  )`,
  [randomUUID(), tenantA, locationA, packageId, ruleId, reception],
);
await client.query(
  `insert into audit_events (
    tenant_id, actor_principal_id, action, target_type, target_id, outcome, correlation_id, changes
  ) values ($1, $2, 'seed.synthetic', 'tenant', $4, 'success', $3, '{}'::jsonb)`,
  [tenantA, ownerA, randomUUID(), tenantA],
);
await client.query(
  `insert into checklists (
     id, tenant_id, location_id, kind, local_date, title, assignee_principal_id, created_by_principal_id
   ) values (
     $1, $2, $3, 'closing', (timezone('Europe/Berlin', now()))::date, 'Fixture Abschluss', $4, $5
   )`,
  [randomUUID(), tenantA, locationA, employee, ownerA],
);
await client.query(
  `insert into checklist_issues (
     tenant_id, location_id, description, status, created_by_principal_id
   ) values ($1, $2, 'Fixture: Seife fehlt', 'open', $3)`,
  [tenantA, locationA, employee],
);
await client.query("commit");
await client.end();

console.log("Synthetic seed complete.");
console.log("Password for every synthetic user: Synthetic-Staff-1");
console.log("Masulino Spielwelt / Berlin: owner.masulino@example.test, manager.masulino@example.test, reception.masulino@example.test, employee.masulino@example.test");
console.log("Revoked login: revoked.masulino@example.test");
console.log("Public booking: /book/masulino-berlin");
