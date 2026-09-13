# Project instructions for AI-assisted development

This repository is the reusable LMS platform template. Before doing anything:

1. Read `docs/CLAUDE_OPERATING_RULES.md` (binding rules) and follow them.
2. Read `docs/ARCHITECTURE_DEMO_TEMPLATE_PLAN.md` §12 (demo scope), §20 (repository structure), §24 (roadmap) and §28 (approved decisions). The master product plan is `docs/PLANNING_REPORT.md`.
3. Check `docs/PROGRESS_LOG.md` for the current phase and open blockers; append an entry when you finish a session.
4. Pinned versions live in `docs/STACK.md`; do not upgrade majors outside phase boundaries.

Conventions: pnpm workspace + Turborepo; TypeScript strict everywhere; Zod schemas in `packages/shared` are the single validation source; API modules follow the module contract in `packages/module-sdk`; secrets only in environment variables; never execute user code inside the API; every endpoint declares a permission; every mutation is audited; tests before "done"; Conventional Commits with module scopes.
