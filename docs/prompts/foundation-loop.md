# Masulino Stage 0 + Stage 1 foundation loop prompt

Paste the block below into a fresh agent session to bootstrap the repository. Persistent product and engineering rules live in `AGENTS.md`; this prompt defines the immediate outcome, architecture choice, slice order, boundaries, and verification loop.

---

## Intended use

- **Outcome:** Stage 0 (foundation) and Stage 1 (internal staff booking) on a Vercel-hosted Next.js modular monolith with Neon Postgres and Better Auth.
- **Not in this run:** guest self-service, payments, Ready2Order, workforce, marketing, loyalty, purchasing, AI, or empty screens for later modules.
- **How to use:** paste the loop prompt as the first message in a new agent chat that already has access to this repo and `AGENTS.md`.

---

## Loop prompt (copy from here)

```text
You are working in this repository as a senior TypeScript engineer for Masulino ERP.

Goal:
Bootstrap Stage 0 (foundation) and Stage 1 (internal staff booking) as one coherent, reviewable product slice. Deliver a working Vercel-ready Next.js modular monolith with real authentication, tenant isolation, roles/permissions, audit, and staff birthday booking with deterministic table allocation and a daily view. Prefer modular, clean, efficient code with explicit package boundaries.

Context to read before editing:
- `AGENTS.md` (engineering contract; authoritative for product, security, modules, and delivery gates)
- Existing package manifests, lockfiles, scripts, and git status if any appear later
- This file only as the task brief; do not invent conflicting rules

Architecture decision (record as ADR; do not silently contradict AGENTS.md):
- Deploy as a single Next.js application on Vercel (App Router). The Next.js app is the only HTTP composition root for this slice: staff UI, route handlers, and server actions.
- Domain and application services live in framework-free packages. HTTP handlers and React components are thin adapters. They must not become a second business backend or bypass authorization.
- Defer a separate NestJS process until a second runtime is actually required. Document this departure from the NestJS default in `docs/adr/0001-nextjs-vercel-composition-root.md`.
- Vercel is hosting and edge/cron runtime only. Vercel is NOT the user directory, organization service, or role system.
- Do not use Sign in with Vercel for venue staff identity.
- Database: Neon Postgres (EU region, preferably Frankfurt proximity), provisioned via Vercel Marketplace for deployment, with a reproducible local Postgres story for development and integration tests. Use Drizzle, pooled connections for serverless, reviewed migrations, and PostgreSQL row-level security.
- Identity/sessions: Better Auth inside the Next.js server, persisted in the same Neon/Postgres database. Use maintained libraries for password hashing, HttpOnly Secure SameSite cookies, invitations, and MFA (two-factor plugin) for privileged roles. Map identity subjects as (issuer, subject) to application principals. Email is an attribute, not the authorization identifier.
- Better Auth organization owner/admin/member roles are only a membership starting point. Masulino authorization is a separate deny-by-default policy API with stable action keys (for example `reservations.booking.read`, `reservations.booking.create`, `reservations.booking.cancel`, `resources.manage`, `core.users.invite`, `core.roles.manage`), location scope, module entitlement, and record state. Evaluate permissions in application services so controllers, server actions, exports, and workers cannot bypass them.
- Background work for this slice: PostgreSQL transactional outbox plus a Vercel Cron route that drains jobs with durable claiming, bounded retries, and idempotent handlers. No separate worker app yet unless local verification requires a small shared job runner package.
- Target region: Vercel `fra1` / EU. Pilot defaults: German UI copy, `de-DE`, EUR, `Europe/Berlin`. Store instants in UTC; retain venue IANA timezone for local rules.
- Money: integer minor units + currency. No floating-point money math.

Package map to create as needed (do not empty-scaffold the entire roadmap):
- `apps/web` — Next.js staff app (and later public routes); routing and composition only
- `packages/core` — identity mapping, tenancy, memberships, authorization, configuration, module entitlements, audit
- `packages/database` — connection/transaction helpers, migrations, schema registration, RLS helpers, tenant-context setters
- `packages/contracts` — transport DTOs and runtime schemas; no ORM models or secrets
- `packages/ui` and `packages/theme` — shared accessible components and semantic tokens
- `packages/modules/reservations` — resources, availability, reservations, packages, allocation, daily operations
- `packages/verticals/indoor-play` — table combination policies and birthday-specific extensions
- Optional later stubs only as typed module-registry entries with entitlements disabled: contacts, notifications, workforce, etc. Do not build their UIs now.

Root tooling:
- TypeScript strict; pnpm workspaces; one lockfile
- Establish root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`
- Commit only a safe `.env.example`. Secrets stay in environment / Vercel project settings.
- Add minimal Vercel project config suitable for the Next.js app and cron drain route.
- Document one reproducible local startup path in `docs/local-setup.md`.

