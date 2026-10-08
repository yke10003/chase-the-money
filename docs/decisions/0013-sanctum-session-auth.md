# 0013. Sanctum session auth

- Date: 2026-10-06
- Status: accepted

## Decision

The Expo web client authenticates with a first-party Laravel session cookie. Sanctum marks the web origin as stateful and enforces CSRF on those requests.

Register, login, logout, and the current user are JSON. There is no Blade login screen and no OAuth.

Sanctum token login for a later native app is not implemented. The token table is migrated so it can be added without replacing users or the session flow.

## Context

V1 is a desktop web app on a different localhost port from the API. Native mobile is explicitly later. A starter kit that ships its own UI would fight the Expo client.

## Rationale

Sanctum's SPA mode is the ordinary Laravel answer for a first-party web client, and the same user model can grow bearer tokens later. Cookie auth keeps the browser from storing a long-lived API token in JavaScript.

## Consequences

- Product routes use `auth:sanctum`.
- Local web setup must share a hostname, list the Expo origin in `SANCTUM_STATEFUL_DOMAINS`, and allow that origin with credentials. See [api.md](../technical/api.md).
- Tests sign in with the session guard. They do not mint personal access tokens.
- Social login is still out.
