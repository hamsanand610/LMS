# Client overlay: si-academy (production)

SI Academy's production configuration, selected with `CLIENT_KEY=si-academy` on the AWS deployment
(ADR-0042, `docs/runbooks/aws-production.md`). The branding, settings, navigation and sign-in
photograph are the same as the `demo` overlay's; only the starting feature flags differ.

**Flags (`flags.json`).** Operating rule 35: anything optional or costly starts **off** in
production until the client approves it. Every AI flag is off (`module.ai` and each `ai.*` surface;
ADR-0024, ADR-0031), and so are the optional modules the demo switches on: labs and the playground
(`module.practice`), the leaderboard (`module.gamification`), placement, doubts, certificates and
feedback. The core of the LMS (courses, progress, batches, sessions, attendance, assignments, tests,
reports) is on. A Super Admin turns a module on in the admin portal once it is approved; that change
is audited, and re-running the seed never undoes it.

**Placeholders to replace in the admin portal.** The contact and support addresses
(`hello@` and `support@siacademy.example`) are on a reserved domain that receives no mail: set the
institute's real ones under Settings and Branding before learners are invited.

Values here are applied by the base seed **only when the database has no value yet**; edits made in
the admin portal are never overwritten by a later release. Never put a secret in this folder.
