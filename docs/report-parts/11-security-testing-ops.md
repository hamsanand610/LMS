## 16. Security Plan

### 16.1 Sensitive data inventory

| Data | Sensitivity | Protection |
|---|---|---|
| Credentials (password hashes, refresh tokens, OTP hashes) | Critical | Argon2id; hashed tokens; never logged; rotation |
| Student personal data (contact, addresses, guardian contact, documents, DOB) | High (DPDP personal data) | Field gating (`students:read_sensitive`), encryption at rest (database and storage encryption), minimal collection **[Q-30]**, consent capture, erasure workflow |
| Assessment content (hidden tests, reference solutions, answer keys) | High (business) | Never sent to clients; access audited; exports restricted |
| Scores, attendance, placement outcomes | Medium–High | Scope-based access; audit |
| Company contacts and packages | Medium | Placement role only |
| Integration secrets (API keys) | Critical | Environment/host secrets; encrypted settings; write-only UI; rotation runbook |
| Audit logs | High | Append-only; restricted read |
| AI conversations | Medium | Retention limits; no sensitive data in prompts |

### 16.2 Controls

| Area | Controls |
|---|---|
| Password security | Argon2id (memory 64 MB, iterations tuned), minimum 10 characters, deny common/breached passwords (optional k-anonymity check), reset tokens single-use and expiring, no password hints, forced reset on compromise |
| Session and token security | Access JWT 15 min signed with rotated keys (kid in header), refresh tokens 30 days, rotation on every use with reuse detection (revokes family), httpOnly Secure SameSite cookies, server-side session records with device list and revocation, logout-all on password change/role change/deactivation, staff two-factor (Standard) |
| RBAC | Deny by default; permission + scope guards; route-table lint; matrix tests; sensitive-field gating; impersonation audited and time-boxed |
| Input validation | Zod at every boundary (HTTP, jobs, imports, webhooks); size limits; strict enums; file MIME sniffing; HTML sanitisation for rich text (allowlist) on input and safe rendering on output |
| SQL injection | Prisma parameterised queries; raw SQL only with tagged templates and reviewed; no string-built SQL; least-privilege DB user for the app (no DDL at runtime) |
| XSS | React escaping; sanitised rich text (DOMPurify-equivalent server-side); strict Content Security Policy (no inline scripts except nonces, restricted `frame-src` for video providers), `X-Content-Type-Options`, `Referrer-Policy`, Trusted Types where supported; Web Lab preview in sandboxed iframe with its own CSP |
| CSRF | SameSite cookies plus double-submit CSRF token on cookie-authenticated mutations; Origin checks on WebSocket handshake |
| Rate limiting and abuse | Redis token buckets per user/IP/route class; login/OTP throttles; execution quotas; Cloudflare WAF and Turnstile on public forms; bot detection on OTP send |
| File-upload security | Presigned uploads to private buckets; type/size limits by context; MIME sniffing; filename sanitisation; optional ClamAV; images re-encoded; PDFs served with `Content-Disposition` and no inline JS; no execution of uploaded content |
| API security | HTTPS only (HSTS); CORS allowlist; problem+json errors without stack traces; request IDs; security headers; OpenAPI docs not public in production; webhook signature verification (video/email providers) |
| Secrets management | Environment variables injected by host/CI; `.env` never committed; secrets encrypted at rest when stored in DB (integration configs) using a key from the environment; rotation procedure documented; separate keys per environment |
| Audit logging | All mutations of sensitive entities and all admin actions; append-only; includes actor, IP, request ID, before/after; retained 3 years; reviewed on incidents |
| Data privacy | Consent at invitation acceptance; privacy notice; purpose-limited fields; data export and erasure requests processed within SLA; anonymisation preserves aggregates; DPDP Act 2023 alignment reviewed with the client's legal advisor **[A-14]**; no third-party trackers without consent |
| Backup and recovery | Managed DB PITR or nightly base + WAL to R2; bucket versioning for certificates/documents; weekly automated restore test in staging; documented RPO/RTO; encrypted backups; access restricted |
| Secure coding practices | Code review on every PR; linting with security rules; dependency scanning (npm audit, Dependabot/Renovate, CodeQL); no dynamic `eval`; typed everywhere; threat model updated per phase; security checklist in Definition of Done |
| Code-execution isolation | §10.6 |
| Dependency management | Lockfiles committed; pinned major versions; automated update PRs; monthly review; SBOM generated in CI; base images pinned and rebuilt monthly |
| Infrastructure | Firewall: only 80/443 to app VM, SSH by key from allowlisted IPs, execution VM private-only; automatic OS security updates; Docker socket not exposed; non-root containers; read-only filesystems where possible; Cloudflare proxy hides origin IPs |
| Monitoring and response | Sentry alerts; anomaly alerts (login failures, export spikes, execution abuse); incident runbook; contact points; post-incident review |
| Test integrity | Server-side timing; question pools; integrity events; results release control; staff-only answer keys |

