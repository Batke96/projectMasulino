# Local setup

One path, from a clean checkout:

1. Install Node.js 22+ and pnpm 10.
2. Copy environment variables:

```bash
cp .env.example .env
```

Generate `BETTER_AUTH_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`. The values in `.env.example` are local placeholders.

3. Start Postgres and leave that process running:

```bash
pnpm db:up
```

This uses a project-local Postgres on `127.0.0.1:54329` via `embedded-postgres` and applies migrations. The first start initializes the cluster as UTF-8 (`en_US.UTF-8`). If `.data/pg` already exists from an older start, delete that directory before `pnpm db:up` so the encoding is recreated. Stop the process with Ctrl+C. Docker Compose (`docker compose up -d`) is an alternative if you already have Docker; create the roles with the same passwords, then run `pnpm db:migrate`.

4. In a second terminal, seed two synthetic tenants:

```bash
MASULINO_SEED_CONFIRM=synthetic pnpm db:seed
```

The seed refuses `NODE_ENV=production` and refuses non-local databases. Every synthetic password is `Synthetic-Staff-1`.

5. Start the app:

```bash
pnpm dev
```

Open `http://localhost:3000`. Public booking for the synthetic venue is `http://localhost:3000/book/masulino-berlin`. That page is separate from `/app` and does not create a staff account.

| Login | What you should see |
| --- | --- |
| `reception.masulino@example.test` | Masulino Spielwelt, Berlin daily plan, create booking |
| `employee.masulino@example.test` | Berlin work hub: own availability, published shifts, clock, assigned checklists. No booking list |
| `manager.masulino@example.test` | Berlin location manager. TOTP is required before the staff area. Can propose and publish the week |
| `revoked.masulino@example.test` | Membership listed as inactive |
| `owner.masulino@example.test` | Prompted to enroll TOTP before the staff area |
| `owner.beispiel@example.test` | Beispielhalle only; Masulino URLs are denied |

Owners and location managers must enroll TOTP under `/account/security` before privileged screens open. Reception can work without MFA.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm boundaries
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

`pnpm test:integration` starts its own Postgres on port `54330` unless `CI=true` and `DATABASE_URL_MIGRATE` are already set. It truncates that test database. Integration files share that database, so the fixture reset takes a Postgres advisory lock.

`pnpm test:e2e` runs Playwright against `http://localhost:3000` and starts `pnpm dev` when that port is free. The guest flow expects a fresh seed: the synthetic failed delivery is consumed when staff click “Erneut vormerken”. Run `MASULINO_SEED_CONFIRM=synthetic pnpm db:seed` before that suite.

`pnpm db:generate` checks that reviewed SQL migrations exist. It does not rewrite them.

## Deployment notes

The `main` branch deploys through GitHub Actions after CI passes. One-time Vercel project, secret, and database steps are in `docs/deploy.md`.

- Vercel project region: `fra1`. The project config is `apps/web/vercel.json`.
- Neon Postgres in the EU, preferably Frankfurt. Use the pooled URL for `DATABASE_URL`, `DATABASE_URL_AUTH`, and `DATABASE_URL_WORKER`. Use the direct URL for `DATABASE_URL_MIGRATE` only in a migration job, not in the Next.js runtime.
- Create the three login roles from `scripts/roles.ts` before migrating. Do not give the app role `BYPASSRLS`.
- Set `CRON_SECRET`. Vercel Cron calls `/api/cron/outbox` every five minutes.
