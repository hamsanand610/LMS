# Product direction — SI Academy

| Field      | Value                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Status     | **CURRENT** — set by the client on 2 October 2026; this write-up awaits the client's review     |
| Product    | **SI Academy — Enterprise Learning Management & AI Learning Platform**                          |
| Roadmap    | `docs/ROADMAP.md` (the controlling plan)                                                        |
| Supersedes | The "reusable white-label template with a local demo" framing of the plans of 13 September 2026 |

## 1. What SI Academy is

SI Academy is a serious, full-stack enterprise learning platform and a portfolio-level engineering
project. It is one coherent system in which students learn and practise, trainers teach and review,
administrators run the institute, and system operators keep it secure and healthy — not a collection
of disconnected CRUD modules, and not a demonstration of what a platform could be.

It is no longer a demo, a white-label template or a generic reusable LMS, and that framing no
longer decides anything. What was built under it is kept and evolved: the architecture, the
modules, the security model and the tests are the foundation of the enterprise product.

## 2. Roles

| Role                            | Portal  | System role keys today                                                                        |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| Student                         | student | `student`                                                                                     |
| Trainer                         | trainer | `trainer`                                                                                     |
| Admin                           | admin   | `admin`, with the narrower `placement_coordinator` and `content_manager` bundles              |
| Super Admin / system operations | admin   | `super_admin` (created from the command line, never by a sign-up; `apps/api/src/cli/main.ts`) |

Roles are defined in `packages/shared/src/roles.ts`; permissions are `resource:action` with `all`,
`batch` and `own` scopes (ADR-0004).

## 3. What the platform covers

Course delivery · lessons · learning progress · attendance · assignments · assessments · coding
practice · secure code execution · SQL practice · web practice · debugging practice · playground ·
projects · question bank · tests · trainer workflows · student progress · analytics · reports ·
documents and resources · notifications · placement and career workflows where applicable ·
AI-powered learning assistance · AI agent workflows · strong authentication and authorisation ·
auditability · secure infrastructure · production-grade engineering.

Which of these exist today, which are partial and which are missing, with evidence:
`docs/product/IMPLEMENTATION_ROADMAP.md`.

## 4. Product principles

1. **One coherent system.** A capability is finished when it works across the roles and modules it
   touches, not when its own screen works (Roadmap Phase 5).
2. **Authorisation on the server, down to the object.** Every endpoint declares a permission and a
   scope; every query is narrowed to what the user may reach. The browser is never trusted.
3. **Auditable.** Every mutation is audited; sensitive reads are audited too.
4. **Learners' code never runs in the API or unsafely in the browser.** It runs in the sandbox
   runner, one locked-down container per job (ADR-0016); hidden tests and expected outputs never
   leave the server.
5. **AI grounded in the LMS.** The AI layer answers from SI Academy's own, authorised context, never
   as a generic public chatbot, and never leaks hidden tests, answers, private trainer material or
   another learner's data (`docs/architecture/AI_ARCHITECTURE.md`).
6. **Real technology only.** Every technology has a legitimate role in the product and an ADR; none
   is added to decorate the stack.
7. **Honest figures.** A metric the platform cannot stand behind is named as missing, not invented.
8. **Engineering standards.** TypeScript strict, shared Zod schemas, tests before done, accessibility
   as part of done, IST for display and UTC for storage (`docs/CLAUDE_OPERATING_RULES.md`).

## 5. Technology identity

The technologies below are the product's technology identity. Each one is either in use with a real
role, or planned for the phase that gives it one.

