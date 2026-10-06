# 0002. Laravel JSON API

- Date: 2026-10-06
- Status: accepted

## Decision

The backend is a Laravel application that serves JSON to the Expo client. It uses Laravel's conventional structure.

## Context

The client needs a place to store goals, opportunities, actions, and outcomes. The product does not need a second UI rendered by the server.

## Rationale

Laravel is the chosen backend. Controllers, models, and migrations are enough until a real second caller appears. A custom domain layer would be structure without behavior.

## Consequences

- Do not add a Blade or Vite frontend in `/api`.
- Do not add repositories, DTOs, CQRS, or microservices as a starting style.
- The stock `users`, `cache`, and `jobs` migrations are framework scaffolding, not the product schema.
- Authentication, the database product model, and the API contract style are still open. See [architecture](../technical/architecture.md).
