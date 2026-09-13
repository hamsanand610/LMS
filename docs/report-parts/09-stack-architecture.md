## 12. Recommended Technology Stack

### 12.1 Summary

| Layer | Recommendation | Version guidance (September 2026) |
|---|---|---|
| Language | TypeScript end to end | TypeScript 5.x (current stable at setup) |
| Runtime | Node.js LTS | Node 22 LTS (or 24 LTS) — pin in `.nvmrc` and Docker images |
| Frontend | Next.js (App Router) + React | Next.js 16 (active LTS line 16.3.x; 15.5.x is maintenance LTS) |
| Styling / components | Tailwind CSS v4 + shadcn/ui (Radix primitives) + Lucide icons | current |
| Data fetching / state | TanStack Query (server state) + small client stores (Zustand) only where needed | current |
| Forms / validation | React Hook Form + Zod (schemas shared with the API) | current |
| Editors | CodeMirror 6 (code), TipTap (rich text) | current |
| Video playback | Provider player or hls.js | current |
| Backend | NestJS (modular monolith) + separate worker process | NestJS 12 (ESM, Standard Schema validation — Zod works natively) |
| ORM / migrations | Prisma ORM | Prisma 7 line (TypeScript runtime); evaluate Prisma 8 once GA; never use dev builds |
| Database | PostgreSQL | 17 or 18 (managed service version) |
| Cache / queues / rate limits | Redis (or Valkey) + BullMQ | Redis 7/8 |
| Object storage | S3-compatible: Cloudflare R2 (production), MinIO (local) | — |
| Video hosting | Bunny Stream (primary candidate) or Cloudflare Stream | — |
| Email | Resend (or Amazon SES) | — |
| SMS / WhatsApp (optional) | MSG91 or Twilio (SMS, DLT-registered), Meta WhatsApp Cloud API via a BSP | — |
| Code execution | Judge0 CE self-hosted on an isolated VM (Judge0 Cloud as fallback) | pinned release |
| AI | Anthropic Claude API via official TypeScript SDK | `claude-opus-5` default; `claude-sonnet-5` as cost option |
| Auth | Own implementation in NestJS (Argon2id, JWT + rotating refresh) — no third-party identity SaaS required | — |
| Real-time | WebSocket (Socket.IO) or SSE for notifications and submission status | — |
| Infrastructure | Docker + Docker Compose; Caddy or Traefik for TLS; Cloudflare DNS/proxy | — |
| CI/CD | GitHub Actions; images to GHCR; SSH deploy with health checks | — |
| Monitoring | Sentry (errors), Uptime Kuma or Better Stack (uptime), OpenTelemetry + Grafana stack or Axiom (optional) | — |
| Testing | Vitest (unit), Supertest (API), Playwright (E2E), k6 (load), axe (a11y) | — |

### 12.2 Frontend

