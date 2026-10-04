# Operations

Procedures for the Super Admin and administrators that the Phases 3–4 build added, and the
procedure for taking a phase's migration onto the main local database. Every action below is
audited; the audit log (Super Admin: the whole institute; an administrator: their own actions)
is where to confirm what happened.

## 1. Failed background jobs

Background work (e-mail, notifications, imports, exports, reminders, alerts) runs as pg-boss jobs
(ADR-0006). A job that fails after its retries is kept as failed.

1. Open **System health** (admin portal, Super Admin). The **Failed jobs** card lists recent
   failures: the queue, when it failed and the error message. Nothing else of the job (its data
   may hold personal details) is shown.
2. Read the message first. Retry only when the cause has gone (the mail server is back, the
   sandbox runner is up); a job that fails on its own data will fail again.
3. **Retry** sends that job back to its queue (`POST /admin/jobs/:id/retry`, audited `jobs.retried`).
4. If the same job keeps failing, leave it, note the message and the queue, and raise it with the
   development team; do not delete rows from the `pgboss` schema by hand.

## 2. Retention

The `retention.sweep` job runs every night at 02:30 India time (the queue schedules in Asia/Kolkata) and removes what the platform no
longer needs. Each sweep that removes anything records `retention.swept` with the counts.

| What                | When it goes                                                            | What stays                       |
| ------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| Report export files | When their download link expires                                        | The export row, marked `expired` |
| Import sheets' rows | 30 days after the import finished                                       | The import's counts and outcome  |
| Audit entries       | Only when **Settings → Records → Keep audit entries for (days)** is set | Everything newer than the period |

