# Permissions

The authoritative matrix is `packages/core/src/authz/policy.ts`. Tests in `policy.test.ts` cover allow and deny. This page matches that matrix.

Scope: **T** tenant-wide grant (`location_id` null), **L** a grant for that location, **—** denied.

Privileged roles (`tenant_owner`, `tenant_administrator`, `location_manager`) also require MFA before any allow.

| Action | Owner | Admin | Manager | Shift lead | Reception | Employee |
| --- | --- | --- | --- | --- | --- | --- |
| `reservations.booking.read` | T | T | L | L | L | — |
| `reservations.booking.create` | T | T | L | — | L | — |
| `reservations.booking.update` | T | T | L | — | L | — |
| `reservations.booking.cancel` | T | T | L | — | L | — |
| `resources.manage` | T | T | L | — | — | — |
| `core.users.invite` | T | T | — | — | — | — |
| `core.roles.manage` | T | — | — | — | — | — |
| `core.membership.read` | T | T | L | — | — | — |
| `core.settings.read` | T | T | L | — | — | — |
| `core.audit.read` | T | — | — | — | — | — |
| `content.notice.read` | T | T | L | L | L | — |
| `content.notice.manage` | T | T | L | — | — | — |
| `content.notice.publish` | T | T | L | — | — | — |
| `workforce.availability.read` | T | — | L | — | — | L |
| `workforce.availability.write` | T | — | — | — | — | L |
| `workforce.schedule.read` | T | — | L | L | — | L |
| `workforce.schedule.propose` | T | — | L | — | — | — |
| `workforce.schedule.publish` | T | — | L | — | — | — |
| `workforce.time.read` | T | — | L | L | — | L |
| `workforce.time.record` | T | — | — | — | — | L |
| `workforce.time.correct` | T | — | — | — | — | L |
| `workforce.time.approve` | T | — | L | — | — | — |
| `workforce.compensation.read` | T | — | — | — | — | — |
| `operations.checklist.read` | T | — | L | L | — | L |
| `operations.checklist.complete` | T | — | L | L | — | L |
| `operations.checklist.manage` | T | — | L | — | — | — |

Administrators may invite only `shift_lead`, `reception`, and `employee`. They cannot grant owner, administrator, or location manager. Revoking the last active owner is rejected.

Better Auth organization roles (`owner`, `admin`, `member`) are not consulted. A disabled module entitlement denies the module's actions even when the role would allow them.

Guests are not in this matrix. A published venue plus an HttpOnly capability cookie may create one booking. A hashed, purpose-scoped link may read or narrowly update that booking. Email and the human booking reference do not authorize either action.

Holiday notices use the `content` module. Drafts are staff-only. Publication requires `content.notice.publish`. The public page lists published notices whose dates include today, and only when the module is enabled.

Workforce actions require the `workforce` module. Checklist actions require the `operations` module. A disabled entitlement denies the action even when the role would allow it. The matrix is not a record-level rule: an employee with `workforce.availability.write` or `workforce.time.record` may change only their own rows, and `workforce.schedule.read` for an employee returns the published plan's own shifts. Draft plans stay with `workforce.schedule.propose` or `workforce.schedule.publish`. `workforce.compensation.read` is the owner only. No wage amounts are stored. Administrators do not receive workforce or checklist actions unless a later explicit grant says so; the default template does not include compensation or schedule publish.
