# Platform strategy

## V1 is web-first

**Decision.** The first product milestone is a desktop web application.

**Decision.** The client is an Expo / React Native project in `/app`, with Expo Web as the web target. Do not add a second React-only web frontend.

**Decision.** The architecture stays compatible with later native iOS and Android builds. Native mobile is not part of the initial milestone.

**Decision.** The desktop web experience is first-class. Do not lay out V1 as a phone screen floating in a wide window. When product screens are built, design the web layout for a desk, and keep the components in React Native so a later native build is possible.

**Later.** A TestFlight or other mobile waitlist may be offered from the web product. That is a marketing surface, not the native app.

## What "compatible with native" means right now

**Assumption.**

- Navigation is Expo Router.
- UI is React Native primitives, not DOM-only components, except where Expo's web support already bridges them.
- No web-only library becomes load-bearing unless it is isolated and a native path is obvious.
- iOS and Android projects are not generated yet. Expo can do that later. The app `.gitignore` ignores `/ios` and `/android` if they appear.
- `app.json` still has `orientation: portrait` and the Expo template icon set. That is scaffold config for a future native shell. It does not define the desktop web layout, and the icons are not a brand.

**Open.** When to move from Expo web to a dev client or store build. Not during the first web milestone.

## What we are not doing

- a separate Next.js or Vite React site for the product
- a Blade UI served by Laravel
- shipping iOS and Android in the same milestone as the first useful web loop
- treating a responsive phone layout as the finished desktop design

## Working name

The Expo slug, URL scheme, and Laravel app name are `sidehustle`. That is a technical placeholder. See [overview](../product/overview.md).
