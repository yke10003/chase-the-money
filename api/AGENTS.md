# API agent notes

This directory is the Laravel JSON API. Product intent lives in [`/docs`](../docs/README.md). Read that before changing behavior.

- Do not install Laravel Boost unless someone explicitly asks.
- Do not add a Blade, Vite, or Tailwind frontend. The client is the Expo app in `/app`.
- Keep the conventional Laravel structure. Do not add repositories, DTOs, or domain layers until a real second caller needs them.
- The stock `users`, `cache`, and `jobs` tables are the framework scaffold. They are not the product schema.
- Do not invent the opportunity model, authentication, or extra migrations until those decisions are made in `/docs`.