### 16.3 Threat model highlights

| Threat | Mitigation |
|---|---|
| Student runs malicious code to reach the database or network | Isolated execution VM without credentials or network; sandbox limits; security test suite |
| Credential stuffing on student accounts | Throttling, breached-password checks, optional OTP, alerting |
| Answer-key leakage via API | Separate DTOs for student views; tests assert absence of `isCorrect`/hidden tests in student responses |
| Trainer accesses other batches' data | Scope guard + query filters; matrix tests |
| Mass export of personal data | Export permission, caps, audit, alerts |
| Prompt injection through lesson/question content or student messages to the AI | Student content treated as data; system prompt policies; no tools with side effects; output filters |
| Compromised provider key | Least-privilege keys; rotation; monitoring of usage |

---

## 17. Testing Strategy

### 17.1 Test pyramid and tools

| Level | Scope | Tools | Where it runs |
|---|---|---|---|
| Unit | Services, formulas (progress, attendance %, scoring, eligibility, streaks), validators, utilities | Vitest | Every commit |
| Integration | Module + database (Testcontainers PostgreSQL/Redis), queues, repositories, migrations | Vitest + Testcontainers + Prisma | Every PR |
| API / contract | Every endpoint against a running API with seed data; OpenAPI schema conformance; permission matrix | Supertest, openapi-validator | Every PR |
| Component | UI components and forms with states (loading/empty/error), accessibility snapshots | Vitest + Testing Library + axe | Every PR |
| End-to-end | Critical journeys per role in a real browser (Chromium, WebKit, mobile emulation) | Playwright | Nightly and before release; smoke subset on PR |
| Role-permission | Matrix-driven allow/deny tests for all (role, endpoint, scope) combinations | Generated Supertest suites | Every PR |
| Responsive | Screenshot tests at 360/768/1024/1280 for key pages | Playwright | Nightly |
| Accessibility | axe on every page in E2E; manual screen-reader passes for player, test attempt, editors | axe-playwright, manual | Per phase |
| Security | Dependency scan, CodeQL, ZAP baseline scan on staging, execution sandbox suite (fork bomb, infinite loop, network, filesystem, huge output), auth abuse tests | GitHub Actions, OWASP ZAP, custom | Weekly and per release |
| Performance / load | Dashboard, lists, test attempt autosave, 50 concurrent submissions, 200 concurrent test takers | k6 | Per phase gate and before launch |
| Coding-execution | Language matrix (compile/run for every catalogued language), limits, verdict mapping, batch results, retries | Custom suite against staging Judge0 | Every execution change |
| Regression | All above on `main`; flaky-test quarantine with owner and deadline | CI | Continuous |
| User acceptance | Client walkthrough scripts per phase with pass/fail and sign-off | Staging | Phase gates |

### 17.2 Example acceptance criteria per module

| Module | Examples (in addition to §4.4 criteria) |
|---|---|
| Authentication | Invitation → password set → login works; 6th failed login within 15 min is throttled; refresh token reuse revokes the session family; password reset link expires after 30 min. |
| RBAC | Every endpoint in the route table has a permission or is public; trainer cannot read another batch's attendance (403); student cannot call staff endpoints. |
| Students & batches | Import 200 rows with 5 duplicates: 195 created, duplicates reported; transferring a student keeps attendance history in the old batch. |
| Courses | Publishing a course version does not change what students already completed; signed video URL rejected after expiry; resume position persists across devices. |
| Live sessions | Series generation respects holidays; reminders sent at T-24 h and T-30 min in IST; cancelling notifies students. |
| Attendance | Percentage formula verified with fixtures; correction after 48 h blocked for trainers, allowed for admin with reason. |
| Question bank | Coding question fails validation when the reference solution fails a test; import report lists row errors. |
| Assignments | Locked module cannot receive submissions (409); explanation hidden until policy allows; progress equals solved/total. |
| Tests | Deadline enforced server-side; reload restores state; result hidden until release; two tabs cannot create two attempts. |
| Execution | Infinite loop → TLE within limit; network call → fails; 50 concurrent submissions p95 < 10 s; hidden tests absent from responses. |
| Projects | Rework → resubmission creates version 2; rubric totals correct. |
| Certificates | Rule met → certificate within 5 min; verification page correct; revoke reflected. |
| Placement | Eligibility rules filter correctly; application snapshot resume; stage change notifies; funnel report matches. |
| Feedback | Anonymous responses unlinkable; aggregates hidden under 5 responses. |
| Reports | Each metric matches fixture expectations; export row counts equal filtered totals; trainer scope enforced. |
| Notifications | Preferences honoured; digest batching works; provider failure retried. |
| AI | Flag off → no calls; quota enforced; hint policy prevents solution leakage on the red-team set. |

