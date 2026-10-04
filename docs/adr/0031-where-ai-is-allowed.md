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
   - lab hints, which are progressive, come after a failed attempt — at least one submission of
     the learner's that was not accepted — and never give the answer (amended 4 October 2026 in
     Phase 7F, as the client's Phase 7E brief set it; first written "after repeated failed
     attempts");
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

## Implementation (Phase 7C, 4 October 2026)

This section records how decisions 1–3 are carried out. Nothing above changes.

- **The data class.** Every request gets a data class on the server
  (`apps/api/src/modules/ai/policy/data-class.ts`), from what the request is rather than by
  guessing at personal details in its text:
  - **restricted**: a credential in the message. Refused, not stored, never sent.
  - **personal**: a lab hint.
  - **course**: a course or lesson subject.
  - **public**: anything else.

  The router sends a request only to a model approved for its class (ADR-0024).

- **Context.** It is the recent conversation and the question only. Nothing else is read, so no
  hidden case, solution, other learner's data or system data can reach a prompt.
- **Lab hints.** A lab hint names a lab, which must be one the learner may work on, by the lab
  drafts' own rule.
- **Course and lesson subjects** wait for the on-page assistant (7E), which brings their context
  (superseded by the Phase 7E section below).
- **Timed tests.** During a timed test, the AI neither answers nor shows earlier conversations.

## Implementation (Phase 7E, 4 October 2026)

This section records how decision 2's course, lesson and lab-hint help are carried out. Nothing
above changes.

- **Subjects by id.** A conversation names its course, lesson or lab by id; the browser never sends
  content. The service that owns each subject checks it with the person's identity and reach when
  the conversation starts and again at every question (`AiSubjectsService`):
  - a course: published, and one the learner is enrolled in (not withdrawn) or a trainer teaches
    (`CoursesService.reachableCourseIds`); never a draft or archived course, nor one reached only
    through authoring or managing rights;
  - a lesson: of such a course, in a module open to the learner by the player's own unlock rule;
    nothing is recorded by the check;
  - a lab: one the learner may work on (`PracticeService.requireReachableLab`).
- **Material, not retrieval.** The material is built on the server at every question: a course's
  outline, a lesson's own text, a lab's statement and visible examples with the learner's own latest
  submission. It goes to the model as learner-side context, never instructions, and answers drawn
  from it are never cached. Hidden cases and their outputs, reference solutions, grader checks,
  rubrics, explanations, staff notes and other learners' work are not read at all. Phase 8's
  retrieval will replace the course and lesson material under the same reach rules.
- **Lab hints after a failed attempt.** As the client's Phase 7E brief set it ("After a failed
  attempt, the user can request a hint"), and decision 2 now says: a hint is refused
  (`422 ai_hint_needs_attempt`) until the learner has at least one submission that was not
  accepted (`HINT_AFTER_FAILED_ATTEMPTS`, one constant, to raise if the client asks). Hints stay
  progressive and never give the answer: the instructions ask for one small step at a time,
  pointing where the learner is stuck, never the complete solution.
- **Data classes.** Course and lesson material is `course`, a lab hint `personal`; each is sent only
  where the deployment and the institute approved the class (ADR-0024), and the availability tells
  the web app which, so it offers no entry point that could only be refused.

## Implementation (Phase 7F, 4 October 2026)

The Phase 7 gate's hardening. Nothing above changes beyond decision 2's amendment.

- **One hint rule.** A lab hint is available after at least one failed learner submission. The
  permission's description, the flag's, the refusal and the web app say the same.
- **A learner's alone.** A hint needs a student profile — a learner, as the lesson labs define one
  ("Only a learner submits a lab"). Staff are refused whatever a role grants: the Super Admin's
  complete bundle holds `ai:hints`, and staff see labs as previews.
- **Labs switched on.** A hint needs the Labs module on for the learner, as the labs themselves do.
- **A lab reached through a lesson** follows the lesson's own rules: a published course the learner
  reaches, its module open. A lab reached only through a withdrawn enrolment, an archived course or
  a locked module gets no hint. A lab in the Labs catalogue needs `practice:use`.
- **Coursework.** Every surface's instructions keep graded work the learner's own: guidance to the
  next step, never a finished answer to submit (prompts `si-academy-7f-1`).
- **Timed tests.** No AI on any surface while an attempt is open — the workspace, the assistant
  with its course or lesson, a lab hint — refused by the server whatever a page shows, and back
  once the attempt is submitted (`apps/api/test/ai-gate.e2e-spec.ts`).
