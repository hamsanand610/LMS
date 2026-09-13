# ADR-0002: TypeScript stack and version pins

- Status: Accepted
- Context: The plan locks Next.js 16, NestJS 12, Prisma 7, PostgreSQL, Tailwind 4, Zod, pg-boss, Vitest and Playwright (architecture plan §7). At setup the npm `latest` tag of Prisma is an 8.0 release candidate and the Nest 12 generator targets TypeScript 6.
- Decision: Pin Prisma 7.10.0 (client, CLI, adapter-pg); use TypeScript 6.0.3 workspace-wide (compatible with every dependency in use, including typescript-eslint's `< 6.1` range and Next.js); Vitest 4.1.11 (the line the Nest generator uses) instead of the just-released 5.0; ESLint 9.39.5 flat config for both apps (the Nest generator's oxlint is replaced so module-boundary rules can be enforced with one linter). All pins are recorded in `docs/STACK.md`.
- Alternatives: TypeScript 5.9 (would diverge from the Nest generator), Prisma 8 RC (unstable), oxlint (no boundary rule support needed here).
- Consequences: majors upgrade only at phase boundaries with a new ADR; the lockfile is the authoritative pin.
