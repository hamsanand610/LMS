## 25. Risks and Mitigation

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| DR-01 | Free VM (Oracle) unobtainable due to capacity, or reclaimed as idle; free-tier limits change | High | Medium | Keep Option B ready; deployment is vendor-agnostic Docker; scheduled light activity on the VM within terms; re-verify limits monthly |
| DR-02 | Vercel Hobby or UptimeRobot non-commercial terms conflict with a client demo | Medium | Low | Prefer Cloudflare Workers/VM and Uptime Kuma; document terms |
| DR-03 | Next.js bundle exceeds Workers free-plan size | Medium | Low | Measure early (Phase 1); fallback to VM or Vercel (personal) |
| DR-04 | Render free API sleeps during a demo | High | Low | Warm the service before demos; state it; prefer Option A for client demos |
| DR-05 | Browser-sandbox execution misunderstood as production-grade grading | Medium | Medium | Trust badges, docs, and the roadmap item for Judge0 |
| DR-06 | pg-boss load on PostgreSQL at scale | Low | Low | Scale target small; BullMQ driver documented; queue interface |
| DR-07 | Scope creep from the master catalogue into the demo | High | High | Demo scope table (§12) and flags; changes through backlog and §28 |
| DR-08 | White-label overlay misuse (clients editing core) | Medium | High | Lint rules, SDK boundaries, CI check that `apps/` and `packages/` are unchanged in client branches, upgrade validator |
| DR-09 | Design-token theming producing inaccessible colour combinations | Medium | Medium | Contrast validation on save; derived neutrals; dark theme generated with checks |
| DR-10 | Test attempt engine correctness under concurrency | Medium | High | Server-authoritative design; fake-clock tests; k6 smoke |
| DR-11 | Sample videos and content quality for demos | Medium | Medium | Curate open-licensed sample media early; client content is client's responsibility |
| DR-12 | Single-developer bus factor | Medium | High | Documentation, ADRs, runbooks, conventional structure, tests |
| DR-13 | Framework/ORM major changes during build (Prisma 8 GA, Next.js updates) | Medium | Medium | Pin versions at Phase 1; upgrade only between phases with ADR |
| DR-14 | Free email tiers throttle demo invitations | Low | Low | Mailpit for demos; Resend only when real inboxes matter |
| DR-15 | Demo data leaks real details by accident | Low | High | Synthetic data only; review seeds; no client data in staging |

---

## 26. Cost and Feasibility Analysis

### 26.1 Local demo

| Item | Tool | Cost |
|---|---|---|
| Development tools | VS Code, Node, pnpm, Git | 0 |
| Database | PostgreSQL in Docker | 0 |
| Docker | Docker Engine; Docker Desktop free under its personal/small-business terms (or Rancher/Podman Desktop) | 0 |
| Storage | MinIO in Docker | 0 |
| Email testing | Mailpit | 0 |
| Testing tools | Vitest, Playwright, Testcontainers, k6, axe | 0 |
| Code execution | Browser sandbox (Pyodide/JS); Judge0 CE optional on Linux | 0 |
| **Total** | | **0 (developer time only)** |

### 26.2 Free staging (within limits; demo-grade only)

| Layer | Option A (VM) | Option B (free tiers) | Cost |
|---|---|---|---|
| Frontend | Container on VM | Cloudflare Workers free (or Vercel Hobby, personal use) | 0 |
| Backend | Container on VM | Render free (sleeps) | 0 |
| Database | PostgreSQL container (+ dumps to R2) or Neon free | Neon free (0.5 GB) | 0 |
| Storage | MinIO or R2 free | R2 free (10 GB) | 0 |
| CI/CD | GitHub Actions (2,000 min/month private; public repos free) | same | 0 |
| Monitoring | Uptime Kuma + Sentry Developer | UptimeRobot (personal) + Sentry Developer | 0 |
| Domain/subdomain | DuckDNS subdomain + Let's Encrypt | Vendor subdomains | 0 (real domain is client-owned, ≈ USD 10–15/year) |
| Email | Mailpit or Resend free (3,000/month) | Resend free | 0 |
| **Total** | | | **0 within limits**; risks in §9 |

### 26.3 Future production (client-owned; indicative, from master §20.2, verify at procurement)

