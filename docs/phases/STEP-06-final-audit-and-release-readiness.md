# Step 6 — Final audit and release readiness

The client's locked execution plan, Step 6 ("final audit and release readiness"), started on 10
October 2026 after Step 5 was released to production in `76bf905`. It is Roadmap Phase 13's audit
(every test level, every area, "no known release-blocking defect remains"), run against the
product as it stands in production, plus the release-readiness decision the client asked for. It
does not declare the product fully released: that needs the institute's signed-in UAT
(`docs/runbooks/production-uat.md`), the legal confirmations and email delivery, which are the
owner's.

## Release 16 (the starting point)

CI #66 on `76bf905` passed all four jobs (31m 6s): lint, types, unit (API 660, web 93, shared 174,
runner 16) and API e2e (64 files, 774 tests); the sandbox (27); Playwright 132 passed and 4 skipped
at desktop, 135 and 1 at phone size; the images. On the client's instruction ("If CI passes,
deploy it"), deploy #16 (run 38048927227: branch `main`, `image_sha` empty, content promotion off)
passed in 18m 23s: snapshot `si-academy-production-pre-release-76bf905481f4-38048927227-1`; 21
migrations, none pending; base seed and Super Admin left as they were; `ai.lab_hints=off`; api,
runner and web healthy; both target groups healthy; 29/29 smoke checks; the site serves
`76bf905`. A read-only database check afterwards: courses 9 draft and 2 published, 57 modules,
416 lessons, 21 draft tests, 14 assignments, 1 published knowledge source (embedded), no companies
or drives, the legal pages served from the built-in drafts.

## How the audit was done

| Area                      | Method                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code security             | A read-only review of the API, web, runner and infrastructure code against the project's rules (permissions, audit, validation, secrets, execution, AI boundaries), with file evidence |
| Dependencies              | `pnpm audit --prod`, then each advisory traced to whether a request can reach it                                                                                                       |
| Container images          | The ECR scan (basic) of every image of the release; Debian's published fixes checked in the base image                                                                                 |
| Production infrastructure | Read-only AWS calls: RDS, snapshots, alarms and their subscription, CloudFront, S3, EC2 and its security groups, ECR, secret names (no value read)                                     |
| Production data           | The read-only count script above (no names, addresses or content)                                                                                                                      |
| Roles and pages           | Step 5's audit of every page of every role (492 page views) and the accessibility spec                                                                                                 |
| Load                      | A read-load baseline on the local QA copy (never production)                                                                                                                           |
| Tests                     | The suites mapped to Phase 13's list (below)                                                                                                                                           |

## Test coverage against Phase 13

| Phase 13 level             | Where                                                                                                                     | State               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Unit                       | API 660 (+3 SMTP), web 93 (+5 drafts), shared 174, runner 16                                                              | in CI               |
| Integration and API E2E    | 64 API e2e files, 774 tests, on a real PostgreSQL                                                                         | in CI               |
| Browser E2E                | 15 Playwright specs, desktop and phone projects                                                                           | in CI               |
| Permission matrix          | `route-table`, `permissions`, `role-boundaries`, `staff-scope`, `search-reach`                                            | in CI               |
| Regression                 | Every push; the deploy's 29 smoke checks                                                                                  | in CI and deploy    |
| Security                   | `auth-hardening`, `hardening`, `ai-gate`; this audit                                                                      | in CI               |
| Sandbox                    | The runner's 16 and the sandbox job's 27                                                                                  | in CI               |
| Load and concurrency       | `concurrency` and `ai-knowledge-load` (races, not volume); the local baseline below                                       | partly              |
| Property and invariant     | None (no generator library); invariants are asserted in the unit and e2e suites                                           | optional, not added |
| AI evaluation and red-team | `ai-phase10-evaluation`, `ai-agent-evaluation`, `ai-knowledge-*-evaluation` (fake provider in CI); `ai:eval-live` by hand | in CI               |
| Storage, export, report    | `course-video`, `hardening` (files), `reports`, `admin-operations`                                                        | in CI               |
| Accessibility              | `e2e/accessibility.spec.ts` (Step 5)                                                                                      | in CI               |

## Findings and what was done

**Fixed in this step** (`ab0cdda`, `3f2489d`, `622c5b7`, `4df71f4`):

