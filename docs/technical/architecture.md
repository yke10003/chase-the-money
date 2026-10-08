# Architecture

**Decision.** The intended shape is:

```text
Expo app (web now, iOS and Android later)
        → Laravel JSON API
        → relational database
```

This is an early product. Prefer a straightforward Laravel backend and a clean Expo client.

Do not introduce microservices, an event bus, a separate recommendation service, CQRS, or a repository layer until a concrete problem forces it. None of those problems exist yet.

## What exists today

This is what the repository contains today. Product rules stay in `docs/product/`.

| Piece | Current state |
| --- | --- |
| `/api` | Laravel 13.35 (skeleton 13.11) on PHP 8.3+ (this machine: 8.4). JSON only. `GET /` and `GET /api/status` return a status payload. `GET /up` is Laravel's health route. |
| `/app` | Expo SDK 57, Expo Router, TypeScript, React Native Web. One placeholder screen. |
| Database | The Laravel skeleton uses SQLite locally so the app can boot. Production database is not chosen. |
| Migrations | Framework defaults (`users`, `cache`, `jobs`) plus `goals`, `opportunities`, `opportunity_actions`, `financial_impacts`, and `xp_events`. |
| Domain behavior | Complete an action (XP once), record a realized impact, settle explicitly, complete, abandon, or reopen an opportunity, and read period metrics. |
| HTTP | `/api/v1` JSON for auth, goals, opportunities, actions, impacts, Home, and Progress. See [api.md](api.md). |
| Auth | Sanctum session cookies for Expo Web. No token login and no social login. See [0013](../decisions/0013-sanctum-session-auth.md). |
| Frontend in the API | None. Vite and the Laravel welcome page were removed so this repo does not grow a second UI. |
| Client state | Component state only. No state library and no server-cache library. |
| Jobs, mail, files | Laravel's defaults (database queue, log mailer, local disk). Nothing product-specific is queued or emailed. |

`php artisan dev` starts the HTTP server, a queue listener, and the log tail. It does not start a Vite process.

## Domain model

Eloquent models, PHP backed enums, and a few small domain types. No repositories, no event store, no workflow engine.

```text
User
 ├── Goal
 ├── Opportunity
 │    └── OpportunityAction
 ├── FinancialImpact
 └── XpEvent
```

Money is integer minor units plus a currency code on the row. See [0008](../decisions/0008-money-in-minor-units.md).

Realized money is `financial_impacts`. Expected and potential live on the opportunity and are never added into that ledger by a query. A Save row may carry a monthly or yearly recurring amount; the annualized number is calculated and is not part of the realized sum. See [0009](../decisions/0009-financial-impact-ledger.md).

XP is `xp_events`. Totals are a sum. See [0010](../decisions/0010-xp-event-ledger.md).

Opportunity status is a small normalized enum. The user-facing stage is a string checked against a PHP catalog that can change without a migration. See [0011](../decisions/0011-status-and-stage.md).

`User::metricsForPeriod()` returns realized totals by type for the dates given, plus current expected and potential for open opportunities, XP in the period, and completion counts. Expected and potential are a current snapshot, not a reconstruction of what the pipeline looked like in October.

Deleting a user removes their rows. Deleting an opportunity removes its actions, and keeps financial impacts and XP events on the user. Impacts keep the type and a title snapshot.

The opt-in `FounderFixtureSeeder` loads the founder scenario. `DatabaseSeeder` does not call it.

## What the API should become

**Assumption.** JSON resources for the Expo client, using ordinary Laravel controllers. Add a model method or a single action class when a controller gets hard to read. Do not create a parallel architecture "because APIs usually have one."

**Open.** API contract style. Possibilities include hand-written JSON, Laravel API resources, or an OpenAPI-first workflow. Do not pick one until the first real resource exists.

**Decision.** The web client uses Sanctum session cookies. Bearer tokens for native apps are not built. See [0013](../decisions/0013-sanctum-session-auth.md).

**Open.** How the client stores server state. Do not add React Query, Zustand, Redux, or similar until a screen needs it.

## Personalization and Discover

**Assumption.** Early recommendations can be ordinary PHP behind a controller, using the profile collected in onboarding. A separate recommendation service is not justified.

## Decisions still to make

- API contract approach beyond the current Laravel resources
- client state and server-cache libraries
- production database
- background job infrastructure beyond Laravel's queue
- email provider
- hosting
- analytics
- file storage for listing photos
- recommendation implementation beyond "start in the Laravel app"

When one of these is chosen, add a record under [decisions](../decisions/README.md).

## Local boundaries

**Decision.** Product UI lives in `/app`. `/api` does not render the product.

**Decision.** Locally the API is `http://localhost:8000` and Expo web is `http://localhost:8081`. CORS allows that web origin with credentials. See [api.md](api.md).

**Open.** The production hostnames for the API and the web app.
