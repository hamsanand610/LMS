# Development progress log

One entry per working session. Newest first. IDs refer to the master report (F-/P-/Q-), the architecture plan (M-/DP-/J-/D-/DQ-) and the backlog (BL-). From 2 October 2026 phases are those of the active roadmap (`docs/ROADMAP.md`), written "Roadmap Phase N"; earlier entries use the original plan's foundation phases and the client's Tasks 1–4.

## 2026-10-08 (session 49) — Production reconciliation: content, recorded classes, AI and e-mail readiness

**Brief.** The client's production reconciliation and product completion brief. Reuse what exists;
promote content, never people; bring back the Phase 7–9 AI with Groq as Gemini's stand-in; e-mail to
any address; recorded classes; placement verified; database safety first.

**Found (local against production).**

- **Why production was empty**: production runs only the base seed by design, and SI Academy's
  content existed only inside the demo seed, which also writes 71 accounts, batches and activity.
- **What the demo content is**: the question bank (157 questions, 53 runnable and verified in the
  sandbox) and the 14 assignment definitions are original material written for SI Academy. The 120
  course lessons all share one generic body (placeholders, no media); the 3 tests are demo scenarios;
  the 5 companies (`.example` domains) and 5 drives are fictional; the legal pages are placeholder
  text.
- **Video**: the API could upload and play videos; no page could upload one. Saving a course outline
  erased every lesson's resources; playback links expired after 2 hours without renewal.
- **AI**: no key in production, `public` data only, no stand-in; the knowledge base is empty and has
  no page in the portal.
- **E-mail**: the SES sandbox reaches verified addresses only; a real sending domain does not exist.
- **Custom domain**: blocked by the organization's denial of us-east-1, and no domain exists.

**Built.**

- **Content promotion**:
  - `prisma/seed/content.ts` writes the taxonomy terms, the question bank (a coding question is
    published only with its verification) and the assignments as unattached drafts. Create-only.
  - It reuses the demo seed's writers, moved into `question-bank.ts` unchanged; a scratch demo seed
    matches the local database on all 12 tables compared.
  - It runs only when the deploy workflow is started with "promote content", behind the pre-release
    snapshot. The demo seed now refuses production whatever is set.
- **Recorded classes**:
  - The course builder uploads a lesson's video, and the recording dialog uploads a class
    recording: MP4 or WebM up to 2000 MB, one presigned PUT, with progress, cancel and retries, and
    the length measured by the browser. A recording keeps its measured length.
  - An outline saved without resources keeps them.
  - The player renews an expired link and carries on from the same second.
- **AI readiness** (still off):
  - `AiDataClasses` may be `public,course`.
  - `AiFallbackProvider` `groq` with `AiFallbackModel`; Gemini needs its key and a model, and Groq
    its key and model.
  - `personal` is refused until ADR-0041's terms are recorded.
- **E-mail**: `EmailDomain` creates the domain's SES identity with DKIM and outputs its records.
  The runbook gives the path to production access.
- **Tests**: `content-promotion.e2e-spec.ts` (6), `course-video.e2e-spec.ts` (4) and
  `placement-search.e2e-spec.ts` (4), the browser journey `recorded-classes.spec.ts`, and the renderer
  tests (11).

**Production.**

- **Deploy #5** (`3a86bdf`, promote content) was green in 16m10s, behind its snapshot. 157
  questions, 67 terms and 14 draft assignments were created; 80 tables were unchanged, including
  every account.
- **Accounts**: 2 active (the Super Admin and the client's test learner, who signed up through an
  SES invitation); no demo account.
- **Public bundles** (18 scripts): no secret pattern; `.env`, `.git` and the API docs answer 404.

**Blocked outside the code**:

- the Gemini and Groq keys, the Gemini tier and its terms;
- the client's approval of AI before Phase 10;
- a sending domain and SES production access;
- a domain and ACM in us-east-1.

**Next.** The client's UAT, then the keys and approvals above. Gaps recorded:

- the course builder has no resource editor;
- the knowledge base has no page;
- videos above 2000 MB need multipart upload and a wider `files.size`.

## 2026-10-08 (session 48) — Production live on AWS: https://d39kxid0rpunjw.cloudfront.net

**Brief.** The client's go-ahead: bootstrap, the main stack, the first release, and one controlled
second release through the pipeline. Constraints: stay on the Free plan, create no duplicates,
print no secret, keep AI off. Signed-in testing is the client's own.

**The account's limits, met on the way** (both decided by the client):

- **Backups**: the Free plan caps RDS backup retention at 1 day; 7, 3 and 2 were rejected. Retention
  is 1, and manual snapshots still work, so every release takes one.
- **Capacity**: ap-southeast-2c had no db.t4g.micro capacity, so the new `DbAvailabilityZone`
  parameter puts the database in 2b. The host stays in 2c.

**Built** (stack `si-academy-production`, 58 resources, `UPDATE_COMPLETE`):

- **Edge**: CloudFront with a VPC origin to an internal load balancer in the two new private
  subnets, and S3 for `/files`.
- **Database**: RDS PostgreSQL 16.15, encrypted, `rds.force_ssl` on, deletion protection.
- **Storage and images**: three S3 buckets, all with public access blocked, plus five immutable ECR
  repositories.
- **Operations**: seven Secrets Manager secrets, five log groups, and ten alarms, all OK.
- **The guard**: still one EC2 instance, the default VPC, no NAT gateway, no Elastic IP, and only
  the existing Zero Spend Alert.

**Host adopted** (`i-0659cb9f754afdf5d`):

- tags, profile `si-academy-production-host`, the app security group;
- IMDSv2 at one hop: no token from inside a container;
- launch-wizard-1 down to its SSH /32;
- Docker 25, Compose 5.5.1, 2 GiB of swap, the CloudWatch agent, the RDS authority;
- SSM online.

