# Deploy

Production hosting is the Next.js app in `apps/web` on Vercel, region `fra1`. GitHub Actions deploys it. A push to `main` runs `.github/workflows/ci.yml`: the `check` job must pass, then the `deploy` job publishes that commit.

Pull requests run checks only. They do not deploy.

Leave Vercel’s automatic Git deployments off for this project. If they are on, every `main` commit builds twice.

## One-time Vercel project

1. Create a Vercel project for this repository. Do not enable automatic production deploys from Git.
2. Set the project Root Directory to `apps/web`. Keep “Include source files outside of the Root Directory” enabled so the workspace packages install.
3. Framework preset: Next.js. Node.js version: 22.
4. Install command: `pnpm install --frozen-lockfile`, run from the repository root if Vercel does not detect the workspace. Build command: the Next.js default.
5. Copy the production values into the Vercel project. Use the names in `.env.example`. `DATABASE_URL`, `DATABASE_URL_AUTH`, and `DATABASE_URL_WORKER` are pooled Neon URLs. `BETTER_AUTH_URL` is the public `https` origin. Generate `BETTER_AUTH_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`.
6. Do not set `DATABASE_URL_MIGRATE` on the Next.js runtime. Migrations stay a separate, reviewed step.

`apps/web/vercel.json` sets region `fra1` and calls `GET /api/cron/outbox` once a day at 08:00 UTC so the project stays on the Vercel Hobby plan. Hobby may invoke that job any time between 08:00 and 08:59 UTC. The cron request must send `Authorization: Bearer $CRON_SECRET`.

## GitHub Actions secrets

Create a Vercel token, then link the project once on a trusted machine:

```bash
npx vercel@latest login
npx vercel@latest link
```

`.vercel/project.json` contains `orgId` and `projectId`. That directory is gitignored. Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Source |
| --- | --- |
| `VERCEL_TOKEN` | Vercel account token |
| `VERCEL_ORG_ID` | `orgId` in `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` in `.vercel/project.json` |

After the secrets exist, re-run the `ci` workflow on `main` (Actions → ci → Run workflow). The deploy job fails with a missing-secret error until all three are set.

## What is not deployed yet

Neon is not provisioned by this pipeline. A successful Vercel deploy still needs the EU database, the three runtime roles, and a migration run with the migration credential. Production confirmation still rejects a fixture rule set. No live email or SMS is sent.
