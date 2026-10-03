# Phase 6 — Code quality and security hardening

| Field    | Value                                                                                                                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **Complete — approved by the client on 3 October 2026** and pushed; the record is §5, the final gate §7                                                                                                                                              |
| Scope    | The client's Phase 6 brief of 3 October 2026 ("Code quality and security hardening — strict autonomous execution"): inspect, identify, prioritise, harden, test, regress, document, commit; the known items 1–8 of the brief; the findings on record |
| Roadmap  | `docs/ROADMAP.md`, Phase 6 (gate: both reviews green; no security control weakened)                                                                                                                                                                  |
| Baseline | `3484cfc` (Phase 5 approved and pushed); every Phase 0–5 decision and ADR kept                                                                                                                                                                       |
| Boundary | Non-AI; no new infrastructure (no Redis, no new service); no redesign; one additive migration (`20261006090000_phase6_hardening`, two columns on `sessions`); dependencies moved only where an advisory was critical and the fix compatible          |

## 1. Inspection

Reconnaissance read the guard chain (rate limit → authentication → CSRF → module → permission),
the auth, users, files, storage, settings, reports, notifications, tests, assignments, placement
and students services, the shared Zod schemas, `app.setup.ts`, the logger, the Caddy and compose
files, and `pnpm audit`. What was already sound and stays as it is: every route declares a
permission (route-table test); object scope through `ScopeService`; Argon2id passwords with a
decoy hash for unknown accounts; refresh-token rotation with reuse detection; double-submit CSRF
for cookie sessions; MIME sniffing of uploads; hidden test cases never leave the runner; learner
code never runs in the API (ADR-0016); the audit log on every mutation.

Findings, ranked by the brief's order (security, authorisation and data leakage, authentication,
privacy and storage, integrity, concurrency, robustness):