- The audit period is off by default (the log is kept for ever). When set, it is at least 1,095
  days (three years, the requirements' retention schedule) and at most 3,650.
- Changing it is a settings change: Super Admin only, and audited.
- To confirm a sweep ran: the audit log, action `retention.swept` (only when something was
  removed), or the API log line "Retention sweep".

**SI Academy AI's data** has a sweep of its own, `ai.retention.sweep`, every night at 02:45 India
time, with its periods from the AI settings (Super Admin, `PATCH /ai/admin/settings`):

| What                                | When it goes                                                               | What stays                              |
| ----------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| A conversation its owner deleted    | At the next sweep, with its messages, notes and answers kept for its owner | Nothing of it                           |
| An AI message                       | `conversationRetentionDays` after it was written (90 by default)           | The conversation, while it has messages |
| A conversation with no message left | Once last used before that period                                          | Nothing of it                           |
| A call in the usage ledger          | `usageDetailRetentionDays` after it was made (730 by default)              | The daily totals, kept for good         |
| A cached answer                     | Once it has expired, been invalidated or was written for an older prompt   | —                                       |

- An answer still being written keeps its conversation; an answer a stopped process left behind is
  closed as failed first. Notes written from messages that went are dropped with them.
- It runs whether or not AI is on. A sweep that removed anything records `ai.retention.swept` with
  the counts, or the API log line "AI retention sweep".

## 3. A learner's privacy request (export or erasure)

Requests come from the learner through the contact named in the privacy notice (IR-24). The
platform does not take them itself, so **confirm the requester's identity outside the platform**
(for example a reply from the e-mail address on the account) before acting.

**Export.** Open the learner (admin portal → Students → the learner) → **Privacy** tab →
**Export data**. A JSON file downloads: account, profile, batches, enrolments, lessons,
attendance, submissions, tests (scores only once released), documents and résumés by name,
applications, doubts, certificates, named feedback answers, recent notifications, active
sessions. Staff notes and staff-only fields are not included. Hand the file over through a
channel the learner controls; do not keep copies. Audited `privacy.exported`.

**Erasure.** Export first if the learner asked for both. Then **Privacy** tab → **Erase…**, type
the learner's e-mail address and the reason (for example "Requested by e-mail on 3 October
2026"), and confirm. It cannot be undone. What happens:

- the account becomes "Erased learner" with an address nobody can use, no password and no
  sessions; it leaves every list;
- profile details, documents, résumés, photo, staff notes, notifications, activity and drafts are
  deleted, their files removed from storage;
- certificates are withdrawn (a verifier is told so) and their PDFs deleted;
- batch places end; the text of answers, doubts and comments is removed;
- marks, attendance, progress and counts stay, belonging to nobody, so reports do not change;
- the audit log keeps its entries (the security record), subject to the retention period above.

An account that also holds a staff role is refused: remove the staff roles (or deactivate a staff
account) first. Audited `privacy.erased`, with the counts and the reason.

## 4. Certificates

- **Revoke** (Certificates page, administrators): give the reason; the learner is told, the public
  check says "revoked", the PDF no longer downloads. **Reinstate** restores it, again with a
  reason. Both are audited; the certificate's words never change (D9).
- **Redraw** draws the PDF again from the stored record, for example after a storage problem.
- **Signatory** (Settings → Records, Super Admin): the name and title printed under the
  signature line of certificates issued **from then on**; one already issued keeps the
  signatory it was issued with.

## 5. A phase's migration on the main local database

The main local database is `lms` in the Docker container `lms-postgres-1` (port 5433). Other
PostgreSQL instances on the machine (port 5432 and other projects' containers) are never touched.
Only do this after the client approves the phase.

1. **Back up.** `docker exec lms-postgres-1 pg_dump -U lms -d lms -Fc` to a file outside the
   repository (`E:\LMS-backups\lms-before-<phase>.dump`), and write its SHA-256 beside it.
2. **Verify the backup.** Restore it into a scratch database in the same container
   (`createdb lms_backup_check`, `pg_restore --no-owner`), compare row counts of every table with
   `lms`, then drop the scratch database.
3. **Record the counts** of every table in `lms` (before).
4. **Migrate.** `pnpm db:migrate` (Prisma `migrate deploy`: only the phase's new, additive
   migration applies).
5. **Seed the base only.** `pnpm db:seed` (the permission catalogue, role bundles and their named
   changes, flags). Never `db:seed:demo` or `demo:reset` on `lms`: they replace sample data.
6. **Compare.** Row counts after against before: only the expected rows change (new permissions,
   role grants, settings rows).
7. Write the result in `docs/PROGRESS_LOG.md`: file, size, checksum, verification, migration names,
   counts before and after.

## 6. Security settings and their limits (Phase 6)

**Storage links.** Browsers follow three kinds of link to stored files, and each has to name a host
they can reach:

| Link                                 | Set by                | Outside local                                                                                                                                                 |
| ------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public files (logos, photos)         | `S3_PUBLIC_BASE_URL`  | Required: a public `https` address, or the API does not start                                                                                                 |
| Signed uploads and private downloads | `S3_PRESIGN_ENDPOINT` | A public `https` host that proxies to the store unchanged. Unset, such links are refused with `503 storage_not_public` rather than naming `http://minio:9000` |
| The API's own calls to the store     | `S3_ENDPOINT`         | The internal address (`http://minio:9000` in the compose stacks)                                                                                              |

Caddy serves `/files/<public bucket>/…` for GET and HEAD only, under `Content-Security-Policy:
sandbox` and `nosniff`; every other `/files` path answers 404. SVG is not accepted for any image
shown to others.

**Stored secrets.** An integration's secret (Settings → Integrations) is sealed with AES-256-GCM
under `DATA_ENCRYPTION_KEY`, or, when that is empty, a key derived from `JWT_ACCESS_SECRET` for
this purpose only. Changing either key leaves the stored secrets unreadable: enter them again. The
API never returns a stored secret, only whether one is set.

**Sessions.** Signing out, revoking a device, an administrator ending a session, a role change, a
deactivation and a password reset end the session's access token too, within 15 seconds on a busy
process and at once on the process that made the change. A session lasts as long as its sign-in
(`JWT_REFRESH_TTL_DAYS`), however often it refreshes; "remember me" decides whether its cookies
outlive the browser. Two tabs refreshing with one token within 30 seconds both carry on; a rotated
token presented later ends its whole family (audited as `auth.refresh_reuse_detected`).

**Rate limits are per process.** The counters, the auth caches and the one-run-per-person gate live
in the API process's memory. One API instance is the supported deployment (the staging stack runs
one); behind several instances every limit would be multiplied by their number. A shared store is
Roadmap Phase 12. The limits worth knowing when a campus shares one address: sign-in 5 failed tries
per account and address in 15 minutes and 150 per address (a successful sign-in is not counted),
refresh 1,200 per address in 5 minutes, and 600 requests per session in 5 minutes for everything
else.

**SI Academy AI is off** (Roadmap Phase 7). `AI_PROVIDER=none`, the default, answers nothing;
`fake` is a deterministic stand-in for local development and tests, and the API refuses to start
with it outside local. The flag `module.ai` and its options (`ai.assistant`, `ai.workspace`,
`ai.lab_hints`, `ai.semantic_cache`) are off by default, and no option opens anything while
`module.ai` is off. Provider keys are server-only environment variables; the logger redacts
provider keys and authorization headers.

**Switching Gemini on** (Phase 7B; only once the client approves AI, operating rule 35):

1. Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` (from Google AI Studio) and `AI_MODEL`, a model the
   registry lists (`apps/api/src/modules/ai/routing/model-registry.ts`), for example
   `gemini-3.8-flash`. Optionally:
   - `AI_TASK_MODELS`, such as `title=gemini-3.5-flash-lite`;
   - `AI_FALLBACK_MODEL`, another listed Gemini model;
   - `AI_MODEL_COSTS`, from Google's price list.
2. Approve data classes in `AI_DATA_CLASSES`:
   - `public` alone by default;
   - `course` for course material;
   - `personal` only once the provider's data-use terms are verified and recorded (ADR-0024);
   - `restricted` never.
3. Restart the API. It refuses to start without the key or the model, on a model the registry does
   not list, or outside local on a placeholder key or a non-https `GEMINI_BASE_URL`.
4. Turn on `module.ai` and the wanted surfaces' flags.

`GET /ai/admin/status` (Super Admin) reports `service`. It never names the provider, the model or
the key:

- `ready`;
- `degraded`: the main model rests after repeated failures, and the fallback answers;
- `unavailable`: no configured model can be called;
- `off`: no provider is configured.

Each call is logged with provider, model, task, outcome, latency and tokens, without its content.
A resting model is logged as `AI model resting after repeated failures`.

**AI allowances and usage** (Phase 7C; ADR-0029). Each person may ask `AI_USER_DAILY_REQUESTS`
questions (default 50) and use `AI_USER_DAILY_TOKENS` tokens (default 100,000) a day, counted in
the institute's time zone. `AI_ORG_MONTHLY_BUDGET_USD` (empty by default) caps the institute's
estimated spend a month. With a budget set, every routed model needs a price in `AI_MODEL_COSTS`, or
the API refuses to start. Over an allowance, a question is refused (`429 ai_quota_exceeded`)
before any call, and `ai.quota.exceeded` is audited. Every call is in `ai_requests`, and the
day's totals per person are in `ai_usage_daily`; costs there are estimates in millionths of a
dollar, not a bill.

**AI answers through a proxy.** Answers stream as server-sent events. The API sends
`Cache-Control: no-store, no-transform` and `X-Accel-Buffering: no`, and a ping every 15
seconds. A proxy in front of it must not buffer or compress `text/event-stream`, and must allow a
response to last `AI_TIMEOUT_MS` (staging, Phase 14).

**An answer that never finished.** If the API stops mid-answer, the answer stays `streaming` and
holds that person's one-answer-at-a-time gate. Their next question closes it as `failed`
(`interrupted`) once it is older than `AI_TIMEOUT_MS` plus 30 seconds, then goes through; the
nightly AI retention sweep closes any left over. No action is needed.

**The institute's AI settings** (Phase 7D; `GET`/`PATCH /ai/admin/settings`, Super Admin only,
`module.ai` on). Each field left empty keeps the deployment's environment variable:

- `dailyQuestions`, `dailyTokens` (each person, each day), `monthlyBudgetUsd` and
  `budgetWarningPercent` (80 by default);
- `conversationRetentionDays` (90) and `usageDetailRetentionDays` (730), as in the table above;
- `dataClasses`, which can only narrow `AI_DATA_CLASSES`; `model`, `taskModels` and
  `fallbackModel`, among the models the registry lists for the configured provider;
- `cacheTtlHours` (168), how long a cached answer may be reused.

A change is checked whole — bounds, then the routing rules start-up applies — and refused with the
field named if anything is wrong; nothing is stored then. Each change is audited
(`ai.settings.updated`, before and after). The answer lists stored choices the deployment can no
longer honour under `ignored` (they are then not applied); keys never appear. Every API process
picks a change up within 30 seconds. Switching AI or the cache on and off stays with the flags.

**AI background jobs** (Phase 7D) run on the queue like the others and show on the Failed jobs card:
`ai.title` and `ai.summarize` (queued after an answer), `ai.cache.write` (after a complete answer),
`ai.usage.rollup` (hourly), `ai.budget.alert` (every 15 minutes), `ai.retention.sweep` (nightly).
Their payloads hold ids only. Each takes its work by a claim in the database, so a retried or
repeated job does nothing twice; a title or note that cannot be written leaves the conversation as
it was.

**AI usage and the budget** (Phase 7D). `GET /ai/usage` (`ai:usage_read`: administrators see
everyone, trainers the learners of their batches) gives questions, tokens and estimated cost per day
and per person; the Super Admin and administrators also see where the month stands against the
budget. The hourly roll-up sets each closed day's per-person totals to the usage ledger
(`ai.usage.reconciled` when it had to repair one). With a budget set:

- at the warning share, `ai.budget.warning` is audited once a month, and the API logs
  "AI budget alert";
- at the budget, `ai.budget.exceeded` is audited once a month, and no question is answered and no
  title or note written until the month ends or the budget is raised;
- costs are estimates from `AI_MODEL_COSTS`, never a bill.

**The AI answer cache** (Phase 7D; ADR-0032) reuses answers to general questions asked on their
own, matched by a normalised exact key — no embeddings or similarity, which are Phase 8's. It works
only for people the `ai.semantic_cache` flag reaches. To empty it at once — after changing course
material the answers relied on, or on any doubt — the Super Admin calls
`POST /ai/admin/cache/purge` (audited `ai.cache.purged`); answers are written afresh as they are
asked again.

**SI Academy AI in the web app** (Phase 7E). What each surface needs, besides `module.ai` and a
provider that answers:

| Surface                                           | Flag           | Permission      |
| ------------------------------------------------- | -------------- | --------------- |
| `/ai`, the workspace, and its menu entry          | `ai.workspace` | `ai:chat`       |
| The launcher and the assistant beside each page   | `ai.assistant` | `ai:chat`       |
| AI Hint in a lab's workspace                      | `ai.lab_hints` | `ai:hints`      |
| AI settings (`/admin/settings/ai`)                | —              | `ai:manage`     |
| AI usage (`/admin/ai-usage`, `/trainer/ai-usage`) | —              | `ai:usage_read` |

- "Ask SI Academy AI about this course / lesson" appears only when course material is approved:
  `course` in `AI_DATA_CLASSES` and in the AI settings' data classes. AI Hint needs `personal`
  likewise. Without them the assistant still answers general questions.
- AI Hint answers only after a submission that was not accepted; before that it says to try the lab
  first. It is a learner's alone — staff, the Super Admin included, get none — and needs the Labs
  module on; a lab placed only in a course's lessons follows the lesson's rules (enrolled, the course
  published, the module open).
- The launcher is not shown during a timed test, over a test paper, a lab or a workspace, or while
  the AI cannot answer.
- A learner who reports that the assistant "cannot see" a lesson: the lesson's module may still be
  locked to them, or the course withdrawn — the AI follows the same rules as the player.

**Phase 7's migrations and `lms`.** Applied on 4 October 2026 under §5, after the client approved
Phase 7: `20261007090000_phase7c_ai_conversations` and `20261008090000_phase7d_ai_lifecycle`
(backup `lms-before-phase7.dump`; progress log, session 35). AI stays switched off until it is
approved for production use.

**The knowledge base** (Phase 8A; ADR-0033). Managed through `/ai/knowledge` with
`ai:knowledge_manage` (the Super Admin's alone) while `module.ai` and `ai.knowledge` are both on.
There is no page for it yet, and nothing retrieves from it before Phase 8D.

- A source is written as a draft, published once, and archived for good. Who it is for and what it
  holds are fixed when it is published.
- A version's text is kept in the private bucket with a `files` row that names no uploader: a
  learner's erasure never removes it, and the files API never serves it by id.
- Its migration, `20261009090000_phase8a_knowledge_base`, reaches `lms` only after the client
  reviews the 8A schema, under §5. Until then, keep `ai.knowledge` off on `lms`: its tables are not
  there yet.
- pgvector: `infra/postgres/Dockerfile` prepares the image (ADR-0026's 8A record). Local, CI and
  staging switch to it together in Phase 8C, never one at a time, and a glibc image is never
  pointed at an existing data volume.

**Start-up refusals outside local.** The API refuses to start with `COOKIE_SECURE=false`, a short
or placeholder (`change-me`, `replace-me`) secret, the local development passwords, a short
`RUNNER_TOKEN`, or an `S3_PUBLIC_BASE_URL` that is not a public `https` address. The route map
(Swagger) is published locally only.