| Decision | Recommendation | Alternatives considered | Why | Trade-offs |
|---|---|---|---|---|
| Framework | **Next.js 16** (App Router, React Server Components, React Compiler stable) | Vite + React Router SPA (as the reference uses); Remix/React Router v7; Nuxt/Vue; SvelteKit | Largest ecosystem, server rendering for fast first paint on phones, built-in routing/layouts, image optimisation, streaming, easy PWA; team hiring pool; Vercel-independent (self-hosted in Docker). | Heavier mental model than a plain SPA; must be disciplined about client/server boundaries. A plain Vite SPA is acceptable if the team strongly prefers it, but loses SSR benefits. |
| Language | TypeScript strict | JavaScript | Shared types with API, fewer runtime bugs. | Slightly slower initial development. |
| UI library | **shadcn/ui** (copied Radix-based components, Tailwind styled) | MUI, Ant Design, Chakra, Mantine | Owns the code (no vendor lock), accessible primitives, themeable with tokens, light bundle. | Components are maintained in-repo (an advantage for customisation, a cost for upgrades). Ant Design would give richer tables faster but heavier bundles and harder theming. |
| Styling | **Tailwind CSS v4** with design tokens as CSS variables | CSS Modules, styled-components, vanilla-extract | Fast, consistent, works with shadcn, no runtime CSS-in-JS cost. | Verbose class lists; mitigated by component extraction. |
| State | **TanStack Query** for server state; URL for filters; Zustand for a few client stores (editor, test attempt buffer) | Redux Toolkit, MobX, Jotai | Most state is server data; avoids boilerplate. | Must design query keys and invalidation carefully. |
| Forms/validation | **React Hook Form + Zod**; Zod schemas in `packages/shared` reused by NestJS | Formik + Yup | Single validation source of truth; type inference. | — |
| Data fetching | Generated typed client from the OpenAPI spec (openapi-typescript + fetch wrapper) | Manual fetches; tRPC | Contract-first, works with a separate API; tRPC would couple web and API deployments. | Regeneration step in CI. |
| Tables | TanStack Table | AG Grid (commercial features), MUI DataGrid | Headless, server-side pagination, free. | More assembly. |
| Charts | Recharts or Apache ECharts | Chart.js, Nivo | Declarative, responsive, themeable. | — |
| Code editor | **CodeMirror 6** | Monaco (VS Code editor) | Much lighter (important for phones and low bandwidth), good touch support, extensible, themeable. Monaco offers richer IntelliSense but is ~10× heavier and poor on mobile. | Less "VS Code feel"; acceptable for practice problems. Monaco can be offered later as a desktop-only option. |
| Accessibility | Radix primitives, axe in CI, ESLint jsx-a11y | — | Baseline AA without bespoke work. | — |
| Video | Provider embed/player (Bunny/Cloudflare) with hls.js fallback | Video.js, Plyr | Providers include adaptive bitrate, token auth, analytics. | Provider lock-in mitigated by an adapter. |

### 12.3 Backend

| Decision | Recommendation | Alternatives considered | Why | Trade-offs |
|---|---|---|---|---|
| Framework | **NestJS 12** as a *modular monolith* (one codebase, feature modules) plus a separate **worker process** for queues | Express/Fastify hand-rolled; Fastify + plugins; Django/DRF (Python); Laravel; Spring Boot; Next.js route handlers only | Opinionated module/DI structure keeps a growing codebase organised for a small team; first-class guards/interceptors for RBAC, validation, logging; OpenAPI generation; WebSocket gateway; queues; ESM and Standard Schema in v12 let Zod be the single validation layer. A Python/Django stack is viable but splits the team across two languages. Next.js-only would put long-running jobs, WebSockets and the execution pipeline in the wrong place. | More abstraction than a minimal Fastify app; learning curve for decorators. |
| API architecture | REST + JSON under `/api/v1`, OpenAPI 3.1 generated from code, SSE/WebSocket for real-time | GraphQL, tRPC, gRPC | Simple to cache, test, document and consume from future mobile apps; GraphQL adds complexity without a clear need. | Some over-fetching; mitigated by purpose-built aggregate endpoints (dashboard). |
| Business logic organisation | Feature modules (`auth`, `users`, `batches`, `courses`, `assignments`, `tests`, `execution`, `placement`, …) each with controller → service → repository (Prisma) and domain events via an in-process event bus; cross-module calls only through service interfaces | Clean architecture with strict layers; CQRS | Right-sized for 2–3 developers; clear seams for later extraction of `execution` or `ai` into services. | Requires discipline to avoid cross-module imports of repositories (lint rule). |
| Authentication | Own implementation: Argon2id, JWT access (15 min) + rotating refresh tokens (httpOnly cookie), server-side session records, OTP adapter | Auth0/Clerk/Keycloak, NextAuth/Auth.js, Supabase Auth | No per-user SaaS cost; full control of invite-based onboarding, OTP and audit; Keycloak is heavy for this size. | Must implement carefully (covered by tests and §16). |
| Authorization | Permission-based RBAC with scopes (§7) implemented as NestJS guards + service scope filters | CASL library, OPA | Simple, testable, explicit. CASL can be adopted inside the same design if rules grow. | — |
| Validation | Zod schemas (shared package) via NestJS 12 Standard Schema pipes | class-validator DTOs | One schema for client and server; better inference. | — |
| Error handling | RFC 9457 `application/problem+json` responses; global exception filter; typed domain errors | Ad-hoc JSON | Consistent client handling. | — |
| Logging | Structured JSON logs (pino) with request IDs, user ID, route; log levels per environment; no PII in logs | Winston | Fast, JSON-native. | — |
| Background jobs | **BullMQ** on Redis: queues for execution, emails, exports, aggregation, reminders, certificates; cron via BullMQ repeatable jobs | Agenda, Temporal, cron containers | Mature, Nest integration, retries, dead-letter, dashboard (Bull Board). | Redis becomes a critical dependency (it already is for sessions/rate limits). |
| Real-time | Socket.IO gateway (notifications, submission status, test monitor) with Redis adapter | SSE only, Pusher/Ably | Bi-directional, scales with Redis; SSE is a simpler fallback for submission status. | Sticky sessions or Redis adapter needed when scaling API replicas. |
| PDF generation | Headless Chromium (Playwright) in the worker for certificates and PDF reports; exceljs for XLSX | pdf-lib, wkhtmltopdf | HTML templates reuse the design system. | Chromium image size; run only in worker. |

