# API

Laravel JSON API for this product. The working technical name is `sidehustle`. Final branding is not chosen.

Product decisions live in [`/docs`](../docs/README.md). The client is [`/app`](../app), not this package.

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve
```

The process listens on `http://localhost:8000`.

- `GET /` and `GET /api/status` return `{ "name": "sidehustle", "status": "ok" }`
- `GET /up` is Laravel's health check

`php artisan dev` also starts the queue listener and log tail alongside the server. There is no Vite frontend in this app.
