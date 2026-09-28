# Masulino roadmap

Living delivery checklist. `AGENTS.md` is the engineering contract. This file records what is done, what comes next, and the constraints that must survive later stages. When they disagree, `AGENTS.md` wins and this file is corrected.

Last reviewed: 28 September 2026.

## How to use this file

Before every coding task:

1. Read `AGENTS.md` from disk. Cursor injects that file as an always-applied workspace rule in this repository. The injection is not enough. Open the file so the current text, not an older memory of it, governs the change.
2. Read this roadmap and start at the first unchecked task in the current stage. Do not skip ahead to a later stage.
3. Implement one end-to-end slice. Add validation, permissions, audit, and tests with the feature.
4. Run the checks named on that task. Do not mark work done because the code exists.
5. Change `- [ ]` to `- [x]` only after those checks have been executed and passed, or after a blocker is written on the task with the exact missing credential or tooling. Add the date and the command result beside the box.
6. Update `docs/architecture.md`, `docs/permissions.md`, `docs/threat-model.md`, `docs/business-decisions.md`, and ADRs when their subject changed.

A fixture, guess, or old note is not an approved production rule. Record new decisions in `docs/business-decisions.md` as proposed, confirmed, or superseded.

## Current position

- [x] Stage 0 Foundation — 28 September 2026. Login, two-tenant isolation, roles, RLS, audit, staff shell, and CI are in the repo. `pnpm test:integration` covered missing tenant context and cross-tenant reads. Playwright covered a permitted reception user reaching the daily plan.
- [x] Stage 1 Internal staff booking — 28 September 2026. Staff confirm a booking, allocations commit with the reservation, and two concurrent last-slot requests produce one confirmation. `pnpm test:integration` (4 tests) and `pnpm test:e2e` (reception booking plus employee denial) passed. Reschedule rollback was added with Stage 2; combined-table overlap and the settings screen stay open below.
- [x] Stage 2 Booking MVP — 28 September 2026. A guest can request a birthday booking, open only that booking through a secure link, and staff see it on the daily plan. Confirmation and reminder jobs write local previews. A failed delivery can be requeued. The preparation sheet and holiday notices are in place. `pnpm test:integration` 10 passed. `pnpm test:e2e` 3 passed. `pnpm build` succeeded. Production still rejects a fixture rule set.
- [x] Stage 3 Operations — 28 September 2026. An employee records availability and leave, a location manager publishes a weekly plan, phone and kiosk punches keep the original row, and assigned checklists can be completed. `pnpm test:integration` 14 passed (3 files). `pnpm test:e2e` 4 passed (40.0s). `pnpm build` compiled successfully. Break rules, leave types, and wages stay proposed. No payroll.
- [ ] Stage 4 Customers and reporting — POS reconciliation, eligible marketing, surveys, optional loyalty.
- [ ] Stage 5 Optimization — measured improvements, purchasing suggestions, reviewable AI.

Stage 0 and Stage 1 leftovers stay open inside those stages below. They do not authorize skipping Stage 2.

## Architecture that stays

Accepted in `docs/adr/0001-nextjs-vercel-composition-root.md`:

- One Next.js App Router application on Vercel, region `fra1`, is the HTTP composition root. Route handlers and React components are adapters. Domain and application services stay in framework-free packages.
- NestJS and a separate worker process stay deferred until a second runtime is required. Do not add them in Stage 2.
- Vercel is hosting and cron only. It is not the user directory, organization service, or role system. Do not use Sign in with Vercel.
- Database: Neon Postgres in the EU for deployment, local Postgres for development and integration tests. Drizzle, pooled connections, reviewed SQL, row-level security. The app role has no `BYPASSRLS`. Tenant context is `set_config(..., true)` inside the same transaction. Missing context returns no rows.
- Identity: Better Auth in the Next.js server, persisted in Postgres. Map `(issuer, subject)` to principals. Email is an attribute. Privileged roles require MFA before access. Better Auth organization roles are not Masulino permissions.
- Authorization is deny-by-default in application services, with the action keys in `docs/permissions.md`. The matrix in `packages/core/src/authz/policy.ts` is authoritative.
- Side effects go through the PostgreSQL outbox. `GET /api/cron/outbox` drains jobs with `CRON_SECRET`.
- Money is integer minor units plus currency. Instants are UTC. Venue rules use the location IANA timezone. Pilot defaults: German UI, `de-DE`, EUR, `Europe/Berlin`.
- Indoor-play allocation is a pure policy passed into the reservations service. Reservations must not import the vertical. Core must not import reservations or indoor-play.