Before editing:
1. Inspect the repository and `AGENTS.md`. Treat the contract as product and security truth.
2. Verify what already exists instead of assuming docs describe implemented code.
3. Write a short implementation plan covering files, integration points, acceptance checks, and material unresolved business decisions.
4. Proceed slice by slice in the forced order below. Do not start the next slice until the current slice’s checks pass or you are blocked by missing credentials/tooling you cannot invent.

Forced implementation order:

Slice A — Workspace and platform skeleton
- pnpm monorepo, apps/web Next.js App Router, shared packages stubs with real exports
- Vercel config, EU region notes, Neon/local Postgres connection story
- ADR for Next.js-on-Vercel composition root
- `.env.example`, `docs/local-setup.md`, `docs/architecture.md` starter, `docs/business-decisions.md` with unresolved booking-policy decisions marked proposed
- Root scripts wired even if some are thin wrappers

Slice B — Schema, identity, tenancy, authorization, audit
- Core schema: principals, tenants, locations, memberships, roles/grants, module settings/entitlements, audit events, outbox/jobs
- Every tenant-owned table has non-null `tenant_id`; location-owned data also has `location_id`
- Restricted runtime DB role without BYPASSRLS; transaction-local tenant context on the same connection; missing context fails closed; pooled reuse must not leak tenant
- Better Auth configured with Drizzle adapter, invitations, sessions, MFA path for owners/admins/managers
- Invitation-based staff access; auditable bootstrap for first owner; no hardcoded admin, mock login, client-side role flags, or production auth bypass
- Central policy API; seed configurable role templates from AGENTS.md (owner, tenant admin, location manager, shift lead, reception, employee) with conservative grants
- Machine-readable permission matrix under `docs/permissions.md` plus tests for allow and deny
- Audit mutations with actor, scope, tenant/location, action, target, timestamp, correlation id, outcome, redacted changes

Slice C — Staff shell
- Login, session, tenant/location selection, protected staff home
- Shared UI shell from `packages/ui` / `packages/theme`
- Loading, empty, validation, error, access-denied, success states on important screens
- German user-facing copy via translation keys; code identifiers stay English
- Demonstrate: permitted staff reaches protected screen; revoked user cannot; cross-tenant denial with two synthetic tenants; role denial for a forbidden action

Slice D — Internal booking (Stage 1)
- Venue/resource/package setup for synthetic Masulino-like fixtures only
- Indoor-play deterministic allocation policy with hard constraints: capacity, allowed table combinations, opening hours/closures (from published or fixture rule set), buffers, duration, existing occupancy
- Represent each physical table allocation; half-open occupancy intervals including buffers; DB exclusion/range constraints per tenant/location/resource
- Staff create/confirm booking path: organizer contact fields needed for operations, date/time, children/adult counts, package, source channel, notes
- Confirm reservation + allocations + price/rule snapshots + audit + outbox entry atomically
- Idempotent booking create/confirm keyed by tenant + actor/capability + payload hash
- Explicit lifecycle: at least draft/requested, confirmed, cancelled (and completed/no-show stubs if cheap)
- Authorized daily view: arrival time, children/adults, tables, package, status, open tasks
- Concurrent last-slot acceptance: at most one confirmation; loser gets accurate conflict/alternative; no partial allocations
- Do not invent live production prices, deposits, cancellation wording, or auto-confirmation from guessed capacity. Fixtures may demonstrate; production publication must reject incomplete rule sets.

