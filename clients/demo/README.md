# Client overlay: demo

The neutral demonstration client ("Demo Institute"). Selected with `CLIENT_KEY=demo`.

| File              | Purpose                                                                                             | Validated by                          |
| ----------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `branding.json`   | Brand seeds (name, colours, fonts, login/dashboard texts, email footer)                             | `brandingSeedsSchema` (`@lms/shared`) |
| `settings.json`   | Initial settings sections (general, academic, legal)                                                | `settingsUpdateSchema`                |
| `flags.json`      | Feature-flag overrides (`{ "module.practice": false }`)                                             | boolean map                           |
| `navigation.json` | Navigation overrides per portal (label, order, hidden, icon)                                        | `navigationOverrideSchema`            |
| `assets/`         | Logo, favicon, background images (uploaded through the branding page or seeded later)               | —                                     |
| `seeds/`          | Client-specific seed data (later phases)                                                            | —                                     |
| `extensions/`     | Extension modules implementing SDK extension points (only when configuration cannot express a need) | module contract                       |

Values here are applied by `pnpm db:seed` **only when the database has no value yet**; edits made in the
admin UI are never overwritten by re-running the seed.
