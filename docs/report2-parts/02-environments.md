## 8. Local Development Environment

### 8.1 Prerequisites (all free)

| Tool | Version | Purpose | Notes |
|---|---|---|---|
| Git | current | Source control | Windows: enable `core.autocrlf=false`; repo ships `.gitattributes` with LF |
| Node.js | 22 LTS (pinned in `.nvmrc` / `.node-version`) | Runtime | Use `fnm` or `nvm-windows` |
| pnpm | 10 (pinned via `packageManager`) | Package manager, workspaces | `corepack enable` |
| Docker Engine + Compose v2 | current | Services | Docker Desktop (free within licence) or Rancher Desktop / Podman Desktop; on Windows use the WSL 2 backend and keep the repository inside the WSL filesystem for fast file watching |
| VS Code (or any editor) | — | Editor | Recommended extensions listed in `.vscode/extensions.json` |
| Playwright browsers | installed by `pnpm exec playwright install` | E2E | ≈ 500 MB |

### 8.2 Services in `docker compose` (profile `core` starts by default)

| Service | Image | Port (host) | Profile | Purpose | Data |
|---|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | core | Application database (+ pg-boss schema) | Named volume `pgdata` |
| `minio` | `minio/minio` (+ `mc` init job creating buckets) | 9000 (S3), 9001 (console) | core | S3-compatible file/video storage | Named volume `minio` |
| `mailpit` | `axllent/mailpit` | 1025 (SMTP), 8025 (UI) | core | Catches all outgoing email | Ephemeral |
| `adminer` | `adminer` | 8080 | tools | Database browser | — |
| `judge0-server`, `judge0-workers`, `judge0-db`, `judge0-redis` | `judge0/judge0:<pinned>` | 2358 | judge0 (Linux hosts only) | Optional trusted execution | Volumes |

The application processes (`web`, `api`, embedded worker) run **on the host** with hot reload during development; a `compose.app.yml` overlay also builds them as containers to verify the production images locally (`pnpm docker:up`).

### 8.3 Running everything locally