Slice E — CI and readiness
- CI: format/lint, typecheck, unit tests, integration tests, boundary/dependency checks where practical, build
- Seed command creates two synthetic tenants, multiple roles, conflicting booking fixtures, restricted records
- Document how to run checks and local startup; state plainly anything unverified

Work loop:
1. Implement only the current slice.
2. Keep the diff modular and reviewable: clear package exports, no unowned utils dump, no `if (tenant === "masulino")` forks.
3. Add migrations, runtime validation, permissions, and audit alongside features.
4. Add tests that prove invariants and security boundaries, including denial and failure paths.
5. Run the most relevant checks for the slice.
6. If a check fails, diagnose the root cause, make the smallest fix, and rerun.
7. Repeat until the slice passes or you are blocked by missing external credentials you cannot fabricate.
8. Then move to the next slice.

Verification (run what exists; never claim a command passed without executing it):
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration` — must cover RLS/tenant isolation and overlapping allocation / last-slot concurrency against real Postgres
- `pnpm test:e2e` or a browser pass for login, access denial, staff booking, and daily view when Playwright is wired
- `pnpm build`
- Manual or scripted smoke of seed + login against local setup when services are available

Hard boundaries / non-goals:
- Do not build guest public booking, secure customer links, payments, Ready2Order, workforce scheduling, marketing campaigns, loyalty, purchasing, or AI.
- Do not create empty decorative dashboards or broad disconnected CRUD for future modules.
- Do not use Vercel KV/Blob as the system of record for tenants, users, bookings, or permissions.
- Do not store privileged bearer tokens in localStorage; do not implement custom password cryptography.
- Do not disable auth, RLS, validation, or audit to make a demo work.
- Do not introduce real customer data, production secrets, or live external email/SMS providers; use synthetic fixtures and local/dev previews.
- Do not microservices, event sourcing, generic workflow engines, or runtime plugin marketplaces.
- Do not silently rewrite AGENTS.md defaults without an ADR.
- Do not mark Stage 2+ complete.

Stop condition:
Stop when Stage 0 and Stage 1 completion gates are met (or clearly blocked with exact missing credentials/tooling), checks for implemented slices pass, documentation for architecture/permissions/local setup/ADR/business decisions is accurate, and the diff is ready for human review.

Final report:
- Summary of what changed and which slices completed
- Files and packages created or changed
- Checks run and exact results
- Architecture ADR path and key decisions
- Assumptions and unresolved business decisions still proposed
- Known limitations and risks
- Follow-up tasks intentionally left out of scope (Stage 2+)
```

---

## Shorter variant (resume / unblock)

Use this only if Stage 0 scaffolding already exists and the agent should continue the next unfinished slice.

```text
Continue Masulino Stage 0/1 from `AGENTS.md` and `docs/prompts/foundation-loop.md`.

Inspect the repo, identify the first incomplete forced slice (A→E), plan briefly, implement only that slice, run its checks, fix failures, then stop for review unless the slice is small and the next one is unblocked.

Respect the Vercel + Neon + Better Auth architecture ADR. Do not build Stage 2+ or empty future-module UI. Report changed files, checks, assumptions, and blockers.
```

---

## Quality checklist before pasting

- [ ] Agent can read `AGENTS.md` in the repo
- [ ] Neon/Postgres and Vercel credentials are available or local Postgres is acceptable for the run
- [ ] You expect Stage 0 + Stage 1 only, not the full ERP roadmap
- [ ] You will review auth, RLS, and concurrent allocation tests yourself after the agent finishes
```
