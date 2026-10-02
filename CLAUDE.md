# Project instructions for AI-assisted development

This repository is **SI Academy — Enterprise Learning Management & AI Learning Platform** (`docs/product/PRODUCT_DIRECTION.md`). It is no longer a demo or a white-label template. Before doing anything:

1. Read `docs/ROADMAP.md`: the CURRENT, controlling roadmap (Phases 0–14, gates, deviation control). Work only inside the current phase and on the items of its approved phase plan (`docs/phases/`); never start a later phase without the client's explicit approval.
2. Read `docs/CLAUDE_OPERATING_RULES.md` (binding rules) and follow them.
3. Architecture: `docs/architecture/OVERVIEW.md`; the AI layer: `docs/architecture/AI_ARCHITECTURE.md`; decisions: `docs/adr/`. Where each phase starts from: `docs/product/IMPLEMENTATION_ROADMAP.md`.
4. `docs/PLANNING_REPORT.md` and `docs/ARCHITECTURE_DEMO_TEMPLATE_PLAN.md` are historical. Their requirements catalogue (F-01…F-28) and their architecture decisions (§28, carried by the ADRs) still apply; their demo scope and roadmaps do not.
5. Check `docs/PROGRESS_LOG.md` for the current phase and open blockers; append an entry when you finish a session.
6. Pinned versions live in `docs/STACK.md`; do not upgrade majors outside phase boundaries.

Conventions: pnpm workspace + Turborepo; TypeScript strict everywhere; Zod schemas in `packages/shared` are the single validation source; API modules follow the module contract in `packages/module-sdk`; secrets only in environment variables; never execute user code inside the API; every endpoint declares a permission; every mutation is audited; tests before "done"; Conventional Commits with module scopes; AI keys stay on the server, and the AI never receives data the user could not see in the product.