### 17.3 Test data and environments

Deterministic seed data (institute with 3 programmes, 6 batches, 300 students, 8 trainers, 12 courses, 2,000 questions, 20 companies, 30 drives) generated by scripts; factories for tests; anonymised production snapshots never used in local development; staging refreshed from seed or anonymised data on demand.

### 17.4 Definition of Done (per feature)

Code reviewed; unit/integration/API tests added and green; permission tests updated; OpenAPI updated and client regenerated; migrations reviewed; accessibility checks pass; docs (feature page in `/docs`) updated; feature flag and settings documented; demoed on staging; acceptance criteria verified by the client or product owner.

---

## 18. Deployment and Operations

### 18.1 Repository and delivery pipeline

- Monorepo (pnpm workspaces + Turborepo): `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/ui`, `packages/config`, `infra/` (Docker, compose files, deploy scripts), `docs/`.
- Branching: trunk-based with short-lived feature branches; conventional commits; PR template with checklist; required CI checks; squash merges.
- CI (GitHub Actions): lint, type-check, unit/integration/API tests (Testcontainers), build images, contract tests, E2E smoke, security scans; artefacts: images tagged with commit SHA and semver on release.
- CD: merge to `main` → deploy to staging automatically; release tag → production deploy with manual approval; migrations executed before rollout with backup snapshot; health checks; rollback procedure.

### 18.2 Runtime topology (production)

| Component | Where | Notes |
|---|---|---|
| Reverse proxy (Caddy/Traefik) | App VM | Automatic TLS; routes `app.` → web, `api.` → api; rate limits at edge via Cloudflare |
| web (Next.js) | App VM (container, 1–2 replicas) | Stateless |
| api (NestJS) | App VM (container, 1–2 replicas) | Stateless; Socket.IO with Redis adapter |
| worker (NestJS) | App VM (container) | Queues; PDF rendering |
| execution worker | Execution VM (container) | Bridges queue → Judge0 |
| Judge0 (server, workers, its own PostgreSQL and Redis) | Execution VM | Private network only |
| PostgreSQL | Managed service | PITR backups |
| Redis | App VM (container) or managed | Persistence enabled for queues |
| Object storage | Cloudflare R2 | Private buckets |
| Video | Bunny/Cloudflare Stream | Token auth |
| Monitoring | Sentry, uptime monitor, metrics stack | Alerts to email/Slack |

### 18.3 Environment configuration

All configuration via environment variables validated at boot (`APP_ENV`, `DATABASE_URL`, `REDIS_URL`, `STORAGE_*`, `VIDEO_*`, `EMAIL_*`, `JWT_*`, `EXECUTION_URL`, `EXECUTION_TOKEN`, `AI_API_KEY`, `FEATURE_*` defaults); secrets from host secret store or CI secrets; `.env.example` documents every variable with description and example (no real values).

### 18.4 Operations runbooks (to be written in Phase 1 and extended per phase)

Deploy and rollback; database migration failure; restore from backup; rotate secrets; Judge0 upgrade and security test; queue backlog; provider outage (email/video/AI); incident response and communication; onboarding a new developer; monthly maintenance (dependency updates, image rebuilds, backup verification, log review).

### 18.5 Capacity and scaling path

Start: 1 app VM (4 vCPU/8 GB) + 1 execution VM (4 vCPU/8 GB) + managed PostgreSQL (2 vCPU/4 GB class) handles the assumed 5,000 students / 500 concurrent users **[A-10]**. Scale path: vertical first; then API replicas behind the proxy; then separate worker VM; add Judge0 workers; read replica for reports if needed. Nothing in the design prevents moving to Kubernetes later, but nothing requires it.

### 18.6 Service-level targets (proposed)

Availability 99.5% monthly for the app (excluding provider outages); p95 API latency < 300 ms for list endpoints and < 800 ms for dashboards; grading latency p95 < 10 s; support response for P1 incidents within 1 hour during business hours **[Q-03]**.

---
