# 0008. Money in minor units

- Date: 2026-10-06
- Status: accepted

## Decision

Money is stored as a non-negative integer number of minor units plus a 3-letter ISO currency code on the row. €400.00 is `40000` and `EUR`. There is no float column and no conversion table.

## Context

Goals, potential, expected, and realized amounts have to be added and compared. The first fixtures are in euros. The product should not be structurally incapable of another currency later.

## Rationale

Integer minor units avoid binary floating-point sums. Putting the currency on each row means a later currency does not require a migration that invents one. Conversion is a different product, and nobody has asked for it.

## Consequences

- Goal amounts, potential minimum and maximum, expected amounts, realized impact, and recurring save amounts use minor units.
- Totals are per currency. Mixed currencies are not added together.
- EUR in factories and the founder seeder is sample data, not a lock and not the user's default currency. That default is still open.
- XP is not money and is stored as its own integer.
