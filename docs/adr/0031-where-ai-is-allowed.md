# ADR-0031 — Where AI is allowed

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §3 and §9, decision 8; operating rule 48

## Context

The AI must never become a way to learn what the product would not show the person asking. The
platform already decides what each person may see: permissions and scopes (ADR-0004), batch scope,
publication reach, course staff (ADR-0023), learner-facing views that leave out hidden cases and
reference solutions (ADR-0016), and timed tests.

## Decision

1. **The AI always runs as the requesting user.** Context comes only through the services the API
   already uses, called with that user's identity and scope (`ScopeService`, publication reach, the
   learner-facing views). It never reads tables around them.
2. **Allowed:**
   - general and educational learning questions;
   - course and lesson help, limited to content the user can open;
   - the learner's own context: their progress, attempts and visible results;
   - lab hints, which are progressive, come after repeated failed attempts, and never give the
     answer;
   - trainer and admin capabilities, only through explicit AI permissions and their existing scope.
3. **Denied or redirected:**
   - secrets and configuration;
   - administrative and internal data, for learners;
   - other learners' private data;
   - hidden test cases and their expected outputs, reference solutions, grader logic, unreleased
     answers and explanations, and other protected assessment data (rubrics, validation results,
     question version snapshots);
   - any repository, database, shell or outbound HTTP access; no such tool exists;
   - any help during a timed test (an attempt in progress);
   - unrelated requests are declined or redirected.
4. **Permissions** (scope in brackets):
   - `ai:chat` (own), for every role;
   - `ai:hints` (own), for learners;
   - `ai:usage_read`, at `all` for administrators and `batch` for trainers;
   - `ai:manage` (all), for the Super Admin only.
5. **Flags.** `module.ai` is off by default. The option flags `ai.assistant`, `ai.workspace`,
   `ai.lab_hints` and `ai.semantic_cache` are off by default too, and none of them opens anything
   while `module.ai` is off.

## Alternatives

- Letting the model decide what is allowed from instructions alone: prompt injection could undo it.
  Here the boundary is structural, because what may not be seen never enters the context.

## Consequences

- Phase 7A implements the permissions, the flags and an availability check: module, option flag,
  permission, and a refusal during a timed test. The gateway answers `ai_unavailable` until
  conversations arrive in Phase 7C.
