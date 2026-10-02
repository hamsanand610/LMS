# CLAUDE DEVELOPMENT OPERATING RULES

Copied from the master planning report §22 (13 September 2026). Binding for all AI-assisted development in this repository.

Amended on 2 October 2026 for the active roadmap (`docs/ROADMAP.md`), which the client made the controlling plan: rules 1, 2 and 45 now point at it, and rules 46–48 were added.

## Process rules

1. Do not start coding before the approved architecture is available. Development begins only after the client approves the reports and the Step 9 artefacts exist. From 2 October 2026 the controlling plan is `docs/ROADMAP.md`: work happens only in its current phase.
2. Do not invent requirements. Implement only items that exist in the approved backlog with an ID. If something seems missing, raise it as a question or a proposed backlog item; do not build it speculatively. Under the active roadmap, a phase's approved backlog is the item list of its client-approved phase plan in `docs/phases/`.
3. Do not silently change the technology stack. Any deviation from the approved stack requires an ADR approved by the lead and, for cost-bearing changes, by the client.
4. Do not modify unrelated modules. A task touches the files it needs; incidental refactors go into a separate, clearly labelled change.
5. Do not introduce unnecessary dependencies. Prefer platform features and existing packages; a new dependency needs a one-line justification, a licence check and a maintenance assessment.
6. Follow the approved folder structure. New modules follow the module template.
7. Follow consistent naming conventions: kebab-case files, PascalCase components/classes, camelCase variables/functions, snake_case database columns, `resource:action` permissions, backlog identifiers in commit and PR titles.
8. Use environment variables for secrets and configuration. Validate them at boot; document every variable in `.env.example`.
9. Never hardcode credentials, API keys, tokens or personal data in code, tests, fixtures, logs, documentation or commit messages.
10. Follow secure coding practices: validate input, encode output, parameterise queries, least privilege, no `eval`, no disabling security controls to make something work.
11. Keep frontend, backend and database responsibilities clear. The frontend never accesses the database or storage directly; business rules live in API services; the database enforces integrity with constraints; workers run background work.
12. Write maintainable, modular code: small functions, explicit types, no cross-module repository imports, domain events for cross-module effects, comments only where intent is not obvious.
13. Validate all inputs at every boundary (HTTP, jobs, imports, webhooks, environment) with shared Zod schemas.
14. Implement proper error handling: typed domain errors, problem+json responses, no swallowed exceptions, no stack traces to clients, user-facing messages that say what to do next.
15. Add tests for important functionality before marking work complete: unit for rules, integration for data access, API for endpoints (including permission allow/deny), E2E for user journeys.
16. Respect role-based access control: every endpoint declares a permission and scope; every new permission is added to the catalogue, matrix and tests.
17. Do not mark incomplete functionality as complete. Partial work is reported as partial with what remains.
18. Report blockers clearly and early: what is blocked, why, and what is needed.
19. Ask for clarification when requirements are ambiguous instead of guessing; when a guess is unavoidable to keep moving, state it explicitly as an assumption in the PR and progress log.
20. Maintain a development progress log (`docs/PROGRESS_LOG.md`): date, phase, items completed with IDs, tests run, blockers, next steps. Update it at the end of every working session.
21. Record architectural decisions as ADRs (`docs/adr/NNNN-title.md`: context, decision, alternatives, consequences, status).
22. Keep database migrations version-controlled (Prisma Migrate), reviewed, backward-compatible (expand/contract), and never edited after being applied to a shared environment.
23. Do not perform destructive database operations without approval: no dropping tables/columns, truncations, mass deletes or resets on shared environments without explicit written approval and a verified backup.
24. Do not change approved scope without confirmation: additions, removals and re-tiering go through the backlog with client confirmation.
25. Complete one approved phase at a time: do not start a later phase before its dependencies are completed, tested and approved.

## Additional rules for reliable AI-assisted development

26. Verify before asserting. Do not claim that a page was inspected, a test passed, a command succeeded or a library API exists unless it was actually observed. Quote outputs.
27. Pin and check versions. Use the versions recorded in the lockfile and `docs/STACK.md`; check the installed version before using an API; read the installed package's types or docs rather than relying on memory.
28. Run the checks before declaring done: lint, type-check, unit/integration tests for touched modules, and the relevant E2E smoke; include the command output summary in the progress log.
29. Never disable or weaken tests, linters, type checks or security rules to get a green build; fix the cause or raise a blocker.
30. Keep changes small and reviewable: one backlog item per change where possible; describe what changed, how it was tested, and any assumptions.
31. Use the shared schema package for validation and types; do not duplicate schemas in web or API.
32. Regenerate the API client after OpenAPI changes and commit it in the same change.
33. Timezones: store UTC, display IST (Asia/Kolkata) via shared utilities; never use local machine time in business logic.
34. Accessibility is part of done: keyboard operability, labels, contrast and focus states for every new UI.
35. Feature flags for anything optional or costly (AI, gamification, OTP, labs): default off in production until approved.
36. Do not log personal data or secrets; use structured logs with IDs.
37. No production data on local machines; use seed data and factories.
38. Document as you go: every module has a `README.md`; every runbook is updated when operations change.
39. Idempotent and retry-safe jobs: every background job can be re-run without side effects.
40. Security checklist per change: input validation, permission declared, sensitive data handling, no new secrets, dependency review.
41. Respect the three environments: never point local tooling at production; production changes only through the pipeline.
42. When a phase gate is reached, stop and report: summarise deliverables, test evidence, open issues, and request approval before continuing.
43. Do not copy code or content from the reference portal or other proprietary sources. Use only the functional patterns documented in the reports.
44. Prefer explicit over clever: readable code and obvious data flows over abstractions that only the author understands.
45. Update the reports and the backlog when reality changes: if a decision or discovery invalidates a section, propose the amendment rather than working around it silently. Changes to the active roadmap follow rule 47.

## Roadmap and AI rules (added 2 October 2026)

46. Follow the active roadmap (`docs/ROADMAP.md`) in order. Do not start a phase before the previous phase's gate has passed and the client has approved it, and do not start a later phase while a release-blocking issue from an earlier phase is open.
47. Deviation control: never change the roadmap silently. Propose the deviation, why it is necessary, the phases it affects and its risks, and wait for the client's explicit approval. Do not return to the earlier demo / white-label roadmap unless the client says so.
48. AI work follows `docs/architecture/AI_ARCHITECTURE.md` §3: AI keys stay on the server; the AI never receives data the user could not see in the product; hidden tests, expected outputs, unreleased answers, private trainer material and other learners' data never enter a learner's prompt, retrieval or reply; AI features stay off in production until approved (rule 35).
