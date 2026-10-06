# sidehustle

Working name only. The product name is not chosen.

This is a gamified personal tool for turning spare time, skills, possessions, and overlooked financial opportunities into extra money, then actually doing the work. It is not accounting software, a budgeting app, or a job marketplace.

The question it should answer:

> What can I do next to become financially better off?

V1 is a desktop web app. The client is Expo / React Native so a later iOS and Android build stays possible. Native mobile is not part of the current milestone.

Product intent lives in [`docs/`](docs/README.md). The apps below are scaffolds. Domain screens, the opportunity schema, and authentication are not built yet.

## Repository

```text
/
├── api/     Laravel JSON API
├── app/     Expo client (web, plus a later native path)
├── docs/    Product and technical source of truth
└── README.md
```

## API

Requires PHP 8.3+ and Composer. This machine uses PHP 8.4 via Laravel Herd.

```bash
cd api
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve
```

Then open `http://localhost:8000`. `GET /` and `GET /api/status` return JSON. `GET /up` is the health check.

`php artisan dev` runs the server, the queue listener, and the log tail together.

## Web app

Requires Node 22 (verified with 22.23.3). `app/.nvmrc` pins that major version. Expo SDK 57.

```bash
cd app
npm install
npm run web
```

Expo prints the local URL. The placeholder screen should say `sidehustle`.

`npm run ios` and `npm run android` exist because this is an Expo app. They are not part of the current milestone.

## Current stage

Foundation only: both projects boot, and `/docs` records the product decisions, the provisional V1 cut, and the questions still open.
