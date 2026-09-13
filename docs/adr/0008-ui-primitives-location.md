# ADR-0008: UI primitives live in the web app; tokens and composites in packages/ui

- Status: Accepted
- Context: The architecture plan (§20) placed shadcn/ui components in `packages/ui`. The shadcn CLI writes components with `@/…` path aliases; a shared package compiled with plain `tsc` cannot rewrite those aliases, and Next.js resolves aliases of transpiled packages against the app's own paths. Making it work would require a bundler for the package or hand-edited imports after every `shadcn add`.
- Decision: shadcn primitives (button, input, dialog, table, …) are generated into `apps/web/src/components/ui` by the CLI. `packages/ui` keeps the framework-independent parts: theme tokens and derivation (re-exported from `@lms/shared`), the design-system CSS (`styles.css`), and composites written with relative imports. Because every client is a deployment of the same web app, reuse across clients is unaffected.
- Alternatives: bundling `packages/ui` with tsup/esbuild (extra tooling), manual alias rewriting (error-prone).
- Consequences: a second front-end consumer (e.g. a future mobile web shell) would need the components moved or bundled; revisit then.