### 12.4 Database

| Decision | Recommendation | Alternatives | Why | Trade-offs |
|---|---|---|---|---|
| Engine | **PostgreSQL** | MySQL/MariaDB, MongoDB | Relational integrity for enrolments, attempts and pipelines; JSONB for flexible content; full-text search; window functions for reports; ubiquitous managed offerings. MongoDB (which the reference appears to use judging by its IDs) trades integrity for flexibility, which this domain does not need. | — |
| ORM | **Prisma ORM 7** | Drizzle ORM (1.0 still release-candidate as of mid-2026), TypeORM, MikroORM, Kysely | Type-safe client, first-class migrations, mature ecosystem and docs; Prisma 7 removed the Rust engine (smaller, faster). Drizzle is excellent and closer to SQL; revisit once 1.0 is stable if the team prefers it. TypeORM has decorator-heavy pitfalls. | Complex reporting queries use raw SQL (`$queryRaw`) or SQL views — acceptable and planned. |
| Schema design | Normalised core with JSONB for polymorphic content (question payloads, profile sections, lesson blocks) validated by Zod at the boundary | Fully normalised or fully document | Balance between integrity and flexibility. | JSONB fields need explicit versioning. |
| Relationships | Foreign keys everywhere with `ON DELETE RESTRICT` by default; soft-delete flags for user-facing entities | Cascades | Prevents accidental data loss. | Cleanup jobs needed. |
| Indexing | Composite indexes for scope queries (batch_id, student_id), partial indexes for active rows, GIN for JSONB/tsvector, covering indexes for leaderboards/aggregates | — | Query plans reviewed for the 20 heaviest queries before launch. | — |
| Migrations | Prisma Migrate, reviewed in PRs, applied by CI/CD before rollout, backward-compatible (expand/contract) | Manual SQL | Version-controlled, repeatable. | Discipline required for zero-downtime changes. |
| Transactions | Prisma interactive transactions for multi-row writes (enrolment, attempt submit, stage change); idempotency keys for client retries | — | Consistency. | — |
| Audit history | Append-only `audit_logs` written by a service interceptor for mutations plus explicit calls for domain events; before/after JSON diffs for sensitive tables; optional temporal tables later | DB triggers | Application-level gives context (actor, request ID). | Must be enforced by tests. |

### 12.5 Infrastructure