| Step | Command (proposed) | What happens |
|---|---|---|
| 1. Install | `pnpm install` | Installs all workspaces; Husky hooks installed |
| 2. Environment | `pnpm env:init` | Copies `.env.example` → `.env` for each app with local defaults (no secrets) |
| 3. Services | `pnpm services:up` (`docker compose --profile core up -d`) | PostgreSQL, MinIO (buckets created), Mailpit |
| 4. Database | `pnpm db:migrate` | Applies Prisma migrations (core, then overlay if `CLIENT_KEY` set) |
| 5. Seed | `pnpm db:seed` (base) and `pnpm db:seed:demo` | Roles, permissions, settings, taxonomies; then the demo institute, users, content |
| 6. Admin account | `pnpm cli users:create-admin --email admin@demo.local` | Creates a Super Admin (password printed once or taken from `SEED_ADMIN_PASSWORD`); demo seed also creates the demo accounts (§21) |
| 7. Run | `pnpm dev` | Turborepo starts `web` (http://localhost:3000) and `api` (http://localhost:4000, docs at `/api/docs`) with the worker embedded; SSE/WebSocket on the API port |
| 8. Email | open http://localhost:8025 | Every invitation, reminder and notification email appears in Mailpit |
| 9. Files | http://localhost:9001 | MinIO console (dev credentials from `.env`) |
| 10. Reset | `pnpm demo:reset` | Drops and recreates the database and buckets, re-runs migrations and seeds (guarded to local/staging only) |
| 11. Tests | `pnpm test`, `pnpm test:e2e` | Unit/integration/API; Playwright against the running stack |
| 12. Optional execution | `docker compose --profile judge0 up -d` (Linux) and `EXECUTION_DRIVER=judge0` | Trusted grading locally when the host supports it |

**Frontend**: Next.js dev server with Turbopack; reads `NEXT_PUBLIC_API_URL`; branding fetched from the API at boot and cached. **Backend**: Nest in watch mode; Prisma client generated on install; OpenAPI regenerated on start in development. **Workers**: `WORKER_MODE=embedded` runs pg-boss workers inside the API process; `WORKER_MODE=separate` runs `apps/worker`. **File storage**: presigned URLs point at `localhost:9000`. **Code execution**: `EXECUTION_DRIVER=browser-sandbox` by default. **Demo users**: created by the demo seed with well-known demo emails and a password from `SEED_DEMO_PASSWORD` (default only in local; must be set explicitly for staging).

### 8.4 Windows-specific notes

Docker Desktop with WSL 2; keep the repo under `\\wsl$` or a WSL path for file watching and Prisma performance; use Git Bash or WSL shell for scripts; line endings enforced by `.gitattributes`; Playwright runs on Windows natively; Judge0 is not supported on Windows Docker Desktop (cgroup requirements) — use the browser sandbox driver or a Linux VM.

---

## 9. Free Staging Environment

All facts below were checked against vendor pages or current reports in September 2026 (Appendix A) and will change; re-verify before relying on them. **Every option here is demo/staging grade, not production.**

### 9.1 Two viable topologies

**Option A — one free virtual machine running the Compose stack (recommended when a VM can be obtained).** Same images as local; Caddy provides HTTPS on a free subdomain; PostgreSQL, MinIO, Mailpit, API (embedded worker) and web all on the VM. Highest fidelity, no sleeping, real background jobs, WebSockets work. Risks: obtaining capacity, idle reclamation, single point of failure, Arm-only images (no Judge0), you are the operator (updates, backups).

**Option B — free-tier combination (fallback).** Web on Cloudflare Workers (via OpenNext) or Vercel Hobby; API on Render free web service in embedded-worker mode; PostgreSQL on Neon free; files on Cloudflare R2 free; email via Resend free; CI on GitHub Actions; monitoring on Sentry and UptimeRobot free tiers. Zero operations, but the API sleeps after inactivity, long-lived WebSockets are unreliable (use SSE), background jobs run only while the API is awake, and free databases have small caps or expiry.

### 9.2 Candidate services and their verified limits

| Service | Category | Classification | Verified limits and behaviour (Sept 2026) | Sleep / expiry | Data-loss risk | Suitable for |
|---|---|---|---|---|---|---|
| **Oracle Cloud Always Free** (Ampere A1 VM) | VM hosting | Free tier with limitations | Since 15 June 2026: **2 OCPU / 12 GB RAM** Arm (down from 4/24); instances over the new limit terminated from 18 Aug 2026; 200 GB block storage total; capacity frequently unavailable in popular regions | **Idle reclamation**: instance may be reclaimed if 95th-percentile CPU < 20% over 7 days (keep a light scheduled load or accept risk) | Medium (reclamation, no managed backups → script your own dumps to R2) | Staging/demo (Option A) |
| Google Cloud Always Free e2-micro | VM hosting | Free tier with limitations | 1 shared vCPU / 1 GB RAM / 30 GB disk, only in us-west1, us-central1, us-east1 | None, but 1 GB RAM is too small for the full stack (API + DB + MinIO); usable for the API alone | Low | Partial staging |
| AWS Free plan (new accounts) | VM/PaaS | Trial-only | Credit-based since July 2025: USD 100 credits (up to 200), **6 months**, account closes when exhausted | Expires | High after expiry | Short demos only |
| **Render** free web service | API hosting | Free tier with limitations | 750 free instance-hours/month per workspace; spins down after **15 minutes** without traffic, ~1 minute to wake; instance size not documented (small); no free background workers or cron; "do not use for production" | Sleeps | Low (stateless) | Option B API (embedded worker) |
| Render free PostgreSQL | Database | Free tier with limitations, **expires** | 1 GB; one per workspace; **expires 30 days after creation** (14-day grace) then deleted; no backups; no pooling | Expires | **High** | Not recommended (use Neon) |
| Render free Key Value (Redis) | Cache | Free tier | In-memory only, one per workspace, data lost on restart | Volatile | High | Not needed (pg-boss) |
| **Neon** free PostgreSQL | Database | Free tier with limitations | 0.5 GB storage per project, 100 CU-hours per project per month, up to 100 projects; compute auto-suspends when idle (cold start on first query) | Auto-suspend (seconds to resume) | Low (managed) but no PITR on free | Option B database; also Option A if the VM's disk is not trusted |
| Supabase free | Database/storage | Free tier with limitations | 2 projects, 500 MB DB, 1 GB file storage, 5 GB egress, 50,000 MAU; **paused after 7 days of inactivity**; no backups | Pauses (manual restore) | Medium | Alternative to Neon |
| **Cloudflare R2** | Object storage | Free tier with limitations | 10 GB-month storage, 1 M Class A and 10 M Class B operations per month, free egress; USD 0.015/GB-month beyond | None | Low | Files and demo videos (both options) |
| Backblaze B2 | Object storage | Free tier (verify) | Commonly 10 GB free storage; egress allowance limited | None | Low | Alternative |
| **Cloudflare Workers** (Next.js via OpenNext) | Web hosting | Free tier with limitations | 100,000 requests/day, 10 ms CPU per request, 128 MB memory, **3 MiB Worker bundle on the free plan** (10 MiB paid), static assets 20,000 files/25 MiB each | None | Low | Option B web (bundle size must be verified; fallback: Vercel or VM) |
| **Vercel Hobby** | Web hosting | Free tier with limitations, **non-commercial only** | Up to 1 M edge requests, 1 M function invocations, 4 CPU-hours, 100 deployments/day, 300 s function duration; usage pause of 30 days when exceeded; fair-use policy restricts Hobby to personal, non-commercial use | Pause on overage | Low | Personal demo only; a client demo may violate fair use — prefer Workers or VM |
| Netlify Free | Web hosting | Free tier with limitations | 300 credits/month (≈ 15 GB bandwidth or ≈ 20 deploys at 15 credits each); sites pause when credits run out; legacy accounts 100 GB/300 build minutes | Pause | Low | Static export only (not for SSR app) |
| Koyeb | PaaS | **No free tier** (Pro USD 29/month) | — | — | — | Not suitable |
| Railway | PaaS | Trial-only then paid | One-time USD 5 credit expiring in 30 days; Hobby USD 5/month | — | — | Not free |
| Fly.io | PaaS | **No free tier** | Free allowance discontinued Oct 2024; trial limited; Hobby USD 5/month | — | — | Not free |
| **Upstash Redis** | Cache/queue | Free tier with limitations | 500 K commands/month, 256 MB, 10 GB bandwidth, 1 database; BullMQ-style polling is not recommended | None | Low | Not needed with pg-boss |
| **Resend** | Email | Free tier with limitations | 3,000 emails/month, 100/day; Pro USD 20/month for 50,000 | None | — | Real inboxes in staging |
| Brevo | Email | Free tier with limitations | 300 emails/day | None | — | Alternative |
| Mailtrap | Email testing/sending | Free tier with limitations | Sending: 4,000 emails/month, 150/day, 1 domain; sandbox for testing | None | — | Alternative to Mailpit for hosted testing |
| Mailpit (self-hosted on VM) | Email testing | Fully free (OSS) | Unlimited catch-all; no real delivery | — | — | Option A default |
| **GitHub Actions** | CI/CD | Free tier with limitations | 2,000 minutes/month and 500 MB artifact storage for private repositories on GitHub Free; standard runners free for public repositories | — | — | CI for both options (keep pipelines lean; Linux runners only) |
| **Sentry** Developer | Error tracking | Free tier with limitations | 5 K errors/month, 5 M spans, 50 replays, 1 user, 30-day retention; Team from USD 26/month | — | — | Both options |
| **UptimeRobot** Free | Monitoring | Free tier, **non-commercial** since Dec 2024 | 50 monitors, 5-minute interval | — | — | Personal staging checks; commercial use needs a paid plan or a self-hosted Uptime Kuma (free) on the VM |
| Uptime Kuma (self-hosted) | Monitoring | Fully free (OSS) | Runs on the VM | — | — | Option A |
| DuckDNS / FreeDNS / sslip.io / nip.io | Domain | Fully free | Free subdomains (DuckDNS) or IP-based hostnames (sslip.io/nip.io); Let's Encrypt via Caddy works with DuckDNS | — | Low | Staging URL; a real domain is a client cost |
| Cloudflare Tunnel quick tunnel (`trycloudflare.com`) | Exposure | Fully free | Random URL, no account, not persistent; named tunnels need a domain | Non-persistent | — | Ad-hoc demos from a laptop |
| GitHub Codespaces | Cloud dev | Free allowance | Included hours per month on personal accounts (verify current allowance) | — | — | Optional |

### 9.3 Recommended staging plan

| Layer | Option A (VM) | Option B (free-tier combination) |
|---|---|---|
| Web | Next.js container behind Caddy | Cloudflare Workers via OpenNext (verify bundle ≤ 3 MiB compressed) or Vercel Hobby for **personal** demos only |
| API + jobs | API container, `WORKER_MODE=embedded` | Render free web service, `WORKER_MODE=embedded`; accept 15-minute sleep; add a free uptime ping every 10 minutes only if the vendor's terms allow keeping it awake (otherwise accept cold starts and say so in demos) |
| Database | PostgreSQL container with nightly `pg_dump` to R2 **or** Neon free | Neon free (0.5 GB) |
| Files/video | MinIO container or R2 free | R2 free |
| Email | Mailpit container (catch-all) or Resend free | Resend free |
| Real-time | Socket.IO/SSE | SSE |
| Domain/TLS | DuckDNS subdomain + Caddy Let's Encrypt | Vendor subdomains |
| CI/CD | GitHub Actions → build images → SSH deploy (`docker compose pull && up`) | GitHub Actions → vendor deploy hooks |
| Monitoring | Uptime Kuma + Sentry free | UptimeRobot (personal) + Sentry free |
| Execution | Browser sandbox only (Arm VM) | Browser sandbox only |

### 9.4 Classification summary

| Classification | Services |
|---|---|
| Fully free (open source, self-hosted) | PostgreSQL, MinIO, Mailpit, Caddy, Uptime Kuma, pg-boss, Judge0 CE (where a suitable host exists), all frameworks and libraries |
| Free tier with limitations | Oracle Always Free VM, GCP e2-micro, Render web service, Neon, Supabase, R2, B2, Cloudflare Workers, Vercel Hobby (non-commercial), Netlify, Upstash, Resend, Brevo, Mailtrap, GitHub Actions, Sentry, UptimeRobot (non-commercial) |
| Trial-only | AWS Free plan (6 months), Railway (USD 5 once), Fly.io trial |
| Paid after usage limits | Render, Neon, R2, Resend, Sentry, Workers, GitHub Actions (all continue at paid rates only if a payment method is added; otherwise they pause) |
| Not suitable for production | Every item in this section (sleeping services, expiring databases, no backups, single VM without redundancy, free-tier terms) |

### 9.5 Security limitations of free staging

Shared infrastructure, no private networking on PaaS free tiers, limited WAF, no guaranteed backups, single admin accounts on vendor consoles; therefore staging must hold **only synthetic demo data**, never real student data, and must be reset from seeds at will.

---

## 10. External Services and Cost Boundaries

### 10.1 Free and open-source development components (no cost to anyone)

Frameworks and libraries (Next.js, React, NestJS, Prisma, Zod, Tailwind, shadcn/ui, TanStack, TipTap, CodeMirror, Recharts, pg-boss, pino, Playwright, Vitest, Testcontainers, k6, axe); PostgreSQL; Docker Engine and Compose (Docker Desktop within its free licence terms, or Rancher/Podman Desktop); MinIO; Mailpit; Caddy; Uptime Kuma; Judge0 CE and Pyodide; Git and GitHub free plan; VS Code.

### 10.2 External services that create costs (client-owned)

| Service | When it becomes necessary | Typical owner cost driver |
|---|---|---|
| Domain and DNS | Any client-facing deployment | Annual domain fee |
| Production hosting (VMs or PaaS) | Production | Monthly compute |
| Managed PostgreSQL with backups | Production | Monthly, by size |
| Object storage beyond free tier | Production or large libraries | Per GB-month |
| Video hosting (Bunny, Cloudflare Stream) | When adaptive streaming/protection is required | Storage and delivery minutes/GB |
| Email provider beyond free tier | Production volumes | Per 1,000 emails |
| SMS/OTP provider and DLT registration | If OTP login or SMS alerts are wanted | Per SMS + registration |
| WhatsApp Business API | If WhatsApp alerts are wanted | Per conversation |
| Live-class provider (Zoom/Meet licences and API) | Live classes | Per host licence |
| AI API (Anthropic Claude) | AI features enabled | Per token |
| Code-execution infrastructure (Judge0 host or Judge0 Cloud) | Trusted grading in production | VM or subscription |
| Monitoring beyond free tiers (Sentry Team, uptime, logs) | Production | Monthly |
| Paid design assets, fonts, stock media | If chosen by the client | One-off |
| Premium integrations (proctoring, payment gateway fees) | If scoped | Per use |

### 10.3 Cost boundary statement

**External service accounts, subscriptions, API usage, hosting charges, domain charges and production infrastructure costs will be owned and paid for by the client unless separately agreed in writing.** Accounts for such services are to be created in the client's name with the developer granted delegated access. **AI and code-execution services must not be silently included in the developer's personal expenses**: they are enabled only when the client provides the account or key and approves the budget, and the platform's flags keep them off until then. During the local demo and free staging stages, no paid service is required; where a free tier is used, its limits and terms (including non-commercial clauses) are documented in §9 and must be respected.

---
