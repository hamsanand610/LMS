# @lms/api

NestJS 12 modular monolith. Feature modules live in `src/modules/<key>` and follow the module contract
(`packages/module-sdk`): a `manifest.ts` declaring permissions, navigation, flags, settings sections and
events; controllers, services, jobs; a public `index.ts`. Cross-cutting infrastructure is in `src/core`.

## Commands

| Command                                                     | Purpose                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                                                  | Watch mode on http://localhost:4000 (docs at `/api/docs`, health at `/health/live`) |
| `pnpm build` / `pnpm start`                                 | Compile to `dist/` and run                                                          |
| `pnpm db:migrate:dev --name <change>`                       | Create and apply a migration (development)                                          |
| `pnpm db:migrate`                                           | Apply migrations (staging/production)                                               |
| `pnpm db:seed`                                              | Base seed: organisation, permissions, roles, settings, branding, flags              |
| `pnpm cli users:create-admin --email <email> --name <name>` | Create or reset the Super Admin                                                     |
| `pnpm test` / `pnpm test:e2e`                               | Unit tests / API tests against a test database                                      |
| `pnpm lint` / `pnpm typecheck`                              | ESLint / TypeScript                                                                 |

## Request pipeline

Request → request-context middleware (id, ip, user agent) → guards in order: rate limit → authentication
(Bearer or `lms_at` cookie) → CSRF (cookie sessions, mutations only) → module enabled (feature flags) →
permission (`@RequirePermission`, deny by default) → Standard Schema validation (`@Body({ schema })`) →
handler → problem+json filter for every error.

## Environment

See `.env.example`; all variables are validated at boot (`src/core/config/env.ts`).