| Area | Recommendation | Alternatives | Why | Cost note (verify at procurement) |
|---|---|---|---|---|
| Local development | Docker Compose: `postgres`, `redis`, `minio`, `mailpit`, `judge0` (server, workers, db, redis); apps run with hot reload; one `make dev`/`pnpm dev` command; seed data | Local installs | Same services as production; new developer ready in hours. | Free |
| Environment management | `.env` files per environment from `.env.example`, validated at boot with Zod (fail fast); secrets injected by the host (Docker secrets / CI secrets), never committed | dotenv-vault, SOPS | Simple and safe. | Free |
| Production hosting | **Two VMs** (app: 4 vCPU/8 GB; execution: 4 vCPU/8 GB) running Docker Compose behind Caddy/Traefik with automatic TLS; Cloudflare in front (DNS, proxy, WAF basics, Turnstile) | Single VM (cheapest, execution not isolated — not recommended); PaaS (Railway/Render/Fly: simpler, 2–4× cost, execution host still needed); Kubernetes (over-engineering for this size) | Cheapest robust option; execution isolation by host; scales vertically first, then horizontally by adding API replicas. | Hetzner shared CX plans were €5.49–€15.99/month (June 2026 list) but were marked unavailable for new orders in September 2026; DigitalOcean (Bangalore region), AWS Lightsail (Mumbai) or Hetzner dedicated-vCPU plans are the alternatives — roughly USD 24–60 per VM per month at this size **[Q-04]**. |
| Database hosting | **Managed PostgreSQL** (Neon, DigitalOcean Managed DB, Supabase DB, or AWS RDS) with automated backups and point-in-time recovery; self-managed in Docker with pgBackRest/wal-g backups to R2 as the budget option | — | Backups and failover are the riskiest thing to self-manage with a small team. | Neon Launch plan: USD 0.106 per CU-hour and USD 0.35 per GB-month (Sept 2026); DO managed from ~USD 15/month; self-managed = VM cost only. |
| Object storage | **Cloudflare R2** | AWS S3, Backblaze B2, DigitalOcean Spaces, MinIO self-hosted | S3-compatible with free egress (videos and resources are download-heavy). | USD 0.015/GB-month storage, Class A USD 4.50/million, Class B USD 0.36/million, egress free; 10 GB free (Sept 2026). |
| Video | **Bunny Stream** (primary candidate) or **Cloudflare Stream** | Mux, Vimeo OTT, YouTube unlisted (interim only), self-hosted HLS | Hosted transcoding, adaptive streaming, token-protected playback, India edge presence. | Bunny Stream (search-verified, confirm on vendor page): ~USD 0.005/GB delivered, ~USD 0.01/GB storage, USD 1 monthly minimum, standard encoding included. Cloudflare Stream: USD 5 per 1,000 minutes stored per month and USD 1 per 1,000 minutes delivered. Example: 500 hours of recordings ≈ 30,000 minutes → Cloudflare ≈ USD 150/month storage + delivery; Bunny would typically be far lower for the same library (storage by GB). |
| Background jobs | BullMQ workers in the `worker` container; separate execution worker on the execution VM | — | Isolation and independent scaling. | Included in VM cost |
| Caching | Redis for sessions, permissions, rate limits, dashboard aggregates; HTTP caching for public assets via Cloudflare | — | — | Included |
| Monitoring | Sentry (errors, performance) free/low tier; Uptime Kuma (self-hosted) or Better Stack for uptime and alerting; container metrics via cAdvisor + Prometheus + Grafana or a hosted alternative (Axiom/Grafana Cloud free tiers) | Datadog (expensive) | Enough visibility at low cost. | Free–USD 30/month |
| Backups | Managed DB PITR (or nightly base + WAL to R2), object storage versioning for critical buckets, weekly restore drill in staging, configuration in Git | — | Recovery objectives: RPO ≤ 15 min (managed) / ≤ 24 h (self-managed nightly), RTO ≤ 4 h. | Included/low |

