# 0001. Monorepo

- Date: 2026-10-06
- Status: accepted

## Decision

The API, the Expo client, and the product docs live in one repository:

```text
/
├── api/
├── app/
├── docs/
└── README.md
```

## Context

The product is one early system with one founder and no need to version the client and API independently yet.

## Rationale

One checkout keeps product docs next to the code that must follow them. A monorepo tool (workspaces, Turborepo, Nx) is not required for two packages.

## Consequences

- Run the API and the app as separate projects. There is no root task runner.
- Shared types between PHP and TypeScript are not generated.
- Do not split the repo until release cadence or ownership actually diverges.