| #   | Severity            | Finding                                                                                                                                                                                                                            | Fix                                                                                                             |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Medium              | Unsent drafts (code, text, web lab) were kept in the browser under keys naming no person and survived sign-out: on a shared lab PC the next learner saw the previous learner's code for the same question                          | Drafts have an owner; the signed-in shell removes anybody else's, sign-out removes all                          |
| 2   | Medium              | The upload link did not sign the Content-Type, so a signed-in person could store any type (a web page) under `/files` and never complete it                                                                                        | Content-Type signed (S3/MinIO refuse another: 403, checked on MinIO); completion refuses a stored type mismatch |
| 3   | High                | `next` 16.3.6: SSRF in image optimisation, cache-poisoning and disclosure advisories                                                                                                                                               | 16.3.8                                                                                                          |
| 4   | Critical (advisory) | `proxy-addr` 2.0.7 (IPv4-mapped IPv6 trust subnets). Not reachable: the API trusts one hop, and the ALB preserves CloudFront's `X-Forwarded-For` (`xff_header_processing.mode: preserve`), so the viewer's address is the one used | 2.0.8 as an override; `sharp` 0.35.5 likewise                                                                   |
| 5   | High (image)        | The release images carried Debian packages behind their published fixes (perl-base, the source of five of the six critical image findings; pcre2; tzdata)                                                                          | The API, web and runner images upgrade their base packages at build time                                        |
| 6   | Low                 | A gzip/brotli body was inflated to the 6 MB parser limit before the 1 MB limit applied, on public routes too                                                                                                                       | Compressed bodies refused with 415                                                                              |
| 7   | Low                 | SMTP to SES on 587 did not require STARTTLS                                                                                                                                                                                        | Required in production                                                                                          |
| 8   | Low                 | The audit log's browser-built CSV did not guard spreadsheet formulas                                                                                                                                                               | Guarded as the API's exports are                                                                                |

Step 5 (released in `76bf905`) had already fixed the Branding save, the trainer's course links and
the page states.