### 12.6 Integrations

| Integration | Recommendation | Alternatives | Notes |
|---|---|---|---|
| Email | Resend (developer-friendly, free 3,000 emails/month with 100/day; Pro USD 20/month for 50,000) or Amazon SES (cheapest at volume) | Postmark, SendGrid, Brevo | Transactional only; domain authentication (SPF/DKIM/DMARC) required. |
| Notifications (push/SMS/WhatsApp) | Optional: Web Push (free, self-implemented); MSG91/Twilio SMS after DLT registration; WhatsApp via Meta Cloud API through a BSP | — | Costs per message; keep as Optional integration behind adapters. |
| Video hosting | See §12.5 | — | Adapter interface: upload/ingest, status, signed playback, delete. |
| Live classes | Links to Zoom/Google Meet (MVP); Zoom API/SDK for auto-create meetings, join logs and cloud recordings (Optional integration) | Jitsi self-hosted (free but ops), 100ms/Dyte (paid SDKs) | Zoom/Meet licences are the client's existing cost **[Q-11]**. |
| Payment gateway | Not in scope; if added: Razorpay (2% per domestic transaction, no setup or annual fee, 18% GST on fees; international up to 3%) | Cashfree, PayU, Stripe India | **[Q-07]** |
| AI services | Anthropic Claude API (official TypeScript SDK); models: `claude-opus-5` (USD 5 input / USD 25 output per million tokens), `claude-sonnet-5` (USD 2 / USD 10), `claude-haiku-4-5` (USD 1 / USD 5) as of the June 2026 price table; prompt caching for stable prefixes; streaming; refusal fallbacks | OpenAI, Google Gemini, open-weight models self-hosted | Server-side only; per-mode model selection; usage accounting; budget alerts **[Q-20]**. |
| Code execution | Judge0 self-hosted; Judge0 Cloud fallback (see §10.3) | Piston | — |
| Analytics | PostHog (self-hosted or cloud free tier) or GA4 for product analytics, consent-gated | Plausible | Optional. |
| Calendar | iCal feed per user (Standard); Google Calendar sync (Advanced) | — | — |
| Support | In-app "report an issue" + email; optional chat widget (Crisp/Zoho) behind consent | — | — |
| Source control / CI | GitHub + GitHub Actions; Dependabot/Renovate; CodeQL | GitLab | — |

### 12.7 Why not other popular choices

- **Firebase/Supabase as the whole backend.** Fast to start, but complex RBAC, background pipelines (execution, grading, exports) and reporting push logic into functions and policies that are harder to test and to reason about; vendor lock-in.
- **Microservices from day one.** Operational overhead for 2–3 people; the modular monolith gives the same seams without the cost; only `execution` (and later `ai`) are separate processes by necessity.
- **MongoDB.** Flexible, but attempts, enrolments, pipelines and reports are relational and benefit from constraints and joins.
- **Low-code/no-code LMS platforms.** Cannot model batches, coding labs and placement pipelines; per-seat costs.

---

## 13. System Architecture

### 13.1 High-level architecture

