# Architecture

Stage 0 through Stage 3 run as one Next.js application. See [ADR 0001](adr/0001-nextjs-vercel-composition-root.md).

## Packages

| Package | Responsibility |
| --- | --- |
| `apps/web` | Routes, server actions, Better Auth adapter, cron route, public booking pages |
| `packages/core` | Principals, memberships, deny-by-default policy, audit, invitations, outbox drain |
| `packages/database` | Pools, transaction-local tenant context, reviewed SQL migrations |
| `packages/contracts` | Zod inputs, permission keys, money helpers |
| `packages/modules/reservations` | Staff and guest booking, secure links, delivery previews, daily view, preparation sheets |
| `packages/modules/notices` | Holiday notices and HTML sanitizing. Not a campaign engine |
| `packages/modules/workforce` | Availability, leave, weekly plans, punches, corrections, kiosk punch capabilities |
| `packages/modules/operations` | Assigned closing, cleaning, and maintenance checklists and open issues |
| `packages/verticals/indoor-play` | Deterministic table-combination policy |
| `packages/ui`, `packages/theme`, `packages/i18n` | Shared UI, tokens, German copy |

Core does not import reservations, notices, workforce, operations, or indoor-play. Reservations does not import indoor-play, notices, workforce, or operations. Workforce reads confirmed booking counts through `BookingFactsLoader` in the web composition root. It does not allocate tables or import indoor-play. The web cron route passes the delivery handler into `drainOutbox`. The web app passes the allocation function in. Stage 3 has no outbox side effects and no Sunday cron.

## Data plane

Three database roles:

- `masulino_app` — request path. No superuser, no `BYPASSRLS`. Tenant data requires `set_config('app.context','tenant')` and `app.tenant_id` inside the transaction. `app.context = public` allows the published-venue, booking-token, kiosk-device, and punch-capability lookup functions.
- `masulino_auth` — Better Auth tables in schema `identity` only.
- `masulino_worker` — select and update `outbox_jobs` only. The cron route is the caller.
- Migration role — DDL, seed, and bootstrap. Not read by the Next.js server.

Missing tenant context returns no rows. Identity context can read the signed-in principal and that principal's memberships. Audit and security logs are append-only.

Public venue lookup and booking-token lookup use `SECURITY DEFINER` functions, `app.lookup_published_venue` and `app.lookup_booking_token`. Kiosk enrollment and punch capabilities use `app.lookup_kiosk_device` and `app.lookup_punch_capability` the same way. Writes stay inside `withTenant`.

## Booking

A confirmed booking, its allocations, price and rule snapshots, audit row, confirmation job, and reminder job commit in one transaction. Occupancy is a half-open `tstzrange` with a per-resource exclusion constraint. The indoor-play policy chooses the feasible combination with the least unused child capacity, then name. Customer-facing time and buffered occupancy are separate. Production use of a published rule set is rejected until business decisions are confirmed and the rule is not a fixture.

Guests use the same booking service. They are not staff principals. Idempotency for a guest is scoped to an HttpOnly capability cookie, not to an email address. A booking link stores only a SHA-256 hash. `GET` previews the exchange token. `POST` consumes it and sets a short-lived booking session cookie. A booking number or email is not a lookup key.

Delivery rows use `queued`, `previewed`, `failed`, and `cancelled`. The outbox job status is separate. The handler writes a German local preview and does not call a mail provider. A reminder is scheduled for 09:00 Europe/Berlin on the previous calendar day and is bound to the reservation version. Cancel and reschedule cancel the queued reminder.

The preparation sheet is a snapshot of the daily view without email. Generating it is a `POST`. A later version change marks that snapshot stale.

## Workforce and checklists

Availability and leave are append-only revisions for the signed-in employee. A manager reads availability for one location. A weekly proposal is a draft built from published availability, leave, and confirmed bookings. Publishing is a separate audited action. A rejected publish leaves the previous published plan in place. Publishing the same plan version twice writes one audit row. The stored publication weekday defaults to Sunday and is not a cron.

Phone clock-in and clock-out store the UTC instant, the Europe/Berlin local date, the actor, and the location. Punch rows are insert-only. A correction is a new request. Approval is a different person, writes an audit row, and inserts an effective entry. The original punch stays readable.

A shared tablet holds an HttpOnly device cookie, not a staff session. A manager enrolls the device with a hashed, expiring, revocable token. The employee's phone session issues a single-use punch capability that expires in five minutes. The tablet submits that capability and then shows a locked screen. There is no PIN and no shared password. The kiosk page does not show bookings, contacts, or compensation.

Closing, cleaning, and maintenance lists are assigned to one person or one role for one location and one local date. Completion stores the actor, the UTC time, and a short note. An issue is one row, open or resolved. Resolving it is audited.

## Modules

`core` and `reservations` are enabled for seeded tenants. The `content` module is enabled in the synthetic seed so holiday notices can be published. `workforce` and `operations` are enabled in the synthetic seed for the pilot tenant only. Registry defaults for those modules stay disabled. Contacts, notifications, marketing, loyalty, and purchasing stay off. Disabling `reservations` fails queued delivery jobs without writing a preview. Disabling `workforce` or `operations` rejects new work and leaves existing rows in place.

## Deployment

`apps/web` is the Vercel project, region `fra1`. Pushes to `main` deploy only after the GitHub Actions `check` job passes. Pull requests do not deploy. The steps and the secrets that are still required are in `docs/deploy.md`.
