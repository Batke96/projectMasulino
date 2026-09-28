# Threat model

Scope: Stage 0 through Stage 3, staff application, public booking, and the location kiosk. This is not an ASVS certification.

## Assets

Tenant bookings, adult organizer contacts, staff sessions, guest booking-link tokens, role grants, audit history, staff availability and leave, published shifts, time punches, and checklist notes.

## Boundaries

- Browser cookies are HttpOnly. The app does not store privileged bearer tokens in `localStorage`. The guest capability cookie and the booking session cookie are HttpOnly, `SameSite=Lax`, and scoped to `/book`. The kiosk device cookie is HttpOnly, `SameSite=Lax`, and scoped to `/kiosk`. It is not a staff session.
- Better Auth checks issuer, session expiry, and password hashes. Public sign-up is disabled. Guests do not become staff users. Email is not an authorization identifier.
- Every protected action calls `authorize` in the application service. UI hiding is not the control. Guest reads and writes require a hashed link or the booking session that replaced it.
- Postgres row-level security is a second boundary. The request role cannot bypass it. Auth and worker roles cannot read reservation tables. Public lookup functions are `SECURITY DEFINER` and return one row for a slug or token hash.
- Booking changes commit with an audit row. Audit tables reject update and delete.
- Production deploys come from the `main` branch after CI passes. The Vercel token stays in GitHub Actions secrets and is not committed. Pull requests do not deploy.
- Cron drain requires `Authorization: Bearer $CRON_SECRET`. The delivery handler rechecks reservation status and version before writing a preview. Disabling the reservations module fails the job instead of sending it.
- A `GET` of a booking link does not consume the exchange token or change the booking. Exchange is a `POST`. Replayed, expired, revoked, and wrong-purpose tokens fail closed.
- Production confirmation refuses fixture or unconfirmed rule sets.
- Time punches reject update and delete. A correction request cannot rewrite the punch. Approval requires `workforce.time.approve` and a different principal from the requester. Employees read only their own punches and the published shifts assigned to them. Draft plans are not returned to an employee.
- Kiosk enrollment tokens and punch capabilities are stored as SHA-256 hashes. A capability is single-use and expires in five minutes. A revoked device cannot punch. The kiosk page has no booking, contact, or compensation fields.
- `workforce.compensation.read` is the owner template only. No hourly rate is stored, so the compensation screen shows an estimate label and no amount.
- A disabled workforce or operations entitlement rejects new writes inside the tenant transaction. Old rows remain.
- Holiday-notice drafts are not returned by the public list. Notice HTML is stripped of script, style, and `javascript:` URLs before storage.

## Residual risks

- Content-Security-Policy still allows inline scripts because Next.js does not yet attach a nonce in this slice. Development also allows `unsafe-eval` so the Next.js dev server can run. Production does not.
- Invitation lookup, booking-token lookup, kiosk-device lookup, and punch-capability lookup use `SECURITY DEFINER` functions. Each returns one matching row. The raw token is the secret. Only its hash is stored.
- The app role can set transaction-local config. It still cannot read another tenant's rows, and it has no grant to become the worker role.
- Seed passwords are synthetic and local-only. Do not run the seed against a shared database.
- MFA is required in application policy for privileged roles. Recovery codes and phishing-resistant methods are not designed yet. Publishing a holiday notice in the browser therefore needs an owner or manager who has enrolled TOTP. The integration test covers publish with an actor context.
- There is no live email or SMS provider. A preview is not delivery. Staff retry requeues the job. It does not mark the message delivered.
- A lost response after the first guest create does not issue a second exchange token on idempotent replay. Staff can revoke links. There is no reissue button yet.
- No payments or card data exist.
- Issuing a punch capability rechecks membership inside the tenant transaction. The phone session already passed MFA for privileged roles; the capability itself does not carry a second factor. It expires in five minutes and cannot be replayed.
- Coverage and break warnings are fixture numbers. They are not a claim about German working-time law.
