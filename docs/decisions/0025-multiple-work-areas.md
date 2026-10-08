# 0025. A profile can have several work areas

- Date: 2026-10-07
- Status: accepted

## Decision

`user_profiles.work_category` (one string) is replaced by `work_categories`, a JSON list of catalog keys. The API reads and writes `work_categories` as an array. An empty list is allowed. Existing rows were migrated to a one-item list.

The first plan and Discover check membership in that list. Several areas can each add their own skill missions in Discover. Suggested skills in onboarding and Profile are the union of the selected areas.

Excluding cold calling no longer hides "reach out to previous colleagues". Those are warm contacts. It still hides the fixed-price audit offer, which is outreach to people who may not know the user.

## Context

Onboarding asked "What best describes what you do?" with a single choice. Many people are genuinely several things, for example software, design, and operations. Forcing one answer hid skills the person could charge for.

## Rationale

The areas are filters for deterministic suggestions, not entities with their own pages. A JSON list on the profile row matches how `willing`, `excluded`, and `situation` are already stored ([0017](0017-personalization-storage.md)). A pivot table would add a model without a second caller.

## Consequences

- `PUT /api/v1/profile` takes `work_categories: string[]` (max 6, distinct, catalog keys). `work_category` is no longer accepted or returned.
- Discover skill missions carry an `area` key so the client can show which area a suggestion came from.
- Skills stay their own rows with one proficiency each. There is no per-area experience level.