| Item | Indicative monthly cost | Notes |
|---|---|---|
| Hosting (app VM + execution VM) | USD 50–120 | Or PaaS at 2–4× |
| Managed PostgreSQL | USD 15–80 | PITR backups |
| Object storage | ≈ USD 8 per 500 GB | R2, free egress |
| Video hosting | USD 40–120 (per-GB model) or far more on per-minute delivery pricing | Depends on viewing hours |
| Email | USD 0–20 | Resend Pro at 50k |
| SMS/OTP | Provider-specific + DLT registration | Optional |
| AI (if enabled) | Budget-driven; see master §20.2 sensitivity (≈ USD 750–5,250 for 300k messages/month depending on model and caching) | Quotas control spend |
| Code execution | USD 0 beyond execution VM (self-hosted) or Judge0 Cloud €27–107 | Optional |
| Backups | Included in managed DB; storage for dumps | — |
| Monitoring | USD 0–30 | Sentry Team USD 26 if needed |
| Domain | ≈ USD 10–15/year | — |
| Maintenance | Developer retainer (separate agreement) | — |
| **Typical total without AI and SMS** | **≈ USD 100–300/month** | Master §20.2 |

### 26.4 Separation of cost types

| Type | Examples | Owner |
|---|---|---|
| Developer effort | Phases 0–6 (12–16 weeks for two engineers), future phases | Per engagement agreement |
| Infrastructure cost | Hosting, database, storage, backups, monitoring | Client (production); free tiers in staging |
| Third-party recurring cost | Video, email, SMS, AI, execution cloud | Client |
| Client-owned cost | Domain, accounts, licences (Zoom/Meet), design assets | Client |
| Optional feature cost | AI, labs execution VM, proctoring, payments | Client, only when enabled |

Free-tier staging is not a guarantee of production readiness; production must follow master §18.

---

## 27. Open Questions

Demo-specific questions (answers change the demo plan):

| ID | Question | Proposed default | Needed by |
|---|---|---|---|
| DQ-01 | Which staging option do you prefer, A (free VM, fuller fidelity, you or the developer operate it) or B (free-tier combination, zero operations, sleeping API)? | A if an Oracle Always Free instance can be created; otherwise B | Phase 1 |
| DQ-02 | Do you accept the browser-sandbox execution prototype (JavaScript and Python only, untrusted results) for the demo, with Judge0 as a later step? | Yes | Phase 4 |
| DQ-03 | Is the pg-boss (no Redis) default acceptable for the template, with Redis/BullMQ as a documented scale option? | Yes | Phase 1 |
| DQ-04 | Do you want Placement Coordinator and Content Manager visible as roles in the demo (seeded, no portal), or hidden entirely? | Visible (shows configurability) | Phase 2 |
| DQ-05 | Should the demo brand be a neutral fictional institute ("Demo Institute") or your own brand? | Neutral; a second overlay can show your brand in minutes | Phase 1 |
| DQ-06 | Demo video source: small open-licensed sample clips in storage, or your own short recordings? | Sample clips | Phase 3 |
| DQ-07 | Which sample subjects/programme should the demo use (Java Full-Stack proposed)? | Java Full-Stack | Phase 2 |
| DQ-08 | Is a public GitHub repository acceptable (unlimited free CI minutes) or must it be private (2,000 minutes/month)? | Private with lean pipelines | Phase 1 |
| DQ-09 | Who owns the staging accounts (GitHub, Oracle/Cloudflare/Render/Neon, Sentry)? | Developer for demo stage; client-owned from first client deployment | Phase 1 |
| DQ-10 | Which client overlay mechanism do you prefer: overlays inside the template repository or one private repository per client? | Inside the template repository until the first paying client | Phase 1 |

Master questions still relevant to the demo (defaults as in master §21 unless answered): Q-01 product name, Q-02 brand assets, Q-05 metric definitions, Q-08 programme/course model, Q-09 login method (email/password in demo), Q-12 attendance method (roll-call), Q-14 languages (JavaScript, Python in browser; more with Judge0), Q-19 integrity level (basic), Q-21 profile fields, Q-23 gamification (off).

---

## 28. Architecture Approval Checklist

