# App

Expo / React Native client, including web. The working technical name is `sidehustle`. Final branding is not chosen.

Product decisions live in [`/docs`](../docs/README.md). Design tokens are in `src/design/`, shared components in `src/components/`, and screens in `src/app/`. See [`docs/technical/client.md`](../docs/technical/client.md).

```bash
npm install
npm run web
```

The API base URL is `EXPO_PUBLIC_API_URL`, default `http://localhost:8000`. Copy `.env.example` to `.env` if you need to override it. Use `localhost` for both this app and the API.

```bash
npm run typecheck
npm test
```

Verified with Node 22. This machine also has Node 21 as the default `node` on some shells. If install or start fails, switch to Node 22 and retry. Client notes are in [`docs/technical/client.md`](../docs/technical/client.md).