| Area           | Technology                                 | Status                                                                                                                   |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Frontend       | Next.js, React, TypeScript                 | **In use** — Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 6.0.3 strict (`apps/web`)                             |
| Frontend       | Tailwind CSS                               | **In use** — 4.3.3, with design tokens from `packages/ui` (ADR-0008, ADR-0013)                                           |
| Backend        | NestJS, Node.js, REST APIs                 | **In use** — NestJS 12.0.1 modular monolith on Node.js 22; REST under `/api/v1` with a generated OpenAPI document        |
| Database       | PostgreSQL, Prisma ORM                     | **In use** — PostgreSQL 16, Prisma 7.10 with versioned migrations                                                        |
| Security       | JWT authentication                         | **In use** — 15-minute access tokens (ADR-0003)                                                                          |
| Security       | Refresh tokens                             | **In use** — opaque, hashed, rotated by family; a replayed token revokes the family                                      |
| Security       | RBAC                                       | **In use** — six system roles, editable bundles, `resource:action` permissions with scopes (ADR-0004)                    |
| Security       | CSRF protection                            | **In use** — double-submit check on cookie-authenticated mutations                                                       |
| Security       | Server-side and object-level authorisation | **In use** — deny-by-default permission guard; batch reach and ownership checks in the services                          |
| Security       | Audit-ready access control                 | **In use** — append-only audit log with redaction                                                                        |
| Infrastructure | Docker                                     | **In use** — images for API, web, runner and sandbox; Compose for local services and staging                             |
| Infrastructure | Git, GitHub, GitHub Actions                | **In use** — CI runs checks, API tests, sandbox tests, browser journeys and image builds on every push                   |
| Infrastructure | S3-compatible object storage               | **In use** — S3 driver against MinIO (Chainguard's build, ADR-0017)                                                      |
| Infrastructure | AWS-compatible deployment                  | **Partial** — S3 API, containers and PostgreSQL carry over to AWS; no AWS deployment exists yet (staging is a single VM) |
| AI / GenAI     | RAG, embeddings, vector search             | **In use** — Roadmap Phase 8: pgvector retrieval and grounded answers (ADR-0033 to ADR-0037), off by default             |
| AI / GenAI     | LangChain, LangGraph                       | **Not adopted** — a native, bounded orchestrator instead (ADR-0025, ADR-0039)                                            |
| AI / GenAI     | LangSmith                                  | **Planned** — Roadmap Phases 7 and 10, where appropriate                                                                 |
| AI / GenAI     | AI agents                                  | **In use** — Roadmap Phase 9: the learning agent (ADR-0039 to ADR-0041), off by default                                  |

Written before Phase 7. Since then Phases 7 to 9 built the AI layer — the gateway, Gemini behind a
model router with Groq as a stand-in, retrieval and grounded answers, and the learning agent — all
off by default (`docs/ROADMAP.md`).

## 6. AI as a first-class product layer

The AI layer is an LMS-specific **AI Learning Agent**, not a chatbot. It works against authorised
LMS context — courses, lessons, learning material, assignments, coding, SQL, web and debugging
exercises, the learner's own progress, attempts and visible test results, skill and topic metadata,
learning history, and trainer-created knowledge — through retrieval and controlled, agentic
workflows. "Building our own AI" means RAG, embeddings, vector search, orchestration, controlled
agents, evaluation, observability, security and cost control; training a foundation model is not
part of the plan, and fine-tuning is considered only if evaluation data proves the need. The target
architecture, the guarantees and the decisions still to take are in
`docs/architecture/AI_ARCHITECTURE.md`.

## 7. What changed on 2 October 2026, and what did not

**Retired as product framing:** the local demo, the white-label template, per-client deployments and
upgrades (plan §§12, 21, 22, 24), and the "demo institute" storyline. Phase plans now come from
`docs/ROADMAP.md`.

**Kept and evolved:**

- The architecture and its ADRs: monorepo and modular monolith, authentication, RBAC, storage,
  queue, code execution, design system (ADR-0001…0017; ADR-0011 stays superseded by ADR-0016).
- The requirements catalogue of `docs/PLANNING_REPORT.md` (F-01…F-28) as the requirements reference.
- The institute configuration layer, `clients/<key>`: SI Academy's branding, flags, navigation and
  sample data live in `clients/demo` today.
- Staging holds sample data only, never a real learner's record. That is a data rule, not a product
  framing.

**Language.** Product-facing text never says demo, template or sample. Development tooling still
carries "demo" in its names — `db:seed:demo`, `demo:reset`, `demo:advance`, `clients/demo`,
`CLIENT_KEY=demo` — because renaming them changes scripts and configuration; that happens in Roadmap
Phase 12, with the rest of the register in `docs/product/IMPLEMENTATION_ROADMAP.md` §5.