| # | Decision | Recommended option | Reason | Alternatives | Decision required | Impact if changed later |
|---|---|---|---|---|---|---|
| D-01 | Architecture | Monorepo with modular monolith (web, api, worker) + client overlay | Best fit for small team, reuse, free tiers (§5) | Plain monolith; microservices | Approve architecture | High: structure of every module |
| D-02 | Frontend stack | Next.js 16, TypeScript, Tailwind 4, shadcn/ui, TanStack Query/Table, RHF + Zod, Recharts, TipTap, CodeMirror 6 | Master choice; SSR for phones; owned components | Vite SPA; MUI/Ant | Approve | High: UI rewrite |
| D-03 | Backend stack | NestJS 12, TypeScript, REST + OpenAPI, Zod, pino | Module contract fit; guards; docs | Fastify/Hono; Django | Approve | High: API rewrite |
| D-04 | Database | PostgreSQL 16+ with Prisma 7 | Integrity, JSONB, portability | MySQL; Drizzle | Approve | High: data layer |
| D-05 | Authentication approach | Own email/password + invitations + rotating refresh tokens; OTP/2FA later behind flags | No SaaS cost; invite-first institutes | Auth.js; Keycloak; Clerk | Approve | Medium: auth module swap |
| D-06 | User roles (demo) | Super Admin, Admin, Trainer, Student; Placement Coordinator and Content Manager seeded without portals | Complete demo without half-built portals | Include placement portal now | Approve | Low: roles are data |
| D-07 | Demo scope | Fourteen modules in §12.2; future modules flagged off | Connected application within 12–16 weeks | Larger scope | Approve | Medium: timeline |
| D-08 | Queue/cache driver | Queue interface with pg-boss default; Redis/BullMQ as scale option; in-memory/PostgreSQL cache and rate-limit stores | Free tiers, one less service | Redis from day one | Approve (refinement R-1) | Low: driver swap |
| D-09 | Coding execution scope | Execution adapter: browser-sandbox (JS, Python) in demo, Judge0 driver optional; trusted grading later | Safety and zero cost | Judge0 required for demo (needs Linux host) | Approve (refinement R-3) | Low: driver swap |
| D-10 | Video strategy | Storage-file driver (MP4/HLS in S3-compatible storage, signed URLs) for demo; hosted providers later | Zero cost, adapter | YouTube unlisted; Bunny now | Approve (refinement R-2) | Low: driver swap |
| D-11 | File-storage strategy | File registry + S3 driver (MinIO local, R2 staging); disk driver for tiny installs | Portable, free tiers | Local disk only | Approve | Low |
| D-12 | Branding / white-label strategy | Configuration layers (§22.1): DB-driven branding/settings/flags/navigation/custom fields/templates; theme tokens; overlay for assets/seeds/extensions; one deployment per client | No forks; isolation | Multi-tenant SaaS now | Approve (refinement R-4) | Medium: tenant migration later is planned |
| D-13 | Local environment | Docker Compose (postgres, minio, mailpit; profiles tools/judge0) + host-run apps with hot reload | Fast, reproducible | All-in-containers dev | Approve | Low |
| D-14 | Free staging environment | Option A (free VM + Compose) preferred; Option B (Workers + Render + Neon + R2 + Resend) fallback; both demo-grade | Fidelity vs zero-ops | Paid PaaS | Choose A or B | Low: same images |
| D-15 | Repository structure | §20 tree | Reuse, overlay, testing | Multi-repo | Approve | Medium |
| D-16 | Database design | §17 (single-tenant per deployment, tenant-ready; demo subset of master §14) | Isolation now, evolution later | Shared multi-tenant | Approve | Medium |
| D-17 | API structure | §18 (`/api/v1`, conventions, groups) | Contract-first | GraphQL/tRPC | Approve | High |
| D-18 | Page inventory | §14 (80 demo pages; future pages flagged) | Matches customer expectations | Fewer/more pages | Approve | Medium |
| D-19 | Navigation | §15 maps and behaviours; configurable labels/order | Reference-consistent, configurable | Fixed navigation | Approve | Low |
| D-20 | UI/UX system | §16 tokens, components, templates; contrast-validated theming | White-label without rewrites | Per-client styling | Approve | Medium |
| D-21 | Security baseline | §19 from Phase 1; execution never in API | Cheaper to build in | Later hardening | Approve | High if deferred |
| D-22 | Testing approach | §23 pyramid, CI, Definition of Done, page checklist | Quality gate for "complete pages" | Lighter testing | Approve | Medium |
| D-23 | Implementation sequence | §24 Phases 0–6 then master phases | Dependency order | Reordered phases | Approve | Medium |