Local startup is `docs/local-setup.md`. `pnpm db:up` keeps Postgres on `127.0.0.1:54329` until Ctrl+C. Seed with `MASULINO_SEED_CONFIRM=synthetic pnpm db:seed`. Synthetic password: `Synthetic-Staff-1`.

## Stage 0 — Foundation

Gate: two-tenant denial tests pass; a permitted staff user reaches a protected screen; a revoked user cannot.

- [x] pnpm workspace, strict TypeScript, root scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed` — 28 September 2026
- [x] `apps/web` Next.js composition root and package boundaries — 28 September 2026. `pnpm boundaries` passed
- [x] ADR 0001, `.env.example`, `docs/local-setup.md`, `docs/architecture.md`, `docs/threat-model.md` — 28 September 2026
- [x] Principals, tenants, locations, memberships, grants, entitlements, audit, outbox — 28 September 2026. Migrations `0001_platform.sql` and `0002_reservations.sql`
- [x] Restricted database roles and fail-closed RLS — 28 September 2026. Integration test: no context and cross-tenant reads return no rows; worker and auth roles cannot read reservations
- [x] Better Auth sessions, invitation-based staff access, auditable owner bootstrap, MFA path for owner, administrator, and location manager — 28 September 2026
- [x] Permission matrix, role templates, allow and deny unit tests — 28 September 2026. `pnpm test` 23 tests passed
- [x] Staff shell: login, tenant and location selection, German copy, access-denied state — 28 September 2026. Playwright: reception reaches the daily plan
- [x] CI workflow for lint, typecheck, unit tests, integration tests, and build — 28 September 2026
- [ ] Deploy `main` to Vercel after CI. The `deploy` job is in `.github/workflows/ci.yml`. Blocked until GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` exist and the Vercel production environment has the variables from `.env.example`. Neon is not provisioned. See `docs/deploy.md`.
- [ ] Browser coverage for the revoked user and for opening the other tenant's URL — seeded (`revoked.masulino@example.test`, `owner.beispiel@example.test`) but not in `apps/web/e2e/staff.spec.ts`
- [ ] Storybook or another shared component catalog
- [ ] `pnpm format` in CI. Prettier is installed; CI does not run it yet
- [ ] MFA recovery that preserves assurance and writes an audit event
- [ ] Content Security Policy nonce. Production still allows inline scripts. Development also allows `unsafe-eval`

## Stage 1 — Internal staff booking

Gate: simultaneous allocation tests pass; persistence works; no unapproved production rules are assumed. Reschedule rollback is covered. Combined-table overlap and the settings screen are still open.

- [x] Synthetic venue, tables, combinations, package, and published fixture rules for Masulino Spielwelt / Berlin and a second tenant — 28 September 2026
- [x] Indoor-play allocation: capacity, combinations, opening hours, closures, buffers, duration, existing occupancy — 28 September 2026. Unit tests in `packages/verticals/indoor-play`
- [x] Half-open occupancy and per-resource exclusion constraint — 28 September 2026
- [x] Staff create and confirm: organizer, date and time, children and adults, package, channel, notes — 28 September 2026. Playwright confirmed a booking onto the daily plan
- [x] Atomic reservation, allocations, price and rule snapshots, audit, and outbox row — 28 September 2026
- [x] Idempotent create keyed by tenant, actor, and payload hash — 28 September 2026. Integration test covers replay and a mismatched key
- [x] Lifecycle includes requested, confirmed, and cancelled. Draft, completed, and no-show are stored states — 28 September 2026
- [x] Daily view: arrival, children and adults, tables, package, status, open tasks — 28 September 2026
- [x] Concurrent last slot: one confirmation, one conflict, one allocation row — 28 September 2026
- [x] Production publication rejects fixture or unconfirmed rule sets — 28 September 2026. `packages/modules/reservations/src/rules.test.ts`
- [x] Reschedule through the same booking service, with a failed move preserving the original reservation and its allocations — 28 September 2026. `pnpm test:integration` passed, including “updates only phone and notes for a guest and keeps a failed move” (10 tests).
- [ ] Combined-table overlap covered by an integration test, not only by the single-table last-slot test
- [ ] Staff resource and package editing UI. Seed and SQL create the fixture venue; there is no settings screen yet

## Stage 2 — Booking MVP

Gate met on 28 September 2026. Staff and guest flows work against the published fixture rule set. A failed delivery is visible and recoverable. Production still refuses an incomplete rule set. Prices, deposits, cancellation wording, and customer-edit deadlines stay proposed.

