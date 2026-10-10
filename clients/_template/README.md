# Client overlay: starting point

Copy this folder to `clients/<client-key>/` (lowercase letters, digits, hyphens), set `CLIENT_KEY=<client-key>`
in the API environment, edit the JSON files, then run `pnpm db:seed`.

Only configuration lives here. Never copy or edit files under `apps/` or `packages/` for a client;
use feature flags, settings, custom fields and templates first, and an extension module only when a
workflow cannot be expressed as configuration (see `docs/ARCHITECTURE_DEMO_TEMPLATE_PLAN.md` §22).

Files: `branding.json`, `settings.json`, `flags.json`, `navigation.json` — see `clients/demo` for a complete example.