| #   | Finding                                                                                                                                                                                     | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1  | Signing out, revoking a device, an administrator ending a session, a role change or a deactivation ended the refresh token only: the access token in hand kept working for up to 15 minutes | P1       |
| A2  | An invitation link activated any account it pointed at: a suspended, deactivated or erased one came back, an active one had its password replaced; two acceptances at once both passed      | P1       |
| A3  | A reset link worked for a switched-off account, could be used twice at once, and left the account's other links working; a password change left them working too                            | P1       |
| A4  | Each refresh moved the session's expiry 30 days on, so a session never ended; and it made a "do not remember me" sign-in a remembered one                                                   | P2       |
| A5  | Two refreshes with the same token at once could both rotate it; a role change left refresh tokens valid (the forced sign-out rule could be refreshed through)                               | P2       |
| A6  | A sign-in posted from another site was accepted (login CSRF); reset and invitation links sat in job payloads for days; the Referer header (which may hold such a link) was logged           | P2       |
| A7  | The failure count stayed at five after a lock, so one wrong password after it re-locked the account at once                                                                                 | P3       |
| S1  | On staging, signed links named `http://minio:9000`, which only containers resolve (finding on record #1)                                                                                    | P1       |
| S2  | SVG was accepted for logos and company logos — script in an image, served from the application's origin (#2); `/files` proxied every bucket and method                                      | P1       |
| S3  | Anyone who could read a file could delete it through `DELETE /files/:id`, live logos and lesson files included                                                                              | P2       |
| S4  | A removed résumé, a replaced or removed profile photo and an expired export stayed downloadable in storage                                                                                  | P2       |
| S5  | Student documents were scoped by `students:read` instead of `students:read_sensitive`, the permission that guards them; a reviewer opening a handed-in file was not audited                 | P2       |
| S6  | Integration secrets were stored as plain text (#3)                                                                                                                                          | P2       |
| V1  | Zod 4 fills defaults inside `.optional()` and `.partial()`: an edit naming one setting reset its siblings (test, assignment, flag audience, branding sections) and the services stored that | P1       |
| V2  | An integration's settings were wiped by an edit that did not send them, and an empty secret cleared the stored one (the schema said it kept it); a status change without a note erased it   | P2       |
| V3  | Windows were compared as text (`…00Z` sorts after `…00.500Z`); a yes/no custom field read "false" as true; an announcement edit could end before its stored start                           | P2       |
| V4  | A database rule the request broke (unique, foreign key, record gone) answered 500; a body that is not JSON was answered with the parser's message, which quotes the body                    | P2       |
| V5  | The size check ran after the JSON parser; a chunked body was read up to 6 MB on any route (#5); answers carried no `Cache-Control`; the route map was public on staging                     | P3       |
| C1  | A queued export or import ran for its requester after they were switched off or lost the permission                                                                                         | P1       |
| C2  | Two administrators could remove the last two Super Admins at the same moment                                                                                                                | P1       |
| C3  | An announcement could be delivered twice (the request and the minute's sweep); a results release or a drive's first opening notified twice when sent twice at once                          | P2       |
| C4  | A coordinator's decision and a learner's withdrawal could overwrite each other; an answer save could land after the attempt was marked                                                      | P2       |
| C5  | Student and drive codes were allocated by text order: past STU-2026-9999 (or with a code of another shape) the same code came back every time                                               | P2       |
| R1  | A route's per-person limit counted the access cookie, which changes at every refresh; a Bearer client was counted by address                                                                | P2       |
| R2  | 60 refreshes per address in five minutes would sign a classroom behind one address out; a successful sign-in counted towards the five tries (#6)                                            | P2       |
| R3  | Unlimited expensive routes: question validation (which also bypassed the one-run-per-person gate), question import, exports, announcements, test e-mails, certificate redraws               | P2       |
| Z1  | A former trainer was still counted in the batches they had taught: `/me` listed them, and batch-aimed flags reached them (the Phase 3–4 record left this to Phase 6)                        | P3       |
| D1  | `next` 16.3.5 had a critical advisory; `multer` (through Nest) an upload-parser one                                                                                                         | P1       |

## 2. Decisions

- **P6-1 Access tokens end with their session.** The guard asks whether the token's session
  family is live (cached 15 s; every revocation clears the cache). A family, not the session: a
  refresh must not break a request already on its way with the previous token.
- **P6-2 Rotation keeps the sign-in.** A refreshed session keeps the family, the expiry and the
  remember-me choice of the sign-in (`sessions.persistent`). A rotation is recorded
  (`sessions.rotated_at`): a token rotated less than 30 s ago in a family nobody signed out is two
  tabs refreshing together, and both carry on; later, it is a leaked token and the family ends.
- **P6-3 Links open only what they were for.** An invitation activates only an `invited` account
  (409 for an active one, 410 otherwise); a reset works only for an `active` one (410). Both are
  claimed in a transaction, end their siblings, and are sent at once, never queued (only a
  token's hash may be stored). The suspended state therefore needs no special case: it is not
  active, not invited — blocked everywhere, and reactivation restores it.
- **P6-4 Login CSRF by origin.** A state-changing request without a session cookie is refused
  when it carries an `Origin` outside `CORS_ORIGINS` (or `WEB_BASE_URL`); clients that are not
  browsers send none and pass.
- **P6-5 Links name only public hosts.** Signed links are signed for `S3_PRESIGN_ENDPOINT`;
  outside local a link naming an internal host is refused (503 `storage_not_public`) rather than
  handed out. The refusal is at run time, not at start-up, because staging links were already
  unusable and the rest of staging should keep working until a public storage host is set up.
  `S3_PUBLIC_BASE_URL` must be a public https address at start-up.
- **P6-6 Only the uploader deletes through the files route.** Reading a file is not owning it.
- **P6-7 An edit names what it changes.** Update schemas carry no defaults at any depth
  (`patchSchemaOf` for nested objects), and services merge what was sent over what is stored
  (`definedFields`).
- **P6-8 Jobs run as the requester is now.** An export or import checks the requester's status
  and permission when it runs.
- **P6-9 Per-person limits count the verified person** on routes with a limit of their own; the
  general allowance stays per session, so working in several tabs is not throttled as one heavy
  client. The limiter stays in process memory (no Redis in this phase): the single-instance
  limitation is documented in the operations runbook and belongs to Phase 12.
- **P6-10 Stored secrets are sealed** with AES-256-GCM under `DATA_ENCRYPTION_KEY` (or, when it is
  not set, a key derived from `JWT_ACCESS_SECRET` for this purpose only). Nothing reads them back
  today; rotating the key means entering them again.
- **P6-11 Dependencies:** `next` 16.3.6 (critical advisory), `multer` ^2.4 by workspace override
  (upload parser). The advisories left are in tooling paths (§6).

## 3. Items built

| Area              | What changed                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication    | Family liveness in the guard (A1); invitation and reset claims, status rules, sibling links ended, sent at once (A2, A3, A6); absolute session lifetime and remember-me kept (A4); rotation claim, grace window and role-change revocation (A5); Origin check (A6); Referer and query strings out of logs (A6); lock resets the count (A7) |
| Storage           | Presign endpoint and refusal, public base URL checked, placeholders refused (S1); SVG removed, Caddy `/files` public bucket only, GET and HEAD, `CSP: sandbox`, `nosniff` (S2); uploader-only delete (S3); files deleted with what held them (S4); document scope and reviewer audit (S5); sealed secrets (S6); playback links 2 h         |
| Validation        | Nested patches without defaults and merged (V1, V2); instants compared; "false" read as false; announcement window checked against the stored half (V3)                                                                                                                                                                                    |
| Errors and limits | 409 / 404 for database rules, plain words for a bad body (V4); size check before the parser, chunked bodies refused outside imports, `Cache-Control: no-store`, Swagger local only (V5)                                                                                                                                                    |
| Concurrency, jobs | Requester checked when a job runs (C1); Super Admin removal under an advisory lock (C2); announcement, release and drive opening claimed and keyed (C3); conditional decision and withdrawal, answers saved only while open (C4); codes by number with a redraw on a clash (C5)                                                            |
| Rate limits       | Verified-person keys, ceilings first (R1); refresh 1,200 per address in 5 min; a successful sign-in refunds its count (R2); limits on validation (and the run gate), imports, exports, announcements, test e-mails, redraws (R3)                                                                                                           |
| Authorisation     | Taught batches count only while the person holds a permission scoped to their batches (Z1); the assignment rows stay on record                                                                                                                                                                                                             |
| Dependencies      | `next` 16.3.6, `multer` ^2.4 (D1)                                                                                                                                                                                                                                                                                                          |

## 4. The findings on record (`docs/product/IMPLEMENTATION_ROADMAP.md` §4) owned by Phase 6

| #   | Finding                                                    | Outcome                                                                                                                                                               |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Staging signed links name `http://minio:9000`              | Application side fixed (P6-5). Staging needs a public storage host for private files; until it has one, those links are refused — Phase 14                            |
| 2   | SVG accepted; `/files` served from the application origin  | Fixed (S2)                                                                                                                                                            |
| 3   | Integration secrets unencrypted                            | Fixed (P6-10)                                                                                                                                                         |
| 4   | Rate-limit store and caches in process memory              | Kept, documented (single instance); a shared store is Phase 12                                                                                                        |
| 5   | 6 MB JSON limit on every route                             | Fixed (V5): 1 MB everywhere except the import routes, whatever the client declares                                                                                    |
| 6   | A successful sign-in counted towards the five tries        | Fixed (R2)                                                                                                                                                            |
| 7   | API test gaps: files, content pages, templates, taxonomies | Files covered (`hardening` spec); the content routes stay with Phase 13's test pass                                                                                   |
| 8   | CI runners: Node 20 actions, `ubuntu-latest` moving        | Runners pinned to `ubuntu-24.04` — the Phase 6 hardening state. The final gate reviewed every action: none has an advisory, none is security-critically outdated (§7) |
| 9   | Sample-data tooling under Prisma 7                         | Unchanged (tooling, not hardening); the manual seeds of the runbook still apply — Phase 13                                                                            |
| 14  | Out-of-date module docs                                    | Fixed (notifications, students, compose)                                                                                                                              |

## 5. Record (3 October 2026)

**Commits** (from `3484cfc`): `306f3e2` dependencies, `b29f59a` authentication, `c0231d4` storage,
`3d847dc` errors and request limits, `3e06fc6` edits and windows, `eccc462` concurrency and jobs,
`ce99c61` rate limits, `a33b458` sealed secrets, `8398a22` the announcement rule order, `a1af213`
CI runners, `899442e` the OpenAPI document, `e9f978e` former trainers, `6466af7` the branding
pickers, and the records.

**Specs added.** `apps/api/test/auth-hardening` (20): remember-me cookies through every refresh;
sign-out, a revoked device and an administrator ending a session end the access token in hand; a
refresh keeps the token working, the family and the sign-in's lifetime; no refresh past it; two tabs
refreshing at once both carry on, while a rotated token presented after the grace window ends the
family; a role change signs out everywhere, refresh token included; a lock starts the count again;
a successful sign-in is not one of the five tries; a sign-in posted from another site is refused;
suspended, deactivated (then reactivated) and erased accounts; a leftover invitation on an active
account, two acceptances at once, a resend ending the earlier link; reset links ended by a reset
and by a password change; links sent at once, never queued. `hardening` (15): SVG refused,
uploader-only delete, résumé and photo files removed, no internal host in answers, a former
trainer's batches, test, assignment, flag, branding and integration edits keeping what they do not
name, the sealed secret, the announcement window, a body that is not JSON, `no-store`, a chunked
body refused. `concurrency` (5): the last two Super Admins removing each other, an export and an
import after the requester's deactivation, an announcement sent twice at once, codes past 9999 and
past codes of another shape. Unit: `s3.driver.spec` (4), `secret-box.spec` (3), the shared
`patch-semantics.spec` (11), and new cases in `env.spec`, `rate-limit.guard.spec` and
`memory-store.spec`. Two earlier tests follow the new rules: the replay in `auth` is made after the
grace window, and the lockout test expects the count to start again.

**Verified** (3 October 2026, on this machine). Type-check and lint clean in every package (9 of 9
tasks each); unit 316 (shared 124, runner 16, API 163, web 13); API end to end 36 files and 477 tests, all passing in the final run; the
permission matrix unchanged (72). Browser, on the production build against a copy of the migrated
`lms`, Chromium, all 11 suites (101 tests): 98 passed, 2 skipped by design, 1 flaky — the trainer's
question-bank search box never became editable on the first attempt; it passed on its retry, and
again when the suite ran alone (14 passed, 1 skipped). After the last two fixes, on a rebuilt stack:
smoke, sign-in, self-service, staff journeys and people again, 40 passed. Role journeys against the
same API, 37 checks, all passing: the Super Admin made a sample trainer a Content Manager (the
change ended that person's session at once), and the Content Manager, the Placement Coordinator,
an Admin, a Trainer and a Learner each reached what they should and were refused what they should
not; sign-out ended the access token; answers carried `no-store` and no internal host; an SVG logo
and a cross-site sign-in were refused. The branding pickers were read on the rendered page. Every
tracked file formatted.

**Fixed on the way.** Writing the refresh tests showed that claiming the token alone would sign out
both tabs of a browser refreshing together; the grace window and `rotated_at` came from that. The
first full run caught the new window check answering before the delivery rule (400 for 422). A
review of the drive change caught a status change without a note notifying as if the note had
changed. Each is fixed and tested.

**Main local database (`lms`).** Before migrating: backup `E:\LMS-backups\lms-before-phase6.dump`
(570,890 bytes, SHA-256 `fb9cb95a…a5211791` in the `.sha256` beside it), restored into a scratch
database and compared table by table — all 79 tables, 4,315 rows, identical content fingerprints —
then the scratch copy dropped. Target checked (`lms` on the LMS container, port 5433); one pending
migration. `db:migrate` applied `20261006090000_phase6_hardening` (13 of 13, none failed):
`sessions.persistent` (boolean, not null, default true) and `sessions.rotated_at` (timestamptz,
null) are present. Compared row by row over each table's earlier columns: 78 tables unchanged,
`_prisma_migrations` one row more (4,315 → 4,316). No data was changed.

**Not touched:** the ET-EMS and SLTS containers (same set, stopped, same start and finish times
before and after) and every other database on the LMS server; the QA copy `lms_phase6_qa` was made
from the migrated `lms` for the browser runs and dropped afterwards.

**Found on the way, outside the phase.** The Branding page's "Interface font" select shows no value
although the stored font is valid (display only, unchanged since Phase 1): flagged as its own task.

## 6. Deferred, with the phase that owns it

| Item                                                                                                                                                         | Phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| A shared store for rate limits, the auth caches and the run gate (they are per process; one API instance is the supported deployment)                        | 12    |
| A public storage host on staging for signed links (`S3_PRESIGN_ENDPOINT`); a least-privilege MinIO user instead of the root keys                             | 14    |
| A per-request CSP nonce for the web app (its CSP still allows inline scripts Next needs)                                                                     | 12    |
| The learner's privacy request queue (P-I08): requests are handled by an administrator today (export and erase are built and audited)                         | 13    |
| Certificates draw names outside Latin-1 as "?" (ADR-0022 known limitation; needs a font with wider coverage)                                                 | 13    |
| Upload quarantine (virus scanning) before a file becomes ready                                                                                               | 14    |
| The audit log is append-only by convention; a database trigger refusing updates and deletes                                                                  | 12    |
| Reports read whole result sets before paging; very large institutes need streaming                                                                           | 12    |
| Prisma 7.10's query interpreter runs sub-queries of one statement in parallel on a transaction connection (pg's deprecation warning); resolve before pg 9    | 12    |
| Remaining `pnpm audit` advisories, all in tooling paths: brace-expansion, braces, fast-uri, ip-address, uuid (ExcelJS), mysql2 and deepmerge-ts (Prisma CLI) | 12    |

## 7. Final gate (3 October 2026)

The client accepted the phase on its hardening report and asked for the final gate: verify, review
CI read-only, record, push; nothing new built unless a check found a Phase 6 security blocker. None
did.

**Checked before the push.** The working tree clean; `HEAD` `51649d0`; `origin/main`, fetched,
and GitHub's `main` (`git ls-remote`) still `3484cfc`, 14 commits behind. On `lms`: 13
migrations applied, none failed or rolled back, the newest `20261006090000_phase6_hardening`, the
schema up to date; all 79 tables row for row as after the migration (4,316 rows); the backup
`lms-before-phase6.dump` still matches its SHA-256. The ET-EMS and SLTS containers: the same set,
stopped, with the same start and finish times as before the phase.

**CI review (read-only).** Eight actions are used, each on its current major version:
`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`,
`pnpm/action-setup@v4`, `docker/setup-buildx-action@v3`, `docker/login-action@v3`,
`docker/build-push-action@v6` and, in the manual staging deploy, `webfactory/ssh-agent@v0.9.0`.
None of them is named by any of the 56 advisories the GitHub Advisory Database lists for the
Actions ecosystem (read on 3 October 2026; the nearest, `actions/download-artifact`, is not used).
Pushes and pull requests run with the repository's default token; the image job asks for
`packages: write` and signs in to the registry on `main` only; the staging deploy runs only when
dispatched by hand and passes its inputs through `env`. **No action is security-critically
outdated, so CI stays as it is: the runners pinned to `ubuntu-24.04` are the Phase 6 hardening
state.** Recommendations for the phases that own CI and staging, not defects found here: actions
pinned by commit rather than by tag (the SSH agent above all, since it holds the staging key), a
read-only `permissions` default at the top of `ci.yml`, the action majors that run on Node 24,
and on staging a checked tag format and a pinned host key instead of `ssh-keyscan` (Phases 12 and 14).

**Outside the gate, documented separately:** the Branding page's font select shows no value
(display only, unchanged since Phase 1; §5), and the public storage host staging needs for signed
links (Phase 14; §6). Neither blocks the gate.
