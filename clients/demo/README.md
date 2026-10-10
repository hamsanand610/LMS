# Client overlay: demo (sample data)

SI Academy's configuration with **sample data**: fictional students, trainers, batches and records
for local development, CI and staging. It never runs against production records. Selected with
`CLIENT_KEY=demo` (the key keeps its old name; renaming it touches scripts, CI and configuration and
is left to Phase 12's tooling work). Every seeded address is on the reserved `siacademy.example`
domain, so no seeded account can receive real mail.

It switches on the optional modules that are off by default (`flags.json`): the leaderboard
(`module.gamification`), placement (`module.placement`) and doubts (`module.doubts`) — ADR-0014.

| File              | Purpose                                                                                                                                                                                                                                                                                      | Validated by                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `branding.json`   | Brand seeds (name, colours, fonts, login/dashboard texts, email footer)                                                                                                                                                                                                                      | `brandingSeedsSchema` (`@lms/shared`) |
| `settings.json`   | Initial settings sections (general, academic, legal)                                                                                                                                                                                                                                         | `settingsUpdateSchema`                |
| `flags.json`      | Feature-flag overrides (`{ "module.practice": false }`)                                                                                                                                                                                                                                      | boolean map                           |
| `navigation.json` | Navigation overrides per portal (label, order, hidden, icon)                                                                                                                                                                                                                                 | `navigationOverrideSchema`            |
| `assets/`         | Brand files. `login-background.webp` is SI Academy's sign-in photograph (Task 3, ADR-0015): `pnpm db:seed` uploads it to storage and sets it as the sign-in background while none is set. Logo and favicon are uploaded through the branding page.                                           | the `branding-background` context     |
| `seeds/`          | Client-specific sample data. `students-sample.csv` is the twenty-row intake used in the demo import: seventeen valid applicants for batch JFS-2026-B2 and three deliberate mistakes (a malformed email, a missing name and an unknown batch code) so the error report has something to show. | the student importer                  |
| `extensions/`     | Extension modules implementing SDK extension points (only when configuration cannot express a need)                                                                                                                                                                                          | module contract                       |

Values here are applied by `pnpm db:seed` **only when the database has no value yet**; edits made in the
admin UI are never overwritten by re-running the seed.