```
                         ┌──────────────────────────── Cloudflare (DNS, proxy, WAF, TLS edge) ────────────────────────────┐
                         │                                                                                                 │
   Students / Trainers   │   https://app.example.com            https://api.example.com                                    │
   Admins / Placement ───┼──────────────┐                              │                                                   │
   (browsers, PWA)       │              ▼                              ▼                                                   │
                         │   ┌────────────────────┐        ┌─────────────────────────┐        ┌─────────────────────────┐  │
                         │   │  web (Next.js)     │ ─────► │  api (NestJS)           │ ◄────► │  redis (cache, queues,  │  │
                         │   │  SSR + static      │  REST  │  REST /api/v1, OpenAPI  │        │  sessions, rate limits) │  │
                         │   └────────────────────┘        │  WebSocket gateway      │        └───────────┬─────────────┘  │
                         │                                 │  RBAC, validation, audit│                    │                │
                         │                                 └───────┬─────────┬───────┘                    │                │
                         │                                         │         │                            │                │
                         │                              ┌──────────▼──┐   ┌──▼──────────────────┐   ┌─────▼──────────────┐ │
                         │                              │ PostgreSQL  │   │ Object storage (R2) │   │ worker (NestJS)    │ │
                         │                              │ (managed)   │   │ private buckets,    │   │ email, exports,    │ │
                         │                              └─────────────┘   │ presigned URLs      │   │ aggregation,       │ │
                         │                                                └─────────────────────┘   │ reminders, PDFs,   │ │
                         │    External providers: video (Bunny/CF Stream), email (Resend), SMS/WA,  │ AI jobs, execution │ │
                         │    Zoom/Meet links, Claude API, Sentry                                     │ dispatch           │ │
                         │                                                                            └─────────┬──────────┘ │
                         └──────────────────────────────────────────────────────────────────────────────────────┼───────────┘
                                                                                                                │ private network only
                                                                                          ┌─────────────────────▼──────────────────┐
                                                                                          │ Execution VM (isolated)                │
                                                                                          │ Judge0 server + workers (isolate)      │
                                                                                          │ SQL runner (Standard)                  │
                                                                                          │ no DB/storage credentials, no inbound  │
                                                                                          └────────────────────────────────────────┘
```

### 13.2 Frontend architecture

- **Monorepo package `apps/web`** (Next.js App Router). Route groups: `(public)`, `(auth)`, `(student)`, `(trainer)`, `(admin)`, `(placement)`, each with its own layout (shell, navigation, guards).
- **Server components** for data-heavy read pages (dashboards, lists) fetching through the typed API client with the user's session cookie; **client components** for interactive surfaces (editors, test attempt, forms, charts).
- **Data layer**: generated OpenAPI client; TanStack Query for client-side caching/mutations; optimistic updates only for reversible actions; SSE/WebSocket hooks for submission status and notifications.
- **Design system package `packages/ui`**: tokens, Tailwind preset, shadcn components, app-specific composites (DataTable, PageHeader, StatTile, StatusChip, EmptyState, Timer, CodeEditor, VideoPlayer).
- **Shared package `packages/shared`**: Zod schemas, TypeScript types, enums (roles, permissions, statuses), constants, utilities (IST date formatting).
- **Performance**: route-level code splitting; editors lazy-loaded; images via Next image; bundle budget checks in CI (student routes < 250 KB gzipped JS initial).
- **PWA**: manifest, service worker for shell caching and push subscription (Optional).

### 13.3 Backend architecture

- **`apps/api`** (NestJS): modules — `auth`, `rbac`, `users`, `students`, `trainers`, `batches`, `courses`, `files`, `sessions` (live), `attendance`, `questions`, `assignments`, `tests`, `execution`, `practice`, `projects`, `certificates`, `feedback`, `placement`, `profile`, `notifications`, `announcements`, `reports`, `search`, `gamification`, `ai`, `settings`, `audit`, `health`. Each module: `*.controller.ts` (HTTP), `*.service.ts` (business rules), `*.repository.ts` (Prisma access), `*.events.ts` (domain events), `dto/` (Zod schemas from shared), `*.spec.ts`.
- **Cross-cutting**: global exception filter (problem+json), validation pipe (Zod), auth guard, permission/scope guard, audit interceptor, request-ID middleware, rate-limit guard (Redis), OpenAPI decorators.
- **Domain events** (in-process event emitter) decouple modules: e.g. `lesson.completed` → progress, gamification, certificates; `submission.graded` → progress, gamification, notifications; `application.stage_changed` → notifications, reports.
- **`apps/worker`** (NestJS standalone context) consumes BullMQ queues: `execution`, `email`, `notifications`, `exports`, `aggregation`, `reminders`, `pdf`, `ai`, `imports`, `privacy`. Repeatable jobs: nightly aggregates, reminder scans, streak calculation, cleanup.
- **Execution adapter** wraps Judge0's API; a second adapter for Judge0 Cloud allows switching by configuration.