Public routes stay visibly separate from `/app`. Guests do not create accounts. A booking number or email alone never reads or changes a reservation.

- [x] Public venue registry and guest booking form using the existing booking service. Availability responses contain no other guest's data. Availability is advisory until commit — 28 September 2026. `pnpm test:integration` 10 passed. `pnpm test:e2e` 3 passed.
- [x] Guest create is idempotent. The same last slot still confirms at most once when a guest and a staff user race — 28 September 2026. `pnpm test:integration` passed, including the guest/staff race and guest replay (10 tests).
- [x] Secure change links: high-entropy, expiring, revocable, hashed, purpose-scoped. Exchange a single-use token after an explicit action for a short booking-scoped session. An email-client preview must not consume the token or change the booking — 28 September 2026. `pnpm test:integration` passed, including guessed, expired, replayed, and wrong-purpose links (10 tests). `pnpm test:e2e` opened the link with GET twice, then POST.
- [x] Guest changes and cancellation revalidate rules and deadlines, use a version check, and roll back a failed move. Unsupported edits go to staff. No shared-email history merge — 28 September 2026. `pnpm test:integration` passed. Guests may change phone and notes. Date, party, package, email, and cancellation become staff tasks and do not release the table. No edit deadline is configured.
- [x] Transactional confirmation and reminder jobs in the venue timezone, bound to the reservation version. Cancel and reschedule invalidate obsolete reminders. Handler is idempotent. Local preview only; no live email or SMS provider — 28 September 2026. `pnpm test:integration` passed, including one preview on a duplicate drain and a cancelled reminder (10 tests).
- [x] Staff can see queued, failed, and previewed delivery. A provider accept is not recorded as delivered. Retry does not duplicate the guest-visible effect — 28 September 2026. `pnpm test:e2e` showed Fehlgeschlagen and, after “Erneut vormerken”, Vorgemerkt. There is no live provider and no delivered state.
- [x] Printable preparation sheet from the daily read model, with generation time and booking versions. A later booking change marks the sheet stale — 28 September 2026. `pnpm test:integration` passed the staleness case. `pnpm test:e2e` generated the sheet at a 768×1024 viewport. The sheet omits email.
- [x] Holiday notices: start and end, draft, preview, approval, publication. Private drafts are not public. Content is sanitized. This is not the campaign engine — 28 September 2026. `pnpm test:integration` passed. `pnpm test` includes the sanitizer. `pnpm test:e2e` showed the published notice and hid the draft.
- [x] Tests: guessed references, expired and replayed links, preview non-consumption, reminder invalidation, failed delivery, print staleness, and the existing last-slot race — 28 September 2026. `pnpm test:integration` 10 passed (2 files).
- [x] Browser pass: guest request, staff daily plan shows it, guest cannot open another booking, staff sees a failed delivery — 28 September 2026. `pnpm test:e2e` 3 passed (21.1s): guest request, tablet daily plan and print, reception booking and employee denial. A fresh `pnpm db:seed` is required to see the seeded failed delivery.
- [x] Mark the completed boxes above with the date and command results — 28 September 2026. Also run: `pnpm lint` (0 errors, 4 existing warnings), `pnpm typecheck` (10 packages), `pnpm boundaries` (Package boundaries ok), `pnpm test` (31 passed), `pnpm build` (Next.js compiled successfully).

## Stage 3 — Operations

Gate met on 28 September 2026. Workforce and checklists. No payroll. No automatic supplier orders. Break numbers, leave types, the Sunday publication preference, and wages stay proposed.

