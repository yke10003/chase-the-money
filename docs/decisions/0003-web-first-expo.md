# 0003. Web-first Expo app

- Date: 2026-10-06
- Status: accepted

## Decision

V1 ships as a desktop web app built with Expo / React Native and Expo Web. The same project must remain able to build for iOS and Android later. Native mobile is not part of the initial milestone.

There is no separate React-only web frontend.

## Context

The first useful version should be usable at a desk. A later native app is expected, and rebuilding the UI from a DOM-only codebase would throw that away.

## Rationale

Expo Web is the web target that keeps a native path. A phone-shaped layout on a wide monitor would miss the actual V1 user. Desktop layout and native compatibility are both requirements.

## Consequences

- Product screens use React Native primitives and Expo Router.
- Design web layouts for a desktop window.
- Do not generate native store builds, TestFlight, or a mobile waitlist as part of the scaffold.
- Do not add Next.js, a standalone Vite React app, or a component library until a later decision says so.
- Client state libraries are not selected.
