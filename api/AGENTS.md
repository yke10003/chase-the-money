# API agent notes

This directory is the Laravel JSON API. Product intent lives in [`/docs`](../docs/README.md). Read that before changing behavior.

- Do not install Laravel Boost unless someone explicitly asks.
- Do not add a Blade, Vite, or Tailwind frontend. The client is the Expo app in `/app`.
- Keep the conventional Laravel structure. Do not add repositories, DTOs, or domain layers until a real second caller needs them.
- The stock `users`, `cache`, and `jobs` tables are the framework scaffold. Product tables are `goals`, `opportunities`, `opportunity_actions`, `financial_impacts`, and `xp_events`.
- Product HTTP is `/api/v1` only. Read `/docs/technical/api.md` before adding routes. Do not add achievements, quests, friends, or token login unless a later phase asks. Read `/docs` before changing money or XP rules.
