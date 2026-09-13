# ADR-0001: Monorepo with a modular monolith

- Status: Accepted (client approval, 13 September 2026)
- Context: A small team must build a reusable, white-label platform that runs locally, on free staging and later in production, with client customisation that never forks the core. See architecture plan §5–§6.
- Decision: One pnpm/Turborepo monorepo containing `apps/web` (Next.js), `apps/api` (NestJS modular monolith with feature modules following the module contract), `apps/worker` (same modules, separate process mode), shared packages (`shared`, `ui`, `module-sdk`, `config`) and `clients/<key>` overlays. Untrusted code execution and external providers sit behind adapters outside the monolith.
- Alternatives: plain monolith (poor reuse), microservices (operational cost, free tiers unfit), multi-repo (duplicated contracts).
- Consequences: strict module boundaries enforced by lint rules; modules communicate via service interfaces, domain events and the queue interface; extraction of hot modules remains possible later.