**First release** (tag `production-2026-10-08-1` on 250e4ea, deploy run #1, green in 21m43s):

- 20 migrations, the base seed, and the first Super Admin (sign-in in Secrets Manager
  `si-academy/production/admin`, never printed);
- api, web and runner healthy, both target groups healthy;
- the database connection is verified TLS 1.3;
- 22/22 anonymous smoke checks through CloudFront.

**Second release** (dd33e96, tag `production-2026-10-08-2`), a harmless, identifiable change:

- The images job writes `/version.json` with the commit, and the smoke checks require it to name the
  deployed commit.
- The release log prints the AI flags and the API's AI configuration.
- The smoke checks confirm that the five AI routes refuse anonymous callers.
- **Result**: deploy run #2 was green in 18m24s.
  - Jobs: infrastructure 34s with no stack change; images 12m40s; release 4m35s; verify 18s.
  - The release took a pre-release snapshot, found no pending migration, and left the seed and the
    admin alone. The log read: every AI flag off; provider none; stand-in none; data public; Gemini
    and Groq keys not set.
  - The site has served `{"commit":"dd33e96…"}` at `/version.json` since 08:52 UTC.
  - 28/28 smoke checks passed, in the pipeline and from outside.

**AI**: every `module.ai`/`ai.*` flag off, provider `none`, stand-in `none`, data `public`. There is
no `ai` secret, so no Gemini or Groq key exists in the account.

**Found, not changed**:

- **No email**: e-mail is off (`EmailDriver` none), so invitations and password resets reach no
  one. Only the Super Admin can sign in until SES is set up; runbook §7 now says so.
- **No passkeys**: Passkey/WebAuthn is not implemented in the product. This is a feature gap, not a
  deployment failure.
- **No alarm recipient**: `AlarmEmail` is empty, so the alarms notify no one.

**Super Admin sign-in fixed** (no product change, no seed, nothing else touched):

- **The fault**: the client had edited the admin secret to a new address and password. The secret is
  read only when the first Super Admin is created. The new address belonged to no account, and the
  only Super Admin (`superadmin@siacademy.example`) kept its first password.
- **The decision**: the client chose to keep the existing address.
- **The fix**:
  1. The secret's `email` was set back to the existing address. The password field was carried over
     unread and unprinted.
  2. On the host through SSM, the approved `users:create-admin` CLI ran from the release image, as
     `release.sh` runs it, behind a guard: the address must be exactly one active Super Admin. It
     re-hashed the password (Argon2id) and recorded an audit entry.
- **Checked**: one real sign-in through the API (200), then that session signed out (204). The
  database still has one account, which matches the secret. The runbook (§3) now describes this
  reset.

**Next.** The client signs in as Super Admin and runs the manual UAT. They decide on SES (sandbox for
UAT) and an alarm address. Phase 10 not started.

## 2026-10-08 (session 47) — Production on AWS reconciled: Sydney, the existing host, no NAT

**Brief.** The client's reconciliation decisions, after a read-only inventory of the real account
(nothing in AWS created or changed in this session):

- region locked to ap-southeast-2;
- reuse the EC2 instance `i-0659cb9f754afdf5d` and the default VPC, with private subnets added;
- RDS PostgreSQL 16.15 on db.t4g.micro;
- CloudFront → private load balancer → the host → RDS;
- close launch-wizard-1's public 80/443 and keep its SSH rule; attach the role; IMDSv2 at one hop;
  the tags;
- AI off, Gemini only on its free tier, no Groq, public data only;
- sized for 2 GiB with one learner job at a time, images built in CI;
- no second budget;
- a deploy-user fallback, because the organization denies OpenID Connect providers.

**The inventory** (read-only describe and list calls, and IAM's policy simulator; no secret value
read):

- **The account**: Free plan with US$120 of credits, ending 7 April 2027.
- **The host**: a t3.small on Amazon Linux 2023, x86_64, 30 GiB encrypted gp3, in ap-southeast-2c,
  with no role, IMDSv2 at two hops, and unlimited CPU credits. Its group allows SSH from one address,
  and ports 80/443 from anywhere.
- **Nothing else exists**: no RDS, S3, ECR, secrets, stacks, load balancers or CloudFront.
- **The organization's policy**: it allows the deployment in ap-southeast-2, denies us-east-1, and
  denies `iam:CreateOpenIDConnectProvider`.

**Changed (no product code).**

- **`infra/aws/stack.yml`** (80 → 62 resources):
  - removed: the VPC, internet gateway, public subnets, NAT gateway and Elastic IP, S3 endpoint,
    launch template and new host, two alarms and the budget;
  - added: two private subnets in the default VPC, with a route table of local routes only;
  - the existing host as a parameter, receiving the load balancer's traffic and the alarms;
  - RDS defaults to db.t4g.micro, in the host's zone; logs kept 30 days; ECR keeps 5 images;
  - the Groq, model-price and AI-budget parameters removed; AI data public only, with a daily
    allowance of 5.
- **`infra/aws/bootstrap.yml`**:
  - `DeployAuth`, `iam-user` by default: a deploy user that can only assume the deploy role;
    `oidc` stays the preferred option;
  - host adoption rights, scoped to that instance and its own group;
  - the Ubuntu image lookup removed.
- **`infra/aws/pipeline/adopt-host.sh`** (new, idempotent): tags; profile; app group; IMDSv2 at one
  hop after the role; public 80/443 closed; waits for SSM.
- **`infra/aws/host/prepare-host.sh`** (new, Amazon Linux 2023): Docker and the CloudWatch agent
  from dnf, Docker Compose v5.5.1 with its SHA-256 checked, 2 GiB of swap, the RDS authority. It
  replaces the old host's first-boot script.
- **Releases and the renderer**:
  - `release.sh` runs `prepare-host.sh`, and `run-release.sh` bundles it.
  - `render_env.py` makes Gemini the only provider, refuses any data class but `public`, sets the
    daily allowance, and caps the Node heaps at 640 and 320 MiB.
  - `compose.production.yml` limits memory to 900 / 512 / 256 MiB.
- **Configuration and workflows**:
  - `production.json`: ap-southeast-2, with the inventory's values.
  - `deploy-stack.sh`: the PostgreSQL version comes from `production.json`, and is checked as offered.
  - `bootstrap.sh`: supports `deployAuth`, and never calls the denied OIDC operations in `iam-user`
    mode.
  - Deploy workflow: every job takes the deploy user's key from the `production` environment's
    secrets (OIDC when they are empty), and adopts the host after the stack.
  - `infra.yml`: checks `production.json` against the template, and the Sydney lock.
- **Docs**: ADR-0042 amended, the AWS runbook, `infra/aws/README.md`, the overview, `STACK.md`.

**Next.** The client's go-ahead for the bootstrap: an administrator runs `infra/aws/bootstrap.sh`,
makes the deploy user's key in the console, and stores it in GitHub's `production` environment. Then
a `production-*` tag starts the first deployment. Phase 10 not started.

## 2026-10-07 (session 46) — Production on AWS: the environment, its pipeline, rehearsed

**Brief.** The client's AWS deployment brief (7 October 2026), from main at `16a8f8c`. Execute the AWS
deployment with `docs/runbooks/aws-readiness.md` as the source of truth: infrastructure, PostgreSQL
with pgvector, S3, secrets, configuration, build, migration, deployment, health checks, production
smoke tests and verification, all in one pass. Stop only for an AWS credential, account, billing or
network action. Never ask for a secret. AI flags off and personal data off. No product change.
Phase 10 not started.

**Deviation recorded.** The roadmap puts production after Phases 10 to 14. The client's instruction
builds it now; this is recorded in `docs/ROADMAP.md` (rule 47) and ADR-0042.

**Built (ADR-0042).**

- `infra/aws/stack.yml` (CloudFormation), in Mumbai:
  - a VPC with private subnets and one NAT gateway;
  - CloudFront with a VPC origin to an internal load balancer;
  - one Ubuntu 24.04 Docker host, with no SSH and IMDSv2 at one hop;
  - RDS PostgreSQL 16 (16.5 or later), encrypted, TLS required, backed up and deletion-protected;
  - private and public S3 buckets, the public files under `/files` through Origin Access Control;
  - secrets generated in Secrets Manager;
  - ECR with immutable tags;
  - CloudWatch logs and alarms, and an optional budget.

  The load balancer preserves CloudFront's `X-Forwarded-For`, so the API's single trusted hop still
  sees the learner's address.

- `infra/aws/bootstrap.yml` and `bootstrap.sh`, once per account:
  - GitHub's OpenID Connect trust;
  - the deploy role, assumable only from this repository's `production` environment;
  - CloudFormation's execution role;
  - the pipeline bucket.
- `.github/workflows/deploy-production.yml`, the only way production changes (rule 41):
  - the stack, without automatic rollback;
  - the commit's images, built into ECR;
  - a pre-release database snapshot;
  - the release on the host through SSM Run Command;
  - health and smoke checks through CloudFront.
- On the host:
  - `infra/compose.production.yml`;
  - `infra/aws/host/release.sh`, `render_env.py` and `db-check.cjs`.

  Secrets go straight to root-only files on tmpfs, and each container gets only its own. The base
  seed and the first Super Admin run on a new deployment only, under the product's production-seed
  guard.

- `clients/si-academy/`: SI Academy's branding and settings, with every AI flag and the optional
  modules off (rule 35).
- `.github/workflows/infra.yml` runs cfn-lint, ShellCheck, actionlint, the renderer's tests, the
  compose file, and the overlay's flags.

**Verified locally.**

- `render_env.py`: 8 tests passed, 1 skipped on Windows (POSIX permissions; it runs on Linux CI).
- Both templates checked structurally: 80 and 5 resources, every reference resolved.
- The compose file renders.
- A rehearsal against a throwaway PostgreSQL 16.14 with pgvector that, like RDS, refuses
  unencrypted connections (scratch container, never `lms`):
  - verified TLS 1.3 works; another authority and plaintext are both refused;
  - all 20 migrations apply through the same URL; pgvector 0.8.7 is installed;
  - the seed is refused without the production flag, and with it seeds SI Academy (78 permissions,
    25 taxonomy terms);
  - the first Super Admin is created once;
  - every AI flag and optional module is off, and the core modules are on.
- The built API booted in production mode on that database:
  - its production checks pass, and the database is ready over TLS;
  - the branding says "SI Academy";
  - anonymous calls get 401 problem+json;
  - CORS allows the site's own origin only;
  - the Super Admin signs in with the release's password, with HttpOnly, Secure, SameSite=Lax
    cookies.

**Stopped for the account.** This machine's AWS CLI has no credentials, so nothing exists on AWS
yet. An account administrator must sign in (`aws login`) and run `bash infra/aws/bootstrap.sh`; the
deploy workflow then creates and releases everything (`docs/runbooks/aws-production.md`).

## 2026-10-07 (session 45) — Roadmap Phase 9C to 9F: the learning agent completed

**Brief.** The client's Phase 9 completion brief (7 October 2026), after the 9C reconnaissance:
build 9C (context and learning state), 9D (workflows and UI), 9E (security and evaluation) and 9F
(performance, hardening and closure) in one continuous execution, with no approval between slices;
commit, push, CI; then an AWS readiness review. No persistent learner memory; no LangChain,
LangGraph, Redis or autonomous agent; personal data only while approved.

**Built (ADR-0040, ADR-0041; items AI-9C-01 to AI-9F-02 in `docs/phases/PHASE-09-ai-learning-agent.md`).**

- **9C.** Two read-only tools with strict `{}` arguments, both `personal`: `learning_state` (the
  pinned course's progress, its lessons open or locked, the lock-aware next lesson — or what opens
  it — and what is due; with no course, the learner's courses) and `lab_attempt` (the pinned lab and
  the learner's own latest failed attempt, behind the AI Hint's gate; never runs anything). AI-safe
  reads that ask for themselves: `CourseLearningStateService` (courses), `aiDueSummary`
  (assignments), `aiOpenWindows` (tests), `aiLabSubject` and `latestFailed` (practice); the hint gate
  shared. Data classes per call (`mostSensitive` of subject, history, evidence); history taint (an
  answer kept with its draft's class; history read with its classes; unapproved classes left out;
  the Phase 7 gateway refuses history more sensitive than its conversation); the trace bug fixed.
  The personal-data gate: unavailable unless approved (`context_unavailable`), never to a stand-in
  unapproved for it. The last check re-asks the learner's state, what is due (assignments, tests),
  the lab and the answer's class. Lab answers hold no code (`solution_code`).
- **9D.** The assistant beside a course or lesson is the learning agent for a learner with it on:
  suggested questions, steps in fixed safe words, verified answers with their sources, the
  platform's own words as a note. "Explain my failed attempt" beside a lab after a failed attempt.
  Agent conversations in the `/ai` workspace (started and continued); the page opens to agent-only
  learners.
- **9E.** `test/ai-agent-context.e2e-spec.ts` (the learner-context security suite) and
  `test/ai-agent-evaluation.e2e-spec.ts` (20 deterministic cases through the stream).
- **9F.** Bounds (state 3,000 characters and 40 lessons; lab 6,000), deadlines (5 s each), no extra
  model call (route and draft: two calls for a state or lab answer); documents.

**Found and fixed while verifying.** The lab tool first explained the latest attempt — a pass, for a
learner who had passed since; it now explains the latest attempt that did not pass and says when a
later one passed (never its code). A "what is due" answer was not re-checked against the
assignments' and tests' own permissions before delivery; it now is.

**Documents.** ADR-0040 and ADR-0041 (accepted); ADR-0039 amended; `AI_ARCHITECTURE.md` §1, §2, §5,
§9, §10; the Phase 7 and 8 plans' and `PRODUCT_DIRECTION.md`'s memory and LangChain/LangGraph
wording; the AI module's README; this log; the roadmap. The tests module README's "`none` shows
neither" does not match the code (a released score is shown under `none`): reported, not changed.

**Verification.**

- Unit: shared 168, API 641, web 76, runner 16. Typecheck 9 of 9, lint 9 of 9, formatting,
  builds 6 of 6.
- Full API end-to-end: 57 of 57 files, 725 of 725 (the 9B agent spec 39, the learner-context suite
  28, the evaluation set 1, Phase 7 and 8 unchanged but two availability expectations brought up to
  date). One more learner-context test was added after that run (the latest failed attempt): its spec
  passed whole, 29 of 29; CI runs all 726.
- Evaluation: 20 of 20 cases correct; unauthorized leakage 0, protected-data leakage 0, fabricated
  citations 0, unchecked streaming 0, successful injections 0, personal data to the stand-in 0. Every
  run within the 9B limits; server time with the fake provider p50 129 ms, p95 314 ms.
- Deliberate breaks: 54 of 54 caught — 9B's seventeen re-run against the Phase 9 code, and 37 for
  9C to 9F (data classes, history taint, the stand-in, lock-awareness, the AI-safe reads' own checks,
  the lab gate and its projection, hidden labels, no code, required context, the last check's
  state, lab, due and class re-checks, the gateway's history check, arguments, bounds, credentials, a
  timed test) — each file restored and its SHA-256 verified; the eight lab breaks re-run on the
  final lab code.
- Browser (Playwright, the AI journeys on a scratch database `lms_ci_smoke`, the fake provider,
  synthetic demo data): Chromium 13 of 13; phone 11 passed, 2 skipped (desktop-only pages). An earlier
  phone run failed one of the new journeys (a selector matched a hidden label; fixed) and, in the
  retry, a Phase 7 journey on the demo learner's daily AI allowance (50 a day), spent by five local
  runs in a row (`ai.quota.exceeded` in the scratch audit; CI's fresh database runs each project
  once).
- No migration, no seed change; `lms` untouched.
- No live provider call: the providers and the router are unchanged since the Phase 8 gates, and the
  per-class routing is proved deterministically with a Groq-like stand-in.

**Committed and pushed.** `369bd8a` (`feat(ai): complete phase 9 learning agent`): 81 files —
Phase 9C to 9F, their tests and documents, and `apps/api/openapi.json` regenerated (it also catches
up 9B's route) — with no environment file, key, build output or temporary file; a secret scan of
the staged diff found nothing. Pushed `93e086c..369bd8a` with the normal hooks (a fast-forward).

**CI.** GitHub Actions run #34, green on every job (23m 56s): lint, types, unit and API tests;
the sandbox runner and question bank; the Playwright smoke on Chromium and on a phone; the container
images.

**AWS readiness.** Reviewed after CI: `docs/runbooks/aws-readiness.md` — what is ready, what each
area still needs on AWS, the first deployment's checklist, and the blockers (none in the code; the
client's go-ahead, one API replica until the in-memory gates move, a Docker host for the runner, a
paid Gemini quota and, for the learner's own data, its terms in ADR-0041). Nothing is deployed.

**Complete.** Phase 9 = 100%: 9A to 9F. Phase 10 NOT STARTED, and only with the client's go-ahead.

## 2026-10-06 (session 44) — Roadmap Phase 9B: approved; its migration on `lms`; integration

**Brief.** The client approved Phase 9B on 6 October 2026 and asked for its integration and closure
gate: back up, migrate, verify, regression, final review, commit, push, CI, report. 9C is not
started.

**The database gate (runbook §5).**

- **Pending before:** exactly one migration, `20261013090000_phase9b_agent_purpose`. Its SQL is the
  one statement `ALTER TYPE "AiPurpose" ADD VALUE 'agent'` (unchanged).
- **Backup:** `E:\LMS-backups\lms-before-phase9b.dump`, 629,590 bytes, SHA-256 `8a428e2e…fb921`,
  written beside it. Restored into a fresh scratch database (`lms_backup_check_9b`), all 90 tables
  had the same row counts as `lms` (4,346 rows), with the same enum, HNSW index, pgvector 0.8.7 and
  migration history. The scratch database was then dropped. An older `lms_backup_check`, a Phase 1
  restore, was found and left as it was.
- **Migrated:** `prisma migrate deploy`; `lms` went from 19 migrations to 20. The migration alone
  changed one row, its own in `_prisma_migrations`. `AiPurpose` is now assistant, workspace,
  lab_hint and agent.
- **Seeded (base only):**

  | Table            | Before | After | What                                                                                  |
  | ---------------- | ------ | ----- | ------------------------------------------------------------------------------------- |
  | permissions      | 77     | 78    | `ai:agent`                                                                            |
  | role_permissions | 237    | 239   | `ai:agent` to `student` (own) and `super_admin` (all)                                 |
  | feature_flags    | 24     | 26    | `ai.agent` and Phase 8E's `ai.knowledge_answers` (never seeded here before), both off |

  Every other table is unchanged (4,346 → 4,352 rows). The HNSW index's definition and pgvector
  0.8.7 are as before; `lms` holds no knowledge vectors.

- **Verified on `lms`:** the compiled API was booted inert (no worker, no e-mail, no AI provider).
  - `ai:agent` is held by the learner and the Super Admin, not the trainer.
  - With `module.ai` and `ai.agent` off, the learner is refused (`ai_feature_disabled`).
  - The Super Admin is refused an agent conversation: "for learners".
  - An `agent` conversation is accepted by the database; that insert was rolled back.
  - AI reach equals course reach, and is empty without `courses:read`.
  - A learner's question view holds only its words and options.
  - A snapshot after the boot: no row changed.

**Regression (the tree committed).**

- Unit: shared 167, API 596, web 65, runner 16.
- Typecheck 9 of 9, lint 9 of 9, formatting, builds 6 of 6.
- The agent's end-to-end spec: 39 of 39.
- Full API end-to-end: 55 of 55 files, 696 of 696, with no connection drop.
- Security recheck: the 17 deliberate breaks, 17 of 17 caught, each file restored and its SHA-256
  verified.
- Phase 8 regression: retrieval's SQL, selection and ranking, the grounded answers, the Gemini and
  Groq providers, the circuits and the model registry are byte-for-byte unchanged. The router
  gained only the optional `beforeFallback`. The retrieval, answers, fallback, knowledge and
  course-access specs are all among the 696.

**Committed and pushed.** `ff60c00` (`feat(ai): complete phase 9b bounded learning agent
foundation`): 73 files — the pre-9B hardening, Phase 9B, its tests, its migration and its
documents — with no environment file, key, build output or temporary file. Pushed
`98dc5d0..ff60c00` with the normal hooks (a fast-forward; Smart App Control did not block them).

**CI.** GitHub Actions run #32, green on every job: lint, types, unit and API tests; the sandbox
runner and question bank; the Playwright smoke on Chromium and on a phone; the container images.

**Closed.** Phase 9B is CLOSED and APPROVED: 9B 100%. 9C NOT STARTED, and only with the client's
go-ahead.

## 2026-10-06 (session 43) — Roadmap Phase 9B: the learning agent's foundation and orchestrator (built; awaiting review)

**Brief.** The client's Phase 9B brief, 6 October 2026, sent after approving 9A's reconnaissance and
closing the pre-9B hardening. It asks for:

- a native, bounded orchestrator in `apps/api/src/modules/ai/agent/`, with one capability: explain
  the lesson being studied, or clear a doubt, from approved lesson and knowledge material;
- two read-only tools;
- every limit enforced in code, and cancellation end to end;
- only verified output streamed;
- `ai:agent` and `ai.agent`, and the conversation purpose `agent`;
- the 28 security cases, with deliberate breaks.

Out of scope: UI, LangChain, LangGraph and Redis. No commit or push.

**Built (ADR-0039; `docs/phases/PHASE-09-ai-learning-agent.md`).**

- Shared contracts: `schemas/agent.ts` — the request, the `stream` query, the result, the citations
  and the stream's events, all strict. The `agent` purpose and feature, the flag `ai.agent`, the
  permission `ai:agent` (students' own).
- The agent module (`ai/agent/`):
  - the hard limits and `RunBudget`, which counts every call before it is made;
  - the strict JSON protocol (routing, and the one follow-up);
  - the prompts, reusing Phase 8E's grounded instructions as they are;
  - `verifyDraft`, the agent's checks on top of Phase 8E/8F's `checkAnswer`;
  - the run's evidence, with citation ids unique in the run;
  - `AgentRun`, the bounded recipe;
  - the tool contract and its allow-list registry, which re-authorizes every call afresh;
  - `knowledge_search` (Phase 8D's retrieval, unchanged) and `lesson_content`
    (`LessonsService.aiContextFor`);
  - `AgentService` and `AgentController`: `POST /api/v1/ai/agent/conversations/:id/runs`,
    10 runs per 5 minutes.
- The one migration, `20261013090000_phase9b_agent_purpose`: `AiPurpose` gains `agent`.
- Additive changes elsewhere:
  - the router's `beforeFallback`;
  - a ledger call may name its own task, and `AiUsageService.runBlockedBy`;
  - a turn may carry its own prompt version;
  - agent turns are abandoned only past the run's deadline and 30 s;
  - the messages route refuses agent conversations (422);
  - agent conversations are a learner's;
  - the fake provider answers routing and the follow-up;
  - `createTestApp`'s `aiModels` option;
  - three compile-only map entries in the web app (no UI change);
  - `PERMISSION_MATRIX.md` regenerated (one row).

**Verified (this machine).**

- Unit: shared 167, API 596 (the agent's 80, the router +1, the providers +1), web 65, runner 16.
- The agent's end-to-end spec, 39 of 39: the integration journeys and the 28 security cases. Cases
  21 to 24 are shown by the audit's counters in one adversarial run, and by unit tests at the real
  limits.
- Deliberate breaks, 17 of 17 caught: authorization (four kinds), arbitrary tools and arguments,
  the tool-call limit, cancellation, unverified streaming, credential leakage (four kinds), the
  loop, the messages route, the stand-in's count and the token budget. Each file was restored and
  its SHA-256 verified.
- Typecheck, lint, formatting (every tracked file) and the builds: clean, through turbo.
- Full API end-to-end: **55 of 55 files, 696 of 696** on the third run. The two before it:
  - **Run 1** (692 of 696): two stale Phase 7A expectations (the student's `ai:agent`, the
    availability map's `agent`), now updated. The new spec left the institute's `ai` settings row
    behind for the next spec; the cause was reproduced with the two files in a fixed order, and the
    spec now deletes the row, as the 8E spec does. The privacy test's 30-second timeout came while
    its queries failed with "Server has closed the connection".
  - **Run 2** (694 passed, 1 skipped): a test application's bootstrap lost its connection the same
    way, and one privacy export stalled.
  - Every test that failed passes alone. Postgres's own log shows no dropped client, and a probe of
    1,800 queries at rest saw none: the drops are Docker Desktop's port forwarding under the
    suite's load, as in session 42.
- Migration: `prisma migrate diff` from the migrated test database to the schema shows only the
  known HNSW index line (never applied). `lms` is at 19 migrations: the 9B migration is not applied
  there (an enum value cannot be taken back); it goes with approval, behind the backup gate.

**Fixed during verification.**

- The run's audit entry is written before the result is given, as 8E's are.
- A run cancelled while its quotas were being read starts no further model or tool call. The
  scripted `@hang` had shown a call started on an already-aborted signal.

**Not done.** No live Gemini or Groq call: the scripted providers cover every path, and none was
needed. No UI. 9C not started. Nothing committed or pushed.

**Next.** The client's review of 9B. Then, only with approval: the migration on `lms` (backup
first), the commit and push, and 9C.

## 2026-10-06 (session 42) — Roadmap Phase 8: GitHub CI repaired; Phase 8 CLOSED

**Brief.** The client's, after the six Phase 8 commits reached `origin/main` (5 October 2026): CI
run #28 for `bfbfab9` failed, as had every run on `main` since #15, and Phase 8's closure is blocked
until the pipeline is green. Classify each failure (product, test or CI harness, environment, or a
deliberate Phase 8 change), fix the real ones without hiding any (no disabled tests, no weaker
rate limits, no longer timeouts or retries), verify, push normally, and wait for CI. Phase 9 not
started.

**What CI showed (runs #15 to #28, read on GitHub; #14, `4ebcaa1`, was the last green run).**

- The load spec's `read ECONNRESET` (#25, #27, #28) and `ECONNRESET: Connection reset by peer`
  (#26): **test harness.** `createTestApp` never made the application listen, so supertest
  started the server for the first request that found it stopped and stopped it when that request
  ended, while requests sent alongside it were still waiting to be accepted; on Linux, closing a
  listening socket resets every connection queued on it. Reproduced without the application on
  Linux (Node 22, supertest 7.2.2): with the starting request ending first, 32 of 35 requests
  reset in 5 of 5 runs; against a server already listening, 150 bursts of 35 gave exactly 30
  served and 5 limited each, and no reset. Windows accepts the whole queue first, so it never
  failed here. Not the earlier oversized-request reset (`3749a96`: a 413 written before the body
  was read); the rate limiter was right throughout.
- The launcher journey (#17 to #24) and the Phase 7C streaming journey (#15, #16): **CI
  configuration.** The smoke job never set what `e2e/ai.spec.ts` says it needs (the paced fake
  provider and the data classes), so its API ran with `AI_PROVIDER=none` and offered no assistant.
  Behind it, the course journey opened ids from the database it was written on, which no fresh
  seeding has (**test**).
- J8 (#23): **test.** The deadline (now + 180 minutes) was looked for in the week shown only; the
  schedule's weeks end on Sunday in the institute's time zone, and J8 began at 21:31 IST on Sunday
  4 October, so the deadline was next week's (replayed with the schedule's own week rule).
- "refuses before any call" answered 200, not 409 (#25): **test.** Its wait for the hanging
  question matched an earlier test's `@hang` in the file-wide scripted provider, so the second
  question raced the first.
- The `@hang` stream assertion (#22): **test**, fixed in 8F (`dd58fab`, `\b503\b`).
- No failure was a product defect or a stale expectation from a deliberate Phase 8 change.

**Fixed.** The test application listens once, on loopback, until `app.close()`
(`test/setup/app.ts`; the three specs that started the listener read its port); the load spec
settles requests sent together with `allAnswered` (`test/setup/http.ts`), which fails a request
that got no HTTP answer as that, never as a 429, 409 or 503; the one-at-a-time wait matches the
test's own question; J8 looks for the deadline in this week or the next, as for the class; the AI
journeys find their course by its slug (`core-java`, or `E2E_AI_COURSE_SLUG`); the smoke job runs
them on the paced fake provider (`AI_PROVIDER=fake`, `AI_FAKE_DELAY_MS=50`,
`AI_DATA_CLASSES=public,course,personal`). No product code changed.

**Verified (this machine).** The load spec 7 times (6 clean; once a Postgres socket reset, below),
the two answer tests 5 of 5; the API e2e suite: 652 passed and one file's later block stopped by
the same kind of reset, that file then 18 of 18 alone (653 of 653 between them); unit 754 (API
514, shared 159, web 65, runner 16); typecheck, lint and builds clean (run as `pnpm -r` in
dependency order: Smart App Control was blocking `turbo.exe` for part of the session). Playwright
against a stack set up as CI's smoke job (a fresh database migrated and seeded with generated
passwords, the API with the smoke job's AI settings, the production web build): chromium 100
passed before the course fix (that journey the one failure; the three after it in its serial
block not run) and the AI journeys 10 of 10 after it; the phone 102 passed, 3 skipped (desktop
only).

**Environment notes.** Twice under load, Prisma reported "Server has closed the connection" (an
`ECONNRESET` on the database socket) while PostgreSQL logged nothing and has no timeouts set; a
plain `pg` probe of 3,000 new connections through Docker Desktop's port forwarding saw none. Never
seen on CI. The scratch database, the temporary launcher and launch entry were removed after the
run.

**GitHub CI.** Run #29 (`c7ebcfd`): all four jobs green (the API tests 653 of 653, the load spec 3
of 3; the sandbox; Playwright on chromium and the phone; the container images), but one journey
only on Playwright's retry: the workspace's delete check asked the server before it had answered
the page's DELETE, which the page sends after showing the conversation gone, by design (**test**).
Fixed: the journey waits for the DELETE's answer. With the DELETE held back 1.5 seconds, the old
check saw 200 in 3 of 3 runs and the new one 404; the AI journeys then ran twice clean on each
project. Two local phone runs before that met SI Academy AI's own limit (20 messages a person in 5
minutes) after back-to-back runs with one learner: the limit at work, not a failure.

**Phase 8 CLOSED (6 October 2026, with the client's approval).** The final CI verification is GitHub
Actions run #30 (`202e863`): every job green — lint, types, unit and API tests; the sandbox runner
and question bank; Playwright smoke on chromium (104 passed, 1 skipped) and the phone (102 passed, 3
skipped), nothing passing on a retry; the container images. Its smoke job ran on the third attempt:
GitHub's incident with hosted runners (5 and 6 October) cancelled the first two before any test
ran. Final status: complete, verified, both external gates closed, CI green, no code blocker. What
production still needs is configuration and rollout, not Phase 8 code: a paid Gemini quota; the
evidence floor (`AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY=0.71`) on every server; model prices under a
budget; Groq's key, Zero Data Retention and data-processor listing if the stand-in is enabled; one
API replica. The larger-rollout items and future capabilities stay in the deferred register
(`docs/phases/PHASE-08-COMPLETION.md`, section 17). Phase 9 not started.

## 2026-10-05 (session 41) — Roadmap Phase 8: external verification, circuit recovery, Groq stand-in

**Briefs.** The client's briefs after 8F (5 October 2026): where the Gemini and Groq keys go
(inspection only); Gemini's embedding smoke, the dimension diagnostic and its fix; the evidence
floor calibrated on the evaluation corpora; the circuits' half-open recovery; and Groq as a
controlled secondary provider with Gemini primary — the last built and verified, not yet approved
or committed. Phase 9 not started.

**Done.**

- `14aca56` (pushed): Gemini's live API ignored `embedContentConfig` (a 768 request came back as
  3,072 values); the adapter sends the task type and dimension at the top of each request too, and
  cuts a full 3,072-value vector to 768, renormalised (ADR-0035).
- The evidence floor for `gemini-embedding-001`, measured through the API on the 8E and 8D corpora
  with real vectors: 34 answerable questions 0.733–0.868, 20 unanswerable 0.472–0.685; the midpoint
  rounded up, **0.71**. The 8E evaluation on `gemini-3.5-flash` at 0.71: 30 of 30 as allowed, no
  false accept or refusal, 21 of 21 citations valid, nothing unauthorised, protected or planted.
  Set in `apps/api/.env` only (gitignored).
- `acf0f1c` (pushed): `serviceState()` counted a half-open circuit as unavailable, so the assistant,
  grounded answers and the browser's availability never sent the probe — a rested model stayed
  busy until a restart. A read-only `CircuitBreaker.admits()`; tests through both paths.
- Groq standing in for Gemini (ADR-0038; uncommitted): `GroqAiProvider` (OpenAI-compatible chat
  completions over `fetch`, no SDK; never embeds), `AI_FALLBACK_PROVIDER=groq`, `GROQ_API_KEY`,
  `GROQ_BASE_URL`; Groq's production text models in the registry (`openai/gpt-oss-120b` and `-20b`
  — its Llama models, shut down for free and developer tiers on 16 August 2026, were removed once
  the live gate showed them gone), `public` and `course` data at most; the router calls each model
  through its own provider, rests each provider's model on its own failures, and gives each model
  tried its own deadline (a timeout may now fall back); a grounded answer's audit entry records
  `fallback`. ADR-0038, ADR-0024's amendment, the runbook's
  Groq section, the env examples, the staging compose file, `STACK.md`; `pnpm ai:fallback-smoke`.

**Verified.** Typecheck 9/9, lint 9/9, unit 752 (API 512), builds 6/6, format clean; the API e2e
suite as CI runs it (the new `ai-provider-fallback` spec: the real Gemini and Groq adapters over a
stand-in network — a Gemini 503, 429 or timeout answered by Groq from the same evidence, checked,
cited and audited as the stand-in; a refused key, a timed test, a credential and weak evidence
never reaching Groq; neither key anywhere but its own header). Live: Gemini through the new router
answered (`gemini-3.5-flash-lite`, cited); a real Gemini 429 (`gemini-3.5-flash`, its free daily
quota spent) handed the request to Groq.

**Groq's external gate (closed, with the client's new key).** `ai:fallback-smoke` on
`openai/gpt-oss-120b`: Groq on its own answered and cited (under 1.5 seconds); a real Gemini call
(`gemini-3.5-flash`) that passed its 60-second deadline was answered by Groq through the router,
cited and checked (`gemini timeout → groq ok, stand-in`); the simulated overload likewise; a real
non-eligible failure (a deliberately invalid Gemini key, `API_KEY_INVALID`) never reached Groq; no
key or key-shaped string in any output. One transient Groq 503 (retry after 15 seconds) on the
first attempt; every later call answered.

**The final closure audit.** An independent review of the whole uncommitted change, every finding
checked against the code: an assistant answer that a stand-in was still writing could be closed as
abandoned (the window allowed one model's deadline) — `ModelRouter.longestCallMs()` now sets it;
an institute's stand-in saved before Groq dropped all its routing choices, its narrowed data classes
with them — it is now set aside and reported alone; the runbook's switching-off step, the budget
wording, the AI module's README and `AI_TIMEOUT_MS`'s description were corrected; a lab hint asked
while Gemini rests is refused at the call (documented). The e2e global setup no longer copies
`apps/api/.env` into the test workers (only `DATABASE_URL` is read), so a developer's floor or keys
never reach the fake-provider tests. Real streaming verified through both adapters; Gemini's
retrieval quality measured from the calibration's rankings (8D: recall@5 and precision@1 23 of 23,
MRR 1.000). The closure report gains section 17: both gates closed, the register reconciled.

**Open.**

- Gemini's free tier allows 20 generations a day per model; production needs a paid key.
- Going live waits on configuration and procurement only (the closure report, section 17): a paid
  Gemini quota, the 0.71 floor on the servers, prices if a budget applies, Groq's key and Zero Data
  Retention if it stands in, one API replica. No code blocker; the Phase 8 gate is the client's.

## 2026-10-05 (session 40) — Roadmap Phase 8, slice 8F: hardening and Phase 8 closure

**Brief.** The client's Phase 8F brief (5 October 2026), which builds on 8E and so approves it: the
final hardening, verification, deferred-item disposition and closure of Phase 8 — the whole
architecture audited, the security guarantees of 8A–8E consolidated, the knowledge lifecycle,
idempotency and recovery verified, Gemini verified if a key exists (else an external gate), the
evidence floor calibrated on Gemini (else deferred), citation semantic validation evaluated, a final
evaluation, a bounded load test, the multi-process limits, observability, usage and storage audited,
a final deferred register, the PDF and automatic-ingestion decisions, the API, OpenAPI and database
audited, the full regression. "Do NOT claim 'Phase 8 fully production-ready' if real Gemini
verification, PDF support, or another actual production requirement remains unresolved." Out of
scope: Phase 9 and everything in it. Items AI-8F-01 to AI-8F-12; the result is
`docs/phases/PHASE-08-COMPLETION.md`.

**The 8E state, verified first** (AI-8F-01). `main` at `5073c40`, clean and in step with
`origin/main`. `lms` and `lms_preview` at 19 migrations, none unfinished. No Gemini key:
`AI_PROVIDER`, `GEMINI_API_KEY`, `AI_MODEL`, `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` and
`AI_MODEL_COSTS` unset in `apps/api/.env` and the environment.

**The audit** (AI-8F-02). Two read-only audits, 8A–8B and 8C–8E, against ten categories. Each
finding was verified before anything changed — one was overstated (the chunker's "endless" loop
ends, after seconds, at an array's limit) and one the auditor could not confirm proved real (the
bracket run). Fixed, each with a test and a deliberate break:

- **Retrieval during a timed test** (blocker): `POST /ai/knowledge/retrieve` embedded the question
  and returned course passages while an attempt was open, against ADR-0031; it now refuses (403
  `ai_not_allowed`, audited `timed_test`) before anything is embedded.
- **The sentence split's quadratic look-behind** (blocker): 200,000 closing brackets kept it busy
  past 40 seconds; matched from the whitespace instead, the breaks are identical (50,023 fuzzed and
  corpus texts) and the paragraph takes 12 ms. No chunk the chunker writes changes.
- **A part with no room** (should-fix): a fence, a language or a nesting wider than a chunk cut
  nothing over and over for 4–6 seconds and much memory; it now fails at once, `chunking_failed`.
- **Credentials in knowledge** (should-fix): stored, embedded (sent to the embedding provider) and
  retrievable; now refused when the version is created (422 `ai_restricted_content`), nothing
  stored; the evidence also scans the source's name and the title. The 8E specs that stored one
  through the API write it straight to the database as legacy data, so answers' withholding is still
  proved.
- **Source writes** (should-fix): a change of audience read the source as a draft and wrote it
  unconditionally, so a publication in between was overwritten; a second archive re-stamped it. Both
  now hold only in the state they read (409).

Recorded, not changed (the completion report, section 4, and register B): a version or a run left
`processing` or `embedding` after a crash until a manager asks again; a failure's error class not in
its log line; a version-number collision told "duplicate"; a wide table header dropped (a chunker
version change); two refusals not audited as described; a batch's vectors left behind by a
concurrent archive (never ranked); flags and settings per installation.

**Citation semantic validation** (AI-8F-06). `answers/support.ts`: each cited sentence's numbers
must be in its passages and at least half its content words; else `unsupported_citation`, once more,
then withheld. On 14 synthetic sentences of known truth it caught 6 of 9 unsupported citations and
accepted 4 of 5 supported ones; what it cannot do (a related passage, a partial claim, a negation in
the passage's own words; a paraphrase in other words) is asserted by the evaluation, so the record
stays true, and is register B. End to end, an off-topic citation of a real passage and a changed
figure are withheld.

**Lifecycle, idempotency, recovery** (AI-8F-04): `test/ai-knowledge-lifecycle.e2e-spec.ts`, 4 tests
— a source's whole life through the API with a failure and recovery at ingestion and at embedding, a
stale version never drawn on, a newer version taking its place, archiving; each step twice or twice
at once doing it once; the audit fixes; and the records a whole life leaves (ledger, audit, logs: no
text, no key; the ledger's only text columns fixed vocabularies). The answers spec gained a provider
429, a refused key, two support faults and a stream abandoned over a real socket (the work stops, is
audited, and the person may ask again).

**Load** (AI-8F-08): `test/ai-knowledge-load.e2e-spec.ts`, 3 tests — 50 retrievals at once in two
courses and two institutes (all served; 90 results checked against the reach rule; 1.85 s each while
all queued on the pool; 11 MB), 12 answers at once (8 served, 4 `ai_busy`, never more than 8 at
once), one person 5 at once (1 served, 4 in progress), a burst of 35 retrievals (30 served, 5
`rate_limited`).

**Evaluation** (AI-8F-07), on the final code: answerable 11 of 11, unanswerable 19 of 19, 14
citations all valid, uncited sentences 0, UNAUTHORIZED_INFORMATION 0, PROTECTED_DATA_LEAKS 0,
FABRICATED_CITATIONS 0, PROMPT_INJECTION_SUCCESS 0; an answer 95 ms at the median (137 at the 95th
percentile), the first streamed event 84 ms, the first `delta` 105 ms.

**API, OpenAPI, databases** (AI-8F-11). Fourteen knowledge routes, each with its permission, flags,
strict schema and problem codes, all in the OpenAPI document; the twelve management routes now
declare their cookie authentication (they required it; the document did not say). Regenerated from
the compiled API on `lms_preview` (a temporary launch entry, restored byte for byte): eleven paths
changed, none added or removed, no schema changed. `lms` and `lms_preview`: 19 migrations, up to
date, the one known HNSW line in the schema diff, no knowledge data, every integrity count nought.
Correction to session 39: starting the API on `lms_preview` for 8E's OpenAPI run added the new
flag's row there (the module registry adds a missing flag, off, at every start) — it was not read
only.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each, one at a time).
Formatting clean on every tracked and new file (1,250). Production builds pass for shared, ui,
module-sdk, the runner, the API and the web app (97 pages). Unit tests 676: API 436 (6 new), shared
159, web 65, runner 16. API end to end: the answers spec 16 of 16, the evaluation 3 of 3, the
lifecycle spec 4 of 4, the load spec 3 of 3; **the full suite: 51 files, 638 tests, all 638
passing** (630 before, 8 new). The first full run failed one test of Phase 7C's conversation stream:
it forbade "503" anywhere in the stream, and a message id held "…-4503-…"; it now looks for a status
standing alone (a separate commit), and the second run passed whole. Thirty-seven rules broken on
purpose on the final, formatted code — 8E's 29 again and 8F's 8 — every one caught, every file
restored byte for byte (the suite was stopped once mid-break to run faster; the file under change
was restored by hand and every file checked against its fingerprint).

**Gemini: EXTERNAL VERIFICATION PENDING** — no key; nothing was called; the floor not calibrated on
Gemini and `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` left unset; the runbook's "Gemini: the external
verification" lists the steps.

**Decisions.** PDF: deferred (register B) — the authored corpus is HTML or Markdown; only uploaded
lesson resources (PDF, DOCX, PPTX) would need an extraction engine, and no client decision makes
them part of the production corpus. Automatic course-material ingestion: deferred (register C), its
architecture recorded (an outbox, a document per lesson, versions by content hash, the existing
jobs, a reconciliation sweep).

**Phase 8.** TECHNICALLY COMPLETE; VERIFIED with the fake provider only; NOT PRODUCTION READY — the
external Gemini gate and the blockers (Gemini verified, its floor and support threshold, prices,
cross-process limits before a second replica). No migration; no new dependency; no web change; no
Phase 9 work.

**Not touched:** ET-EMS and SLTS (containers exited on 1 October), the other databases, every other
project, port 3000; `lms` only read.

**Next.** The client reviews 8F and decides the Phase 8 gate. Production readiness waits on the
developer's Gemini verification. Phase 9 only with the client's go-ahead.

## 2026-10-04 (session 39) — Roadmap Phase 8, slice 8E: grounded answers

**Brief.** The client's Phase 8E brief (4 October 2026), which builds on 8D and so approves it:
grounded RAG answer generation — answers made only from the authorised passages 8D's retrieval
returns ("THE MODEL MAY ONLY MAKE KNOWLEDGE CLAIMS THAT ARE SUPPORTED BY THE AUTHORIZED RETRIEVED
CONTEXT"), cited, and declined when the evidence is not enough; the provider abstraction extended
and the registry's model; a minimum similarity chosen from measurements ("Do NOT choose a random
threshold"); the prompt's architecture and defences against injection in the knowledge and in the
question; protected data checked again before the request; deterministic context packing;
citations validated; one regeneration at most; streaming; usage, audit, limits and failures; a
fake generation provider; a guarded smoke test; an evaluation with groundedness metrics; 24
deliberate breaks; OpenAPI; a migration only if needed. Out of scope: agents and tool calling, web
search and crawling, long-term and learner memory, mock interviews, an AI evaluation system,
hidden-test solving, reference-solution exposure, automatic course ingestion, PDF and OCR, AWS,
Redis, LangChain, LangGraph. Items AI-8E-01 to AI-8E-19 (`docs/phases/PHASE-08-rag-knowledge.md`,
with grounded answers, the calibration, the evaluation and performance, the 8E matrix and the
deferred items).

Earlier the same day, on its own: the oversized-request race in the `auth` end-to-end file fixed
(`3749a96`: the request keeps its connection alive, so the 413 is read before the socket closes;
the focused test 10 times, the file 3 times and the full suite passing).

**The 8D state, verified first** (AI-8E-01). Branch `main` at `3749a96`, clean and in step with
`origin/main`. `lms` and `lms_preview` each at 19 migrations, the last
`20261012090000_phase8d_knowledge_retrieval`; `vector` 0.8.7; `vector(768)` under the HNSW cosine
index; no vectors in `lms`. The embedding contract `gemini-embedding-001` at 768 dimensions (the
fake's `fake-embedding-2` in tests); `KnowledgeRetrievalService`, the reach rule, the model
registry and router, the ledger, the audit, Phase 7's answer stream, the AI error contract and the
rate limiter as 8D left them. No Gemini key on this machine (`AI_PROVIDER` unset in
`apps/api/.env`).

**Built** (ADR-0037, proposed).

- **The route** `POST /ai/knowledge/answer` (200) for `ai:chat`, with `module.ai`, `ai.knowledge`
  and a new option flag, `ai.knowledge_answers` (off by default), on; 20 in five minutes per
  person, one answer at a time each (409), eight at once per process (503 `ai_busy`), never during
  a timed test. A strict request: a question, a course or lesson, `stream`; passages, context,
  citations, a prompt, a model, a temperature, a data class, an institute or K are refused (400).
- **The pipeline** (`knowledge/answers/answer.service.ts`): the flags, the timed test, the
  institute's settings, the question classified (a credential refused, 422), a model that may answer
  and be given the data, an evidence floor for the active embedding model (503 without one), the
  allowance and the budget — then 8D's `retrieve`, unchanged, for eight passages: nothing in 8E
  reads the knowledge base or queries pgvector. No model is called before that.
- **The evidence floor** (`evidence.ts`), per embedding model, from the evaluation's measurements:
  0.40 for `fake-embedding-2`; for Gemini none until `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` (more than
  0, at most 1) is set from Gemini's own measurements, and answers are refused until then.
- **The evidence** (`packEvidence`): retrieval's order; each passage at or above the floor, of a
  data class approved for the provider now, holding no credential; six passages and 12,000
  characters at most; `S1`, `S2`, …; those withheld counted by reason. None: the answer declines and
  no model is called.
- **The request to the model** (`grounded-prompt.ts`, version `si-academy-8e-1`): the instructions
  and a reference code made for the request in the system channel; the passages and the question as
  data in the person's, inside `<evidence>`, `<passage id="S1" …>` and `<question>`, neutralised
  (delimiter tags defanged, citation-shaped text rewritten); the `chat` task's registry model
  through `ModelRouter.chat`, temperature 0.2 (a provider request may now carry one; Gemini gets it
  in `generationConfig`), 1,024 output tokens at most.
- **The check** (`validation.ts`): empty, too long, the instructions or the code, a credential, a
  decline, a conflict, any citation mark not exactly one of the evidence's identifiers, no citation,
  an uncited sentence; once more with a reminder, then withheld (`not_grounded`). Citations are
  built from retrieval's results; a conflict is shown with its sources and the advice to check with
  the course team.
- **The stream**: problems before the evidence; `meta` once it is chosen; `delta`, `sources`,
  `notice`, `usage` and `done` once the answer is checked; `error` and `done` after a failure. The
  stream writer (`answer-stream.ts`) now takes a route's own events.
- **Records**: each model call in the ledger (`knowledge`/`rag_answer`, a question of the person's);
  one audit entry per answer (`ai.knowledge.answer`: status, reason, counts, the passages withheld
  by reason, attempts and faults, the documents cited, the model, the instructions' version, times —
  never the question, a passage, the answer, the instructions or the code), amending ADR-0028's item
  4 as ADR-0036 did; one log line of numbers. No conversation, memory or cache.
- **Failures**: `knowledge_answer_unavailable` (503), `knowledge_answer_timeout` (504: the model's
  part within `AI_TIMEOUT_MS` × 2 + 5 s), `knowledge_answer_failed` (502), `ai_busy` (503), beside
  retrieval's; a client gone stops the work, audited as cancelled.
- **The fake** answers a grounded request from its passages (each passage's sentence sharing most of
  the question's words, the best two, a conflict when alike but for their numbers, a decline with
  none) and obeys planted instructions, so the tests prove the checks against the worst model; the
  tests' scripted provider adds the failures. `ai:rag-smoke` is the guarded live check (synthetic
  text; `--calibrate` measures Gemini's similarities).

**Found and fixed.**

- A provisional floor of 0.30 let the evaluation's weakest passages — two of them planted
  instructions — into the evidence of factual questions, whose answers were then withheld. Measured,
  the corpus separates at 0.298 and 0.495; the floor became the midpoint, 0.40.
- The fake's reading of a passage broke on a heading path holding `>`: attributes are read as
  quoted values.
- The response carries no request id, so the evaluation pairs each answer with its retrieval through
  their audit entries' shared request id.
- Two "unanswerable" questions of the evaluation had no passage above the floor at all: their
  outcome is a decline (`insufficient_evidence`), and two questions were added whose closest passage
  is a planted instruction (`not_grounded`).
- Run beside the 8D specs, the 8E spec's institute-wide passages paraphrased the 8D corpus
  (inheritance, interfaces, loops, generics) and took first place for one of 8D's exact questions
  (precision@1 0.9): the 8E spec now uses words of its own.
- The evaluation counted every answer audited in the shared database (71 for its 30 questions); it
  reads its own learners' entries now. It also counted a citation of another spec's authorised,
  retrieved passage as fabricated: a citation is judged against the request's own retrieval and
  audit entry, one outside the corpus is counted apart, and every metric names its findings when it
  fails.
- The shared package's stale build hid the new schemas from the API's type-check: rebuilt.
- One deliberate break went uncaught at first (the answer's own allowance check; see below): a test
  of the day's questions used up was added.

**Evaluation** (AI-8E-17; the plan has the tables). Calibration: the closest passage of each of the
11 questions the corpus answers at 0.495 or more, of the 11 it cannot at 0.298 or less (eight more,
whose outcome is the checks' whatever the floor, not measured); the floor 0.40. Thirty questions
over 22 documents, as three learners: answerable answered 11 of 11 (none refused wrongly);
unanswerable declined or withheld 19 of 19; 14 citations, all valid; uncited sentences 0;
UNAUTHORIZED_INFORMATION 0, PROTECTED_DATA_LEAKS 0, FABRICATED_CITATIONS 0, PROMPT_INJECTION_SUCCESS 0.

**Performance** (one machine, the fake's model, so the platform's own overhead): an answer 91 ms at
the median, 106 at the 95th percentile; retrieval 57 and 62 ms (the question's embedding 38 and 42,
the search 18 and 20); the model's part 1 and 6 ms. Streamed: `meta` after 73 ms (118), the first
`delta` after 97 ms (148) — with the whole answer, as it is written only once checked. The evidence
162 characters at the median, 353 at most; the largest request about 15,300 characters (about
3,800 tokens) with the instructions' 1,282.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each, one at a time).
Formatting clean on every tracked and new file (1,245). Production builds pass for shared, ui,
module-sdk, the runner, the API and the web app (97 pages); the API's first attempt died for want
of memory (`Fatal process out of memory: Zone`: other applications held all but 0.6 GB of the
machine's commit limit) and passed once the page file had grown.

Unit tests 670: API 430 (20 new — the answer check 7, the evidence 5, the prompt and the fake's
grounded answers 7, Gemini's temperature 1), shared 159 (3 new — the request, the fields refused,
the answer and its citations), web 65, runner 16.

API end to end:

- the answers spec (`test/ai-knowledge-answers.e2e-spec.ts`), 15 of 15: the gate (the permission,
  three flags, a timed test; nothing embedded, retrieved or sent otherwise); 15 bodies refused and
  the 21st answer in five minutes; provenance, the same answer twice, instructions in the system
  channel and data in the person's; declines without a model call; another institute's, staff,
  another course's, a closed lesson's, draft, archived and personal knowledge never sent or shown;
  course material withheld when only public data is approved, a credential never sent; planted
  instructions and forged delimiters, a role switch; instructions and a forged block in the
  question; eight citation and content faults, one retry each; a conflict; the provider
  unavailable, unreadable, too slow, empty and blocked, and retrieval's own failure; a credential
  in the question, no floor known, a spent budget, the day's questions used up and an answer
  already being written, all refused before any call; the stream, a refusal before it and a
  failure in it; the ledger, the allowance and the audit entry without the question, a passage,
  the answer or the code; a client gone;
- the evaluation (`test/ai-knowledge-answers-evaluation.e2e-spec.ts`), 3 of 3;
- the four knowledge specs together (8D's retrieval and evaluation beside 8E's), 33 of 33;
- **the full suite: 49 files, 630 tests, all 630 passing** (612 before, 18 new), in one run of
  13 minutes.

**Deliberate breaks.** Twenty-nine rules were broken on purpose on the final, formatted code —
the brief's 24 and five more — each run against the 8E unit specs and both 8E end-to-end specs,
and the files restored byte for byte (every code file's SHA-256 the same after the run as before
it): retrieval authorisation (every course's material); the data-class check; a credential's
passage sent; the no-evidence refusal; uncited claims; a fabricated citation; an unknown citation
dropped quietly; the question in the system channel; passages not neutralised; the instruction
leak check; the credential check on answers; personal knowledge retrievable (another learner's
notes); staff material for learners (where answer keys and moderation notes live); the institute
scope; citation validation; the evidence's bounds; 25 attempts; the answer's own allowance check;
the flag; the provider's error passed through; the question and the answer in the audit; the
stream opened before retrieval; no evidence floor; two answers at once; help during a timed test;
no usage recorded; the permission; a forged block out of the question. Twenty-eight were caught on
the first run. The answer's own allowance check was not: retrieval refuses a spent budget or the
day's tokens itself, but counts no questions, so only a person whose questions for the day are
used up tells the two apart — that case was added to the refusals test, and the break, run again
with the unchanged code, was caught (as was two answers at once, which the same test proves):
29 of 29.

The compiled API on `lms_preview` (a temporary launch entry, restored byte for byte, SHA-256
`ee7ba339…`): no session, 401 on the new route. The OpenAPI document regenerated from that run: the
one new path, `POST /api/v1/ai/knowledge/answer` — cookie authentication, the strict request, JSON
or
`text/event-stream`, the answer and its citations, and 400, 401, 403, 409, 422, 429, 500, 502, 503
and
504 described; nothing else changed.

**Real Gemini: NOT VERIFIED — no developer key configured.** `ai:rag-smoke` without a key prints
"NOT CONFIGURED — nothing was called" and exits 0; with a placeholder key and no `--confirm` it
refuses (exit 2). Nothing was sent anywhere.

**Database.** No migration: 8E adds no table, column or index. `lms` and `lms_preview` stay at 19
migrations; `lms_preview` was only read, by the OpenAPI run. The new flag's row reaches `lms` with
the base seed (`pnpm db:seed`, which adds missing flags, off) — not run, as nothing asked for it.

**Security.** Retrieval is still the only reader of the knowledge base; the answer removes, never
adds. Nothing unchecked reaches a reader, the stream included. The request cannot carry passages,
citations, a prompt, a model, a data class or an institute. No question, passage, answer,
instruction or code reaches the audit, the ledger or the logs. No Gemini call, no learner data sent
anywhere, no `fetch` added, no new dependency, no LangChain, LangGraph, Redis or AWS, no web change.

**Not touched:** ET-EMS and SLTS (their containers exited on 1 October, start and finish times
unchanged), the other databases, every other project, port 3000.

**Deferred, carried forward** (the plan's table): from 8A and 8B, automatic course-material
ingestion, PDF, Word, PowerPoint and OCR, topic, skill, batch and role audiences, knowledge purging,
re-chunking for a new chunker, personal knowledge, the reach rule under load; from 8C, automatic and
bulk embedding, the live Gemini check, a price for `gemini-embedding-001`, a registry for CI's
database image, Prisma and the HNSW index; from 8D, retrieval measured with Gemini, a retrieval
cache
(only with a measured need), retrieval at production scale, and the minimum similarity — now
calibrated for the fake, Gemini's waiting for a key; from 8E, a live Gemini answer, the answer's
limits tuned on Gemini, checking what a cited passage says, answers in conversations, a page for
answers, and one answer at a time across API processes.

**Next.** The client reviews 8E — ADR-0037 above all: the flag, the evidence floor per embedding
model and Gemini's refusal until it is measured, the check and the single retry, the stream that
writes only checked text, the audit entry per answer (amending ADR-0028), no conversation, memory or
cache. The live check needs the developer's key. Then slice 8F only with the client's go-ahead.

## 2026-10-04 (session 38) — Roadmap Phase 8, slice 8D: access-controlled retrieval

**Brief.** The client's Phase 8D brief (4 October 2026), which builds on 8C and so approves it:
access-controlled semantic retrieval — a question embedded as `RETRIEVAL_QUERY`, the scope resolved
on the server, a vector search with authorisation inside the database query ("The vector database
must NEVER return unauthorized knowledge merely because the content is semantically similar"),
cosine ranking, deterministic ties, top K, provenance, usage and audit; an evaluation set; 24
deliberate breaks; performance at 1K, 10K and larger with the query plans; any migration by a
controlled procedure; OpenAPI. Out of scope: RAG answers, Gemini chat generation, a citations UI,
conversational memory, agents, web search and crawling, prompt orchestration, answer streaming, a
learner-facing RAG workspace, automatic course ingestion, PDF, DOCX, PPTX and OCR, personal
knowledge, Redis, LangChain, LangGraph, AWS. Items AI-8D-01 to AI-8D-15
(`docs/phases/PHASE-08-rag-knowledge.md`, with retrieval, its evaluation and performance, the
contract Phase 8E consumes, the 8D matrix and the deferred items).

**The 8C state, verified first** (AI-8D-01). Branch `main` at `7e4a0ed`, clean and in step with
`origin/main`. `lms` and `lms_preview` each at 18 migrations, the last
`20261011090000_phase8c_knowledge_embeddings`, "Database schema is up to date!"; `vector` 0.8.7;
`knowledge_chunk_embeddings.embedding` `vector(768)` under
`USING hnsw (embedding vector_cosine_ops)`; no vectors in either; 72 users in each. The contract:
`gemini-embedding-001` at 768 dimensions, embedding version `embed-1`, the fake for tests.

**Built** (ADR-0036, proposed).

- **The route** `POST /ai/knowledge/retrieve` (200) for `ai:chat`, with `module.ai` and
  `ai.knowledge` on — no new permission or flag (Step 28: the knowledge base's switch covers drawing
  on it; off, a controlled 403 and no search) — 30 in five minutes per person. A strict request: a
  question (3 to 1,000 characters), K (1 to 20, 5 by default) and, perhaps, a course or lesson;
  anything else is refused (400), an institute, data classes, archived or unpublished material, a
  model or a vector included.
- **The scope, the server's** (`KnowledgeRetrievalService`): `reachOf` for each request; a course
  context checked by the courses service, a lesson by the lesson player (403
  `knowledge_retrieval_forbidden` otherwise); context only narrows.
- **The question** classified as the gateway classifies one (a credential refused, 422; course data
  from a course or lesson, else public; 403 `ai_data_not_approved` when the provider may not have
  it), the person's tokens and the institute's budget checked, then embedded through
  `ModelRouter.embed` with the purpose `query` under the active contract, the vector checked.
- **The search** (`KnowledgeVectorSearch`): one transaction, one snapshot. First what may be ranked,
  found by the database from the scope (published sources of a retrievable class, and the
  context's; the documents to leave out — inactive, a closed lesson's, another lesson's; the
  versions to leave out — any not current and chunked); then the ranking on the vectors' table
  alone, every rule a condition before ranking, by cosine distance — the HNSW index with
  `hnsw.iterative_scan = relaxed_order` and `ef_search` at least the candidates, or exactly for a
  small scope — each candidate joined to its chunk while its hash holds, and its provenance; ordered
  by distance, then chunk id; `statement_timeout` within the deadline.
- **Selection** (`selection.ts`): four candidates per passage asked for (at most 100), a chunk once,
  a text once, two passages of a document at most, the first K; similarity 1 − cosine distance.
- **The result**: each passage's chunk (id, position, heading, content, hash), similarity, source,
  document and version with their provenance; the context drawn for. Never a vector or a distance.
- **Bounds and failures**: 10 seconds in all, the work stopped when the client goes;
  `knowledge_retrieval_unavailable` (503), `knowledge_retrieval_timeout` (504),
  `knowledge_retrieval_failed` (502 for the provider's answer, 500 for the search) — the project's
  own naming for the brief's examples — never SQL, Prisma or the provider's words.
- **Records**: one ledger row for the question's embedding (feature `knowledge`, task `retrieve`;
  the person's tokens, not a question); one audit entry per retrieval (`ai.knowledge.retrieval`:
  outcome, K, context, counts, documents, duration, contract — never the question, not even its
  hash, a passage or a vector), amending ADR-0028's item 4; one log line of numbers. No cache.
- **The fake embeds by words** (`fake-embedding-2`): shared words make vectors close, so retrieval
  is tested and measured offline; the 8C fake hashed whole texts, which made every two texts
  equally far.
- **The reach rule asks about lessons at once**: `LessonsService.openLessonIds`, the player's
  module-lock walk moved into one function that the player's own check (`requireUnlocked`) and the
  new method share.
- **Migration** `20261012090000_phase8d_knowledge_retrieval`: `toast_tuple_target = 8160` on
  `knowledge_chunk_embeddings` — each vector kept in its row. No column, index or row changes.
- **Reused, nothing added**: the reach rule, the courses service and lesson player, the router and
  its checks, the classifier, the usage ledger and budget, the audit service, the flags, the rate
  limiter, the error types. No new dependency.

**Found and fixed.**

- The first search was one statement joining every table: correct, but the planner misjudged the
  joins and ranked every vector exactly — 1.6 seconds at 50,000 vectors. Ranked on the vectors'
  table alone, after what may be ranked is found in the same snapshot: about 21 ms.
- At 10,000 vectors the planner still ranked a broad scope exactly, in 240 ms: pgvector stores a
  vector EXTERNAL, and each 3,080-byte vector had been moved into the TOAST table, from which an
  exact ranking read every one back. With rows kept whole, 15 ms by the HNSW index (exact: 18 ms
  instead of 250). `SET STORAGE PLAIN` was tried first: it moved the content hash out of line
  instead.
- The reach rule asked the lesson player about each lesson in turn: about 15 ms a lesson, 3 seconds
  for a course with 200 lesson documents. Asked all at once: 31 ms, the same answers.
- The search's three settings were three round trips; now one.
- Three test faults the first full run found: the 8C audit test looked for the stored vector's
  first component in the logs, and the lexical fake's vectors are sparse — that component was 0,
  found in any log; it now takes one that is not nought. The 8C embeddings spec and the new
  retrieval spec left the institute's AI settings row behind, which `ai-lifecycle` does not expect
  when it runs after them; both now remove it, as the other AI specs do. The provenance test
  searched the whole answer for the word "vector", passages' own words included — and with no
  minimum similarity, another spec's material can fill the top K; it now judges the answer's
  structure (no such field, no list of numbers, the result's exact fields).

**Evaluation** (AI-8D-11; the plan, "Retrieval: evaluation and performance"). 21 synthetic
documents and 32 questions through the API, as two learners: Recall@5 1.0, MRR 1.0, no empty
result, **no unauthorised passage** (each checked with `mayRetrieve`); questions with no answer at
0.21 similarity at most, answered ones at 0.43 at least; median 74 ms. Lexical vectors: meaning
waits for Gemini.

**Performance and plans** (AI-8D-12; Steps 26 and 27; the plan has the tables). Vectors shaped like
text embeddings at 1,000, 10,000, 50,000 and 100,000: the search 14 to 30 ms at the median; the
statements 1 to 11 ms; recall against an exact ranking 0.988 or more on average for every scope;
the reach rule 7 to 9 ms, what may be ranked under 1 ms; the whole request about 60 ms. Broad scopes
use `knowledge_chunk_embeddings_embedding_hnsw_idx` with `embedding <=> query` and every condition
in the scan's filter; small ones are ranked exactly from the (institute, source) index; the TOAST
table stays empty. No new index. Not production-scale: one machine, synthetic vectors, one person
at a time.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each, one at a time).
Formatting clean on every tracked and new file (1,174). Production builds pass for shared, ui,
module-sdk, the runner, the API and the web app (97 pages).

Unit tests 647: API 410 (10 new — the search's guards 4, selection 5, the lexical fake 1), shared
156 (4 new — the request and the result), web 65, runner 16. The tests that named the 8C fake
model now name `fake-embedding-2`.

API end to end:

- the retrieval spec (`test/ai-knowledge-retrieval.e2e-spec.ts`), 13 of 13: who may ask, behind
  both flags, and no search otherwise; a strict request (24 bodies refused, none reaching the
  provider), a lesson outside the given course, and the rate limit; provenance, the same answer
  twice and the default K; another institute's twelve passages identical to the question never
  returned, and the search refusing them even when handed an over-broad scope; drafts, archived
  sources and documents, personal data, an older version, another model's vectors and a stale hash
  kept out by the search itself; an older version's vectors left in place and ignored; each audience
  — staff, a course, a stranger, a trainer by their batch, the Super Admin, personal knowledge for
  nobody; course and lesson context, a closed lesson's documents never drawn on; ties by chunk id,
  a text once, two passages of a document; the provider unavailable, two bad vectors, the deadline
  (a provider that hangs) and a slow search (a table lock); a credential, unapproved data, a spent
  budget and an unpriced model refused before any call; the ledger, the allowance and the audit
  without the question or a passage; a client gone;
- the evaluation (`test/ai-knowledge-retrieval-evaluation.e2e-spec.ts`), 2 of 2;
- the 8A spec, 13 of 13 (its no-provider test also asks for a retrieval: 503), and the 8C
  embeddings spec, 15 of 15;
- **the full suite: 47 files, 612 tests, all 612 passing** (597 before, 15 new). The first full run
  failed three; the second, after the fixes below, one — the oversized-request race in `auth`
  already on record (`ECONNRESET`: the server refuses the 2 MB body before reading it while the
  client is still sending; the file passes alone, 12 of 12, three times out of three; offered as a
  task of its own); the third passed whole.

Twenty-six rules were broken on purpose on the final, formatted code — the brief's 24 and two more
— each caught by the test aimed at it, and the files restored byte for byte: the ranking's
institute filter; publication; the current version; archiving; the audience (staff material for
everyone); course authorisation; lesson authorisation (closed lessons kept); the data class; a
client-provided `instituteId`, `archived=true`, `unpublished=true` and an arbitrary data class
(each with the request's schema loosened to let it in); another institute's chunk with no institute
filter anywhere; personal knowledge; the feature flag; the permission; another embedding model's
vectors; a query vector of the wrong dimension; a provider's failure in its own words; no
deadline; a cache keyed by the question alone (caught by three tests); the raw vector in the
answer; the question in the audit; a passage in the ledger; a vector whose hash is no longer its
chunk's; every lesson of a course the person reaches opened (the module locks in the reach rule).

The compiled API on `lms_preview` (a temporary launch entry, restored byte for byte): no session,
401 on the new route. The OpenAPI document regenerated from that run: the one new path,
`POST /api/v1/ai/knowledge/retrieve` — cookie authentication, the strict request, the result
without a vector, and 400, 401, 403 (the flags off among its causes), 422, 429, 500, 502, 503 and
504 described; nothing else changed.

**Phase 8D's migration** (Step 32; runbook §5).

- `lms` and `lms_preview` at 18 migrations, each with exactly one pending,
  `20261012090000_phase8d_knowledge_retrieval`.
- Backup `E:\LMS-backups\lms-before-phase8d.dump`: 629,425 bytes, SHA-256
  `ee8b7fee94f4f7c6e8f50c8d103f2e56fea2e9a7ec0212d774bab5cdd27be6a0` (written beside it).
- Restored into the scratch database `lms_backup_check_p8d`: 90 tables and 4,345 rows, every
  table's row count and content fingerprint identical to `lms`.
- The migration applied to the scratch copy first: its schema differs from before by
  `WITH (toast_tuple_target='8160')` on `knowledge_chunk_embeddings` alone; its data by
  `_prisma_migrations` alone (18 → 19); the Prisma schema diff the same one line as before the
  migration — the HNSW index Prisma cannot describe, never to be applied. The scratch database
  dropped.
- `lms_preview` backed up (`E:\LMS-backups\lms_preview-before-phase8d.dump`, 696,985 bytes,
  SHA-256 `593a4887e0b05f6a12db3a3734d630da6a970c833f1f3f75c2862238d6b9941b`; 90 tables, 5,141
  rows) and migrated: `_prisma_migrations` 18 → 19, every other table's row count and fingerprint
  identical; 19 migrations, "Database schema is up to date!"; the storage parameter set; the same
  one-line diff.
- `lms`: `pnpm db:migrate` applied that migration alone; `pnpm db:seed` (the base only): "77
  permissions, system roles synced". Row by row, 4,345 → 4,346: `_prisma_migrations` +1;
  `feature_flags` (24), `roles` (6) and `settings` (`rbac.seeded_permissions`,
  `rbac.applied_bundle_changes`) with `updated_at` alone changed, checked against the backup's own
  rows; the other 86 tables unchanged. After: 19 migrations, "Database schema is up to date!",
  `toast_tuple_target=8160`, `vector` 0.8.7, `vector(768)`, 72 users, no vectors, the same one-line
  diff.
- `lms_test` is rebuilt from the 19 migrations by every end-to-end run.

**Security.** Authorisation is a condition of the database query itself: the ranking statement
holds the institute, the contract, the sources, and the documents and versions left out, so
nothing is retrieved broadly and filtered afterwards — the only check after ranking is a vector's
hash against its chunk's. The request cannot name an institute, a data class, a state, a model or a
vector. No vector, distance or database detail leaves the API; no question or passage reaches the
audit, the ledger or the logs. No Gemini call was made — there is no key on this machine — and no
learner data was sent anywhere: every vector in the tests and the measurements is the fake's or
synthetic. No `fetch`, no new dependency, no LangChain, LangGraph, Redis or AWS, no web change.

**Not touched:** ET-EMS and SLTS (their containers' start and finish times unchanged since 1
October), the other databases on the LMS server except the scratch database created and dropped,
every other project, port 3000.

**Deferred, carried forward** (the plan's table): from 8A and 8B, automatic course-material
ingestion, PDF, Word, PowerPoint and OCR, topic, skill, batch and role audiences, knowledge purging,
re-chunking for a new chunker, personal knowledge, the reach rule under load with many people; from
8C, automatic and bulk embedding, the live Gemini check, a price for `gemini-embedding-001`, a
registry for CI's database image, Prisma and the HNSW index; from 8D, a minimum similarity (8E,
calibrated on Gemini), retrieval measured with Gemini, a retrieval cache (only with a measured
need), retrieval at production scale.

**Next.** The client reviews 8D — ADR-0036 above all: authorisation inside the query, no new
permission or flag, no cache, the audit entry per retrieval (amending ADR-0028), each vector in its
row, and the deferred items. The first live Gemini check still needs the developer's paid-tier key.
Then slice 8E (Gemini RAG integration) only with the client's go-ahead.

## 2026-10-04 (session 37) — Roadmap Phase 8, slice 8C: embeddings and pgvector

**Brief.** The client's Phase 8C brief (4 October 2026): first the 8B migration on `lms` by the
controlled procedure; then embeddings and pgvector — the Gemini embedding model and its dimension
taken from Google's documentation, never assumed; embeddings in the provider abstraction, with the
fake for every test; storage of their own with the provider, model, dimension, embedding version and
content hash beside each vector, so that no incompatible vector stays active; pgvector verified;
eligibility; the `ai.knowledge.embed` job with claims, leases, idempotency, batches and dimension
validation; usage, audit and failure classes; deliberate breaks and security tests; performance;
an ADR. Out of scope: retrieval, similarity search, RAG, prompts, citations, agents, web search,
automatic course ingestion, PDF, Word, PowerPoint and OCR, AWS, Redis, LangChain, LangGraph, local
models, production learner data. Items AI-8C-01 to AI-8C-13 (`docs/phases/PHASE-08-rag-knowledge.md`,
with the 8C matrix, the contract Phase 8D consumes and the deferred items).

**Phase 8B on `lms`** (AI-8C-01; runbook §5).

- Branch `main` at `173f28a`, clean and in step with `origin/main`; `lms` at 16 migrations with
  exactly one pending, `20261010090000_phase8b_knowledge_ingestion`.
- Backup `E:\LMS-backups\lms-before-phase8b.dump`: 617,221 bytes, SHA-256
  `0c57fe16cab328efeeaafb6e0205e76838ceb19f2cc802099e74a2175a654133` (written beside it).
- The restore verified in a scratch database: 88 tables and 4,343 rows, every table's row count
  and content fingerprint identical to `lms`; the scratch database dropped.
- `pnpm db:migrate` applied that migration alone; `pnpm db:seed` (the base only): "77 permissions,
  system roles synced".
- Row by row, before and after: 4,343 → 4,344. `_prisma_migrations` +1; `feature_flags` (24) and
  `roles` (6) with `updated_at` alone changed; `settings`: `rbac.seeded_permissions` and
  `rbac.applied_bundle_changes`, `updated_at` alone. Each checked against the backup's own rows.
  The other 84 tables unchanged.
- After: 17 migrations, "Database schema is up to date!", the schema diff "No difference detected",
  `parser_version`, `chunker_version` and `ingestion_started_at` present, 72 users as before.

**The pgvector image** (AI-8C-02; ADR-0026's 8C record).

- Backed up first: `E:\LMS-backups\lms-before-pgvector.dump`, 617,693 bytes, SHA-256
  `8b241a4f3171764e05bee215dab4f85715bcb63db701a3eb6d02bf7e268c0d87`.
- Before: `postgres:16-alpine` (`57c72fd2a128`), PostgreSQL 16.14 on musl, `en_US.utf8`.
- `lms-postgres:16-pgvector-0.8.7` built from `infra/postgres/Dockerfile` (420 MB): PostgreSQL
  16.14, pgvector 0.8.7's files in place.
- The container recreated on the same `pgdata` volume, healthy: PostgreSQL 16.14 on musl,
  `en_US.utf8`; `vector` 0.8.7 available and not yet installed; every database still there; `lms`
  (88 tables) and `lms_preview`, every table's row count and content fingerprint identical to before;
  `lms` "Database schema is up to date!".
- In a throwaway database, dropped afterwards: `CREATE EXTENSION vector` (0.8.7); an HNSW
  `vector_cosine_ops` index ordering three vectors correctly; "expected 768 dimensions, not 3";
  "column cannot have more than 2000 dimensions for hnsw index"; a `halfvec` index accepted;
  `hnsw.iterative_scan` off and `hnsw.ef_search` 40 by default.
- CI builds the image on each run in its two database jobs; staging's compose file builds it, and
  the deploy workflow builds and restarts PostgreSQL before it migrates.

**What Google documents** (AI-8C-03; read on 4 October 2026, recorded in ADR-0035's "Evidence").
The embeddings guide (17 September 2026): `gemini-embedding-001` — stable, text, 2,048 input
tokens, 128 to 3,072 dimensions, reduced sizes to be normalised by the caller, the task a parameter
— and `gemini-embedding-2` — stable there, multimodal, 8,192 tokens, normalised by the service, the
task in the text (named `gemini-embedding-2-preview` on the models page of 1 October 2026). MTEB for
`-001`: 68.17 at 1,536, 67.99 at 768. The discovery documents (v1, revision 20261002):
`batchEmbedContents` with `embedContentConfig {taskType, outputDimensionality, autoTruncate}`, the
embeddings in the order asked, `usageMetadata.promptTokenCount`; no largest batch stated. The
pricing page (1 October 2026): $0.20 per million text tokens for Gemini Embedding 2 on the paid
tier, free-tier content used to improve Google's products, no price for `gemini-embedding-001`. The
rate-limit page: per project, `429 RESOURCE_EXHAUSTED` beyond a limit.

**Built** (ADR-0035, proposed).

- **The choice:** `gemini-embedding-001` at **768** dimensions, `vector(768)`, every vector at unit
  length, cosine distance. The dimension is a contract held in three places — the shared
  `KNOWLEDGE_EMBEDDING_DIMENSION`, the column with its CHECK, and `AI_EMBEDDING_DIMENSION`, which the
  API refuses to start with at any other value.
- **Providers** (`AiProvider.embed`, reserved since 7A): one method for a batch (a single text is a
  batch of one) with the purpose and the dimension; `capabilities().embeddings`. The fake embeds
  deterministically (SHA-256 of the text) and offline; Gemini's adapter makes one
  `POST v1/models/{model}:batchEmbedContents` per batch, `autoTruncate: false`, the task
  `RETRIEVAL_DOCUMENT` (`RETRIEVAL_QUERY` ready for 8D), the key in its header alone, and checks
  and normalises what comes back (`vectors.ts`).
- **The router** (`ModelRouter.embed`): the embedding registry (`fake-embedding-1`,
  `gemini-embedding-001`), the data class approved by the deployment and the institute, the batch
  and input limits, the deadline, the model's circuit, the vectors checked once more, one log line
  of numbers, the ledger's attempts.
- **Migration** `20261011090000_phase8c_knowledge_embeddings`: the `vector` extension, created if
  missing; `knowledge_version_embeddings` (a run per version and contract: status, counts,
  attempts, failure code, requester, claim) and `knowledge_chunk_embeddings` (a vector per chunk and
  contract, with the chunk's whole provenance under a composite key that cascades, and its hash);
  CHECKs on the dimension, unit length, the hash, the counts, the claim and the finish; an HNSW
  `vector_cosine_ops` index in raw SQL (Prisma cannot describe it). Additive: the one change to an
  existing table is a unique key on the chunks' whole provenance, for the composite key.
- **The job** `ai.knowledge.embed` (`knowledge/embedding/embedding.service.ts`): nothing while a
  flag is off or the installation cannot embed; a claim under a 10-minute lease, every write fenced
  by its time; eligibility checked again; the chunks from 8B's hand-over without a valid vector, 32
  at a time; each batch's vectors and ledger rows in one transaction (`ON CONFLICT … DO UPDATE`);
  finished only when every chunk is valid, then the older versions' and other contracts' vectors
  deleted. Failure codes; five that may pass go back to the queue (three retries) and go on from
  what was written.
- **The route** `POST /ai/knowledge/versions/:id/embed` (202), `ai:knowledge_manage`, both flags;
  the version's view carries its run, the status counts the vectors; archiving a source deletes its
  vectors.
- **Usage**: the ledger (feature `knowledge`, task `embed`), the institute's budget (failing closed
  without a price), never the requester's own allowance. **Audit** by ids, codes and counts.
- **Infrastructure:** `infra/compose.yml` and `infra/compose.staging.yml` build and run the pgvector
  image; CI builds it in its two database jobs; the staging deploy builds and restarts it before
  migrating; `.env.example` sets `AI_PROVIDER=fake` for local work, and both examples list the
  embedding settings.
- **The live check:** `pnpm --filter @lms/api ai:embed-smoke -- --confirm` (the script
  `gemini-embed-smoke.ts`): three synthetic sentences through the real adapter, numbers only;
  refused without `AI_PROVIDER=gemini`, a key and the flag. Not run: no key on this machine.
- **Reused, nothing added:** the provider abstraction, the router and its circuits, the queue, the
  ledger and budget, the AI settings, the audit service, the flags, 8B's hand-over and hashes, the
  reach rule. No new dependency.

**Found and fixed.**

- Embedding would have used up the requester's own daily token allowance: a Super Admin who embedded
  a large document could not use SI Academy AI for the rest of the day. The ledger and the roll-up
  keep the tokens; the quota check now leaves knowledge tokens out (`ownTokens`), and the budget still
  counts them.
- The staging deploy would have run the 8C migration before PostgreSQL ran the new image: the
  workflow builds and restarts it first.
- The 8A spec's vector-readiness test asserted "not installed": it now asserts what 8C installs, and
  a new test proves nothing is embedded or counted while no provider can embed.

**Decisions.** `gemini-embedding-001` over `gemini-embedding-2`: text is all that is embedded, the
task is a field rather than text, its sizes have published quality figures, and the second model's
name differs between Google's pages; it stays the first candidate for a later contract. 768 over
1,536: 0.18 points for half the storage. The embedding capability of the existing provider
adapters, rather than separate embedding-provider classes. The HNSW index created with the table.
Retrieval left to 8D, inside the reach rule.

**Performance** (Step 19; the fake provider, so the time is the platform's own: the job's
transactions, the vector writes and the HNSW index; the API and PostgreSQL on this machine, batches
of 32):

| Document                   | Chunks | Batches | Job      | Provider | Database and the rest | Per batch | Chunks/s | Transactions | Heap    |
| -------------------------- | ------ | ------- | -------- | -------- | --------------------- | --------- | -------- | ------------ | ------- |
| Notes, 40 sections         | 106    | 4       | 895 ms   | 36 ms    | 859 ms                | 215 ms    | 118      | 43           | +9.6 MB |
| Notes, 70 sections (limit) | 185    | 6       | 1,233 ms | 53 ms    | 1,180 ms              | 197 ms    | 150      | 53           | +8.8 MB |

- Transactions grow with batches, not chunks — about five per batch, and some twenty for the
  request, the claim, the audit and the finish (counted from `pg_stat_database`): no N+1. A batch
  writes its vectors in one statement; the run reads chunk ids and hashes back, never vectors, and
  holds one batch's vectors at a time.
- Five versions of 70 sections, ingested, published and embedded one after another: 925 chunks in
  6.4 seconds.
- A transient failure on the third call: the first run stopped after two batches (64 chunks kept,
  415 ms); taken up again, it embedded the other 121 in four calls (667 ms), none twice.
- With Gemini each batch adds the provider's latency; at 32 texts a call, a 185-chunk version is
  six calls.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each, one at a time).
Formatting clean on every tracked and new file. Production builds pass for shared, ui, module-sdk,
the runner, the API and the web app (97 pages).

Unit tests 633: API 400 (28 new — vectors 3, Gemini's embeddings 9, embedding routing 6, the
router's embedding guards 6, the failure codes 4), shared 152, web 65, runner 16. Two provider
tests that asserted embeddings were refused (Phase 7 reserved `embed()`) now assert them.

API end to end:

- the new embeddings spec (`test/ai-knowledge-embeddings.e2e-spec.ts`), 15 of 15: who may ask, and
  the job waiting while a flag is off; an eligible version embedded in order under the contract,
  one unit vector of 768 values per chunk, the provider's own vector kept; refused once embedded,
  and two jobs at once embedding it once; a failed run taken up again for the missing chunks alone,
  and the queue's retries for what may pass; wrong dimensions, missing vectors and NaN refused by the
  router, and the database refusing them on its own; each provider failure in its own code, a
  resting model never called, the run's own deadline; eligibility in the request and again in the
  job (not chunked, not published, personal, not current, archived document and source, data the
  institute does not approve); institute B's version neither found nor taken, and no vector filed
  under its chunk; leases and a lost claim writing nothing; vectors purged by a newer version,
  another contract, a stale hash, a deleted chunk and an archived source; the ledger, the budget,
  an unpriced model and the requester's untouched allowance; the audit and the logs by ids and
  counts; the metadata retrieval will filter on; the HNSW index, the column type and every CHECK; a
  moderately sized document;
- the 8A spec, 13 of 13: its vector-readiness test now asserts what 8C installs, and a new test
  proves that nothing is embedded or counted while no provider can embed;
- the 8B ingestion spec, 11 of 11, unchanged; the Gemini spec, 8 of 8, one new: knowledge embedded
  through Gemini's adapter against the stand-in, the canary key in its header alone;
- **the full suite: 45 files, 597 tests, all 597 passing** (580 before, 17 new). The first full run
  failed one Phase 6 test: the embeddings spec had left an active Super Admin behind, and the
  "last Super Admin" test counts every active one. The spec now suspends its own when done, and the
  second full run passed.

Twenty-one rules were broken on purpose, each break caught by a test and the files restored byte for
byte — run on the code as tested, then again on the final, formatted code: the job's institute
filter; the request's institute; the route's permission; the flags in the job; publication; personal
data held back; the current version; an archived document; the institute's data-class approval; the
router's check of every vector; unit length; an embedded version never claimed again; the lease's
fence; the content hash; the contract; the purge of older versions; the purge on archiving; the
budget; the requester's allowance; content kept out of the audit; the key kept out of the URL.

The compiled API on `lms_preview` (a temporary launch entry, restored byte for byte): no session,
401 on the new route. The OpenAPI document regenerated from that run: the one new path,
`POST /api/v1/ai/knowledge/versions/{id}/embed`; nothing else changed.

**Phase 8C on `lms`** (Step 22; runbook §5), once 8C was verified.

- Branch `main` at `173f28a` with 8C's changes in the working tree; `lms` at 17 migrations with
  exactly one pending, `20261011090000_phase8c_knowledge_embeddings`.
- Backup `E:\LMS-backups\lms-before-phase8c.dump`: 617,693 bytes, SHA-256
  `61e337f8ded0a4b87d13a6bc19d363fda0edebee2e908ff49bbd6773c9bff68c` (written beside it).
- The restore verified in the scratch database `lms_backup_check_p8c`: 88 tables and 4,344 rows,
  every table's row count and content fingerprint identical to `lms`; the scratch database dropped.
- `pnpm db:migrate` applied that migration alone; `pnpm db:seed` (the base only): "77 permissions,
  system roles synced".
- Row by row, before and after: 4,344 → 4,345. `_prisma_migrations` +1; the two embedding tables,
  created empty; `feature_flags` (24) and `roles` (6) with `updated_at` alone changed; `settings`:
  `rbac.seeded_permissions` and `rbac.applied_bundle_changes`, `updated_at` alone. The other 84
  tables unchanged.
- After: 18 migrations, "Database schema is up to date!"; `vector` 0.8.7 installed; the column
  `vector(768)`; the index `USING hnsw (embedding vector_cosine_ops)` beside five B-tree indexes,
  two unique keys and the primary keys; seven CHECKs and three foreign keys; the chunks' new unique key on their whole
  provenance; 72 users as before. The schema diff from the database to the Prisma schema is one line,
  `DROP INDEX "knowledge_chunk_embeddings_embedding_hnsw_idx"` — the index Prisma cannot describe,
  never to be applied.
- `lms_preview` was backed up first (`E:\LMS-backups\lms_preview-before-phase8c.dump`, 685,242 bytes,
  SHA-256 `9533d6a4965009a39d949ecf63aeae3a4d01ca9faa0853b79219fc437791842e`; 88 tables, 5,140 rows)
  and migrated: `_prisma_migrations` 17 → 18, the two new tables empty, every other table's row count
  and fingerprint identical; `vector` 0.8.7; the same one-line diff. `lms_test` is rebuilt from the
  18 migrations by every end-to-end run.

**Security.** A search of the code and every `package.json`: no new dependency (one script,
`ai:embed-smoke`); no operator or query that compares vectors outside the index test; no `fetch` in
the knowledge code; no LangChain, LangGraph, Redis or Bedrock; no web change. No Gemini call was
made — there is no key on this machine — and no learner data was sent anywhere: every vector in the
tests is the fake's or a stand-in's. The canary key appears in no URL, request body, error, log
line, audit entry, database row or API description.

**Not touched:** ET-EMS and SLTS (their containers' start and finish times unchanged since 1
October), the other databases on the LMS server except the scratch databases created and dropped,
every other project, port 3000.

**Next.** The client reviews 8C — ADR-0035 above all: `gemini-embedding-001` at 768 dimensions, the
embedding contract, eligibility (personal knowledge never embedded), usage outside a person's
allowance, and the deferred items carried forward. The first live Gemini embedding needs the
developer's paid-tier key in `apps/api/.env` and `pnpm --filter @lms/api ai:embed-smoke -- --confirm`.
Then slice 8D (retrieval and grounding) only with the client's go-ahead.

## 2026-10-04 (session 36) — Roadmap Phase 8, slice 8B: knowledge ingestion and chunking

**Brief.** The client's Phase 8B brief (4 October 2026): Phase 8A is complete and approved, with
ADR-0033; 8B builds the ingestion pipeline — version, content extraction, normalisation, structural
parsing, chunking, chunk metadata, persisted chunks — clean, deterministic, traceable and ready for
Phase 8C embeddings. First, the approved 8A migration on `lms` under the database procedure. Out of
scope: embeddings and any Gemini call, vector similarity and pgvector queries, retrieval, RAG
answers, citations, agents, tools, memory, crawling, scraping, AWS, Redis, LangChain, LangGraph.
Items AI-8B-01 to AI-8B-12 (`docs/phases/PHASE-08-rag-knowledge.md`, with the 8B matrix and the
contract Phase 8C consumes).

**Phase 8A on `lms`** (AI-8B-01; runbook §5).

- Branch `main` at `76942ff`, clean and in step with `origin/main`; `lms` at 15 migrations with
  exactly one pending, `20261009090000_phase8a_knowledge_base`.
- Backup `E:\LMS-backups\lms-before-phase8a.dump`: 596,255 bytes, SHA-256
  `abaf09d9477fc4faaba254f625c7cebc68bc3fefa07a6660a552fc1598e44e3f` (written beside it).
- The restore verified in the scratch database `lms_backup_check_p8a`: 84 tables and 4,339 rows,
  every table's content fingerprint identical to `lms`; the scratch database dropped.
- `pnpm db:migrate` applied that migration alone; `pnpm db:seed` (the base only): "77 permissions,
  system roles synced".
- Row by row, before and after: 4,339 → 4,343. `_prisma_migrations` +1; the four knowledge tables,
  created empty; `permissions` 76 → 77 (`ai:knowledge_manage`); `role_permissions` 236 → 237 (the
  Super Admin's); `feature_flags` +1 (`ai.knowledge`, off), the other 23 with `updated_at` alone
  changed; `roles`, `updated_at` alone; `settings`: `rbac.seeded_permissions` gained
  `ai:knowledge_manage` and nothing else, `rbac.applied_bundle_changes` its `updated_at`. Each
  checked against the backup's own rows. The other 78 tables unchanged.
- After: 16 migrations, "Database schema is up to date!", the schema diff "No difference
  detected", the knowledge tables present and empty, 72 users as before.

**Built** (ADR-0034, proposed).

- **Formats:** Markdown (when none is named), plain text and HTML, named when a version is created
  and stored with their media type. PDF and Word are not read — the platform has no engine for
  them, and 8B adds none; a PDF is refused at creation.
- **Normalisation and structure** (`apps/api/src/modules/ai/knowledge/ingestion/`): strict UTF-8,
  NFC, LF, no control or zero-width characters (the joiners Indic scripts need stay); Markdown read
  as CommonMark's blocks with GitHub's tables and taken as written; HTML through the platform's
  sanitiser with a structure-only policy; plain text as paragraphs. Every format becomes blocks —
  headings, paragraphs, quotations, lists, code, tables — written back as Markdown.
- **The chunker** `sections-1/1200-2000-200-200`: sections first; a longer section cut between its
  blocks, and a block by its grain (sentences, list items with their nested items, table rows with
  the header repeated, code lines fenced again); every part of a cut section headed; small units
  joined; overlap only where a paragraph is cut, its last sentence of 200 characters or fewer.
  Every chunk carries its section's path as its heading.
- **The job** `ai.knowledge.ingest` on the queue: nothing while `module.ai` or `ai.knowledge` is
  off; a claim of its own institute's version with a 10-minute lease whose time every write checks;
  the checks (archived source or document, a lesson in its source's course, no newer current
  version, the file its own, a format it reads, the size); at most 2 MiB read; the hash verified;
  extraction; every chunk and the chunked state in one transaction, with chunks an interrupted run
  left replaced. Eighteen failure codes; `storage_unavailable` and `persist_failed` retried by the
  queue.
- **Identity:** chunk ids are name-based UUIDs of version, position and hash.
- **Routes:** `POST /ai/knowledge/versions/:id/ingest` (202) and `GET /ai/knowledge/versions/:id`;
  the version view now shows its format, failure code, parser and chunker.
- **The hand-over to 8C:** `chunksForEmbedding`, from the database alone.
- **Migration** `20261010090000_phase8b_knowledge_ingestion`: `parser_version`, `chunker_version`,
  `ingestion_started_at` on the versions, and a CHECK that a version being ingested records its
  claim's time.
- **Reused, nothing added:** the storage driver and files table, the queue, the sanitiser, the 7E
  entity decoder (exported as `decodeHtmlEntities`), the audit service, the flags, the reach rule.
  No new dependency.

**Found and fixed.**

- A draft source's course could change while documents of it were about lessons of that course,
  leaving them about another course's lessons. Its course now stays while it has lesson documents
  (409 `knowledge_source_has_lesson_documents`), and ingestion refuses such a document
  (`document_mismatch`).
- An administrator could not see why an ingestion failed: the version view now carries the failure
  code, with the format, parser and chunker.

**Decisions and deviation.** No "parsed" state: parsing and chunking are steps of one job and leave
nothing durable between them, and a version is chunked only in the transaction that writes all of
its chunks. Creating a version does not ingest it: ingestion is asked for. Automatic ingestion of
course material (lessons as documents, kept current by publish events), which the 8A plan placed in
8B, is not in the 8B brief and is not built: the client's decision.

**Performance** (Step 20; the pure pipeline on this machine, the median of 15 runs):

| Document                     | Characters | Normalise | Parse   | Chunk   | Total    | Chunks (average size) |
| ---------------------------- | ---------- | --------- | ------- | ------- | -------- | --------------------- |
| Java fixture, Markdown       | 714        | 0.00 ms   | 0.03 ms | 0.02 ms | 0.07 ms  | 1 (714)               |
| Notes, 40 sections, Markdown | 105,727    | 0.33 ms   | 3.19 ms | 2.40 ms | 8.08 ms  | 106 (1,009)           |
| Notes, 70 sections, Markdown | 184,195    | 0.65 ms   | 3.62 ms | 3.50 ms | 9.91 ms  | 185 (1,007)           |
| Notes, 40 sections, HTML     | 28,631     | 0.13 ms   | 9.31 ms | 0.67 ms | 12.67 ms | 21 (1,126)            |

Per 10,000 characters: 1.05, 1.00, 0.55 and 0.49 ms at 25k, 53k, 106k and 184k characters — linear,
no quadratic step. The whole job (claim, checks, the read from object storage, the hash,
extraction, the transaction) took 34 ms for the 105,727-character document (106 chunks) and 22 to
42 ms for small ones, in the end-to-end run.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each, one at a time; lint
first found a needless escape and a control-character pattern, fixed by an explicit character test
rather than a disabled rule). Formatting clean: 1,207 tracked and new files checked. Production
builds pass for shared, the API and the web app (97 pages).

Unit tests 605: API 372 (29 new — the Markdown reader 5, the HTML reader 5, the chunker 12, the
pipeline 7), shared 152, web 65, runner 16.

API end to end:

- the new ingestion spec (`test/ai-knowledge-ingestion.e2e-spec.ts`), 11 of 11: who may ask, and
  the job waiting while a flag is off; Markdown, plain text and HTML into chunks with their whole
  provenance; a version ingested once, and taken again into the very same chunks; a missing file,
  a run stopped half-way, a lapsed lease, leftovers replaced, a lost claim recording nothing;
  tampered, malformed, oversized, unread, borrowed, other-context and other-folder files, scripts
  only, too much text, a PDF refused; institute B's version neither taken nor found nor asked for;
  archived sources and documents refused, a draft staying a draft and reaching nobody until
  published, personal data reaching nobody; a lesson document held to its source's course, an
  older version below the current one; the 8C hand-over with the file deleted first; the audit by
  ids and counts, and the files API still closed to knowledge files; a moderately sized document;
- the 8A spec, 12 of 12, unchanged;
- **the full suite: 44 files, 580 tests, all 580 passing**.

Ten rules were broken on purpose, and each break was caught by its test, the files restored byte
for byte: the institute filter of the job's claim; a lesson document in its source's course; the
request's institute; the archived-document check; the request's permission; the file's owner; a
chunked version never taken again; the content's hash; each chunk's section; the archived-source
check.

The compiled API on `lms_preview` (a temporary launch entry, restored byte for byte): no session
401; the Super Admin 403 `module_disabled` on both new routes with AI off, as by default. The
OpenAPI document regenerated from that run: the two new paths, and `format` with the new limit on
version creation; nothing else changed.

**Security.** A search of the code and every `package.json`: no new dependency; no embedding,
vector, similarity or retrieval code; no `fetch` and no provider call in the knowledge code; only
the ingest job registered; no LangChain, LangGraph, Redis or Bedrock; no web change. No Gemini call,
no key, no learner data sent anywhere.

**Database.** `lms`: 16 migrations (Phase 8A), matching the 8A schema; the 8B migration waits for
the client's review of 8B (runbook §5), and `ai.knowledge` stays off there until it lands.
`lms_preview` was backed up first (`E:\LMS-backups\lms_preview-before-phase8b.dump`, 684,067 bytes,
SHA-256 `d757f153a74bdbf3abf19bb791a793252f8dcef75e62aad108d428102313f309`) and migrated; it and
`lms_test` are at 17 migrations and match the schema ("No difference detected").

**Not touched:** ET-EMS and SLTS (their containers' start and finish times unchanged since 1
October), the other databases on the LMS server, every other project, port 3000.

**Next.** The client reviews 8B — ADR-0034 above all: the formats, the chunk sizes, no automatic
course-material ingestion. Then, with approval, the 8B migration on `lms` under §5, and slice 8C
(embeddings and pgvector) only with the client's go-ahead.

## 2026-10-04 (session 35) — Roadmap Phase 8, slice 8A: knowledge architecture and vector readiness

**Brief.** The client's Phase 8A brief (4 October 2026): Phase 7 is complete and approved, and Phase
8 has started — 8A only. Build the secure foundation of the knowledge base: sources, documents,
versions and chunks with their metadata, visibility and provenance, the boundary for future
embeddings, and pgvector readiness; stop before ingestion, embeddings and retrieval. First, migrate
`lms` with Phase 7's migrations under the runbook's procedure. Out of scope: embeddings and
embedding calls, similarity search, retrieval, RAG answers or chat, citations, crawling, scraping,
automatic ingestion, agents, tools, long-term memory, mock interviews, voice, AWS, Bedrock, Redis,
LangChain, LangGraph, and any RAG interface. Items AI-8A-01 to AI-8A-12
(`docs/phases/PHASE-08-rag-knowledge.md`, with the Phase 8 slices 8A to 8F and the 8A matrix).

**Phase 7 on `lms`** (AI-8A-01; runbook §5).

- Branch `main` at `66ef3cd`; the target `lms` in `lms-postgres-1` (port 5433), at 13 migrations
  with exactly two pending: `20261007090000_phase7c_ai_conversations` and
  `20261008090000_phase7d_ai_lifecycle`.
- Backup `E:\LMS-backups\lms-before-phase7.dump`: 571,094 bytes, SHA-256
  `ccf501ce34b3dadce139137eec87dd863a1143521525ad6fed3609fa04591f38` (written beside it).
- The restore verified in the scratch database `lms_backup_check_p7`: 79 tables and 4,316 rows,
  every table's fingerprint identical to `lms`; the scratch database dropped. An older scratch
  database, `lms_backup_check` (Phase 1, 9 migrations), was found and left as it was.
- `pnpm db:migrate` applied the two migrations; `pnpm db:seed` (the base only): "76 permissions,
  system roles synced".
- Before and after: rows 4,316 → 4,339. `_prisma_migrations` +2; the five AI tables, created
  empty; `feature_flags` +5 (the AI flags, all off), and 18 others with only `updated_at` changed,
  checked against the restored backup by key, state, audience and description; `permissions`
  72 → 76; `role_permissions` 224 → 236; `roles`, `updated_at` only; `settings`,
  `rbac.seeded_permissions` and the `updated_at` of `rbac.applied_bundle_changes`. The other 73
  tables unchanged.
- After: 15 migrations, "Database schema is up to date!", the schema diff "No difference
  detected", 72 users as before.

**Built.**

- **The knowledge model** (additive migration `20261009090000_phase8a_knowledge_base`):
  `knowledge_sources`, `knowledge_documents`, `knowledge_document_versions`, `knowledge_chunks`.
  Composite foreign keys along the chain (a chunk to its version, document, source and institute);
  one current version per document (a partial unique index), and only a chunked one (CHECK);
  CHECKs for a course audience with its course, the data classes (public, course, personal),
  archived with its date, version numbers from 1, hashes of 64 hex characters, positions from 0
  and chunks with text.
- **The services** (`apps/api/src/modules/ai/knowledge/`): `KnowledgeService` (management, storage
  through the driver, the ingestion claims), `KnowledgeReachService` (who may draw on a chunk:
  the institute, a published source, public or course data, the audience — institute, staff alone,
  or a course's reach down to the lesson — and the current, chunked version of an active document),
  `VectorReadinessService`, `content-hash.ts` (SHA-256 of normalised text) and `knowledge-jobs.ts`
  (the 8B and 8C contract, no handler registered); nine routes under `/ai/knowledge`; the shared
  contracts in `packages/shared/src/schemas/knowledge.ts`.
- **The flag** `ai.knowledge` (an option, off) and **the permission** `ai:knowledge_manage` (scope
  `all`, the Super Admin's alone; the matrix regenerated: 77 permissions).
- **A synthetic fixture**, "Java Inheritance Basics" (definition, parent class, child class, method
  overriding, an example), written for the tests from no book, course or web page.
- **Vector readiness:** `infra/postgres/Dockerfile` (`postgres:16-alpine` with pgvector v0.8.7,
  pinned to its commit, built portable). Proved in a throwaway container (no published port,
  removed afterwards): PostgreSQL 16.14 on musl, `en_US.utf8`; `vector` 0.8.7 available;
  `CREATE EXTENSION vector`; a `vector(3)` column with an HNSW cosine index answering a
  nearest-neighbour query in order. No environment switched; no database has the extension.
- **Decisions:** ADR-0033 (visibility and provenance; proposed, for the client's review); ADR-0026's
  8A record; ADR-0027's decision point — Gemini's embeddings page (last updated 17 September 2026)
  lists `gemini-embedding-2` and `gemini-embedding-001`, both 3,072 dimensions by default with 768
  and 1,536 recommended, so 8C embeds at a reduced size as `vector(n)` or keeps 3,072 as `halfvec`.
  No model or dimension is chosen in 8A.

**Found and fixed.** The files API would have served a knowledge version's text by id to anyone
holding `files:read` at scope `all` — administrators and content managers — around
`ai:knowledge_manage` and the flag: `FilesService.find` guarded a file only by its context's read
permission, and a knowledge file has no upload context. Now a file that no upload context describes
is served by id to nobody but its uploader, and a knowledge file has none. No API exposed a
knowledge file's id, so nothing was reachable in practice. The files API's specs pass unchanged
(4 files, 108 tests); the knowledge spec proves the refusal beside a readable control file.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each, run one task at a time on this
machine). Formatting clean: 1,191 tracked and new files checked, none unformatted. Production builds pass for shared, the API and the web
app.

Unit tests 576:

- API 343 (3 new: the content hash, the same for the same content in any form, another for
  any change, deterministic);
- shared 152 (the permission list now names `ai:knowledge_manage`), web 65,
  runner 16.

API end to end:

- the new knowledge spec (`test/ai-knowledge.e2e-spec.ts`), 12 of 12: who manages it (every other
  role 403, either flag off, no session 401); storage, hashes and audit by ids (no content in any
  entry), and the files API refusing the file; duplicates in another form refused, a change the
  next version, a duplicate reference refused; publishing once, settled first, archived for good;
  a course source held to its course and a lesson to that course; ingestion claims and provenance,
  the newest chunked version current; the database refusing a broken chain, a non-chunked current
  version, a course audience without a course, restricted data and a malformed hash; learner A
  never reaching institute B's knowledge, and the management API not finding it; no draft,
  archived source, archived document, older or unfinished version, or personal data; the
  audiences (institute, staff alone, enrolled, outsider, teaching, a locked lesson, then unlocked,
  withdrawn, an archived course); a learner's erasure leaving the knowledge base and its files
  whole; vector readiness told truthfully, with no vector column anywhere;
- **the full suite: 43 files, 569 tests, all 569 passing**.

Nine rules were broken on purpose, and each break was caught, the files restored byte for byte: the
institute filter in management; the institute filters in the reach rule; publication; the
permission (`ai:chat` in its place); the flag; provenance (any version of a chunk); publishing an
archived source; staff knowledge to learners; knowledge files through the files API.

The compiled API on `lms_preview` (a temporary launch entry, restored byte for byte): no session
401; the Super Admin and a student 403 `module_disabled` with AI off, as by default. The OpenAPI
document regenerated from that run: the seven new paths (nine operations), nothing else changed.
The web app has no generated client — it reads the shared contracts — so there was none to
regenerate (operating rule 32).

**Security.** A search of the code and every `package.json`: no new dependency; no embedding,
vector-search, similarity or retrieval code; no ingestion handler registered; no `fetch` in the
knowledge code; the reserved `embed()` still refused by every provider; no LangChain, LangGraph,
Redis or Bedrock; no web page or menu entry. No Gemini call, no real key, no learner data sent
anywhere.

**Database.** `lms` is at 15 migrations (Phase 7) with no knowledge tables: the 8A migration waits
for the client's review of the 8A schema (runbook §5). `lms_preview` was backed up first
(`E:\LMS-backups\lms_preview-before-phase8a.dump`, 662,592 bytes, SHA-256
`62b8c26794ce2f0b4d99cf50b0392c3abc6398af5c02d696c2de5bab95f5b692`) and migrated; it and
`lms_test` are at 16 migrations and match the schema ("No difference detected").

**Not touched:** ET-EMS and SLTS (their containers' start and finish times unchanged since 1
October), the other databases on the LMS server (each still at its own migration count), every
other project, port 3000. The throwaway image built for the pgvector proof was removed afterwards.

**Next.** The client reviews 8A — ADR-0033 above all: the audiences, the data classes held back,
management by the Super Admin alone. Then, with approval, the 8A migration on `lms` under §5, and
slice 8B (ingestion and chunking) only with the client's go-ahead.

## 2026-10-04 (session 34) — Roadmap Phase 7, slice 7F: the Phase 7 gate

**Brief.** The client's Phase 7F brief (4 October 2026): no new features. Make Phase 7 complete,
consistent, secure, integrated, documented and tested, and ready for Phase 8 — inspect 7A–7E as
built, reconcile the lab-hint rule, investigate J-01, audit authorization, flags, provider
isolation, data leakage, streaming, quotas, the cache, privacy, jobs, contextual AI, lab hints,
timed tests and the web app, settle pgvector readiness without enabling it, reconcile the
documentation, and pass the full gate. Out of scope: RAG, pgvector, embeddings, agents, tools,
AWS, Redis, LangChain or LangGraph, long-term memory, mock interviews, model training, migrating
`lms`. Items AI-7F-01 to AI-7F-10 (`docs/phases/PHASE-07-ai-foundation.md`, with the gate's
matrix and the Phase 8 prerequisites).

**Found and fixed.**

- **The lab-hint rule** read "after repeated failed attempts" in ADR-0031, the permission's
  description and the flag's, while the code — as the 7E brief asked — gives a hint after one.
  One rule now, everywhere: available after at least one failed learner submission. ADR-0031's
  decision 2 is amended with its date and first wording; the permission matrix is regenerated.
- **Lab hints were looser than the labs.** A hint used the lab drafts' reach rule: any enrolment,
  whatever the course's state or the module's lock, and no check that Labs were on; and a staff
  role holding `ai:hints` — the Super Admin's complete bundle does — could ask for one. Now a hint
  is a learner's alone (a student profile, as the lesson labs define a learner), needs the Labs
  module on, and a lab placed only in a course's lessons follows the lesson's own rules
  (published, reached, the module open); a catalogue lab needs `practice:use`.
- **An answer without a word** was closed as a complete, empty answer. The router now treats it as
  unreadable (`malformed`, `EMPTY_ANSWER`): `failed`, said safely, counted once, never kept.
- **Coursework.** Every surface's instructions now keep graded work the learner's own: guidance to
  the next step, never a finished answer to submit (prompts `si-academy-7f-1`).
- **The workspace's load errors** showed the server's own sentence; they are worded from their
  code, as everything else in the AI pages is. AI Hint is offered to learners only in the web app
  too.
- **J-01.** Root cause: the Phase 6 concurrency test inserts `STU-<year>-9999` and creates the next
  two learners (`…-10000`, `…-10001`) to prove the numbering goes past four digits, and left them
  in the shared test database, so every learner created later in the run got a five-digit code —
  while J-01 expects the ordinary four. Pre-existing since Phase 6, unrelated to Phase 7, a test
  defect, not a product one. Fixed in the test: it gives the sequence back when it ends (its codes
  renamed to a test-only shape, pass or fail). Neither assertion changed; production unchanged.
  Run together, the numbering test first, both pass; with the fix taken out, J-01 fails again.
- **A 7E order dependency.** The 7E context spec left the institute's AI settings row behind,
  which the 7D lifecycle spec requires absent; it now removes it, as the new gate spec does.

**Audited and confirmed** (`docs/phases/PHASE-07-ai-foundation.md`, "The Phase 7 gate"):
every AI route for every role; owner-only conversations; usage by scope; settings for the Super
Admin alone; the kill switch and each surface's flag; only the router reaches a provider, keys only
in the server's configuration and one redacted header, no SDK, `fetch` only in the Gemini adapter;
streaming endings, cancellation and the generation gate; quotas, tokens and the budget before any
call, background calls within the budget, usage figures by day in the institute's zone; the exact
cache only, behind the policy and the allowance, never subjects, hints, follow-ups or failures,
reach re-checked on every hit; retention; export and erasure covering every AI table; job claims;
course, lesson and lab context checked again at every question, nothing recorded by reading a
lesson; no AI on any surface during a timed test.

**pgvector readiness** (ADR-0026's readiness record): every environment runs
`postgres:16-alpine` (PostgreSQL 16.14 on musl, no `vector` available), the databases use
`en_US.utf8`, and no Phase 7 table depends on a vector column. Settled for Phase 8: one extension
in the existing database, retrieval in tables of its own, an Alpine image with pgvector compiled
in (or a glibc image only through a dump and restore), the extension created by a migration under
the database gate, a dimension of at most 2,000 (else `halfvec`) stored with the model's name,
HNSW with the model's distance, the same image locally and in CI. Nothing installed.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each, run one task at a
time on this machine). Formatting clean in every tracked file (1,122 checked). Production builds
pass for shared, the API and the web app, with the four AI pages; the browser bundles (7.1 MB) hold
no provider key, address or header.

Unit tests 573:

- API 340 (3 new): an empty answer in the router, the coursework line, the usage day across
  midnight, the month and the year in the institute's zone;
- web 65 (1 new, one more case): the workspace's load error worded by code; AI Hint not offered to
  staff;
- shared 152, runner 16.

API end to end:

- the new gate spec (`test/ai-gate.e2e-spec.ts`), 9 of 9: every route for every role and nothing
  without signing in; owner-only conversations; the kill switch and each surface's flag; the hint
  rule (none before a failed submission, none after accepted ones only); staff, previews, Labs
  off and lesson-only labs under the lesson's rules; no AI on any surface during a timed test; the
  cache behind the allowance; an answer without a word;
- all six AI specs (7A–7F), 80 of 80. Six earlier tests asked for hints as "students" without a
  student profile; their learners now have one, as every learner does. Their assertions are
  unchanged;
- **the full suite: 42 files, 557 tests, all 557 passing**, J-01 included.

Six rules were broken on purpose, and each break was caught, the files restored byte for byte: a
hint for learners alone; Labs switched on; a lesson-only lab under the lesson's rules; an empty
answer closed as failed; the numbering test giving the sequence back (J-01 fails without it); the
workspace wording its load errors.

Browser (Playwright, `apps/web/e2e/ai.spec.ts`) on the preview stack — the API on `lms_preview`
with the paced fake provider, the web on 3001: 7 of 7 journeys on a desktop and 5 of 5 on a phone
(the two management journeys are desktop-only, as since 7E), and no console error or warning on
any AI surface. Temporary launch entries restored and the launcher deleted; ports free; the AI
flags off again.

**Security.** A search of the code and every `package.json`: no RAG, embedding, vector or
similarity code (only the reserved `embed()`, which every provider refuses), no tools or function
calling, no LangChain, LangGraph, LangSmith, OpenAI, Redis or AI SDK; the only AWS packages are the
S3 client the storage driver has used since Phase 1. Only the router reaches a provider; `fetch`
appears only in the Gemini adapter; the key is read from the configuration alone and travels in
one redacted header. The AI module reads no reference solution, grader check, rubric or
explanation. No live provider call.

**Database.** No migration in 7F. `lms` remains at 13 migrations with no AI tables: it
is migrated only after the client approves Phase 7 (runbook §5). `lms_test` and `lms_preview` are at
15 and match the schema ("No difference detected").

**Phase 8 prerequisites** (none implemented): the client's approval of Phase 7; the Phase 7
migrations on `lms` under the database gate; the pgvector image for local, CI and staging
together; the embedding model chosen and recorded (ADR-0027); Gemini on a paid tier before real
learner data, the AI flags on only with the client's approval; the knowledge sources and their
visibility agreed.

**Not touched:** ET-EMS and SLTS (containers unchanged), `lms`, every other project.

## 2026-10-04 (session 33) — Roadmap Phase 7, slice 7E: the SI Academy AI experience

**Brief.** The client's Phase 7E brief (4 October 2026): the main user-facing AI experience — the
`/ai` workspace with conversation history, the global launcher, context-aware entry points beside a
course and a lesson, the lab-hint UI, the admin AI settings, usage and budget pages, navigation, a
responsive experience — with authorization and flags enforced in the backend, which stays the
authority. Out of scope: RAG, embeddings, pgvector, vector search, agents or tools, long-term
memory, mock interviews, voice, evaluation, AWS, Redis, LangChain or LangGraph, a new AI
architecture or database. Items AI-7E-01 to AI-7E-09 (`docs/phases/PHASE-07-ai-foundation.md`).

**Built.**

- **Subjects and their material** (`AiSubjectsService`, `context/material.ts`). A conversation names
  a course, a lesson or a lab by id; the browser sends no content.
  - The service that owns each subject checks it with the person's own reach, when the conversation
    starts and again at every question: a published course the learner is enrolled in (not
    withdrawn) or a trainer teaches (`CoursesService.aiContextFor`); a lesson of one, in a module
    open to the learner by the player's own unlock rule, with nothing recorded
    (`LessonsService.aiContextFor`); a lab the learner may work on (`PracticeService.labHintBrief`).
  - The material is built on the server each time: the course outline; the lesson's own text,
    without markup or scripts (`core/html/text.ts`); the lab's statement, formats, constraints and
    visible examples with the learner's own latest submission and its visible verdicts.
  - It goes to the model as a learner-side message after the instructions, framed as context and
    never instructions, inside the context's length (prompts `si-academy-7e-1`). Answers drawn from
    it are never cached.
  - A subject a surface does not take is `422 ai_subject_not_supported`; a lesson named with
    another course is not found; a locked module is `403 module_locked`.
  - No retrieval: Phase 8's RAG index replaces the course and lesson material under the same rules.
- **Lab hints after a failed attempt**: refused with `422 ai_hint_needs_attempt` until the learner
  has a submission that was not accepted — the brief's "After a failed attempt, the user can request
  a hint", recorded against ADR-0031's "repeated failed attempts" (one constant,
  `HINT_AFTER_FAILED_ATTEMPTS`).
- **Availability** now names the subjects the approvals allow (`subjects.course`,
  `subjects.labHints`), so the web app offers no entry point that could only be refused.
- **Navigation**: an item with its own flag shows only while its module's flag is on too (no other
  item had its own flag, so nothing else changes). The workspace in every portal; AI usage for
  trainers and administrators; AI settings for the Super Admin; the `sparkles` icon.
- **The web app** (`apps/web/src/modules/ai/`):
  - `/ai`: the person's own conversations, newest first; new, open (`?c=`), delete with
    confirmation, gone from the screen at once; streaming with Stop; titles refreshed after the
    first answer; history in a drawer on a phone;
  - the launcher at the bottom right of every portal page, above the learner's tab bar, opening the
    assistant about the course or lesson in view; a link to the workspace when only that is on; not
    shown over a test paper, a lab, a workspace or a preview, nor while the AI cannot answer; the
    page keeps room below its last line;
  - "Ask SI Academy AI about this course / lesson" on the course and lesson pages;
  - AI Hint in a lab's workspace (never a preview): "AI Hint — helps you reason about the problem
    without giving the solution."; it asks for a submission first and says any refusal safely;
  - `/admin/settings/ai` (state, allowances, budget, data approval, models, retention, cache purge)
    and `/admin/ai-usage`, `/trainer/ai-usage` (as the API scopes them; figures only);
  - one stream client; text added once per frame; refusals worded by code, never as the server or a
    provider wrote them; nothing of a conversation in the browser's storage.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each; the API's type-check ran out
of memory once under parallel load with the preview servers up, and passed alone and in a run one
task at a time). Formatting clean in every tracked file (1,121 checked). API and web production
builds pass, with the four new pages.

Unit tests 569:

- API 337 (13 new): the material, the context with material, the prompts, HTML to text;
- web 64 (41 new): the thread's state and the frame buffer, the error wording, the chat hook
  (start, stream, Stop, refusal, stream errors, nothing in storage), the launcher and the page's
  subject, AI Hint, the workspace (list, open, new, delete at once, the phone drawer), the
  management pages and their access;
- shared 152, runner 16.

API end to end:

- the new context spec (`test/ai-context.e2e-spec.ts`), 12 of 12: availability and navigation, a
  course and a lesson as material, drafts, archived, unenrolled, locked and tampered ids refused,
  reach checked again at every question, the cache never keeping such an answer, approvals, the
  hint's attempt rule, a lab's reach, and the leak test on the provider's requests;
- the 7A, 7C, 7D and Gemini specs, 59 of 59. Two of their tests asked for a hint with no attempt
  and one checked that course subjects were refused: they now make the failed attempt 7E requires,
  and check the course rules instead;
- the full suite: 41 files, 548 tests, 547 passing. The one failure is the one already on record
  (students J-01: after the Phase 6 concurrency test the year's student-code counter passes 9,999
  and the test expects four digits); the file passes alone, 13 of 13.

Six rules were broken on purpose, and each break was caught by the context spec, the files
restored byte for byte:

- a course's reach;
- a locked module staying locked;
- hidden cases never read for a hint;
- a hint needing a failed attempt;
- an accepted attempt not counting as a failed one;
- a navigation item needing its module's flag.

Browser (Playwright, `apps/web/e2e/ai.spec.ts`, rewritten for 7E) on the preview stack — the API
on `lms_preview` with the paced fake provider and course material and learners' work approved, the
web on 3001: 7 of 7 on a desktop (off, launcher, workspace with streaming, Stop, history and delete,
course and lesson context, AI Hint, the Super Admin's settings and usage, a trainer's usage) and 5
of 5 on a phone (the two management journeys are desktop-only), with no sideways scrolling, the
launcher above the tab bar, and no console error or warning on any AI surface. Screenshots of each
surface on both sizes were reviewed. The demo data already held what the journeys need (a lab the
learner failed, one not tried, an enrolled course); nothing was written to `lms_preview` beyond the
journeys' own conversations and one save of the AI settings with their values unchanged. Temporary
launch entries restored and the launcher deleted; ports free; the AI flags off again.

**Security.**

- The browser sends ids only; every subject is checked again by its own service at every question.
- No hidden case, expected output, reference solution, grader check, rubric, explanation, staff
  note, draft, other learner's work or secret reaches the provider — proved by the leak test on the
  provider's requests.
- No route or job reaches a provider except through the router; no key or credential-shaped string,
  dependency, lockfile, image or infrastructure change; no RAG, embedding, pgvector, LangChain, AWS
  or Redis; no live provider call.

**Database.** No migration in 7E. `lms` was not migrated: it remains at 13 migrations with no AI
tables. `lms_test` and `lms_preview` stay at 15 migrations (7C and 7D); the test database matches the schema ("No difference detected").

**Remaining for 7F.** Full integration and verification across the platform, the Phase 7 gate, and
pgvector readiness planned (ADR-0026); then the client's approval before the 7C and 7D migrations
reach `lms`.

**Not touched:** ET-EMS and SLTS (containers unchanged), `lms`, Phase 6 to 7D behaviour, every other
project.

## 2026-10-04 (session 32) — Roadmap Phase 7, slice 7D: settings, jobs, retention, the answer cache

**Brief.** The client's Phase 7D brief (4 October 2026): give the AI backend a controlled lifecycle —
the institute's AI settings, retention, titles and notes written in the background, usage roll-ups,
budget alerts and the Phase 7 answer cache (exact keys only), with background jobs safe to repeat
and privacy kept. Out of scope: RAG, embeddings, pgvector, vector similarity, LangChain or LangGraph,
agents or tools, long-term memory, mock interviews, voice, evaluation, AWS, Redis, the final
workspace UI. Items AI-7D-01 to AI-7D-09 (`docs/phases/PHASE-07-ai-foundation.md`); ADR-0032 for the
cache.

**Built.**

- **The institute's AI settings** (`GET`/`PATCH /ai/admin/settings`, `ai:manage`, the Super Admin's
  alone):
  - stored as the `ai` row of the existing settings table; no new settings table;
  - validated by the shared schema, then by the routing rules the deployment's own configuration is
    checked by at start-up; a change is refused whole, with the field named, and audited
    (`ai.settings.updated`, before and after);
  - daily questions and tokens, the monthly budget and its warning share (80%), retention
    periods, data classes (narrowing the deployment's approval, never widening it), the default
    model, a model per task, the fallback, and the cache's lifetime;
  - each empty field keeps the deployment's variable; keys stay in the environment.
- **Data** (migration `20261008090000_phase7d_ai_lifecycle`, additive):
  - new columns on three of the 7C tables: a title's source and claim, the notes' watermark and
    claim, an answer's cache entry, the ledger's day and question mark;
  - the existing ledger rows are backfilled in the migration (their day in the institute's time
    zone; the first call of each answered question);
  - one new table, `ai_cache_entries`.
- **Background jobs** on the platform's queue: `ai.title`, `ai.summarize`, `ai.cache.write`
  (queued only after the answer's stream has ended), `ai.usage.rollup` (hourly), `ai.budget.alert`
  (every 15 minutes), `ai.retention.sweep` (nightly).
  - Payloads carry ids only.
  - Each job takes its work by a claim in the database (the existing pattern); a singleton key on
    the queue is never what makes it safe.
  - Inline when `WORKER_MODE=none`.
- **Titles and notes.**
  - Both go through the router alone, as the owner is now, within their tokens and the budget.
  - Both are counted in the ledger and the day as calls, never as questions.
  - A title is written once, from the first question alone, never over the owner's title.
  - Notes are written once six messages have left the context window, and go with later questions
    after the instructions, as learner-side context — never instructions, never authority, and no
    memory beyond the conversation.
  - Either failing leaves the conversation as it was.
- **Usage and budget.**
  - The hourly roll-up sets each closed day's per-person totals to the ledger, settling each day
    once, by a watermark claimed in the same transaction.
  - Budget alerts are audited once a month per level (`ai.budget.warning`, `ai.budget.exceeded`).
  - At the budget, no question, title or note calls anything.
  - `GET /ai/usage` (`ai:usage_read`) gives figures per day and per person.
- **Retention** (requirements' schedule, planning report §14.4):
  - deleted conversations go at the next sweep;
  - messages, and conversations left empty, after 90 days;
  - ledger rows after 730 days; daily totals are kept;
  - cached answers once they can no longer be reused;
  - nothing being written is touched.
- **The answer cache** (ADR-0032): normalised exact keys in PostgreSQL. No embeddings, vectors or
  similarity — those are Phase 8's.
  - `shared` scope for general questions with nothing of the asker in them; `user` scope
    otherwise.
  - Never a lab hint, a follow-up, code, a person's details, or an answer that did not complete.
  - Reach is re-checked on every hit, after the whole policy.
  - Invalidation: expiry, model, prompt, knowledge, and the Super Admin's purge
    (`POST /ai/admin/cache/purge`).
- **Privacy.** The export gains each conversation's notes and the person's own cached answers;
  erasure removes them. Shared answers hold nothing of anyone.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each). Formatting clean in
every tracked file (1,097 checked); the root check flags only `apps/web/next-env.d.ts`, a git-ignored
file Next writes at each build. API and web production builds pass. Unit tests 515:

- API 324 (32 new): normalisation, keys, routing by the settings, the roll-up's days, the budget,
  prompts, the context with notes;
- shared 152 (7 new), web 23, runner 16.

API end to end:

- the new lifecycle spec, 25 of 25, with the scripted provider: settings, titles, notes, the
  roll-up, the budget, usage figures, the cache, retention, privacy and security;
- the 7A, 7C and Gemini specs, 34 of 34. The 7C and Gemini specs now wait for the title written in
  the background, and check only the question's own requests where a title call can interleave.
  The Gemini spec also shows the background title keeps the key in its header alone, and a cached
  answer holds neither the key nor any of Gemini's raw fields;
- the full suite: 40 files, 536 tests, 534 passing. The two failures are those already on record
  (students J-01 after the Phase 6 concurrency test; the auth oversized-request race); both files
  pass alone, 25 of 25.

Five rules were broken on purpose, and each break was caught by its test, the files restored byte
for byte:

- the reach re-check on a cache hit;
- keeping a question about the asker for them alone;
- the roll-up setting totals rather than adding to them;
- retention leaving what is being written;
- a budget alert claimed once a month.

The test database matches the schema ("No difference detected", 15 migrations). The OpenAPI document
changes only by the new routes.

Browser (Playwright, `apps/web/e2e/ai.spec.ts`) on the preview stack: 5 of 5 on desktop and 5 of 5
on a phone. The stack was the API on `lms_preview` with the paced fake provider and the web on 3001.
`lms_preview` was migrated for it after a verified backup
(`E:\LMS-backups\lms_preview-before-phase7d.dump`, 602,315 bytes); its 12 ledger rows were
backfilled as the migration intends. On the real queue there, the title jobs ran: each called
through the router and was counted as a call, and one that ran after the spec had switched AI off
called nothing. Temporary launch entries restored and the launcher deleted; ports free.

**Security.**

- No route or job reaches a provider except through the router.
- No key, credential-shaped string, dependency, lockfile, image or infrastructure change.
- No pgvector, embedding, LangChain or Redis.
- No live provider call.

**Findings fixed on the way.** Two jobs creating a settings row at once (the budget alerts' claim
rows, the roll-up's watermark) could collide; they now insert with `ON CONFLICT DO NOTHING`. The
cache keeps the same rule, so a race to keep one answer logs no error.

**Database.**

- `lms` was not migrated: it remains at 13 migrations with no AI tables. Per the runbook (§5), the
  7C and 7D migrations follow the client's approval.
- The test database and the preview copy carry both migrations.

**Remaining for 7E.**

- The web AI workspace (conversation list, titles, deletion).
- The global launcher.
- The lab-hint UI, and course and lesson subjects with their context and source checks.
- An admin page for AI settings, usage and the budget.
- Navigation behind both flags.

**Not touched:** ET-EMS and SLTS (containers unchanged), `lms`, Phase 6 behaviour, every other
project.

## 2026-10-04 (session 31) — Roadmap Phase 7, slice 7C: conversations, streamed answers, usage

**Brief.** The client's Phase 7C brief (4 October 2026): turn the foundation and provider layer into
a controlled conversation system. A permitted person asks a question and reads the answer as it
streams. Out of scope: RAG, embeddings, pgvector, a semantic cache, agents or tools, long-term
memory, mock interviews, voice, evaluation, AWS, LangChain or LangGraph, UI polish. Items AI-7C-01
to AI-7C-10 (`docs/phases/PHASE-07-ai-foundation.md`).

**Built.**

- **Data** (migration `20261007090000_phase7c_ai_conversations`, additive):
  - the tables `ai_conversations`, `ai_messages`, `ai_requests` (the usage ledger) and
    `ai_usage_daily`;
  - `ai_messages_one_generation_per_user_key`, a partial unique index allowing one `streaming`
    answer per person: the generation gate, kept in the database (the Phase 5 pattern for racing
    publications).
- **Conversations** are their owner's alone. Anybody else's — a trainer's, an administrator's, the
  Super Admin's included — is not found, and there is no staff view.
  - Messages are append-only.
  - An answer that does not complete keeps no text.
  - Deleting hides a conversation at once.
  - A lab hint names a lab the learner may work on: the lab drafts' rule, moved unchanged into
    `PracticeService` so both use one rule.
  - Course and lesson subjects are refused until the on-page assistant (7E).
- **Routes:**
  - `GET` and `POST /ai/conversations`, and `GET` and `DELETE /ai/conversations/:id`;
  - `POST /ai/conversations/:id/messages`, answering with server-sent events (`meta`, `delta`,
    `notice`, `error`, `usage`, `done`, a `ping` every 15 seconds), each checked against its strict
    shape;
  - the 7A placeholder `POST /ai/messages` is gone.
- **Before anything is written**, in order:
  - ownership;
  - the surface's flag and permission;
  - no AI during a timed test, reading conversations included;
  - an answering model service;
  - the data class, decided on the server: a credential in the message is restricted (refused,
    not stored, never sent), a lab hint personal, a general question public;
  - the router's approval of that class (`AI_DATA_CLASSES`, only `public` by default);
  - the daily allowances and the optional monthly budget, failing closed.
- **The answer:**
  - the context is the recent conversation (at most 10 completed messages, 16,000 characters) and
    the question;
  - the router's deadline bounds it, and it is cancelled when the reader leaves;
  - it is closed once, with its ledger rows and the day's usage, which opens the gate again;
  - an answer a stopped process left behind is closed as `failed` (`interrupted`) once it is past
    the longest an answer can take;
  - the problem filter closes a response already under way instead of writing over it.
- **Usage:**
  - one ledger row per call, with tokens, estimated cost from `AI_MODEL_COSTS` and latency;
  - one question per day counted per person, however many calls it took;
  - a call that stopped while writing is counted with estimated tokens, marked so.
- **Allowances:**
  - `AI_USER_DAILY_REQUESTS` (50) and `AI_USER_DAILY_TOKENS` (100,000);
  - `AI_ORG_MONTHLY_BUDGET_USD` (none; once set, every routed model needs a price);
  - `AI_MAX_OUTPUT_TOKENS` (4096) and `AI_FAKE_DELAY_MS` (local).
- **Audit and privacy:**
  - governance events, as metadata only: `ai.conversation.created`, `ai.conversation.deleted`,
    `ai.policy.refused`, `ai.quota.exceeded`, `ai.generation.busy`, `ai.generation.failed`;
  - a completed answer is not audited (ADR-0028);
  - the learner export carries their AI data;
  - erasure deletes their conversations and keeps their calls and daily totals, belonging to
    nobody.
- **Web:**
  - `apps/web/src/lib/api/stream.ts`, a POST read as server-sent events, with cookies, the CSRF
    header and one refresh;
  - a minimal page to ask on `/ai`: streaming, Stop, a refused question returned to the box;
  - the full workspace is 7E's.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each). Unit tests 476:

- API 292 (28 new): classification, context, quotas and cost, the stream writer, the problem
  filter, the router's additions;
- shared 145 (11 new), web 23 (7 new), runner 16.

API end to end:

- the new conversations spec, 18 of 18, with a scripted provider: ownership, guards, the policy,
  every ending, cancellation, the gate (including a crash), quotas, privacy, audit, and context
  hygiene (hidden cases, solutions and other learners' words never sent);
- the 7A and 7B AI specs, updated to the routes (10 and 6). The Gemini adapter answers end to end
  against a stand-in for its API: no raw field and no key reach the browser, the audit log, the
  logs or the API description;
- the full suite: 39 files, 511 tests, 510 passing. The one failure is the order dependency already
  on record (students J-01 after the Phase 6 concurrency test); the file passes alone, 13 of 13.

Four rules were broken on purpose, and each break was caught by its test:

- ownership scope;
- the quota check;
- keeping a partial answer;
- reading during a timed test.

Browser (Playwright, `apps/web/e2e/ai.spec.ts`) on the preview stack: 5 of 5 on desktop and 5 of 5
on a phone. The stack was the API on the preview copy `lms_preview`, migrated for it, never `lms`,
with the paced fake provider; and the web on 3001. The page is absent while AI is off; the answer
streams; Stop works and the next question is answered; a second tab is refused; a phone screen
fits.

Formatting clean; the API and web production builds pass. The migrated test database shows no
drift from the schema. The OpenAPI document changes by the AI routes only: the placeholder removed
and five added.

**Security.**

- No route reaches a provider except through the router.
- No key, credential-shaped string, dependency, image, pgvector, embedding or AWS change.
- No live provider call: the scripted provider and a stand-in for Gemini's API.

**Database.**

- `lms` was not migrated: per the runbook (§5), its migration follows the client's approval. It
  remains at 13 migrations with no AI tables.
- The test database and the preview copy carry the 7C migration.

**Deferred to 7D.**

- The retention sweep for deleted conversations and old messages.
- Titles and summaries by the model, usage roll-ups and budget alerts.
- Per-institute AI settings.
- The semantic-cache foundation.

**Not touched:** ET-EMS and SLTS (containers unchanged), `lms`, Phase 6 behaviour, every other
project.

## 2026-10-04 (session 30) — Roadmap Phase 7, slice 7B: providers and model routing

**Brief.** The client's Phase 7B brief (3 October 2026): the provider and model-routing foundation.
Gemini becomes a real server-side provider; the fake stays the deterministic local and test
provider, and `none` the safe default. A model registry and router, normalised failures, timeouts
and cancellation, circuits, and credentials that never reach a browser or a log. No RAG,
embeddings, pgvector, AWS, LangChain or LangGraph, agents or long-term memory; `/ai/messages`
stays a placeholder until 7C. Items AI-7B-01 to AI-7B-08 (`docs/phases/PHASE-07-ai-foundation.md`).

**The contract, checked first.** Gemini's request and response were taken from Google's discovery
documents for the Generative Language API (`v1` and `v1beta`, revision 20261002) and its model
pages, read on 3 October 2026; no field name was guessed. Google now recommends its Interactions
API for new projects and calls `generateContent` legacy, but fully supported with no end date.
`generateContent` was kept because it is stateless and its contract is machine-readable; ADR-0024
gained an Implementation section saying so.

**Built.**

- The Gemini provider (`providers/gemini.provider.ts`, wire format in `gemini.wire.ts`):
  - `generateContent` and `streamGenerateContent?alt=sse` on the stable `v1` API, over the
    platform's fetch, with no SDK;
  - `store: false` on every request; the key only in the `x-goog-api-key` header; redirects refused;
  - the model code checked before it goes into the path;
  - bounded responses and stream events;
  - health read from the model's description, with no generation.
- Results in SI Academy's terms:
  - finish reasons `stop`, `length`, `blocked`, `other`;
  - usage with thinking counted as output, or estimated and marked as such.
- Failures in SI Academy's terms: `AiProviderError` kinds `auth`, `configuration`, `rate_limited`,
  `unavailable`, `timeout`, `cancelled`, `bad_request`, `malformed`, `circuit_open`.
  - They answer `ai_unavailable`, `ai_busy` (new) or `ai_timeout` (new).
  - Only status and reason codes are read from the provider's error, never its message.
- The model registry (`routing/model-registry.ts`), an allow-list: Gemini's six stable text models
  as Google listed them on 3 October 2026, and the fake's one. Every configured model is checked
  at start-up.
- `ModelRouter`, the only path to a provider; the provider is no longer exported. It handles:
  - per-task models (`AI_TASK_MODELS`, else `AI_MODEL`);
  - refusals before any call: the task, streaming, data class (`AI_DATA_CLASSES`, only `public`
    by default; `restricted` never) and input size;
  - output capped at the model's limit;
  - a deadline (`AI_TIMEOUT_MS`) and the caller's abort;
  - a fallback to another model of the same provider only (`AI_FALLBACK_MODEL`), only when the
    task's model is overloaded or resting, and only before any of the answer is written;
  - an estimated cost (`AI_MODEL_COSTS`);
  - one log line per call, without its content.
- Circuits (`routing/circuit-breaker.ts`): five consecutive failures rest a model for 30 seconds;
  then one probe call; in the process (ADR-0006).
- Configuration and status:
  - `GEMINI_API_KEY` and `GEMINI_BASE_URL`, with start-up refusals: Gemini without its key or
    model, a refused key echoed nowhere, and outside local a placeholder key or plain http;
  - the example files and the staging compose file carry the new variables;
  - only the configured provider is built;
  - the Super Admin's status gains `service` (`off`, `ready`, `degraded`, `unavailable`).

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each). Unit tests 430:

- API 264, 89 of them new: Gemini 36; the provider contract 13 (the same suite for the fake and
  Gemini); router 18; registry 9; circuits 6; configuration 7.
- shared 134, runner 16, web 16.

API end to end:

- The AI, Gemini-configured, route-table, role-boundary and permission files: 39 of 39. The 6 new
  tests run with Gemini configured on a made-up key, and every request to Google is refused by a
  stand-in.
- The full suite: 38 files, 493 tests, 491 passing. The two failures are not 7B's and pass alone
  (`auth` 12 of 12, `students` 13 of 13):
  - the oversized-request reset race already on record;
  - J-01 meeting the student codes past 9999 that a Phase 6 concurrency test leaves in the shared
    run database, when the file order puts it first (a task is offered).

Three of the router's rules were broken on purpose, and each break was caught by its test:
stitching a stream from two models; routing restricted data; keeping a probe slot.

After the full run, two changes, then type-check, lint, unit and the AI end-to-end files again, all
green:

- formatting;
- a title for each failure kind.

Formatting is clean in every changed file. The API and web production builds pass.

**Security.** No route calls a provider: `fetch` appears only in the Gemini provider, and `chat`
and `stream` are called only by the router. Tests show the key stays out of:

- URLs, errors, log lines and results;
- the provider object itself;
- every API answer;
- the generated API description.

No key-shaped string is in the change, and no real key exists on this machine. No dependency,
migration, schema, image or base compose change; no public web variable.

**Database.** No migration and no schema change. `lms` was not touched; the API tests ran on
`lms_test`.

**Deferred to 7C.** The gateway calling the router, with conversations, the policy layer,
streaming over SSE, usage accounting and quotas. Per-institute model choice in AI settings, over
the same registry. The data classification of each request, which the router already enforces.

**Not touched:** ET-EMS and SLTS (containers unchanged), `lms`, Phase 6 behaviour, every other
project.

## 2026-10-03 (session 29) — Roadmap Phase 7, slice 7A: the AI foundation

**Brief.** After the AI platform reconnaissance (read-only, the same day), the client's Phase 7A
brief: the AI foundation and its contracts only — ADRs, the Phase 7 plan, shared contracts,
permissions, flags, the module skeleton, the provider boundary, configuration, secret redaction,
the `/ai` route boundary and tests. No Gemini call, RAG, embeddings, pgvector, image change, AWS,
LangChain or LangGraph, agents, long-term memory, evaluation, mock interviews or UI polish; Phase 6
behaviour, ADR-0001–0023, ET-EMS and SLTS untouched. Plan and backlog: `docs/phases/PHASE-07-ai-foundation.md`
(items AI-7A-01 to AI-7A-09).

**Built.**

- ADR-0024 to ADR-0031: provider and models (Gemini first, `none` by default, `fake` for local and
  tests, keys on the server, no learner data to a free tier), orchestration in house, vector storage
  readiness (no pgvector yet; never a glibc image on the musl data volume), embeddings in Phase 8,
  observability with the platform's own records, quotas, streaming and retention, where AI is
  allowed.
- `packages/shared/src/schemas/ai.ts`: purposes, tasks, roles, statuses, data classes, features and
  their flags, the message input (strict; a lab hint names its lab) and strict answer shapes
  (availability, conversation summary, message view, admin status, provider capabilities).
- Permissions `ai:chat` (own; every role), `ai:hints` (own; learners), `ai:usage_read` (all for
  administrators, batch for trainers), `ai:manage` (Super Admin only), in the bundles as new keys
  (the ADR-0009 watermark grants them once; no named change needed); the matrix regenerated.
- Flags `module.ai` (declared off) and `ai.assistant`, `ai.workspace`, `ai.lab_hints`,
  `ai.semantic_cache` (off); an option opens nothing without `module.ai` (`aiFeatureEnabled`).
- `apps/api/src/modules/ai`: the manifest; `GET /ai/availability`, `POST /ai/messages` (20 in 5
  minutes per person) and `GET /ai/admin/status` behind the usual guards and `module.ai`; the policy
  (module, option flag, permission, and no help during a timed test through the new
  `AttemptsService.hasOpenAttempt`); the gateway answers `503 ai_unavailable` and calls no provider;
  `AiProvider` with `none` and `fake` (deterministic, no network; `embed` refused until Phase 8).
- `AI_PROVIDER` (`none` default; `fake` refused outside local) and `AI_MODEL`; the logger's
  redaction list named (`LOG_REDACT_PATHS`) with explicit paths for provider keys and authorization
  headers; `DATA_ENCRYPTION_KEY` now in the example files and the staging compose (the
  reconnaissance's finding), with `AI_PROVIDER`/`AI_MODEL`.
- Web: `/ai` in the account shell, not found unless `module.ai`, `ai.workspace` and `ai:chat` all
  hold; a placeholder only (the workspace is 7E).
- The roadmap and the AI architecture record the client's scope split (retrieval, embeddings and
  vector storage in Phase 8; no LangChain, LangGraph or LangSmith in Phase 7) as amendments.

**Verified.** Type-check and lint clean in every package (9 of 9 tasks each); unit 341 (shared 134,
runner 16, API 175, web 16); API end to end 37 files and 487 tests: 486 passed; one existing test (authentication: "refuses an oversized request before reading it") failed with a client-side `ECONNRESET` — the server refuses the 2 MB body before reading it and the client was still sending — and its file passed on two reruns (12 of 12 each); 7A changed nothing on that path (flagged as its own task); formatting clean in every tracked file; API and
web production builds. A runtime smoke on the built API and web against the preview copy of `lms`
(`lms_preview`, never `lms`): the five AI flags present and off, every AI route refused while off,
`/ai` sends a signed-out visitor to sign-in and answers 404 to a signed-in learner, and with
`module.ai` and `ai.workspace` switched on in the copy the placeholder page appears, availability
says `not_ready` without naming a provider, and a message gets `503 ai_unavailable`; the flags were
switched off again (9 checks, all passing). The OpenAPI document regenerated with the three AI
routes and nothing else.

**Security.** No provider call exists outside the provider classes and their tests; no key-shaped
string in the change; no migration, no schema change, no image or pgvector change; the gateway
never calls a provider in 7A; client-facing shapes are strict and checked for key, secret, token
and provider fields.

**Database.** No migration: settings, flags and permissions use the existing tables. The new
permission and flag rows reach a database through the existing boot and seed sync (ADR-0009); `lms`
itself was not touched in this session.

**Not touched:** ET-EMS and SLTS (containers unchanged), `lms`, every other project.

## 2026-10-03 (session 28) — Phase 6 approved; the final gate; pushed

**Approval.** The client accepted Phase 6 on its hardening report and asked for the final gate:
verify, review CI read-only, record, push. No Phase 7, no AI, no staging deployment; nothing new
built unless a check found a Phase 6 security blocker — none did.

**Checked.** The working tree clean, `HEAD` `51649d0`, `origin/main` and GitHub's `main` still
`3484cfc`. `lms`: 13 migrations, none failed, the newest `20261006090000_phase6_hardening`; all 79
tables row for row as after the migration (4,316 rows); the backup's SHA-256 still matches. The
ET-EMS and SLTS containers unchanged.

**CI review.** Eight actions, each on its current major; none named by the 56 Actions advisories in
the GitHub Advisory Database. CI left as it is: the runners pinned to `ubuntu-24.04` are the Phase 6
state. Recommendations (pin actions by commit, a read-only token default, Node 24 action majors, a
checked deploy tag and a pinned host key) go to the phases that own CI and staging:
`docs/phases/PHASE-06-hardening.md` §7.

**Pushed.** This record goes to `origin/main` with the 14 commits of Phase 6, as a fast-forward
from `3484cfc`. The Branding page's font select and the staging storage host stay documented as
their own items.

## 2026-10-03 (session 27) — Roadmap Phase 6: code quality and security hardening

**Brief.** The client's Phase 6 brief: a full security and code-quality pass — authentication,
sessions, authorisation, privacy and storage, validation, robustness, audit, jobs, concurrency, rate
limits, dependencies — in the order inspect, identify, prioritise, harden, test, regress, document,
commit; the known items (a suspended account and invitations, session revocation, the privacy
request workflow, the former trainer's `/me`, certificate fonts, browser-facing storage addresses,
remaining authorisation and concurrency findings); no Phase 7, no AI, no infrastructure added, no
push. From `3484cfc`; findings, decisions P6-1–P6-11 and the record:
`docs/phases/PHASE-06-hardening.md`.

**Built** (thirteen commits, `306f3e2`..`6466af7`, and this record). Access tokens end with their
session family; refresh keeps the family, the sign-in's lifetime and its remember-me choice, with a
30-second grace for two tabs refreshing together (`sessions.persistent`, `sessions.rotated_at`).
Invitations activate only invited accounts and reset links only active ones, each claimed once,
ending its siblings and sent at once rather than queued; a cross-site sign-in is refused by its
origin. Signed links name only public hosts (`S3_PRESIGN_ENDPOINT`; refused otherwise), SVG is gone
from shared images and `/files` serves only the public bucket, sandboxed; files go with the résumé,
photo or export that held them; only the uploader deletes through the files route; stored
integration secrets are sealed. Edits change only what they name (Zod 4 nested defaults); windows
compare instants; database rules a request breaks answer 409 or 404, not 500. Queued exports and
imports run as their requester is now; the last Super Admin is kept under a lock; announcements,
results releases and drive openings notify once; codes are allocated by number. Per-person limits
count the verified person, a successful sign-in is not counted, costly routes have limits. A former
trainer is no longer counted in the batches they taught. `next` 16.3.6 and `multer` ^2.4. One
additive migration, `20261006090000_phase6_hardening`.

**Verified.** Type-check and lint clean in every package; unit 316 (shared 124, runner 16, API 163,
web 13); API end to end 36 files and 477 tests in the final run, all passing (three new specs — auth-hardening, hardening, concurrency — and every
earlier suite as regression); the permission matrix unchanged (72); every tracked file formatted.
Browser, on the production build against a copy of the migrated `lms`, Chromium, all 11 suites (101
tests): 98 passed, 2 skipped by design, 1 passed on its retry (the trainer's question-bank search
box was not editable on the first attempt; the suite alone passed it cleanly); after the last two
fixes, five suites again on a rebuilt stack, 40 passed. Role journeys for all six roles against the
same API, 37 checks passed. The phone project was not run: no layout changed.

**Main local database (`lms`).** Backed up first (`E:\LMS-backups\lms-before-phase6.dump`, 570,890
bytes, SHA-256 beside it), restored into a scratch database and compared — all 79 tables, 4,315
rows, identical — and the scratch copy dropped. Target checked (`lms`, port 5433); one pending
migration. `db:migrate` applied `20261006090000_phase6_hardening` (13 of 13, none failed); both
columns present. Compared row by row over each table's earlier columns: 78 tables unchanged, the
migrations table one row more (4,315 → 4,316). The ET-EMS and SLTS containers: the same set,
stopped, same start and finish times before and after; every other database on the LMS server
untouched; the QA copy `lms_phase6_qa` dropped after the browser runs.

**Deferred**, each with its phase in the record (§6): a shared store for limits and caches (12), a
public storage host on staging and a least-privilege storage user (14), a CSP nonce for the web app
(12), the learner's privacy request queue (13), certificate fonts beyond Latin-1 (13), upload
scanning (14), an append-only trigger for the audit log (12), streaming for very large reports
(12), Prisma's parallel sub-queries on a transaction connection before pg 9 (12), and the tooling
advisories `pnpm audit` still reports (12). Found on the way and flagged as its own task: the
Branding page's font select shows no value.

**Not pushed.** The phase's commits stay local until the client decides the gate.

## 2026-10-03 (session 26) — Phase 5 approved and pushed

**Approval.** The client approved Phase 5 and accepted it as complete on 3 October 2026, and asked
for the final gate only: nothing further built, Phase 6 and AI not started.

**The gate.** The working tree was clean, `HEAD` was `3484cfc` and `origin/main` had not moved from
`9369b50`. The push of `9369b50..3484cfc` (the first pass, the completion pass and its record) was
a fast-forward, with the pre-push type-check and unit tests passing; afterwards the local `HEAD`,
`origin/main` and GitHub's `main` were the same commit,
`3484cfc5e5856a679b7865323d3df0d480c29ca8`. The push started the CI workflow on `main`; its result
could not be read from this machine (no `gh`, and the repository is private). The ET-EMS and SLTS
containers: the same set, stopped, with the same start and finish times; `lms` as the Phase 5
migration left it.

**Records.** The roadmap and the phase record were brought up to date with Phase 6's record
(session 27): Phase 5 complete and approved.

## 2026-10-03 (session 25) — Roadmap Phase 5: the final completion pass

**Brief.** The client stopped the Phase 5 gate and asked for every item the first pass had deferred
to be finished inside Phase 5 — deactivated accounts, completed and archived batches, reconciliation
of asynchronous effects, the list-read timeout, concurrent publication, notice read state, staff
search for labs and questions, a learner's document search, overdue notices — each inspected and
defined against the existing rules first, product questions settled by the safest consistent
behaviour and documented; no push, no Phase 6, no AI. From `637265d`; findings C1–C9, decisions
P6–P14, the lifecycle rule and the record: `docs/phases/PHASE-05-integration.md` §5–§8.

**Built** (eleven commits, `5beb8ba`..`88803ed`, and this record). List reads outside transactions
(21 lists; the 5-second limit is not raised). One live publication per audience, kept by partial
unique indexes (courses and assignments; racers answered `409`). One lifecycle in
`EnrollmentService`: deactivation ends batch places as a removal does and reactivation gives them
back (under the batch-row lock, once); archived batches and programmes end what they gave; completed
courses are never withdrawn; withdrawn courses neither complete nor certify; delivery skips
deactivated and erased accounts. `progress.reconcile` every 15 minutes, idempotent and audited,
failing the job when a learner cannot be settled; the certificates sweep no longer redraws revoked
certificates or issues to erased accounts. Overdue notices and per-learner due-soon notices from
`learnerState`, sent once (dedupe keys; queued deliveries keyed too). Opening a page reads the
notices that lead to it (`@ReadsNotices`, `POST /me/notifications/read-page`, the centre for
announcements). Staff search for labs and the question bank; a learner's Documents. One additive
migration, `20261005090000_phase5_integration`.

**Verified.** Type-check and lint clean in all six packages; unit 293 (shared 113, runner 16, API
151, web 13); API end to end 33 files and 437 tests in the final run (the six new specs —
list-reads, lifecycle, reconciliation, deadlines, notice-reading, search-reach — and the race tests
among them, every earlier suite as regression); the permission matrix unchanged (72); formatting
clean in every tracked file. Browser, on the production build against copies of the migrated `lms`,
Chromium, every suite (11 files, 95 tests): 93 passed and 2 skipped by design; one passed on its
retry (the engagement streak test: the learner's session was refused by the web server's own `/me`
check for a minute, before the page asked for its dashboard). After the last API fix, the two suites
that create learners again: 20 passed, 1 skipped. The phone project was not run: no layout changed.
Two older specs made the suite pass or fail by the clock and by file order, and this pass's runs
exposed both: the Phase 2 learner spec left a class two days ahead on the shared trainer's
timetable, which clashed with the sessions spec's morning series (reproduced at 10:47, fixed), and
the Task 2 engagement spec gave a learner a STU-2026-<six digits> code that derailed the year's code
sequence for the students spec (fixed).

**Main local database (`lms`).** Backed up first (`E:\LMS-backups\lms-before-phase5.dump`, 568,656
bytes, SHA-256 beside it), restored into a scratch database and compared — all 79 tables, 4,314
rows, identical — and the scratch copy dropped. Target checked (`lms`, port 5433). `db:migrate`
applied `20261005090000_phase5_integration` (12 of 12, none failed); the five indexes and the
nullable `notifications.dedupe_key` are present. Compared row by row over each table's earlier
columns: 78 tables unchanged, the migrations table one row more (4,314 → 4,315). The reconciliation
job has not run on `lms` (no API ran on it); on a copy of it, after the browser runs, its first run
made one enrolment, whose cause — a new learner made without a batch was not enrolled in what is
published to everyone — is fixed (`c667ad5`). The ET-EMS and SLTS containers: the same set, stopped,
same start and finish times as at the Phase 2 gate; every other database on the LMS server
untouched.

**Not pushed.** The phase's commits stay local until the client decides the gate.

## 2026-10-03 (session 24) — Roadmap Phase 5: cross-module integration built and verified

**Brief.** The client's Phase 5 brief (strict two-hour autonomous window, from `9369b50`):
cross-module correctness, data consistency, authorisation and scope integrity, workflow continuity,
notifications, search, report consistency and audit, verified rather than broad; no Phase 6, no AI,
no new infrastructure, no UI redesign. Plan, gaps, decisions P1–P5 and the record:
`docs/phases/PHASE-05-integration.md`. Received at 06:43 IST; built and verified by 08:00.

**Found and fixed** (each with API end-to-end tests): the dashboard counted course progress
differently from the progress report, and a trainer's dashboard showed another batch's course and a
shared learner's progress in it (D6); removing the learner role left the person's batch places
(rosters, roll calls, batch notices); new content could be given to an archived batch or programme;
staff search found no courses, assignments or tests and sent trainers' hits to admin pages; a
doubt's answer stayed unread in the bell after the thread was read. No migration, no new dependency,
no new infrastructure; the existing events, audit log and list services were reused.

**The integration spec** (`apps/api/test/integration.e2e-spec.ts`, 8 tests) follows one learner
across the modules and asks each side what it sees. Its first full-suite run failed once on an
order-dependent assertion (a course another spec left on the other batch reached the transferred
learner, as it should); the test now creates that condition itself and asserts it.

**Verified.** Type-check and lint clean in all six packages; unit 293 (shared 113, runner 16, API
151, web 13); API end to end 27 files and 405 tests (the 26 earlier files and the integration spec,
with every role-boundary, object-scope and Phase 1–4 suite as regression); the generated permission
matrix unchanged (72 permissions); formatting clean in every tracked file. Browser, on the
production build against a copy of `lms` (`lms_phase5_qa`, dropped afterwards), Chromium, every
suite (11 files, 95 tests): 93 passed and 2 skipped by design, the three journeys first (31 passed;
the phone layout skipped). The Labs suite failed once while the machine was starved of memory (the
sandbox runner gave up after 55 s; in the same minute two assignment-list reads hit Prisma's
5-second transaction limit, recorded for Phase 6) and passed 10 of 10 run on its own. The phone
project was not run: no web code changed in this phase. The OpenAPI document is re-committed in the
order the new module imports give it (the same 253 paths, equal once key order is ignored).

**Main local database (`lms`).** No migration and no seed in this phase; compared read-only with the
snapshot taken at the Phase 3–4 approval: 11 migrations applied, none failed, the newest still
`20261004090000_phase3_4_staff_and_operations`; all 79 tables row for row as they were (4,314 rows).
No backup was needed: nothing was written to it. The ET-EMS and SLTS containers: the same set,
stopped, with the same start and finish times as at the Phase 2 gate; the LMS containers were not
restarted either.

**Not pushed.** The phase's commits stay local until the client decides the gate.

## 2026-10-03 (session 23) — Phases 3 and 4 approved; ADR-0023 accepted; pushed

**Approvals.** The client approved and closed Phases 3 and 4 and approved ADR-0023 (course staff,
with its amendment of ADR-0009) on 3 October 2026. Phase 5 and any AI work wait for the client's
explicit approval.

**Checked again before the push** (read-only on `lms`, which the client asked to keep as
verified): the backup `E:\LMS-backups\lms-before-phase3-4.dump` still matches its SHA-256; 11
migrations applied, none failed or rolled back, the newest
`20261004090000_phase3_4_staff_and_operations`; all 79 tables row for row as after the migration
(4,314 rows); the working tree clean; GitHub's `main` still `3f9ec2c`. The ET-EMS and SLTS
containers: the same set, stopped, with the same creation and start times as before the phase.

**Cleaned up.** The QA copy `lms_phase34_qa` (no connections, its servers stopped) was dropped;
`lms` and every other database on the LMS server were left as they were.

**Pushed.** This record goes to `origin/main` with the 33 commits of Phases 3 and 4 and the two
Phase 2 records made after that phase's push (`4251a15`, `0684c21`), as a fast-forward from
`3f9ec2c`.

## 2026-10-03 (session 22) — Roadmap Phases 3 and 4: the trainer and the administrator completed

**Brief.** The client's combined Phase 3 + Phase 4 brief (autonomous): complete the trainer and
staff side and the administration and operations side, verify with role-boundary, object-scope,
cross-role and direct-API tests, browser journeys on a desktop and a phone, and the Phase 1 and 2
suites as regression; stop at the gate. Plan, five read-only audits, decisions D1–D10, items and
the record: `docs/phases/PHASE-03-04-trainer-and-admin.md`. Received at 00:21 IST; built,
verified and the main database migrated by 06:00.

**Built.** P0 security and data integrity first (SEC-01 to SEC-07: every route's role boundary,
tests and questions fixed once answered, no privilege granted by someone who lacks it, one path
into a batch, the trainer's reach from taught batches only, audit gaps closed, flag audiences on
the server). Then the trainer (TRN-01 to TRN-12: dashboard, batches and students, course staff
with lesson editing, attendance corrections, test windows and re-marking, late work, doubt
notices, announcements, report links, feedback, debugging and web labs in assignments, Run inside
timed tests) and the administrator (ADM-01 to ADM-13: unlock and sessions, the learner record,
batch and programme editing, individual enrolment, certificate administration, four new reports,
applicants' résumés and export, flag audiences, audit filters and export, failed jobs, privacy
export and erasure, retention, the certificate signatory). One migration
(`20261004090000_phase3_4_staff_and_operations`, additive); ADR-0023 (course staff, amends
ADR-0009) proposed; the permission matrix generated from the code
(`docs/architecture/PERMISSION_MATRIX.md`); a runbook (`docs/runbooks/operations.md`).

**Security review.** An independent read-only review of the whole change found two medium and
five low issues; all are fixed with tests (plan §6): a trainer's filter reaching a co-trainer's
figures, feedback figures that date ranges could narrow to one answer, learners' names shown to
course staff outside their batches, practice lessons embedding others' questions, certificates
outside course reach, a former trainer's views, and — wider than reported — Zod 4 filling defaults
into every partial update (a course settings save wiped its tags and picture).

**Verified.** Type-check and lint clean in all six packages; unit 293; API 26 files and 397 tests;
role boundaries on every route for five roles; sandbox 27; question bank 53 questions and 107
runs; browser on the production build: Chromium 96 passed (2 skipped by design), phone 97 passed
(1 skipped); the new staff journeys on both. The browser regression found one regression (a
correction's reason hidden by TRN-04), fixed.

**Main local database (`lms`).** Backed up first (`pg_dump`, custom format, outside the
repository: `E:\LMS-backups\lms-before-phase3-4.dump`, 556,101 bytes, SHA-256 beside it). The
backup was restored into a scratch database and all 75 tables (4,289 rows) matched the live
database, row counts and content fingerprints; the scratch copy was then dropped. `db:migrate`
applied `20261004090000_phase3_4_staff_and_operations` (11 of 11). Only the base seed ran.

- **Compared row by row (4,289 → 4,314):** 69 tables unchanged (users, students, enrolments,
  progress and submissions among them). Changed as intended: the migration record; four new, empty
  tables (`course_staff`, `attendance_corrections`, `feedback_forms`, `feedback_responses`); six
  permissions with their 16 role grants, and three permission descriptions refreshed; the
  `module.feedback` flag (on, as SI Academy's configuration says); the two RBAC settings (the
  watermark and the applied bundle changes). Flags and roles otherwise changed only their update
  times: no flag was switched and no role renamed.
- **Not touched:** the ET-EMS and SLTS containers (same set, same creation and start times) and
  every other database on the LMS server. The QA copy `lms_phase34_qa` was used for the browser
  runs.

**Not pushed.** The phase's commits stay local until the client approves the gate.

## 2026-10-03 (session 21) — Phase 2 approved; the main database migrated; Phase 2 pushed

**Approvals.** The client approved the Phase 2 gate and ADR-0022 on 3 October 2026; ADR-0022 is
accepted. The client then approved Phases 3 and 4 as one combined batch (trainer and staff
completion, admin and operations completion), started the same day.

**Main local database (`lms`).** Backed up first (`pg_dump`, custom format, outside the
repository: `E:\LMS-backups\lms-before-phase2.dump`, 551,234 bytes, SHA-256 beside it). The backup
was restored into a scratch database (`lms_backup_check`), and all 74 tables (4,282 rows) matched
the live database, row counts and content fingerprints. `db:migrate` applied
`20261003090000_phase2_learner_experience` (10 of 10, up to date). Only the base seed ran
(`db:seed`): it added `certificates:read` with its four role grants and the
`module.certificates` flag (on, as SI Academy's configuration says). The demo seed was not run:
Phase 2 adds no sample content, and it would re-date the sample history and reset the 71 sample
accounts.

- **Compared row by row:** 67 of 74 tables unchanged (users, students, the 240 enrolments, progress
  and submissions among them). Changed as intended: the migration record, the empty certificates
  table, the permission and its grants, the flag, the one practice lesson (`manual` to `pass`)
  and the seeded-permissions setting. Flags and roles otherwise changed only their update times,
  and the Labs flag's description was refreshed from its manifest; no flag was switched.
- **Not touched:** the ET-EMS and SLTS containers (identical start and stop times) and every other
  database on the LMS server.

**Pushed.** The nine Phase 2 commits (`4d0d353` to `3f9ec2c`) went to `origin/main` as a
fast-forward from `aad481c`; the pre-push hook passed (type-check 9 of 9, unit 279). GitHub's
`main` is `3f9ec2c`. CI's result could not be read from this machine.

**Found after the gate and fixed.** On a fresh database the demo seed created its practice lesson
with the `manual` rule, which Phase 2 no longer allows (D3); it now creates it with `pass`. The
main database was not affected (its lesson already existed and the migration moved it).

## 2026-10-02 (session 20) — Roadmap Phase 2: the complete learner experience built

**Brief.** The client's Phase 2 brief ("Phase 2 — Complete all learner modules"): audit all 19
learner modules, complete them, verify journeys J1–J18, stop at the gate. Plan, audit, decisions
D1–D8, items LRN-01 to LRN-23 and the record: `docs/phases/PHASE-02-learner-experience.md`.

**Audit first.** Every module was read end to end before any change (§1 of the plan): one broken
outright (lessons: the player's remount loop, client-asserted watch time), tests leaking the key
during an attempt, answer keys leaking under `after_due`, certificates missing, and partial flows
everywhere else.

**Built.** Server-measured watch time and completion rules per lesson type (D2, D3); one progress
model recomputed on outline changes (D1); course access per ADR-0010's own remedy, with
`withdrawn` enrolments (D4); certificates with a PDF and a public check (ADR-0022, proposed);
Projects, Certificates and Attendance pages; deadlines on the schedule; the dashboard's activity,
notifications, Labs and certificates; answer keys and scores never early (D7); late work recorded;
the attempt limit safe under races; notices for classes, due work, closing tests, reviewed
documents and certificates; search limited to what the caller can reach; documents downloadable by
their owner; a lost stored file answered as "not found".

**Security review.** An independent read-only review of the whole change found ten issues; eight
are fixed with tests, two are recorded (plan §7): join links readable early through other routes,
a test's key opening per batch rather than per test, per-question results before the window
closed, watch credit earned per lesson in parallel, the password-change limit counted per session,
duplicate certificate notices under a race, doubts on a course left behind, and the verify page's
session forwarding.

**Verified.** Type-check and lint clean; unit 279; API 295 (19 files, real PostgreSQL); sandbox
27; question bank 53 questions in 107 runs; browser: every spec passes on Chromium and the phone
(seven flaky under memory pressure, all passed on retry; two journey selectors fixed and rerun,
plan §7); build of every package; the
migration applied to a copy of the local sample data (`lms_phase2_qa`), changing only the one
practice lesson's rule. The QA copy, its fixture and the temporary launch entries stay outside the
repository; the main `lms` database was not touched, nor any ET-EMS or SLTS database or container.

**Not done here.** The main `lms` database is not migrated (it needs the client's go-ahead, as in
Phase 1); nothing is pushed.

**Next.** The Phase 2 gate: the client's approval of the phase and of ADR-0022. Phase 3 has not
started; AI implementation has not started.

## 2026-10-02 (session 19) — Phase 1 approved; the main database migrated; Phases 0 and 1 pushed

**Approvals.** The client approved the Phase 1 gate and ADR-0018 to ADR-0021 on 2 October 2026; the
four ADRs are accepted. Phase 2 has not started: it begins only on the client's explicit approval.

**Main local database (`lms`).** Backed up first (`pg_dump`, custom format, outside the
repository). `pnpm --filter @lms/api db:migrate` applied `20261002120000_phase1_labs` (recorded as
finished and not rolled back; `migrate status`: up to date, 9 of 9), then
`pnpm --filter @lms/api db:seed:demo` ran cleanly. Checked afterwards:

- **Phase 1 is there:** the six labs (three debugging, three web) published, validated and in the
  catalogue, with 31 cases; the two lab lessons, last in Core Java › The language and in Web
  Development › HTML, completed on `pass`; `practice:publish_own` and `practice:review` granted by
  role bundle (trainer, admin, content manager, Super Admin); `module.practice` on; `lab_drafts` in
  place and empty.
- **Existing data:** compared row by row with a snapshot taken before (72 tables, 4,172 rows), no
  row was removed. The migration changed no row. The seed changed existing rows only as every run of
  it does: the sample history's dates moved forward a day or two to centre on today; two past
  classes had their roll call marked (40 marks) and two of today's moved to completed; four
  enrolments' percentages fell a little (61 to 58, for example) because their courses gained a lab
  lesson; and the 71 sample accounts were reset, their password set again to the seed password that
  every one of them already had (checked against the old hashes) and their token versions moved on
  (no account was signed in). The Super Admin was not touched.
- **Correction to session 18:** on an existing database the demo seed is not "additive, nothing
  else"; the runbook (`docs/runbooks/local-setup.md`) and the phase record now say what it
  refreshes.
- **Not touched:** the ET-EMS and SLTS containers (same state, start and stop times), every Docker
  volume, the list of databases on the LMS server, and the separate PostgreSQL on port 5432.

**Pushed.** The eight commits of Phases 0 and 1 (`de31792` to `2df44a9`) went to `origin/main` as a
fast-forward from `74824f5`; the pre-push hook passed (type-check 9 of 9, unit 237). GitHub's `main`
is `2df44a9`, the same as the local branch. The push starts CI; its result could not be read from
this machine (no `gh`, and the repository's API needs signing in).

**Commits.** This entry and the approval records are committed on top of `2df44a9`; pushing them
waits for the client's go-ahead.

**Next.** Phase 2 — Complete student experience — waits for the client's explicit approval.

## 2026-10-02 (session 18) — Roadmap Phase 1: Labs and Playground built

**Brief.** The client's Phase 1 brief ("Phase 1 implementation — Labs & Playground"), with the
course-placement decision of the same day (admins and content managers place labs; trainers write,
check, preview and publish their own). Plan, assessment and ADR-0018 to ADR-0021:
`docs/phases/PHASE-01-labs-and-playground.md`.

**Built.**

- **The Labs** (`modules/practice`, key kept): coding, SQL, debugging and web labs as question-bank
  questions; a hub by kind with continue-where-you-left-off; the playground (Java, Python,
  JavaScript, PHP, SQL); drafts kept on the server; a staff page with preview, catalogue and
  attempts within the reviewer's scope (`practice:publish_own`, `practice:review`).
- **Debugging labs:** what the fixed program does; validation needs the fix to pass and the code
  with the bug to fail.
- **SQL Lab:** a schema browser read in the sandbox; a case's own rows now run under the authoriser
  and the step budget (ADR-0020).
- **Web Lab** (ADR-0019): three editors, a sandboxed srcdoc preview with its console, and checks in
  the sandbox — the page in one program that prints a snapshot, everything it leaves stopped, then a
  checker that runs none of its code. A page that escapes jsdom cannot decide its verdict.
- **Lab lessons** (`lab`, completed on `pass`), in the lesson or from the catalogue through a
  progress listener; completion is recorded once.
- **Limits** (ADR-0021): one run at a time per person, rate limits, payload and output limits with a
  truncation flag; nothing a case starts outlives it.
- **Authoring:** the question editor writes debugging and web labs (files editor, checks builder);
  "New lab" opens it on the right type.
- **Seeds:** three debugging and three web labs, proved in the sandbox (`verified-runs.json`), and
  two lab lessons (Core Java, Web Development).

**Fixed on the way.** The question editor's in-form buttons submitted the form; the course editor
cleared a lesson's video and question when its body was opened and saved; a sessions test failed
every Friday (UTC).

**Tests.** See the plan, §7: type-check, lint, unit (237), API (246), sandbox (27), the question
bank in the sandbox (53 questions, 107 language runs), build, and the browser suite (three sign-ins
and 70 journeys): Chromium 73 of 73; the phone 69 of 73 at first, because the lab-lesson journey
read the course outline before it had loaded and left the phone's console sheet over the page, and
the three Labs journeys after it did not run. With that journey fixed, the Labs journeys passed in
full on both. The migration applied cleanly to a copy of the local sample data (`lms_phase1_qa`),
and the demo seed then added the new labs and lessons and nothing else.

**Environment.** The first browser run met Docker Desktop's port-forwarding stall again (PostgreSQL
healthy in its container but unreachable through the forwarded port, so pages waited on 30-second
database timeouts). Docker Desktop was restarted (only the LMS containers run; the other projects'
stay stopped) and the suites were run again with two workers, as on CI. The journeys sign in as the
seed's Super Admin, as CI does: two of them open settings pages that only a Super Admin may.

**Commits.** `7c30cd8` (the plan, its assessment and ADR-0018 to ADR-0021), `6a7d839` (the Labs
engine), `e829405` (the sessions test), `fec4396` (reviewers and the playground's address),
`cb22318` (the seeded labs), `6aa829b` (the Labs in the web app), and the commit holding this entry
(the phase record, the ADRs and the module docs). Nothing is pushed.

**Blockers.** None. ADR-0018 to ADR-0021 are proposed, for the client's approval at the Phase 1
gate. Phase 2 has not started.

**For the developer.** Rebuild the sandbox image (`docker build -t lms-sandbox:1 infra/sandbox`;
its first stage needs the npm registry), then `pnpm --filter @lms/api db:migrate` and
`db:seed:demo` on the local database. The scratch database `lms_phase1_qa` holds the QA runs (its
dates were moved to today with `demo:advance`; between runs one learner's pass of the Core Java lab
lesson was cleared, and once their attempt at the open test, so the journeys walked them in full)
and can be dropped.

## 2026-10-02 (session 17) — Roadmap Phase 0: product direction reset and roadmap lock

**Direction.** The client reset the product direction. SI Academy is now an enterprise learning
management and AI learning platform, a serious full-stack product, and the demo / white-label /
template framing no longer decides anything. A fifteen-phase roadmap (Phases 0–14) is the
controlling plan:

- Labs and Playground;
- the student, trainer and admin experiences;
- cross-module integration;
- hardening;
- the AI foundation, RAG, the AI Learning Agent, AI evaluation and advanced AI;
- refinement, full testing and staging.

The existing architecture is kept and evolved.

**Done.** Documentation only; no application code, configuration, data or infrastructure changed.

New:

- `docs/ROADMAP.md`: phases, gates, rules, deviation control, known decisions;
- `docs/product/PRODUCT_DIRECTION.md`;
- `docs/product/IMPLEMENTATION_ROADMAP.md`: baseline at `74824f5` with evidence, findings with their
  owning phases, and the register of the old framing;
- `docs/architecture/OVERVIEW.md`;
- `docs/architecture/AI_ARCHITECTURE.md`.

Updated:

- `CLAUDE.md` and `README.md`;
- `docs/CLAUDE_OPERATING_RULES.md`: rules 1, 2 and 45 point at the roadmap; rules 46–48 added (phase
  order, deviation control, AI guardrails);
- `docs/STACK.md`: AI technologies planned, not adopted;
- `docs/runbooks/README.md`: index.

Both original plans, their first part files and their HTML copies open with a dated status note
("historical"); their bodies are unchanged.

**ADRs.** None amended. Every decision still holds; the original framing in their context sections
is historical. The AI stack decisions are Phase 7 ADRs (`docs/architecture/AI_ARCHITECTURE.md` §9).

**Against the roadmap.**

- Built: courses, lessons, progress, schedule, attendance, assignments, timed tests, the question
  bank, coding practice on the sandbox runner, trainer review, reports and exports, documents,
  notifications, placement, doubts, settings, audit, health.
- Partial: SQL practice (no lab), projects, analytics, enrolments, feature flags, privacy operations,
  an operations view for the Super Admin.
- Missing: the playground, SQL Lab, Web Lab, debugging challenges, certificates, any AI code, vector
  support.

**Blockers.** None for Phase 1. Its open design questions (the Web Lab's preview and checking
model, the SQL Lab's engine, playground quotas) are settled by ADRs in its phase plan. Later
dependencies, none of them blocking now:

- signed storage links on staging (decide before Phase 6 closes);
- an AI provider account and keys from the client (Phase 7);
- a PostgreSQL image with pgvector (Phase 7 ADR).

**Status.** Roadmap Phase 0 is complete pending the client's review. **Phase 1, Labs and
Playground, has not been started.**

## 2026-10-02 (session 16) — ADR-0017 extended: local and staging object storage on Chainguard's MinIO

**Decision.** The client approved ADR-0017 for the object store wherever MinIO's own image can no
longer be pulled. `infra/compose.yml` and `infra/compose.staging.yml` run
`cgr.dev/chainguard/minio:latest` for the server and for the bucket set-up (the image carries `mc`
and a shell); the health check, buckets, access policies, ports and keys are unchanged, and no
application code changed. The server now runs as an unprivileged user (65532) instead of root: a
one-shot `minio-volume` service hands a volume the old image wrote (root's files) to that user
before the server starts, and changes nothing on a volume already handed over or a new one.

**Validated in scratch Compose projects only** (the running local stack, its containers and the
`lms_minio` volume were not touched):

- A copy of the local volume under the new definitions: hand-over, healthy server and set-up all
  clean; both buckets identical to the old server (146 + 2 objects: keys, sizes, ETags) with the
  same policies (public `download`, private `private`); a second `up` changed nothing; the console
  answers on its port.
- The API's storage paths, compiled API with CI-style settings on the scratch database: 15 of 15
  checks (readiness; a public avatar upload, its content check and public link; a private lesson
  resource with its signed download, and the unsigned link refused; a server-written export, ready
  with 60 rows, downloaded as `.xlsx`; deletion), on the migrated copy, on a new volume, and on
  staging's definitions with staging's own keys.
- Staging Compose: `config` valid with and without `sandbox-image`; its storage services and Caddy
  started in isolation and served the public bucket through `/files`.

**Fixed while validating staging** (configuration and documentation only):

- Public file links lacked their bucket. `S3_PUBLIC_BASE_URL` was `https://<host>/files`, and Caddy
  hands `/files/*` to MinIO without the prefix, so a link such as `/files/demo/…` answered 403
  (MinIO read `demo` as the bucket). It now ends in `${S3_BUCKET_PUBLIC}`: through Caddy the
  driver's link answers 200, and the private bucket still answers 403 without a signature.
- An unquoted bcrypt hash in `.env.staging` is mangled by Compose's interpolation (23 of its 60
  characters arrived), so `/mail` and `/status` would never accept the password. The example and
  the staging runbook now say to single-quote it; quoted, it arrives intact.

**Open before staging (a decision).** With `S3_ENDPOINT=http://minio:9000` the API signs every
upload link and private download link for `http://minio:9000`, a name only containers resolve, so
on staging a browser could not upload files or download private ones (exports, documents, lesson
resources). The fix is either an application change (sign with an address browsers reach) or a
different staging topology (a storage address browsers reach, such as its own host behind Caddy,
or a managed store); a separate origin would also have to reach the web build's content security
policy through `NEXT_PUBLIC_STORAGE_URL`.

**Local stack.** Still on the cached old image. The next `pnpm services:up` switches it: Compose
recreates `minio`, and `minio-volume` hands `lms_minio` (2.7 MB, root's files) to the new user,
with the data left as it is, as on the copy.

## 2026-10-02 (session 15) — `lms` reset, pushed to GitHub, first CI runs fixed

**Database.** With the client's consent (2026-10-01) `lms` was reset to SI Academy: 8 migrations,
base seed, demo seed and the Super Admin from the CLI. Prisma 7's `migrate reset` no longer runs
the seed, so `pnpm demo:reset` stops before the demo data; the seeds were run by hand (debt: the
script).

**Remote.** `origin` is `https://github.com/hamsanand610/LMS.git`; `main` was pushed normally.

**What each CI run found** (nothing was skipped or weakened to pass):

1. GitHub rejected the workflow: a job's `env` read the `env` context. The smoke job now exports
   the CI database URL from a step (`22c72ed`).
2. Three report API tests failed: exports are written to object storage and CI has none. The API
   tests use an in-memory storage stand-in, as they already did for code execution (`89737f2`).
3. Container images: the API image's `prisma generate` stopped with `PrismaConfigEnvError` (no
   `DATABASE_URL` in the build); that one command gets a placeholder (`2211ced`). Playwright smoke:
   J-12's export never became ready because the smoke job had no object storage; the job now
   starts MinIO with the buckets `infra/compose.yml` creates (`f64dc9d`).
4. Checks, sandbox and all four images green (pushed to GHCR, as on every push to `main`); the
   smoke job could not pull MinIO. MinIO has withdrawn its open-source images and binaries
   (quay.io 401, Docker Hub gone, dl.min.io 410 "archived"). The client chose Chainguard's build of
   MinIO for the CI smoke job: ADR-0017, with the stack row in `docs/STACK.md`.

**Verified locally before each push**, with CI's own commands and environment: the API image fails
as on CI and builds after the fix (web and runner images too); J-12, against a scratch database
`lms_ci_smoke` seeded as CI seeds it (its generated passwords are discarded), fails without storage
as on CI (the export reads "failed") and passes with it (ready, 60 rows), including against
Chainguard's MinIO on tmpfs. Pre-push hook each time: typecheck 9/9, unit 220.

**Open.** Local development and staging still name the `quay.io/minio` images: a machine without
them cached, and the staging host, cannot start object storage, and MinIO is unmaintained. The
client decides the replacement before staging (ADR-0017). GitHub also warns that the actions used
run on Node 20 (forced to Node 24) and that `ubuntu-latest` becomes Ubuntu 26 from 2026-10-19;
neither fails a run.

## 2026-10-01 (session 14) — ADR-0013 to ADR-0016 accepted

The client approved ADR-0013, ADR-0014, ADR-0015 and ADR-0016 on 2026-10-01. Their status is now
"accepted" with an "Approved: 2026-10-01" line; their decision text is unchanged, and the plan
amendments they propose (ADR-0013 §16.4, ADR-0014's) are approved with them. ADR-0011 is marked
superseded by ADR-0016, and ADR-0007's amendment note no longer waits on approval. The Task 4
report says the same. Documentation only: no code, database or remote was touched.

## 2026-10-01 (session 13) — Task 4 release gate: audited, verified, committed; push blocked (no remote)

**Scope.** The client's release-gate brief: close Task 4 without new features. Details and the
technical-debt classification: `docs/product/TASK4_COMPLETION_REPORT.md` ("Release gate").

**Results.** Repository audit PASS (515 changed paths, all intended Task 1–4 work; no QA files,
session state, logs or screenshots; `.gitignore` now also covers `*.env`, `**/.auth/` and `*.har`).
Security audit PASS (no secrets; only the published local defaults, CI's throwaway values and
test placeholders). ADR review PASS: ADR-0013 to ADR-0016 match the code, and ADR-0016's trust
boundary (learner → API → runner → container → result) is exact; ADR-0007, ADR-0011 and the gap
analysis §5.2 now point at ADR-0016 instead of reading as current. Docker PASS (LMS PostgreSQL,
MinIO, Mailpit healthy; volumes intact; `lms-sandbox:1` and `lms-runner:local` present; a job ran
through the hardened runner image). Staging and CI configuration validated locally (resolved
compose: runner internal-only, read-only, no capabilities, docker group, token required; CI has
the sandbox job, a runner in smoke and both images; deploy pulls them). The only runtime
reference to the retired driver was the local `apps/api/.env`; it now selects the runner with a
token shared with `apps/runner/.env` (never printed).

**Checks (one at a time).** Typecheck 9/9, lint 9/9, unit 220, API e2e 17/17 files and 223 tests,
build 6/6, runner real containers 13/13, question bank 101/101 (check only).

**Commit.** Local commits on `main`: `4595be2` product code; `5ae9871` CI, images and staging;
`0b1f5cd` documentation; `0dcd056` preview launch configurations; `bfa3ec3` the generated OpenAPI
document kept exactly as the API writes it (Prettier ignores it now, so an API start no longer
leaves the tree dirty); then this note. **Push, CI and staging: not run** — no Git remote is
configured (the brief forbids changing it) and the GitHub CLI is not installed.

**Main database.** `lms` still holds the Phase 6 "Demo Institute" data (79 `demo.local` accounts,
132 questions, 7 of 8 migrations; last activity 2026-09-27, test runs). Nothing found that needs
keeping. `pnpm demo:reset` would drop and recreate every table and seed SI Academy; it does not
touch MinIO. Not run: it needs the client's approval (and Prisma blocks it for agents anyway).

## 2026-10-01 (session 12) — Task 4 finished: runner in staging and CI, fair sandbox timing, full verification

**Scope.** Resumed Task 4 after the client moved Docker Desktop's disk to `D:`. No redesign: the
open items from session 11 plus everything the verification turned up. Final report:
`docs/product/TASK4_COMPLETION_REPORT.md`.

**Environment.** Docker 29.8.1; LMS PostgreSQL, MinIO and Mailpit healthy; `lms_task4` current (8
migrations). A QA database `lms_task4_qa` was seeded for automated browser checks with passwords
generated for the session (held only in the session scratchpad, never printed, deleted at the end);
`api-runner-qa` in `.claude/launch.json` runs the API and runner on it. The preview was left on
`lms_task4` (`api-runner-task4` + `web-prod`).

**Runner and staging.** The runner image (`apps/runner/Dockerfile`) builds; run with staging's
hardening (read-only root, no capabilities, no-new-privileges, docker group instead of root,
socket mounted) it passed a job and the whole question bank (101 language runs). Jobs run with
`--pull never`. `infra/compose.staging.yml` gains the `runner` service and the sandbox image
(profile `sandbox-image`), and the API points at the runner; `.env.staging.example` gains
`RUNNER_TOKEN`, `DOCKER_GID`, `RUNNER_CONCURRENCY`. CI: a `sandbox` job (real-container tests and
`verify:questions`), a runner in the smoke job (the journeys run code), and `lms-runner` /
`lms-sandbox` images; the deploy workflow pulls both. The runner reads `apps/runner/.env`;
`pnpm env:init` writes one shared token into both `.env` files. Runbooks (staging, local setup,
testing), `apps/runner/README.md`, module READMEs and ADR-0016 updated.

**Fair timing.** Twice a correct reference solution failed its check with "time limit exceeded"
because the host was slow (a cold container after a restart). The harness now judges a case on the
CPU time it uses (limit plus runtime start-up); the wall clock is a backstop at twice that plus two
seconds for code that waits. The runner's deadline and the API's request budget follow it; the time
a case reports is its CPU time. New container tests prove both halves; `verify-runs.json` was
re-recorded with the new harness (101/101).

**Fixed.** Integrations › Code execution probes the driver really running (it reported "runs in the
learner's own browser" as healthy) and lists runner/Judge0/none; integration descriptions lost
their "demo" wording; the practice page no longer claims code runs in the browser; the "Local
environment" chip is gone; the seeded note "Seeded demo publication" is gone (seed, and blanked in
`lms_task4` and `lms_task4_qa`); `EMAIL_FROM` reads "SI Academy" (`.env.example`, staging example,
the display name in the local `apps/api/.env`); the learner dashboard no longer scrolls sideways on
phones; the structure editor is usable on phones; inline code renders in explanations,
instructions and mark schemes; a solved question reopens on the learner's last submission instead
of the template; history hides run-only columns for answers that ran no code; analytics say what
average score and pass rate are computed from; "Open now" on Tests lists only tests the learner
can start or resume; a failed reference check says why. Journey fixes: J-06c's check text, J-09b
re-runs from the action bar, list and catalogue lookups by search, J-10's skip guard, and the
coding journeys follow the phone layout (Code tab, console sheet).

**Verified (final, run one at a time).** Typecheck and lint, 9/9 packages; unit tests 220 (shared
77, runner 16, web 4, API 123); API e2e 17/17 files, 223 tests; production build 6/6; schema drift
(`prisma migrate diff` against a freshly migrated database): none; runner real-container suite
13/13; `verify:questions` 101/101; live checks through the real API and runner 58/58 (Java,
Python, JavaScript, PHP, SQL; hidden cases never in learner responses; time, memory, output and
network limits; compile and runtime errors; invalid input; idempotent submit; history; review and
feedback; access boundaries); sandbox outage 8/8 (Run answers 503 `execution_unavailable`; a
submission is kept "being checked" and evaluated once the runner is back). Browser: 498 views (33
pages, 42 states with tabs, 7 widths, both themes) with no console errors, failed API calls, error
screens or broken images, then 190 views after the fixes with no issue; loading and error states
32/32. Playwright journeys: desktop 59 passed, phone 59 passed; 4 one-time journeys (J-05 ×2, J-08,
J-10) skip by design once their seeded data is used.

**Incidents.** The machine has 7.2 GB of RAM. A repository-wide format check run beside the browser
suite starved it: that run failed for environmental reasons and Docker Desktop's port forwarding
stalled (containers stayed healthy; restarting one container did not help). Docker Desktop was
restarted once; the LMS containers came back healthy with their data. Afterwards every heavy check
ran on its own. Earlier, one run of the assessment e2e file failed at J-06; it could not be
reproduced (four passes since, including the final full run).

**Open.** Client approval of ADR-0013 to ADR-0016; commit; CI's new jobs and the staging runner
have not run outside this machine; `pnpm demo:reset` on `lms` is the client's to run.

## 2026-10-01 (session 11) — Task 4 (Assignments) built and tested; browser checks blocked by a full system disk

**Scope.** The client's Task 4 brief (Assignments). Plan, audit and gap analysis:
`docs/product/TASK4_ASSIGNMENTS_GAP_ANALYSIS.md`; decision record ADR-0016 (proposed; supersedes
ADR-0011). The client chose the WebAssembly argon2 fallback and the Docker sandbox runner.

**Built.**

- Security fixes from the audit, each with a deny test (tests results, trainer batch scope, reveal
  after the due date, HTML sanitising and security headers, login throttling and lockout,
  broadcast scope, practice grading, file ownership and type checks, open redirect, account
  enumeration, cache after sign-out, secrets in logs).
- `apps/runner` and `infra/sandbox`: one locked-down container per job (Java, Python, JavaScript,
  PHP, SQL on SQLite); the API only sends inputs and compares outputs; hidden cases never leave it.
- Assignments API: server-computed learner state, publications to batches or named learners with
  open/due/close dates, run and submit, queued idempotent evaluation, append-only reviews,
  resubmission, progress with struggling learners, analytics.
- Web: learner list, set page and one workspace for every type (CodeMirror 6, run, submit, history);
  staff builder (structure, details, resources, publishing, progress, reviews), review queue and
  review page, analytics; question editor for all nine types; practice on the sandbox; the browser
  runner deleted and the Content Security Policy tightened; admin health reports the sandbox.
- Content: 151 original questions and 14 assignments in `apps/api/prisma/seed/content`; the 85
  generated filler questions are gone. `pnpm --filter @lms/api verify:questions` ran every
  reference solution in the sandbox (101 language runs, all passing) and wrote fingerprinted
  outcomes the seed relies on; the seed never runs code and invents no results.

**Verified.** Typecheck and lint (api, web, shared, runner); unit tests (api 123, including the
content checks; shared; runner 15 plus 11 against real containers); API e2e: 16 of 17 files passed
in the final run (admin 7, assessment 37, attendance 12, auth 12, batches 9, courses 17,
engagement 18, notifications 13, permissions 12, profile 11, queue 4, reports 13, route table 5,
sessions 16, settings 5, students 13); `tests` could not start because the database went down (see
below) — it passed earlier the same day, before the option-id change. Production web build passes.
A fresh preview database (`lms_task4`) seeded end to end: 151 questions, 14 assignments,
19 publications, 1 214 answers, 60 reviews, 28 practice runs.

**Not yet verified.** Browser checks of the new pages (they need the client to sign in; the
Playwright journeys in `apps/web/e2e/assessment.spec.ts` need `E2E_*` credentials in the
environment). Staging still names the retired browser driver: the runner image
(`apps/runner/Dockerfile`) is written but its build was interrupted, and the staging compose and CI
are not yet wired to it. _Resolved in session 12: browser checks, journeys, the runner image and
the staging and CI wiring are all done._

**Incident.** Building the runner image filled drive C: (0 GB free); Docker Desktop's disk went
read-only, and PostgreSQL and MinIO stopped answering. Only this session's own scratch files were
deleted (212 MB). Nothing in Docker was restarted or pruned. The client needs to free space on C:
(or move Docker Desktop's disk image to E:) and restart Docker Desktop before work continues.
_Resolved: the client moved Docker Desktop's data to `D:\DockerDesktop\DockerDesktopWSL`._

## 2026-09-30 (session 10) — Sign-in picture at every width; local preview under Smart App Control

**Sign-in (direction A, reaffirmed by the client).** The cinematic panel only appeared from 1024 px;
below that the page showed a cropped photo strip, which is what the locked decision rules out. The
one panel now serves every width: beside the form from 640 px (the split layout), above it on
phones, with the photograph anchored to the panel's foot and masked on all four edges
(`login-photo` utility; `LoginBand` removed). Checked at 360, 390, 644, 768, 1024 and 1440 px in
both themes; no sideways scroll; the Sign in button stays in the first screen on a 360 × 640 phone.
Lint, typecheck and format clean; browser smoke tests pass on desktop and phone.

**Environment finding.** Windows Smart App Control is now on (since the restart into build 26300)
and blocks Node from loading argon2's native binary, so the API, the demo seed, the admin CLI,
`pnpm demo:reset` and the API test suites cannot start on this machine as they are. Nothing in the
product or in Windows was changed. The local preview runs through `.claude/launch.json`
(`api-siacademy`, `web-prod`): the launcher points the API at the `lms_siacademy` scratch database
and, only when the native binary is refused, substitutes a pure-JavaScript argon2id with the same
parameters and PHC format (about five seconds a sign-in). `next dev` also exits on this machine
(code 0xC0000409); the production build and server work.

**Open (client's decision).** Turn Smart App Control off, or approve a product-level fallback for
password hashing when the native binary cannot load. The main database is still not reset.

## 2026-09-27 (session 9) — Task 3 (premium visual refinement) complete; stopped for approval

**Scope.** The client's Task 3 brief: a visual and UI/UX refinement of SI Academy only — no workflow,
permission, API contract or business rule changed; brand (burgundy and ink), roles, navigation,
responsive shell and every Task 2 feature kept. Sign-in direction **A, "Cinematic Learner
Workspace"**, locked by the client with their own photograph.

**Documents.** docs/design/TASK3_VISUAL_DIRECTION.md (audit, research, three sign-in directions with
A locked, signature motifs, type, token table, card roles, motion); ADR-0015 (proposed, amends
ADR-0013: brand focus ring, re-tuned warm layers, brand-tinted active navigation, streak and
achievement colours, Instrument Sans with a display width, overlay sign-in photograph);
DESIGN_SYSTEM.md rewritten for the new system; clients/demo/README.md notes the photograph.

**Delivered.**

- **Tokens** (`deriveTokens`): ivory canvas, cream cards, warm-beige insets; a layered dark theme
  (canvas, card, inset, active) with a faint warm-red undertone; a deeper navigation plane; brand
  focus ring (`--focus`, `--nav-focus`); `--nav-active` as a deep brand tint; new fixed families
  `--streak` (emerald) and `--achievement` (champagne gold); success, warning, danger and info
  re-tuned. `validateTokens` checks the new pairs; unit tests pin the SI Academy values.
- **Type**: Instrument Sans (width axis) with a display voice (`font-display`, `stat-figure`) for
  heroes, titles and figures; only it is preloaded. SI Academy's branding selects it.
- **Signature**: the Progress Arc (`ProgressRing` with semantic tones, a bright head, a threshold
  tick and a one-time draw-in) replaces most bars; the Burgundy Glow lights the sign-in picture, the
  dashboard hero and the rail head; grain and a faint grid only there.
- **Sign-in**: the photograph (optimised to a 32 KB WebP) masked into a rounded dark panel with the
  lamp's light carried past the frame, corner arcs, vignette and grain; the statement in the dark
  space; a photo band above the form on phones; a show-password toggle on every password field.
  Seeded from `clients/demo/assets/login-background.webp` by an idempotent base-seed step (uploads
  only while no background is set; skips without storage).
- **Shell**: rail with its own glow, a burgundy-tinted active item with a glowing rule, quieter
  group labels; an architectural 60 px header; display-type page and section titles.
- **Learner dashboard**: an ink hero (date, greeting as the `h1`, welcome line, a live class when
  there is one, where you left off with the arc) → streak (emerald, 7-day row), adherence
  (segments), rank (gold) → due soon with urgency edges beside today and tomorrow → placements →
  other courses → announcements, batches and progress arcs.
- **Everywhere else**: course cards and covers as ink plates with the arc motif; one primary action
  on a question lesson; arcs in the course outline and contents; gold podium and own-row highlight
  on the leaderboard; summary bands, meters, bars and status chips coloured by meaning (brand
  progress, emerald attendance and completion, gold scores and upcoming, ink capacity);
  display numerals on staff dashboards; designed empty and status pages.

**Tests.** Lint and typecheck clean (8/8). Unit: shared 63, API 84, web 3. API integration: 17
files, 191 tests. Browser on the SI Academy database: desktop 58/58; phone 57 passed and 1 skipped
by design (J-10's single attempt used by the desktop run). The two `getByLabel('Password')` lookups
are now exact (the new toggle is named "Show password"). Screens reviewed in both themes at 360,
390, 768, 1024, 1440 and 1920 px; keyboard focus, the toggle's state and reduced motion checked in
the browser.

**Environment.** The main database was not reset (the client runs `pnpm demo:reset`). The running
app used a freshly seeded scratch database, `lms_siacademy`, whose branding copy and font were
synced to the overlay; `lms_task2`…`lms_task2d` can be dropped with approval. 21st was requested
for component research but is not connected in this environment; Inspo was used.

**Next (needs approval — operating rule 42).** Approve ADR-0013 and ADR-0015 with the direction
document; run `pnpm demo:reset` so the main database picks up SI Academy's font, sign-in copy and
photograph.

## 2026-09-27 (session 8) — Task 2 (real-world LMS transformation) complete; stopped for approval

**Scope.** The client's Task 2 brief: turn the template into a product an academy runs every day,
using the reference portal's authenticated learner area as the benchmark (audit, inventory, gap
analysis, then build), keeping Task 1's design system. Client decisions: the institute is
**SI Academy** (seeded addresses on the reserved `siacademy.example` domain); placement is a
**basic drives board**; the client runs `pnpm demo:reset` themselves.

**Documents.** docs/product/TASK2_AUDIT_AND_GAP_ANALYSIS.md (method, audit, inventory with P0–P3
actions, metric definitions, research, navigation, staff paths, and §9 what was built);
ADR-0014 (proposed) — pulls gamification, placement, doubts and profile projects/certificates
forward behind module flags, with the plan amendments it needs.

**Delivered.**

- **Measures from recorded work** (progress module): learning streak (IST days with a lesson,
  assignment answer, practice submission or test), practice streak, and class-day adherence
  (attend every marked class and do one activity); `GET /me/consistency`,
  `GET /students/:id/consistency`; dashboard cards, a 26-week calendar, recent class days and the
  rules on the progress page and the trainer's student view.
- **Leaderboard** (`gamification`, flag off in the template): points for lessons, first solves,
  best assignment marks and released test scores; this week / month / all time; batch-scoped;
  short names only; learner, trainer and admin pages.
- **Placement** (`placement`): companies with ordered, topic-labelled interview-prep kits built
  from the practice catalogue, favourites and per-learner status; drives (draft → open → closed)
  with eligibility by batch, programme and attendance; apply with the default resume, withdraw;
  staff stages with a note that reaches the learner; learners told when a drive opens; admin
  dashboard placement tiles measured while the module is on.
- **Doubts** (`doubts`): learner `/me/doubts…`, staff `/doubts…` (trainer = own batches, admin =
  all); linked from course pages and the lesson player; notifications both ways; waiting count on
  the trainer's dashboard.
- **Courses**: lesson topics (builder field, grouped outline), required/optional clarity, duration,
  modules and instructor on cards and the outline; lesson counts follow the percentage's rule.
- **Profile and account**: projects and certificates sections, photo upload (also in the account
  menu), a `/settings` page; notifications grouped by period with placement and doubt categories;
  schedule Week/Month views; learner search over courses, lessons, assignments and practice; a
  practice topic filter; grouped navigation for all three portals (`minScope` on menu items).
- **Sign-in**: an original composition of the product's own surfaces on the ink panel.
- **No demo wording** in the product: environment pill, pending-tile reasons, report reasons,
  content pages, email footer; notification dates in IST through shared formatters.
- **Seed (SI Academy)**: branding, settings, flags on; fictional colleges, towns and trainer names;
  lesson lengths that add up to each course's stated time; a dated learning history, practice runs,
  six new hand-checked practice problems, five companies with kits, five drives, sixteen
  applications, five doubts with replies and their notifications. Validated on fresh scratch
  databases (`lms_task2`, `lms_task2b`, `lms_task2c`, `lms_task2d`) — the main database was not
  reset.
- **Reliability**: `DATABASE_POOL_MAX` (default 20), a 10-second transaction wait, and the
  notification bell's read no longer in a transaction — the causes of the connection-pool 500s and
  flaky journeys seen under parallel browser runs.

**Tests.** Lint and typecheck clean (8/8 tasks). Unit: API 84, shared 61, web 3. API integration:
17 files, 191 tests (new `engagement.e2e-spec.ts`; role matrix, profile, navigation and pending-
wording assertions updated). Browser on a freshly seeded database: desktop 58/58, phone 57 passed
and 1 skipped by design (J-10's single attempt used by the desktop run); new
`e2e/engagement.spec.ts`; J-03a now waits for the save confirmation (a race that made it flaky).

**Open / for approval.** ADR-0014 and the plan §12.2/§12.3/§24 amendments; not built: assignment
time-spent figures (needs a definition), per-test leaderboard (P2), bookmarks (P2); the scratch
databases can be dropped; the client runs `pnpm demo:reset`. Nothing committed.

## 2026-09-27 (session 7) — Task 1 (premium UI/UX redesign) complete; stopped before Task 2

**Scope.** The client's Task 1 brief: a premium red-and-charcoal redesign of every screen, research
first, UI only — no API, model, permission or workflow changes beyond what the UI needed. Task 2 was
not started.

**Research (docs/design/RESEARCH.md).** About thirty Inspo queries (education products, wine
palettes, SaaS dashboards, docs navigation, dark products, restrained glass, mobile navigation);
the reference portal's learner area viewed read-only in the session already signed in from the
planning stage (no credentials entered, nothing opened or submitted); a before-audit of all 85 pages
at four widths and both themes. Patterns selected and rejected are recorded with the reasons.

**Delivered.**

- **Design system (ADR-0013, docs/design/DESIGN_SYSTEM.md).** Neutrals now follow the brand's
  temperature (warm or cool OKLCH ramps) instead of its hue; brand shades in OKLCH; tokens derived
  on read with a fingerprinted `ETag`; new tokens for a third surface, a strong border, a second
  text tier, a blue focus ring, an ink navigation plane and validated chart colours; elevation,
  glass and motion tokens. Demo primary `#7F2331`. Emails take their colours from the same tokens.
- **Shell.** Ink sidebar that stays in view on long pages, grouped and role-filtered, collapsible to
  icons with tooltips and remembered; glass header with section name, search, notifications, theme
  and account menus; staff drawer and the learner's five-tab bar on phones (hidden while sitting a
  test); skip link; section highlighting for pages outside the navigation.
- **Dashboards.** Learner: continue-learning hero, today and tomorrow, due soon, progress with the
  attendance threshold. Trainer: "Needs you" (roll calls, marking), today's timeline, batch health,
  learners slipping. Admin: "Needs attention" first, then the figures grouped as People, Delivery and
  Outcomes, the unmeasured ones named in one quiet band, then trends and tables — no wall of tiles.
- **Learning and assessment.** Course catalogue and outline, lesson player with a curriculum rail,
  assignments, the question workspace, practice as a statement-and-editor workspace with a console,
  the test instructions, a focused exam screen (sticky console, countdown with five- and one-minute
  announcements, sectioned palette with a legend, confirm dialog with a summary) and the result page.
- **Everything else.** Progress, profile (completeness links straight to the missing section),
  notifications, preferences, search (type icons, highlighted matches), roll call, attendance lists
  and detail, reports and report pages (`aria-sort`, column chooser, summary band), staff detail
  pages (back links, stat bands), list pages (search fields, framed tables, pagination), sign-in and
  the other auth pages, 403, 404 and error pages, the public content pages.
- **Consistency.** One date format everywhere through `lib/format.ts` (IST), one `humanise`, shared
  `ChoiceRow`, `CodeArea`, `SearchInput`, `StatusPage`, `StatStrip`, `OverviewBand`, `Meter`,
  `ProgressRing`, `SectionHeader`; restyled primitives (button, card, badge, tabs, table, inputs,
  dialogs, sheets, menus, tooltips, toasts, skeletons).

**Tests run (operating rule 28), on the development machine, 27 September 2026.**

- Lint and typecheck, all eight workspaces: pass.
- Unit: shared 60, web 3, API 73: pass. API integration: 171 in 16 files: pass.
- Browser suites against the production build: desktop 47 passed, mobile 47 passed, none failed;
  3 skipped on each (J-05 twice and J-10), because earlier runs today used the demo's unmarked
  classes and the learner's one attempt. Both journeys passed against the new screens earlier in the
  session, before their data was used; `demo:reset` makes them runnable again.
- Visual review with the local harness: every page at desktop light, desktop dark and phone, plus
  the exam and result screens rendered from fixture data (nothing written).
- One test change: the progress-page check in `learning.spec.ts` now finds the course block by its
  list-item role instead of by CSS classes.

**Found, not fixed (outside a UI task).**

- Under the browser suite's burst of publishing, marking and exporting, the long-running API logged
  `pg-boss error` and unhandled exceptions and answered even `/branding/public` in 10–30 s for about
  half a minute; two journeys failed their first attempt and passed on retry. A fresh API process
  ran both suites without a failure. Worth a look at connection-pool sizing between Prisma and
  pg-boss before staging.
- `/admin/settings/fields` requests three resources that answer 404 (console noise, page works).
- Notification bodies written by the API use ISO dates and 24-hour times ("2026-09-27", "14:00").
- Course data has no instructor field, so the course pages cannot name one.
- Tables scroll sideways on phones rather than turning into cards (plan §16.5 asks for cards), and
  dashboard charts have no table toggle yet.

**Needs approval.** ADR-0013 proposes amending plan §16.4 (neutrals by temperature, the added
tokens, derivation on read).

**Still owed from Phase 6.** Its progress-log entry has not been written; the Phase 6 commit
(`19aaca9`) and the uncommitted follow-ups (demo:advance settling class statuses, the J-08 week
check, the sign-in setup clearing the password box, the staging runbook) are recorded in git only.

## 2026-09-15 (session 6) — Phase 5 (Attendance and reporting) complete; gate reached

**Approval recorded.** The client approved the Phase 4 gate and asked for Phase 5: attendance and
reporting. Asked two scope questions before starting, the client answered both: build the trainer's
view of a student (DP-T05) now rather than in Phase 6, and extend the two existing importers to
accept `.xlsx` now that the phase introduces a spreadsheet library.

**Delivered (architecture plan §24.1, Phase 5 deliverables).**

- **Database.** Migration `20260915044359_phase5_attendance_reporting`: attendance records (one per
  student per class, with who marked it, who corrected it and why) and report exports, plus three
  columns on a class recording when its roll call was taken, by whom, and whether the trainer has
  been nudged about it.
- **Attendance (M-13).** The roll call with everybody present by default, so a full class is one
  button and only the exceptions are touched. A class can be marked once it is live or finished,
  never before, and only for students on its roster. Changing a mark that has already been taken
  requires a reason, and the record keeps who changed it, when and why; after the correction window
  (48 hours by default) a trainer is refused and told to ask an administrator, who holds
  `attendance:manage`. The percentage is one formula in one place — attended ÷ classes marked,
  where "attended" is the statuses the institute counts — and the learner's page, the roll call, the
  batch tab, every report and both dashboards all read it from there.
- **Attendance jobs.** A quarter-hourly job tells a trainer about a class that finished an hour ago
  and has not been marked; a Monday-morning job tells learners who have fallen below the threshold.
  Both stamp before they send, so neither can go out twice.
- **Reports (M-15).** Five reports — students, attendance, progress, assessments, assignments —
  each a filtered table with summary tiles, a chart and the definitions behind every figure. The
  page asks for a slice of the rows and an export asks for all of them, from one builder and one
  sort, so a file cannot disagree with the table it came from (ADR-0012).
- **Exports.** CSV and `.xlsx` as background jobs, written to private storage as the person who
  asked for them, listed with their row count, size and expiry, and downloaded through a signed
  link. Files are kept seven days; three exports at once per person.
- **Admin dashboard (DP-A01) completed.** The attention band (classes without a roll call, learners
  below the threshold, answers awaiting marking, documents to verify, failed jobs), every tile the
  customer's screenshot asked for with its own definition, the six whose module is not in this build
  named rather than invented, an attendance trend, an active-students trend, per-batch attendance
  and a course-wise table.
- **Trainer dashboard (DP-T01).** Today's classes with the roll call one click away — where journey
  J-05 begins — what is waiting to be marked, batch health (attendance, assignment completion, the
  last test average) and the learners who are slipping.
- **Trainer student view (DP-T05).** Attendance, courses, assessment and staff notes, with no
  sensitive personal fields. It also fixes a link that pointed a trainer at an admin route they are
  refused.
- **Spreadsheet imports.** The student and question importers now accept an `.xlsx` workbook, which
  is turned into CSV before anything else reads it, so there is one row reader, one set of line
  numbers and one error report whatever was uploaded. This closes the deviations stated in Phases 2
  and 4.
- **Demo data.** Attendance for the classes that have already happened — 320 marks across 16
  classes, about 81% present and 87% counted, four learners under the threshold — with a few classes
  left unmarked so the waiting list, the trainer's nudge and the attention band all have something
  real in them.
- **Web.** Admin attendance list and roll call, reports index, report page and exports; trainer
  attendance list, roll call, reports, exports, student view and a real dashboard; the learner's
  attendance on the dashboard and the progress page; an Attendance tab on the batch detail.

**Tests run (operating rule 28), on the development machine, 15 September 2026.**

| Suite                              | Command                           | Result                              |
| ---------------------------------- | --------------------------------- | ----------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 47 tests passed            |
| API unit                           | `pnpm --filter @lms/api test`     | 11 files, 58 tests passed           |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed              |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 15 files, 162 tests passed (137 s)  |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 34 passed, 2 skipped (5.1 min)      |
| Lint and type-check                | run per package                   | every package with the script clean |

**Phase 5 exit criteria (plan §24.1).**

| Criterion                   | Evidence                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-05 passes end to end      | `test/attendance.e2e-spec.ts` marks a class, refuses a correction with no reason, records who changed it and why, and refuses it again once the window closes; the browser suite marks a class and corrects it through the pages |
| J-12 passes end to end      | `test/reports.e2e-spec.ts` reads the dashboard, builds a report, sorts and pages it and exports it; the browser suite drills from the dashboard into the report and downloads the file                                           |
| Export equals filtered rows | The export job and the page share one builder and one sort; the API test asserts the file's row count equals the filtered total the page showed                                                                                  |
| Metric fixture tests pass   | `attendance-math.spec.ts` checks the percentage against a known dataset, including the two edge cases that matter: no class conducted is not 0%, and exactly at the threshold is not below it                                    |
| Dashboard tiles complete    | Every tile carries a definition; the six whose module is not in this build carry the reason instead of a number, and the API test asserts both                                                                                   |
| Trainer reports             | The same report pages, narrowed to the batches a trainer teaches; the API test asserts a trainer asking for somebody else's batch gets no rows rather than theirs                                                                |

**Defects found and fixed during this phase.**

- **A new module's permissions reached nobody but the Super Admin.** There were two implementations
  of the role sync: the watermark-aware one the seeds use (ADR-0009) and an older copy in
  `RbacService` that ran at boot and only seeded a role holding no permissions at all. Every
  non-super role therefore missed everything a new module added — Phase 4 worked around this by
  hand, which is what made it look like a one-off. The boot path now delegates to the one
  implementation, and the demo seed syncs the permission catalogue before the roles, because a
  permission the database has never heard of cannot be granted.
- **A learner could open their whole class's roll call.** `attendance:read` at scope `own` is a
  learner's own record; the staff views resolved "own" to "their batch" and so would have shown
  every classmate's attendance. The roll call, the class list and another learner's record now
  refuse an `own`-scoped caller outright.
- **A trainer's roster linked into an administrator's route.** The batch roster pointed at
  `/admin/students/:id`, which a trainer is refused. It now points at the trainer's own view of the
  learner.
- **A server component passed a function to a client component.** The attendance list took a
  function to build its links, which Next refuses across that boundary; it takes the portal name
  instead.
- **A hidden radio had no visible focus.** The roll call's status buttons hide the radio inside its
  label; a keyboard user had nothing to see. The label now draws the focus ring.

**Assumptions and deviations (stated, not invented).**

- **Reports read the live tables.** The master report (F-19) describes aggregate tables and sets
  AC-01.4 (a dashboard under two seconds for 5,000 students). This build computes every report from
  the source tables on each request: the figures cannot be stale, and the criterion is met at demo
  volumes but is not demonstrated at 5,000 students. ADR-0012 records the decision and names the
  aggregate tables as the documented path to that scale.
- **Four attendance statuses, not six.** The reference portal shows "week off" and "holiday" as
  attendance states. Here they are the absence of a class rather than a mark against a person: a
  holiday is a skipped date on the timetable, so nobody is marked and nobody's percentage moves.
- **QR check-in is not built.** The master report puts it in the Standard tier (F-13, Q-25); the
  demo captures attendance by roll call only, which is what the plan asks of this phase.
- **The seeded distribution is close to, not exactly, the plan's.** §21.1 asks for roughly 85%
  present and three learners below the threshold; the seed produces 81% present, 87% counted and
  four below. The shape is what the reports need; the exact figures are not worth forcing.
- **The roll-call journey needs a class that is waiting.** The demo seed leaves a couple per batch.
  Once a browser run has marked them the test skips with a message saying to run `demo:reset`,
  rather than passing on nothing.
- **Two browser tests skipped in the recorded run,** both for the same reason as in earlier phases
  and both saying so: J-08, because every class this trainer has taught already has its recording,
  and J-10, because no test window is open to the demo learner at the moment the suite runs. Neither
  is a Phase 5 journey; `pnpm --filter @lms/api demo:reset` puts both back in range.
- **The generated OpenAPI client is not committed.** `apps/api/openapi.json` is refreshed and
  tracked; nothing in the web app imports the `openapi-typescript` output, which uses a hand-written
  `api()` helper and the shared types instead, so the generated file is left out of the tree rather
  than committed as dead weight.

**Environment notes from this session.** Playwright's failure artefacts capture the page as it
stood, including a filled password field. `test-results/` and `playwright-report/` are git-ignored,
so nothing reaches the repository, but those folders should be deleted rather than shared; the
testing runbook now says so. Sign-in is limited to five attempts per quarter of an hour per address,
and iterating on a browser test trips it: wait for the window rather than raising the limit.

## 2026-09-14 (session 5) — Phase 4 (Assessment) complete; gate reached

**Approval recorded.** The client approved the Phase 3 gate and asked for Phase 4: the question bank, assignments, and tests and assessments. Asked whether the plan's fourth Phase 4 item, the student practice catalogue and workspace, was in scope, the client answered "Add the Practice pages too", so the whole Phase 4 row of the roadmap was built.

**Delivered (architecture plan §24.1, Phase 4 deliverables).**

- **Database.** Migration `20260914154134_phase4_assessment`: questions, options, coding problems, test cases, question versions, assignments, assignment modules and placements, publications, submissions and their per-case results, tests, sections, placements, schedules, attempts, answers, and a record of every code execution.
- **Question bank (M-11).** Five types: multiple choice with one or several answers, true or false, written, and coding. Each save keeps a version, so what a learner saw can still be explained. The type of a saved question cannot change. A question already used by a paper can be retired but not deleted. Import from a sheet with a template, a dry run that writes nothing, and a per-row error report with line numbers.
- **Execution adapter (M-14, ADR-0007 and the new ADR-0011).** Two drivers behind one interface. The demo runs JavaScript in a sandboxed worker and Python through Pyodide, in the learner's own browser; a Judge0 host runs them away from the learner. The API process never compiles, evaluates or spawns learner code, and a test asserts it. A browser verdict is recorded as untrusted and badged as such wherever a mark is shown; the marks themselves are always computed from the weights stored against the question.
- **Assignments (M-12).** Modules of questions with unlock rules, attempt limits, an explanation policy and a due policy. Objective answers are marked at once, written answers queue for a person, coding answers are marked from the question's own cases. Published to a batch with an optional due date; everyone in it is told.
- **Tests (M-13).** A paper of sections, settings for duration, attempts, shuffling, results and review, and a window per batch. The attempt engine owns the clock: the deadline is written at the start, every save after it is refused, and a job submits anything still open. Answers autosave. A second tab continues the same attempt. Negative marking applies to a wrong answer and never to a blank one, and a paper never scores below zero. Staff see scores at once; learners wait for the release, which is refused while any written answer is unmarked. A live monitor, a results table and a grading queue.
- **Practice (M-14).** A catalogue that is a view over the coding questions in the bank, with a workspace that runs the samples before a submission and records every verdict with its trust level.
- **Progress.** Assignments and tests are now measured rather than named as pending. Attendance is the only figure still named, and the dashboard has a "due soon" list of assignments and open tests.
- **Demo data.** 120 questions across the programme's subjects, six coding problems with reference solutions in both languages, four assignments published to batches, three tests at different points in their life, twelve sittings of the one already released, and a practice catalogue.
- **Web.** Admin and trainer pages for the bank, the editor, the import wizard, assignments and tests, with the builders, publishing, progress, results, the live monitor and the grading queues. Student pages for assignments, the question workspace, tests, the instructions page, the timed attempt, the result, and practice.

**Tests run (operating rule 28), on the development machine, 14 September 2026.**

| Suite                              | Command                           | Result                              |
| ---------------------------------- | --------------------------------- | ----------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 47 tests passed            |
| API unit                           | `pnpm --filter @lms/api test`     | 9 files, 45 tests passed            |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed              |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 13 files, 138 tests passed (114 s)  |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 26 passed, 1 skipped (2.3 min)      |
| Lint and type-check                | run per package                   | every package with the script clean |

**Phase 4 exit criteria (plan §24.1).**

| Criterion                              | Evidence                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-06 passes end to end                 | `test/assessment.e2e-spec.ts` builds an assignment from the bank, publishes it to a batch and marks a written answer; the browser test does the same through the pages |
| J-09 passes end to end                 | The same spec answers a question wrongly then rightly, watches the gate open, and checks the figures agree; the browser test answers one through the workspace         |
| J-10 passes end to end                 | `test/tests.e2e-spec.ts` starts an attempt, saves answers, restores them, refuses a second attempt and submits; the browser test sits a test and submits it            |
| J-11 passes end to end                 | The same spec marks a written answer, releases the results and reads them back as the learner, with the rank and the review                                            |
| Browser driver runs JavaScript         | The browser test writes a solution, runs it against the examples and submits it, and reads back the accepted verdict with its badge                                    |
| Response-shape security tests pass     | The learner-facing question carries no correct option, no explanation and no hidden case; an API test asserts the browser driver refuses to run anything on the server |
| AC-06.1 to AC-06.4, AC-07.1 to AC-07.4 | Each has an assertion of its own, named in the specs                                                                                                                   |

**Defects found and fixed during this phase.**

- **An Admin could not write a question.** The authoring endpoints require `questions:create_own`, and the Admin bundle had only `questions:manage`. Whoever manages the bank now gets the authoring grant with it. Found by the browser journey.
- **Question versions collided.** Creating a question wrote version 1, and the first edit tried to write version 1 again, so every edit failed with a unique-constraint error. A version row now records the question as it stands after the change.
- **The question edit endpoint was a lie.** It was `PATCH` but replaced the whole question, so an editor that omitted a field silently cleared it. It is now `PUT`, which is what it does.

**Assumptions and deviations (stated, not invented).**

- **A browser-run verdict is not evidence.** ADR-0011 sets out what the demo driver can and cannot be trusted with, including that a browser cannot be kept from the hidden test cases it is asked to run. Practice and assignment coding marks carry a badge saying which machine checked them; a test never sends its hidden cases anywhere and never trusts a client report.
- **Coding answers inside a test wait for a person under the browser driver.** The server cannot run them, and marking them from a client report during a timed test is not something the platform will do. With a Judge0 host they are marked automatically.
- **The import sheet is CSV or TSV.** The same deferral as the student import in Phase 2: `.xlsx` waits for the library Phase 5 introduces for exports.
- **Python in the browser runs on the page, not in a worker.** Pyodide is loaded that way, so the time limit cannot interrupt a runaway Python loop; the workspace says so rather than implying a limit it cannot enforce.
- **The browser suite's admin account may be an ordinary Admin.** The Phase 1 smoke test walks the Super Admin settings pages; it now checks what the signed-in account holds and skips that part rather than failing when the account is an Admin.
- **One journey skipped in the recorded run.** The demo allows one attempt at the open test, and the learner used it in an earlier run of the same suite. The test says so in its skip message instead of passing on nothing; running `pnpm --filter @lms/api demo:reset` first makes it run.
- **The browser suite retries once.** Against the development server the first request to a route compiles it, and on this machine that can outlast any sensible limit. A retry hits the compiled route; a test that fails twice has failed.

**Environment notes from this session.** The machine has 7.4 GB of memory and a full C: drive, and compiling every route at once starved the disk badly enough that PostgreSQL timed out every connection and both servers fell over. Docker Desktop's port forwarder then stayed wedged — the database answered inside the container while refusing the host — and only restarting Docker Desktop cleared it. Nothing in the product was at fault, but it is worth knowing before running the suite here: start the API compiled, leave the routes to compile as the tests reach them, and do not run a warm-up pass.

## 2026-09-14 (session 4) — Phase 3 (Learning foundation) complete; gate reached

**Approval recorded.** The client approved the Phase 2 gate and asked for Phase 3: courses, lessons, media, publications, the learning player, progress tracking and the schedule.

**Delivered (architecture plan §24.1, Phase 3 deliverables).**

- **Database.** Migration `20260913173259_phase3_learning_foundation`: taxonomy terms, courses, course modules, lessons, lesson resources, course publications, enrolments, lesson progress, activity events, session series and live sessions.
- **Taxonomies.** The curated vocabularies the plan asked for (course levels, subjects, topics), built now because courses are their first consumer. Records store the term key, so a client renames a label without touching the records that use it; a term still in use is archived rather than deleted.
- **Courses (M-07).** Create, edit, archive; a whole-outline save that keeps the identity of every module and lesson the author kept, so editing a live course never resets progress anybody has already made; four lesson types; per-lesson completion rules; module unlocking once the previous module reaches a percentage.
- **Media (M-08).** Upload contexts for course thumbnails, lesson videos, lesson resources and class recordings. `VideoService` hides the delivery driver: the demo plays a private object through a four-hour signed URL, and a hosted provider becomes a second driver without touching the lessons that reference it (ADR-0005).
- **Publications (M-09).** A course is published to a batch, a programme or the whole institute, and the publication derives the enrolments (ADR-0010). Withdrawing removes only the learners with no progress. Publishing twice to one audience is refused rather than silently repeated.
- **Learning player (M-10).** Article and video lessons, downloads through short-lived links, previous and next, mark complete, and the video position saved every fifteen seconds. A locked module is refused by the API as well as hidden in the page.
- **Progress (M-11).** One source of truth for every percentage: the player, the course page, the dashboard, the progress page and the staff view all read the same figures, so they cannot disagree. Completing a lesson writes an activity row; the last mandatory lesson completes the enrolment.
- **Schedule (M-12).** Repeating classes expanded from weekdays, a time range, a date range and holidays, stored as instants derived from institute wall-clock time; a preview that names every clash before anything is written; status transitions; cancellation notices; a reminder job that cannot send twice; per-person timetables for learners and trainers.
- **Recordings (J-08).** A trainer publishes the recording of a class as an optional lesson in a course, linked back to the class it came from.
- **Demo data.** Six courses of twenty lessons each, six publications, 250 derived enrolments, 36 classes across a fortnight either side of today, and recorded progress for five learners.
- **Web.** Admin course catalogue, course workspace (outline builder, publishing, details), institute schedule, and the batch Timetable and Content tabs; trainer schedule and course views; student courses, course outline, lesson player, progress page and schedule; a student dashboard that is now real.

**Tests run (operating rule 28), on the development machine, 14 September 2026.**

| Suite                              | Command                           | Result                              |
| ---------------------------------- | --------------------------------- | ----------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 47 tests passed            |
| API unit                           | `pnpm --filter @lms/api test`     | 9 files, 45 tests passed            |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed              |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 11 files, 103 tests passed (135 s)  |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 20 tests passed (2.4 min)           |
| Lint and type-check                | run per package                   | every package with the script clean |

**Phase 3 exit criteria (plan §24.1).**

| Criterion                        | Evidence                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-03 passes end to end           | `test/courses.e2e-spec.ts` builds a course, publishes it to a batch, opens a lesson, completes it and checks the recomputed figures; the browser test does the same through the pages, as author then learner |
| J-07 passes end to end           | `test/sessions.e2e-spec.ts` previews a timetable, creates it, refuses the double booking, cancels a class and checks the notice; the browser test opens a learner's week and a trainer's                      |
| J-08 passes end to end           | `test/sessions.e2e-spec.ts` and the browser test publish a class recording into a course and find it there as a lesson                                                                                        |
| Progress figures agree           | The API test asserts the same number on the course, the progress overview and the dashboard; the browser test asserts it on the course page and the progress page                                             |
| Gating enforced, not just hidden | A lesson inside a locked module returns 403 `module_locked` to a direct request                                                                                                                               |
| Audit rows present               | Every mutation writes one; the courses and schedule suites assert the rows they expect                                                                                                                        |

**Defects found and fixed during this phase.**

- **The outline editor would have silently wiped lesson bodies.** The course detail response carries no lesson text, so a save would have written an empty body for every lesson the author had not opened. Lesson content is now optional on save, and the builder loads a lesson's text before it opens the editor, so nothing is overwritten unseen.
- **The batch Content tab showed every published course.** It claimed to show what the batch had been given while listing the whole catalogue. The catalogue endpoint now takes a batch filter and answers the question the tab actually asks.
- **Invalid taxonomy terms were accepted.** The course service checked the term and then ignored the answer; an unknown level or subject is now a field error.
- **The API test database accumulated fixtures between runs.** A Phase 2 assertion about what a trainer can see began failing once enough runs had added batches. The schema is dropped and recreated before the migrations, so every run starts clean.

**Assumptions and deviations (stated, not invented).**

- **Demo lessons are written articles, not videos.** No media ships in this repository, and a player pointed at a file that does not exist would be a worse demonstration than one that reads well. Uploading a video and attaching a recording are exercised by the tests instead, and the video driver is the same code either way.
- **The demo has 36 classes, not the "about 60" sketched in the plan of work.** Six series over a fortnight either side of today produce 36; padding the number would mean inventing classes nobody teaches.
- **Practice lessons carry a question id but nothing answers it.** The question bank is Phase 4, and the lesson page says so rather than showing an empty exercise.
- **A recording is attached as a link.** Uploading the video file itself uses the same upload context as a lesson video and is wired for the media work in Phase 5; the dialog says which of the two it is asking for.
- **Attendance against a class is not built.** It is a Phase 5 row, and the progress page names it as pending rather than showing a zero.
- **The browser suite's per-test limit is now ninety seconds.** Against the development server the first request to a route compiles it, which on this machine can take most of a minute; the previous thirty-second limit reported that as a product failure.
- **The `nest start --watch` runner is not reliable for long browser runs on this machine.** Its restart step kills a process id that has already gone and takes the whole watcher down with it. The verification run used the compiled server (`pnpm --filter @lms/api build` then `node dist/main.js`), which is also what the testing runbook now recommends.

## 2026-09-13 (session 3) — Phase 2 (Admin foundation) complete; gate reached

**Approval recorded.** The client approved the Phase 1 gate and asked for Phase 2 as planned: students, trainers, programmes, batches, notifications, announcements, search, journeys J-01 and J-02.

**Delivered (architecture plan §24.1, Phase 2 deliverables).**

- **Database.** Migration `20260913152313_phase2_admin_foundation`: student profiles, documents, staff notes, trainer profiles, programmes, batches, batch members, batch trainers, notifications, notification preferences, announcements, custom field definitions, import jobs.
- **Students (M-03/M-04).** Records with lifecycle status, personal and education sections, skills, completeness score and client-defined fields; staff notes; documents in the private bucket with verify/reject and audited download links; sensitive fields gated by `students:read_sensitive`; student codes `STU-<year>-<sequence>`.
- **Import (DP-A07).** CSV/TSV import as a queued job with a template, a real dry run, per-row error reporting, batch placement by code, and a one-at-a-time guard that releases jobs abandoned by a crashed process.
- **Trainers (M-05).** Records, subjects, batch assignments, own-record scope for a signed-in trainer.
- **Programmes and batches (M-06).** Programme CRUD with an archive guard; batches with capacity, mode, dates and status transitions; roster with membership history and transfers; trainer assignment per subject; starting a batch notifies its members.
- **Notifications and announcements (M-16).** In-app centre with categories and read state, per-category channel preferences, staff broadcast with an audience preview, announcements with a validity window delivered once by a five-minute dispatch job, and a bell in every portal.
- **Search (M-20).** Command palette (Ctrl/⌘+K) over students, trainers, batches, programmes and staff, gated per group by permission and narrowed by batch scope.
- **Dashboard (DP-A01, subset).** People and cohort tiles that are real today; attendance, completion and assessment tiles return no value and name the phase that will deliver them.
- **Custom fields.** Client-defined fields for students and batches, validated on every write, with a settings page.
- **Scope service.** Batch-scope resolution moved into core so every module answers the same question; trainers see only their own batches and the students in them.
- **Demo data.** One programme (Java Full-Stack), three batches (running, planned, completed), 60 students spread 20 per batch, 8 trainers with subjects, 9 trainer assignments, one announcement, plus `clients/demo/seeds/students-sample.csv` for the import demonstration.
- **Web.** Admin pages for students (list, import, detail), trainers, programmes, batches (roster, trainers, status), announcements and custom fields; a trainer portal with its own batches; a notification centre; a searchable command palette; a student dashboard that states the enrolment honestly.

**Tests run (operating rule 28), on the development machine, 13 September 2026.**

| Suite                              | Command                           | Result                           |
| ---------------------------------- | --------------------------------- | -------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 40 tests passed         |
| API unit                           | `pnpm --filter @lms/api test`     | 8 files, 37 tests passed         |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed           |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 9 files, 72 tests passed (103 s) |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 13 tests passed (50 s)           |
| Lint / type-check                  | `pnpm lint`, `pnpm typecheck`     | 8 of 8 packages clean            |

**Phase 2 exit criteria (plan §24.1).**

| Criterion                | Evidence                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-01 passes end to end   | `test/students.e2e-spec.ts` creates the account, the student record and the invitation and checks the audit row; the browser test creates a student through the dialog and opens the resulting record. The journey's final step, the student accepting the invitation, is covered by the Phase 1 invitation tests |
| J-02 passes end to end   | `test/batches.e2e-spec.ts` walks programme → batch → students → trainers → running and asserts the member notification; the browser test opens a seeded batch and its trainer assignments. Timetable and content publication are Phase 3 (see the deviation below)                                                |
| Import of the demo sheet | A browser test uploads `clients/demo/seeds/students-sample.csv` and asserts 17 of 20 rows import with exactly the three expected errors                                                                                                                                                                           |
| Audit rows present       | Every mutation writes one; the students, batches and notifications suites assert the rows they expect                                                                                                                                                                                                             |

**Defects found and fixed during this phase.** Three were pre-existing Phase 1 faults that only a Phase 2 journey could reach.

- **A trainer could open the admin portal.** Portal access was derived from "has any navigation item", and a trainer legitimately holds `batches:read`. Access now follows the user's roles, with the navigation fallback kept only for client-defined roles. Admin-portal menu items also moved onto the manage permissions, matching plan §14. Found by a browser test.
- **The queue rejected every job in embedded mode.** The pg-boss driver passed `priority: undefined`, which pg-boss validates and refuses, so no invitation email or notification could be queued outside tests. Options are now omitted when absent, and `test/queue.e2e-spec.ts` drives the real driver so the inline test path cannot hide it again.
- **`WORKER_MODE=none` crashed on enqueue.** The queue was never started in that mode, yet enqueue still called it. Handlers now run inline and awaited, which is also what the tests and the CLI want.
- **Rate limits shared one bucket.** A route with its own limit counted into the same counter as the global default, so a small per-route limit rejected requests the default had already allowed. Declared limits now count per route.
- **The import page treated a queued job as finished.** It now follows the job until the worker completes it.
- Smaller: the custom-fields tab read "Batchs"; the import counters mixed "skipped" with "failed"; a validation error for a missing sheet column did not name the column.

**Assumptions and deviations (stated, not invented).**

- **J-02 reaches as far as Phase 2 does.** The journey's timetable and content-publication steps depend on the schedule and course modules, which the same roadmap row places in Phase 3. Phase 2 delivers the batch, its roster, its trainers and its status, and the batch page says plainly that the timetable arrives with the schedule module. Nothing was faked to make the journey look complete.
- **Spreadsheet import is CSV/TSV only.** DP-A07 also promises `.xlsx`. That needs a library, and Phase 5 introduces one for report exports; using the same library for both directions avoids a second dependency. Every spreadsheet exports CSV, and the demo sheet is CSV. Amendment proposed for plan §14 (DP-A07).
- **The sample import sheet has 20 rows, not the 60 named in §21.5.** Sixty extra applicants would double the seeded student body mid-demonstration; twenty rows still show all three kinds of error. Amendment proposed for plan §21.5 step 6.
- **Role bundles on upgrade** now follow ADR-0009 (a catalogue watermark): a new module's defaults are granted once, and a permission a client removed is never re-added.
- **Taxonomies** (the plan's "Fields & taxonomies" page) are not built: nothing in Phase 2 uses them. They arrive with courses and questions, their first consumers.
- **Resumes and the student profile pages** (DP-S17–S20) are not in the Phase 2 row and were not built.

**Environment note.** The machine's system drive filled during this session (0 bytes free on C:), which crashed the web dev server with an out-of-memory error and broke test runs until temporary files were redirected to E:. By the end of the session `pnpm lint` and `pnpm test` through Turborepo were also dying with a Windows stack-overrun exit code whenever several packages built in parallel; the same checks pass when each package runs on its own, which is how the results above were produced. Only regenerable caches were deleted; roughly 3 GB of other Claude sessions' temporary folders were left untouched. The drive needs the owner's attention before the next phase.

**Next (needs approval — operating rule 42).** Phase 3 (Learning foundation): courses, modules and lessons, the file and video drivers, publications, the catalogue and player, the progress service, the schedule (series, occurrences, reminders), and the student dashboard and progress pages; journeys J-03, J-07, J-08.

## 2026-09-13 (session 2) — Phase 1 (Foundation) complete; gate reached

**Delivered (architecture plan §24.1, Phase 1 deliverables).**

- Monorepo (pnpm 11 + Turborepo), Compose stack (PostgreSQL 16 on host port 5433, MinIO from quay.io, Mailpit, Adminer profile), root and app `.env.example` files, `scripts/env-init.mjs`.
- Environment validation at boot (`apps/api/src/core/config/env.ts`, Zod; production refuses insecure cookies and placeholder secrets).
- Prisma 7 baseline migration `20260913140206_init_foundation`: organizations, users, invitations, password resets, sessions, roles, permissions, role permissions, user roles, settings, branding settings, feature flags, navigation configs, audit logs, files.
- Authentication (ADR-0003): Argon2id, 15-minute access JWT in an httpOnly cookie or Bearer header, rotating refresh tokens with family reuse detection, double-submit CSRF, lockout after 5 failures, invitations and password resets as hashed single-use tokens, sessions list/revoke, logout-all.
- RBAC (ADR-0004): permission catalogue from module manifests, system role bundles, scopes `all|batch|own`, deny-by-default guard, module-enabled guard, 60-second auth context cache.
- Module registry (manifests → permissions, navigation defaults, flag defaults; catalogue synced at boot), foundation modules `settings`, `auth`, `rbac`, `users` (+ `/me`), `audit`, `files`, `health`, each with a README.
- Core services: pino logging with request ids and redaction, RFC 9457 problem responses, request context, audit service, tenant service, pg-boss queue with embedded workers, S3 storage driver with presigned uploads and MIME sniffing, SMTP/noop email drivers with branded templates, in-repo rate limiting.
- Shared package: schemas (auth, settings, branding, flags, navigation, common), permission catalogue, roles, error codes, `/me` contract, time utilities, theme derivation with WCAG contrast validation.
- Web shell (Next.js 16, shadcn `radix-vega`, Tailwind 4): branding injected server-side as CSS variables for light and dark schemes, theme toggle (system/light/dark), portal layouts with navigation from `/me`, user menu, mobile navigation, environment banner, typed API client with CSRF header and one silent refresh, server-side portal guards.
- Pages: sign in (with silent session restore from the refresh cookie), forgot/reset password, accept invitation, sign out, 403/404/error, admin home, users (list, filters, invite, roles, deactivate/reactivate, resend invitation), general settings, branding (live preview, contrast check, logo/favicon/background uploads), feature flags, navigation editor, roles and permissions matrix (create/clone roles, per-role save), audit log (filters, before/after viewer), system health, my account (name, password, devices), trainer and student placeholders (wireframes).
- Seeds and CLI: base seed with client overlay (`clients/demo`), Super Admin CLI, demo accounts seed (§21.1 people: admin, ops, placement, 8 trainers, 60 students), `demo:reset`.
- Worker entry (`apps/api/src/worker.ts`, `apps/worker`), CI workflow (`.github/workflows/ci.yml`), husky hooks (pre-commit Prettier, commit-msg commitlint, pre-push type-check + unit tests), runbooks (local setup, testing, page checklist), ADR-0001…0008, `docs/STACK.md`.

**Tests run (operating rule 28), all on the development machine, 13 September 2026.**

| Suite                                                                                                                        | Command                                                                                | Result                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Shared unit (schemas, token derivation/contrast for 10 sample brand colours, time)                                           | `pnpm --filter @lms/shared test`                                                       | 3 files, 26 tests passed                            |
| API unit (env contract, passwords/tokens, pagination, MIME sniffing, rate-limit store)                                       | `pnpm --filter @lms/api test`                                                          | 5 files, 22 tests passed                            |
| API integration against `lms_test` (route table, authentication, permission matrix for four roles, branding/settings/health) | `pnpm --filter @lms/api test:e2e`                                                      | 4 files, 28 tests passed (36 s)                     |
| Web unit (portal helpers)                                                                                                    | `pnpm --filter @lms/web test`                                                          | 1 file, 3 tests passed                              |
| Browser smoke, Chromium (redirect to sign-in, Super Admin sign-in → dashboard → settings → sign-out, wrong credentials)      | `pnpm --filter @lms/web test:e2e --project=chromium`                                   | 3 tests passed (see session note below)             |
| Lint / type-check                                                                                                            | `pnpm lint`, `pnpm typecheck` (per package: eslint `--max-warnings=0`, `tsc --noEmit`) | clean for `apps/api`, `apps/web`, `packages/shared` |

Manual browser verification (Claude in-app browser, viewport 553×616): sign-in as Super Admin, admin dashboard, general settings, branding, feature flags, navigation, roles matrix, audit log (5 rows from this session), system health (database/storage/email OK), users list, my account — all render with data from the API; dark theme resolved from the system preference.

**Phase 1 exit criteria (plan §24.1).**

| Criterion                                | Evidence                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New developer runs the stack in < 1 hour | `docs/runbooks/local-setup.md`; quick start is seven commands; ports and pitfalls documented                                                                                               |
| Login works for four roles               | `test/permissions.e2e-spec.ts` signs in Super Admin, Admin, Trainer and Student and checks home portals (`admin`, `admin`, `trainer`, `student`); Super Admin also verified in the browser |
| Branding changes re-theme                | `test/settings.e2e-spec.ts`: PATCH primary colour → new derived tokens, version bump, public branding and audit row; web injects tokens on every request (no cache)                        |
| Route-table test passes                  | `test/route-table.e2e-spec.ts`: 40+ routes, each public or permission-declared, permissions exist in the catalogue, protected GETs answer 401                                              |

**Fixes made during verification.**

- shadcn-generated components imported `cn` from an npm package instead of `@/lib/utils`; class names aligned with shadcn conventions (`text-muted-foreground` etc.).
- React Compiler lint rules: hoisted a component created during render, replaced `setState`-in-effect patterns (theme toggle now uses `useSyncExternalStore`; navigation editor remounts on fresh data), switched forms to `useWatch`.
- `/me` reported no portals for students and trainers (no navigation items yet in Phase 1) → portals now derive from roles as well; `POST /branding/preview` answered 201 → 200.
- Shared `emailSchema` now trims and lower-cases before validating, so a trailing space cannot block a sign-in.
- ESLint for the API: `@typescript-eslint/consistent-type-imports` needs the `emitDecoratorMetadata` parser option, otherwise auto-fix would break Nest dependency injection; shared config package now declares its runtime dependencies.
- Removed `vite-tsconfig-paths` (Vite resolves `tsconfig` paths natively) and `@nestjs/throttler` (no Nest 12 peer range; replaced by the in-repo guard) — recorded in `docs/STACK.md`.
- Login page restores a session silently when the access token expired but the refresh cookie is valid (the refresh cookie is scoped to `/api/v1/auth`, so server components cannot see it).

**Assumptions and deviations (stated, not invented).**

- Demo password (§21.2): outside local the seed requires `SEED_DEMO_PASSWORD`; locally, when unset, it generates a random password and prints it once instead of using a documented fixed value, because operating rule 9 forbids credentials in the repository or docs. The runbook tells presenters to set the variable.
- Phase 1 has only core (locked) modules, so the Feature flags page shows an explained empty state until Phase 2 modules add flags.
- Trainer and student home pages are temporary wireframes (labelled in `docs/runbooks/page-checklist.md`); their content arrives with Phases 2–3.
- `docs/source-materials/` (client WhatsApp screenshots) is kept out of version control because the images may contain personal data.
- CI has not run yet: the repository has no remote. The workflow is written to the plan (§23.2) and will be verified on the first push.

**Session note (rate limiting during verification).** The login route allows 5 attempts per 15 minutes per IP and email; repeated manual and automated sign-ins during verification hit that limit once, which is the intended behaviour. Test suites keep sign-ins per file below the limit and boot their own application instance.

**Next (needs approval — operating rule 42).** Phase 2 (Admin foundation): students, trainers, programmes, batches, notifications, announcements, audit viewer polish, basic search; journeys J-01 and J-02.

## 2026-09-13 — Phase 1 (Foundation) started

**Approval recorded.** Client approved: monorepo with modular monolith; separate web, API and optional worker; PostgreSQL; Docker Compose local environment; one deployment and database per client; configuration and feature flags first, extension modules only when necessary; code execution through an external/isolated adapter, never inside the API; staging Option A (VM); AI, advanced labs, placement, certificates and gamification deferred to future phases. Instruction given to start implementing per the documents and to ask before inventing anything unclear.

**Environment verified on the development machine.** Node 22.22.1, pnpm 11.15.1, Git 2.53, Docker 29.7.2 with Compose v5.4.0 (Docker Desktop installed per-user; daemon started during this session). Windows 11.

**Version pins decided at setup (recorded in docs/STACK.md).** Next.js 16.3.5, React 19.2.8, NestJS 12.0.1 (CLI 12.0.0), Prisma 7.10.0 (the npm `latest` tag is an 8.0 release candidate, so the 7.x line is pinned explicitly as per D-04), Tailwind CSS 4.3.3, Zod 4.6.4, pg-boss 12.31.0, TypeScript 6.0.3 (the Nest 12 generator targets TypeScript 6; every dependency in use accepts it, so it is used workspace-wide instead of 5.9), Vitest 4.1.11, Playwright 1.63.0, Turborepo 2.10.12.

**Done.** Repository initialised (`git init`, branch `main`); workspace root files; Nest and Next apps scaffolded with their official generators (`@nestjs/cli@12 new`, `create-next-app@16.3.5`); nested workspace file removed from the web app; package manifests for `apps/api`, `apps/web`, `packages/config`, `packages/shared`, `packages/module-sdk`, `packages/ui`; `infra/compose.yml` (postgres, minio + bucket init, mailpit, adminer profile); `.env.example` files for root, API and web; Prettier, commitlint, editor config; `scripts/env-init.mjs`.

**Assumptions (not inventions; defaults from the approved documents).** Product codename "LMS" and package scope `@lms/*` until a product name is given (Q-01); demo brand "Demo Institute" (DQ-05); pg-boss as queue default (DQ-03); repository private (DQ-08); overlays inside the template repository (DQ-10).

**Next.** Install dependencies; Prisma baseline schema and first migration; core (config, logging, errors, guards, audit, queue, events, storage, email adapters); modules auth, rbac, users (me), settings/branding/flags/navigation, audit, health, files; web shell with theme injection and auth pages; seeds and CLI; tests; CI workflow; ADRs; runbooks.