Additional confirmations: DQ-01…DQ-10 (§27), the cost boundary statement (§10.3), and the preservation statement (§2).

---

## 29. Recommended Next Steps

1. Review this document and the master together; comment per section (Step 5).
2. Answer DQ-01…DQ-10 and confirm or amend D-01…D-23 (Step 6 revision follows).
3. Approve the final architecture decision document (Step 7–8). Nothing is locked before that.
4. Only after approval (Step 9): prepare the final repository structure, Prisma schema draft, OpenAPI skeleton, page implementation checklist, development backlog (`BL-` items for Phases 1–6) and local setup instructions.
5. Only after a separate explicit instruction: begin Phase 1 coding.

Parallel client-side tasks that need no code: decide the demo brand (DQ-05); choose staging option and create the accounts (DQ-01, DQ-09); collect or approve sample media (DQ-06); confirm the sample programme (DQ-07); read the cost boundary statement (§10.3).

---

## Appendix A. Sources verified for this document (September 2026)

- Render free tier: https://render.com/docs/free (750 instance-hours; 15-minute spin-down; free PostgreSQL 1 GB expiring after 30 days; no free workers/cron)
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby (included usage; non-commercial fair use; 100 deployments/day; 300 s functions)
- Supabase pricing: https://supabase.com/pricing (2 projects; 500 MB; 1 GB storage; 5 GB egress; pause after 7 days)
- Upstash Redis pricing: https://upstash.com/pricing/redis (500K commands/month; 256 MB; 10 GB)
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/ (100,000 requests/day; 10 ms CPU; 128 MB; static assets limits) and OpenNext Cloudflare adapter notes on the 3 MiB free-plan Worker size: https://opennext.js.org/cloudflare
- Koyeb pricing: https://www.koyeb.com/pricing (no free tier; Pro USD 29/month)
- Oracle Cloud Always Free changes (2 OCPU/12 GB from 15 June 2026; idle reclamation rule): https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/ and https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Railway pricing: https://docs.railway.com/pricing/plans (USD 5 trial credit; Hobby USD 5/month)
- Fly.io discontinued free allowance: https://fly.io/docs/about/discontinued-plans/
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions (2,000 minutes, 500 MB; public repositories free)
- Sentry pricing: https://sentry.io/pricing/ (Developer: 5K errors, 5M spans, 50 replays, 1 user, 30 days)
- Netlify Free plan credits: https://www.netlify.com/blog/introducing-netlify-free-plan/ (300 credits/month)
- UptimeRobot free plan (50 monitors, 5-minute interval, non-commercial): vendor and comparison pages listed in search results
- Brevo free (300 emails/day) and Mailtrap free (4,000 emails/month, 150/day): vendor and review pages listed in search results
- Docker Desktop licensing: https://docs.docker.com/subscription/desktop-license/ (free for individuals, education, non-commercial OSS, and businesses under 250 employees and USD 10 million revenue)
- Judge0 host requirements (Ubuntu 22.04 with cgroup v1 boot parameter): https://github.com/judge0/judge0 and its CHANGELOG
- Google Cloud Always Free e2-micro (us-west1/us-central1/us-east1) and AWS Free plan (credits, 6 months): https://cloud.google.com/free/docs/compute-getting-started and https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/
- pg-boss: https://github.com/timgit/pg-boss (PostgreSQL SKIP LOCKED queue; v12 line, September 2026)
- OpenNext Cloudflare adapter and Next.js 16 support: https://opennext.js.org/cloudflare and https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Pyodide (CPython on WebAssembly; sandboxed iframe at opaque origin; ≈ 15 MB core download): https://pyodide.org/ and https://github.com/pyodide/pyodide
- Neon, Cloudflare R2, Resend, Razorpay, Anthropic pricing and framework versions: as verified for the master report (Appendix C there)

*End of document.*
