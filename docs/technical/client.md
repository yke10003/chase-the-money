# Client

The Expo app in `/app` is the product UI. V1 targets desktop web. The same React Native screens stay usable later on iOS and Android, but native token login is not built.

## Stack

- Expo SDK 57, Expo Router, TypeScript
- `@tanstack/react-query` for server state
- `react-native-svg` and `phosphor-react-native` for icons
- `expo-font` with `@expo-google-fonts/bricolage-grotesque` (display) and `@expo-google-fonts/instrument-sans` (interface)
- No Redux and no UI kit

Local component state covers forms and filters. React Query owns anything that came from the API.

## Design system

The visual direction is recorded in [0026](../decisions/0026-product-ui-language.md).

| File | Holds |
| --- | --- |
| `src/design/tokens.ts` | Colour (paper, ink, money green, XP yellow, attention, one colour per type), type scale, spacing, radii, breakpoints |
| `src/design/layout.ts` | `useLayout()`: phone, tablet, desktop, wide, and `twoColumn` (≥1280px) |
| `src/components/ui.tsx` | Text, buttons, panels, inputs (money, date, segmented, chips, option cards), `TypeGlyph`, `CertaintySwatch`, `Amount`, `GoalMeter`, `XpTag`, `AttentionTag`, loading, empty, and error states |
| `src/components/icon.tsx` | The only icon entry point. Each Phosphor icon is required from its own module so the other ~3,000 stay out of the bundle |
| `src/components/shell.tsx` | Desktop rail (≥1024px), compact icon rail (760–1023px), phone top bar plus bottom tabs, and the navigation-free onboarding shell |
| `src/components/feedback.tsx` | The toast for steps, banked money, XP, and goal milestones |
| `src/lib/mission.ts` | Type labels and icons, money certainty by money-line label, attention from due dates, mission grouping, journey tracks, date humanizing in server copy |

Screens use these instead of one-off colours or money formatting. Light theme only.

## Environment

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:8000` in code and in `app/.env.example`.

Use `localhost` for both the API and Expo web (`http://localhost:8081`). Do not mix in `127.0.0.1`. Sanctum cookies are not shared across those hostnames.

## API client

`src/api/client.ts` calls `fetch` with `credentials: 'include'`.

State-changing requests first call `GET /sanctum/csrf-cookie`, then send `X-XSRF-TOKEN` from the `XSRF-TOKEN` cookie. That cookie read is web-only. A later native client can replace this file's transport without rewriting the screens.

`src/api/endpoints.ts` is the list of calls. Responses keep Laravel's `data` envelope at the call site. `listAllOpportunities()` follows the 25-per-page pagination so the Missions board and Home can group every mission.

`ApiError` carries the HTTP status and Laravel's `errors` map. Forms show field errors from that map.

## Auth

On boot, `GET /api/v1/me` decides the session.

- `401` means signed out.
- A signed-in user is sent to Home, or to onboarding when there is no current goal.
- Login and register screens are hidden once a session exists.
- Logout calls `POST /api/v1/logout` and clears cached product queries.

## Routes

| Path | Screen |
| --- | --- |
| `/login`, `/register` | Session, split layout on desktop |
| `/onboarding` | Target, work, skills, experience, approach, right now. No app navigation. Ends on `/?welcome=1` |
| `/` | Home, with a strip into the four cockpits once anything exists |
| `/sell`, `/freelance`, `/build`, `/recover` | Cockpits. See [cockpits](../product/cockpits.md) |
| `/sell/new`, `/sell/setup/[id]`, `/sell/listed`, `/sell/items/[id]` | Redirects (`app.json`) to `/create/sell/…` and `/product/[id]`. See [sell](../product/sell.md). |
| `/freelance/new`, `/recover/new`, `/build/new` | Cockpit-specific create screens. No category picker. |
| `/opportunities` | All activity. Not in the navigation. `?start=cost` reviews one expense |
| `/opportunities/new` | Custom mission, plus cut-a-cost. `?mode=` redirects to the cockpit create route |
| `/product/[id]` | Product Detail for a Sell item, by the item's own id. Missions that are Sell items open here, using `sell_item_id` |
| `/opportunities/[id]` | Detail for other missions. A Sell mission redirects to its product. Back goes to the cockpit that owns it |
| `/discover` | Redirects into the cockpit that now owns that tool |
| `/progress` | Progress. Links to All activity |
| `/friends` | Placeholder. No fake data |
| `/settings` | Profile & settings (`?tab=profile|goal|account`) |

## Queries

Keys: `me`, `goal`, `home`, `opportunities`, `opportunity`, `progress`, `discover`, `profile`, `catalog`.

Mutations that change money, actions, or opportunities invalidate all product keys, so Home, the board, detail, the rail goal, and Progress do not need a manual reload. Mission detail compares XP, banked money, and goal progress before and after a change to fill the toast.

## Money and playbooks

`src/lib/money.ts` formats integer minor units without floating point. `formatAmount` drops `.00` for display. `formatAmountRange` keeps a range instead of a midpoint. `majorToMinor` accepts `249.99`, `249,99`, and a leading `€`.

Mission detail follows `playbook_view` from the API. The client does not decide which outcome is legal. Date fields on web use a date control and send `YYYY-MM-DD`. A suggested follow-up day is the value already in that control. Server copy with ISO dates ("Follow up on 2026-10-13") is shown as "13 Oct".

## Not in this client

- AI recommendations
- Friends, leaderboards, challenges
- Achievements, levels, quests
- Native Sanctum tokens
- Dark mode
