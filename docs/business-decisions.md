# Business decisions

Values below are not live production rules. Fixture data may demonstrate them. Publishing or using a rule set when `NODE_ENV=production` requires `businessDecisionsConfirmed`, a cancellation policy, and `fixture = false`.

| Decision | Status | Posture in this slice |
| --- | --- | --- |
| Tables, valid combinations, adult seating, walk-ins, venue capacity | Proposed | Synthetic Berlin fixture: three tables, combinations Tisch 1, Tisch 3, Tisch 1+2. Adult seating `not_required` is a fixture choice, not a confirmed Masulino rule. |
| Opening hours, slots, duration, buffers, horizon | Proposed | Fixture hours 10:00–18:00 Europe/Berlin all week, 120 minute package, 30 minute buffers, 30 minute slot grid. |
| Packages, prices, deposits, payment deadlines, binding terms, cancellation | Proposed | Fixture package `Geburtstagsfeier Fixture` at 25000 minor EUR. No deposit, no payment, no cancellation wording. |
| Customer edit fields and shared-email history | Proposed | Guests may change organizer phone and operational notes. Date, time, party size, package, email, honoree, and cancellation are staff-review tasks and do not change the reservation or release tables. No guest edit deadline beyond link expiry. A shared email does not merge bookings or history. |
| Staff responsibilities and wage visibility | Proposed | Conservative role templates in `docs/permissions.md`. No wages and no hourly rates are stored. The owner compensation screen says the figure would be an estimate and not payroll, and it shows no number. |
| Website form, domain, email delivery | Proposed | Synthetic public route `/book/masulino-berlin`. Confirmation and reminder jobs write a local preview. No live email or SMS provider, and no real domain handoff. Reminder time 09:00 Europe/Berlin on the previous calendar day is a fixture schedule, not a confirmed guest promise. |
| Marketing, retention, loyalty | Proposed | Campaign, survey, and loyalty modules stay disabled. Holiday notices are a separate `content` module, enabled only in the synthetic seed. |
| Ready2Order | Proposed | Not integrated. |
| Identity provider and hosting | Accepted for this slice | Better Auth in Postgres. Vercel `fra1` and Neon EU are the deployment target. See ADR 0001. |
| Weekly coverage and breaks | Proposed | Fixture only: one person on a day with a confirmed booking, a second person when that day has 16 or more children, a warning when a shift is longer than 360 minutes and has fewer than 30 minutes of break. These numbers do not claim to satisfy German working-time law. The proposal does not insert breaks or publish itself. |
| Leave types and balances | Proposed | Start date, end date, and status `requested` or `recorded`. The reason is free text. There is no leave catalog and no balance. |
| Weekly plan publication day | Proposed | The pilot tenant stores Sunday (weekday 0) as the day the plan is meant to be ready. Nothing publishes on that clock. |

Owner of the open rows: the venue operator. Engineering owner of the fixture posture: this repository.
