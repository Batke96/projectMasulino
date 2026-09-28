# ADR 0001: Next.js on Vercel is the composition root

## Status

Accepted for Stage 0 and Stage 1.

## Context

`AGENTS.md` defaults to a NestJS backend, a separate worker process, and a Next.js web app. This slice has one HTTP runtime: staff UI, route handlers, server actions, and a cron drain. A second process is not required yet.

## Decision

- Deploy one Next.js App Router application (`apps/web`) to Vercel, region `fra1`.
- Domain and application services stay in framework-free packages. Route handlers and React components are adapters. They call application services that enforce authorization.
- Vercel is hosting and cron only. It is not the user directory, organization service, or role system. Staff do not sign in with Vercel.
- Identity is Better Auth inside the Next.js server, stored in the same Postgres database. Password hashing and session cookies come from that library.
- Persistence is Neon Postgres in the EU for deployment, with local Postgres for development and integration tests. Drizzle is the query layer. Reviewed SQL migrations own constraints and row-level security.
- Background work is a PostgreSQL transactional outbox drained by `GET /api/cron/outbox`. A separate worker app is deferred.
- NestJS remains the documented default for a future second runtime. This ADR is the explicit departure until that runtime exists.

## Consequences

- Serverless transactions must set tenant context with `set_config(..., true)` inside one transaction. Session-level settings are not used.
- Migration credentials are not part of the Next.js runtime environment.
- A NestJS process can be introduced later without moving domain rules, by calling the same application services.
