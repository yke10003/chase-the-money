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

These are scaffold facts, not product decisions.

| Piece | Current state |
| --- | --- |
| `/api` | Laravel 13.35 (skeleton 13.11) on PHP 8.3+ (this machine: 8.4). JSON only. `GET /` and `GET /api/status` return a status payload. `GET /up` is Laravel's health route. |
| `/app` | Expo SDK 57, Expo Router, TypeScript, React Native Web. One placeholder screen. |
| Database | The Laravel skeleton uses SQLite locally so the app can boot. Production database is not chosen. |
| Migrations | Only the framework defaults: `users`, `cache`, `jobs`. These are not the product schema. |
| Auth | Not implemented. The stock `User` model shipped with Laravel. No Sanctum, Fortify, or session login UI. |
| Frontend in the API | None. Vite and the Laravel welcome page were removed so this repo does not grow a second UI. |
| Client state | Component state only. No state library and no server-cache library. |
| Jobs, mail, files | Laravel's defaults (database queue, log mailer, local disk). Nothing product-specific is queued or emailed. |

`php artisan dev` starts the HTTP server, a queue listener, and the log tail. It does not start a Vite process.

## What the API should become

**Assumption.** JSON resources for the Expo client, using ordinary Laravel controllers. Add a model method or a single action class when a controller gets hard to read. Do not create a parallel architecture "because APIs usually have one."

**Open.** API contract style. Possibilities include hand-written JSON, Laravel API resources, or an OpenAPI-first workflow. Do not pick one until the first real resource exists.

**Open.** Authentication. It is required before this is a product a person returns to. The mechanism (session, token, first-party cookies for the web client, social login) is not chosen. Web-first does not by itself mean cookie sessions.

**Open.** How the client stores server state. Do not add React Query, Zustand, Redux, or similar until a screen needs it.

## Personalization and Discover

**Assumption.** Early recommendations can be ordinary PHP behind a controller, using the profile collected in onboarding. A separate recommendation service is not justified.

## Decisions still to make

Do not select these during scaffold work:

- authentication strategy
- API contract approach
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

**Assumption.** The web client will call the API over HTTP. CORS and the deployed origins are not configured yet, because there is no product client calling the API yet.

**Open.** Whether the Expo web app and the API are on the same site, and how local ports are fixed. The scaffold defaults are API `http://localhost:8000` and Expo's own web port.