- [x] Recurring availability and leave, scoped to the employee — 28 September 2026. `pnpm test:integration` passed “keeps availability on the employee and denies colleagues, locations, and tenants” (14 tests, 3 files). `pnpm test:e2e` saved Monday availability as the employee (4 passed, 40.0s).
- [x] Proposed weekly plan from rules and bookings, including coverage, overlaps, and break constraints. A manager reviews and publishes it. Sunday publication is a tenant preference, not a hardcoded clock — 28 September 2026. `pnpm test:integration` passed “publishes one plan version and leaves the previous plan when publish is denied” (14 tests). `pnpm test:e2e` showed Entwurf to the manager, then the employee plan had no Entwurf and showed 09:00–17:00. Publication weekday 0 is stored. No Sunday cron.
- [x] Clock-in and clock-out on a shared device with individual verification, automatic locking, and no customer-history or wage access — 28 September 2026. `pnpm test:e2e` at 768×1024 enrolled a hashed device token, submitted a single-use phone capability, and returned to “Tablet gesperrt”. The kiosk text has no Familie and no euro amount. The capability expires in five minutes and is not a PIN.
- [x] Original time entries preserved. Corrections are requests. Approval is a separate action and is audited — 28 September 2026. `pnpm test:integration` passed “keeps the original punch and denies self-approval, shift leads, and a disabled module” (14 tests), including an UPDATE denied on `time_punches`. `pnpm test:e2e` kept the punch line text after “Korrektur anfragen”.
- [x] Wage and compensation data stay behind `workforce.compensation.read`. Personnel-cost figures are labeled estimates — 28 September 2026. `pnpm test` 51 passed, including the policy matrix (33 tests in `policy.test.ts`). `pnpm test:e2e` showed the employee “Kein Zugriff” and the owner the sentences “Personalkosten sind eine Schätzung und keine Lohnabrechnung.” and “Es ist kein Stundensatz hinterlegt.” No euro amount. No rate is stored.
- [x] Assigned closing, cleaning, and maintenance checklists with completion evidence and open issues. Not a generic workflow engine — 28 September 2026. `pnpm test:integration` passed “completes only an assigned checklist and rejects a disabled operations module” (14 tests). `pnpm test:e2e` showed “Erledigt: Tische geprüft” and the open issue “Fixture: Seife fehlt”.
- [x] Tests for publish permission, cross-location denial, correction history, and a disabled workforce module rejecting new work — 28 September 2026. `pnpm test:integration` 14 passed (3 files, 47.10s). Also run: `pnpm lint` (0 errors, 4 existing warnings), `pnpm typecheck` (12 packages, all Done), `pnpm boundaries` (Package boundaries ok), `pnpm test` (51 passed), `pnpm test:e2e` (4 passed, 40.0s), `pnpm build` (Next.js compiled successfully in 7.0s).

## Stage 4 — Customers and reporting

- [ ] Ready2Order read-only import from documented contracts and synthetic fixtures. Reconcile totals, refunds, and periods. Do not invent endpoints or claim fiscal compliance
- [ ] Booked value, collected payments, reportable sales, and refunds stay separate facts
- [ ] Marketing audiences require recorded eligibility. Recheck at send time. Historical contacts stay out until a lawful basis is stored. Suppression wins
- [ ] Surveys and loyalty only after their rules exist. Rewards are an idempotent ledger. No double redemption. Customers cannot self-certify a visit
- [ ] Optional customer account does not attach historical bookings by email alone. Claiming a booking requires proof

## Stage 5 — Optimization

- [ ] Purchasing suggestions from counts, target stock, and bookings. A person approves the order. Wednesday counting is tenant configuration
- [ ] Weather or holiday inputs only as data to a human decision
- [ ] AI suggestions are reviewable, evidence is distinct from inference, and the model cannot grant access, publish, price, approve, refund, or order
- [ ] Any improvement claim cites a measured baseline. Do not invent success numbers

## Decisions still proposed

From `docs/business-decisions.md`. Fixture code may demonstrate them. `NODE_ENV=production` must reject a rule set until `businessDecisionsConfirmed`, a cancellation policy, and `fixture = false`.

- [ ] Tables, combinations, adult seating, walk-ins, venue capacity
- [ ] Opening hours, slot grid, duration, buffers, booking horizon
- [ ] Packages, prices, deposits, payment deadlines, binding terms, cancellation
- [ ] Which fields a guest may change, and by when
- [ ] Staff grant boundaries beyond the conservative templates
- [ ] Real website domain and email delivery handoff
- [ ] Marketing basis, retention, loyalty rules
- [ ] Ready2Order account, record mapping, and reconciliation
- [ ] Pilot hosting region confirmation, processors, backup restore, and recovery targets

Accepted for the current slice: Better Auth in Postgres, Vercel `fra1`, Neon EU as the deployment target, local Postgres for development.

## Checks

Run what the slice touched. Record the exit status in the task box.

```bash
pnpm lint
pnpm typecheck
pnpm boundaries
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

`pnpm test:integration` uses Postgres. Do not treat a mocked database as proof of tenant isolation or allocation constraints.

## Out of scope until their stage

Guest payment collection, card data, Ready2Order writes, payroll, native apps, accounting, fiscal cash-register certification, automatic employee scoring, automatic supplier ordering, campaigns, live email and SMS, microservices, event sourcing, and a plugin marketplace.