### 13.4 Database architecture

Single PostgreSQL database with schemas: `app` (operational tables), `reporting` (aggregate tables and materialised views), `audit` (append-only). Read replicas are not needed initially; heavy reports use aggregates and off-peak jobs. Connection pooling via PgBouncer (or the managed provider's pooler). Retention: activity events partitioned by month after volume grows (Standard).

### 13.5 Authentication and authorization architecture

Described in F-01/F-02 and §7: stateless access JWT validated by the API, refresh rotation with server-side session table, Redis-cached permissions, guards and scope filters, audited changes, optional OTP and two-factor adapters.

### 13.6 File storage architecture

Presigned direct uploads from the browser to the private bucket (multipart for large files); registry table in PostgreSQL; downloads via short-lived presigned URLs issued after permission checks; video files go to the video provider (direct upload with provider tokens) and only metadata is stored; export files and certificates are written by the worker; lifecycle rules delete expired exports; optional antivirus scanning queue.

### 13.7 Background-job architecture

BullMQ queues with concurrency per queue, retries with exponential backoff, dead-letter handling and alerts, job idempotency keys, Bull Board UI restricted to Super Admin, metrics exported. Long jobs report progress (imports, exports) to the notification centre.

### 13.8 Notification architecture

Notification service creates records and fans out to channel adapters (in-app via WebSocket, email via provider, optional SMS/WhatsApp/push) based on preferences and template; digests batch non-urgent items; announcements are a separate targeted table rendered on dashboards.

### 13.9 Coding-execution architecture

See §10.4–10.6.

### 13.10 Logging and monitoring architecture

Structured logs from web, api, worker and Judge0 shipped by the Docker logging driver to a log store (Loki or hosted); Sentry for exceptions and traces; health endpoints (`/health/live`, `/health/ready`) checked by the reverse proxy and uptime monitor; metrics (request latency, queue depth, DB pool, execution latency) via OpenTelemetry to Prometheus/Grafana or a hosted service; alerts to email/Slack for error spikes, queue backlog, disk usage, failed backups.

### 13.11 Deployment architecture and environments

| Environment | Purpose | Infrastructure | Data |
|---|---|---|---|
| Local | Development | Docker Compose on the developer machine; hot reload; Mailpit; MinIO; local Judge0 | Seed data (fake students, courses, questions); no production data |
| Staging | Integration, UAT, load and security tests | Same images as production on a smaller VM (or the same VM with separate compose project); staging database and buckets; sandbox provider accounts | Anonymised subset or seed data; refreshed on demand |
| Production | Live | App VM + Execution VM + managed PostgreSQL + R2 + providers; Cloudflare | Real data; backups; audit |

Promotion: `main` → staging automatically on merge; production by tagged release with manual approval; migrations run before app rollout; health checks gate traffic; rollback = previous image tag plus backward-compatible migrations.

### 13.12 Component communication summary

| From → To | Protocol | Notes |
|---|---|---|
| Browser → web | HTTPS | SSR pages, static assets |
| Browser → api | HTTPS JSON (`/api/v1`), WebSocket/SSE | Cookie session; CSRF token on mutations |
| web (server) → api | HTTP (internal network) | Forwarded session cookie; short timeouts |
| api → PostgreSQL | TCP (pooled) | Prisma |
| api/worker → Redis | TCP | Cache, queues, pub/sub |
| api ↔ worker | BullMQ jobs and Redis pub/sub events | No direct HTTP |
| worker → Judge0 | HTTP on private network | API token; no public exposure |
| api/worker → providers | HTTPS | Adapters with timeouts, retries, circuit breakers |
| Browser → object storage / video provider | HTTPS presigned/tokenised | Never with long-lived credentials |

---