**Open, not blocking a small first intake** (recorded for Phase 12's remaining work or later):

| Finding                                                                                                                                                                                                                                                   | Why it can wait                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit entries are written after the change commits and a failure is only logged; some mutations write none (automatic marking of a submission, file upload records, learner progress and autosave, notification reads, scheduled announcement publishing) | Every staff action that changes a record is audited; the gaps are system or self-service events. A test pinning audit coverage is the follow-up |
| Remaining dependency advisories (19) are in tools and CLIs a request never reaches: eslint, the Prisma CLI (mysql2, deepmerge-ts, source-map-js), the shadcn CLI (not in the standalone web build), exceljs's archiver; ExcelJS 4.4.0 is unmaintained     | Not reachable; ExcelJS is used only by holders of an import permission                                                                          |
| Image findings with no Debian fix yet (gnutls, util-linux, zlib; python and krb5 in the migration image)                                                                                                                                                  | Not used by the Node processes; the build now takes fixes as Debian publishes them. A move to Debian 13 is a separate change                    |
| A whole XLSX is read before the 5,000-row cap (memory on a crafted file)                                                                                                                                                                                  | Only staff holding an import permission can send one                                                                                            |
| Expired sessions and uploads never completed are not swept (retention)                                                                                                                                                                                    | Kept inside the institute's own store; a retention schedule is legal item 5                                                                     |
| A flag limited to batches also reaches a learner in no batch                                                                                                                                                                                              | No production flag is batch-limited                                                                                                             |
| Five failed sign-ins lock an account for 15 minutes (anyone who knows an address can repeat it)                                                                                                                                                           | Accepted trade-off against password guessing                                                                                                    |
| `script-src 'unsafe-inline'` in the web CSP; visiting `/logout` signs out (logout CSRF)                                                                                                                                                                   | Lesson HTML is sanitised on write and read; AI output renders as text                                                                           |
| Rate-limit and authorisation caches are per process                                                                                                                                                                                                       | Production runs one API container                                                                                                               |
| Learner code runs in containers on the same host as the API (runc, no network, all capabilities dropped, read-only, user 65534)                                                                                                                           | ADR-0016's accepted design                                                                                                                      |
| S3 and SES use long-lived IAM keys; no WAF; CloudFront access logs off; SSH open to one /32                                                                                                                                                               | Cost and free-plan limits; SSM is the admin path, the SSH rule can be removed when not needed                                                   |
| TLS 1.0 is the edge minimum                                                                                                                                                                                                                               | The default CloudFront certificate sets it; a custom certificate needs us-east-1, which the organisation's SCP denies                           |

**Checked and sound** (evidence in the review): every route declares a permission or is one of 10
justified public routes; row scope fails closed; Argon2id (64 MiB, t=3); refresh rotation with
reuse detection; HttpOnly, Secure, SameSite cookies with double-submit CSRF; no raw SQL built from
input; no secret in the repository; secrets from Secrets Manager into root-only tmpfs; RDS with
`verify-full` TLS, encryption, deletion protection, not public; no server-side fetch of a
user-supplied URL; no `eval` or child processes in the API; AI keys server-side, data classes
limited to `public,course` in production, `ai.lab_hints` off, retrieval filtered by access before
the prompt, per-user quotas; HSTS, `frame-ancestors 'none'`, `nosniff`; open redirects blocked.

**Production infrastructure (read-only)**: RDS db.t4g.micro, PostgreSQL 16.15, encrypted, private,
deletion protection on, automated backups kept 1 day (the free plan's maximum; latest restorable
point minutes old) plus a manual snapshot before every release (the newest five kept). All ten
CloudWatch alarms OK, actions enabled, and their email subscription confirmed. S3 buckets: public
access blocked, encrypted, versioned. EC2 t3.small: IMDSv2 required, app ports open only to the
load balancer. ECR: immutable tags, scan on push. Nine secrets, none read.

## Load baseline (local, indicative)

On the local QA copy (one API process, PostgreSQL in Docker, the demo learners each on a session of
their own), closed-loop users looping over the calls the main pages make:

| Users | Throughput      | Learner dashboard p50 / p95 | Trainer dashboard p50 | Admin dashboard p50 | Other learner calls p95 | Errors |
| ----- | --------------- | --------------------------- | --------------------- | ------------------- | ----------------------- | ------ |
| 1     | (paced)         | 91 / 219 ms                 | 72 ms                 | 142 ms              | ≤ 45 ms                 | 0      |
| 10    | 29.5 requests/s | 713 / 1,038 ms              | 487 ms                | 576 ms              | ≤ 486 ms                | 0      |
| 30    | 30.0 requests/s | 2,169 / 3,379 ms            | 1,530 ms              | 1,673 ms            | ≤ 1,532 ms              | 0      |

The API saturates near 30 requests per second on one process, and the three dashboards are the
heaviest calls. A learner opening a page makes 5–8 calls, so a class of 40 working together is
about 10 requests per second: within capacity. Production (t3.small, burstable CPU; db.t4g.micro)
was not load-tested: that would load the live service, and needs the owner's approval and a quiet
window. Before a larger intake: measure production, then consider the dashboards' queries (Phase
12's performance part) and a larger instance (a paid change).

## Release readiness

| Item                                      | State                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production running the verified build     | `76bf905`, verified. The Step 6 fixes (`ab0cdda..4df71f4`) are pushed for CI and need a release (deploy #17) on the owner's go-ahead                                                                                                                                      |
| Known release-blocking defect in the code | None after the Step 6 fixes are released (the shared-browser drafts were the one that mattered for lab PCs)                                                                                                                                                               |
| Backups and recovery                      | 1-day automated backups and a snapshot before each release; a restore has not been rehearsed (recommended before real data accumulates)                                                                                                                                   |
| Monitoring                                | Ten alarms to a confirmed email                                                                                                                                                                                                                                           |
| **Email to real students**                | **Blocking for an intake.** SES is in its sandbox (by decision): invitations and password resets reach only verified addresses. Each learner's address must be verified in SES first, or SES production access requested (the owner's decision)                           |
| **Legal**                                 | **Blocking for real personal data.** The Privacy Policy and Terms are drafts; `docs/legal/LEGAL_REVIEW.md` §1 lists 17 confirmations (organisation identity, applicable law, transfers, retention, minors, sharing applicants with employers, Gemini/Groq terms and tier) |
| **Signed-in UAT**                         | **The institute's**, with `docs/runbooks/production-uat.md` on desktop and phone                                                                                                                                                                                          |
| Content                                   | 2 of 11 courses published; the learner's batch is planned with 1 learner. Publishing and enrolment are the owner's                                                                                                                                                        |
| Placement                                 | No companies or drives yet: genuine data only, per `docs/placement/GENUINE_PLACEMENT_DATA.md`                                                                                                                                                                             |
| AI                                        | On with `public,course` data only; `ai.lab_hints` off until ADR-0041's terms are recorded                                                                                                                                                                                 |
| Capacity                                  | Enough for a small first intake (above); measure before a larger one                                                                                                                                                                                                      |
| Domain                                    | The CloudFront address; a custom domain is blocked by the organisation's SCP (us-east-1)                                                                                                                                                                                  |

**Verdict.** Technically ready for a small, controlled first intake once deploy #17 releases the
Step 6 fixes and its smoke checks pass. Not ready to invite real students until the three owner
items in bold are closed: email delivery to their addresses, the legal confirmations, and the
institute's signed-in UAT.
