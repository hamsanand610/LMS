# ADR-0040 — The learning agent's learner context: live state, data classes, history taint

- **Status**: accepted — built on 7 October 2026 in Phase 9 (slices 9C to 9F), under the client's
  Phase 9 completion brief of the same day
- **Date**: 2026-10-07
- **Phase**: Roadmap Phase 9 (AI Learning Agent), slices 9C (context and learning state), 9D
  (workflows and UI), 9E (security and evaluation), 9F (hardening and closure)
- **Builds on**: ADR-0024 (data classes), ADR-0031 (where AI is allowed; no solutions), ADR-0038
  (the stand-in provider), ADR-0039 (the native, bounded orchestrator)
- **Amends**: ADR-0039 — its allow-list grows from two tools to four; its "memory, a profile — 9C"
  is withdrawn: Phase 9 keeps **no** learner memory
- **With**: ADR-0041 (personal data and the providers)

## Context

Phase 9C's reconnaissance (7 October 2026) found that a learner's learning state already exists and
is computed live — lesson progress, the enrolment's completion, the course's unlock rules, the
assignments' states, the test windows, the lab runs — with no snapshot or aggregate table to read.
It also found that several "reads" write (`LessonsService.get` records an opening and may complete
a lesson; `PracticeService.detail` may run the sandbox), that most services check their caller only
behind HTTP guards, that the course page's "next lesson" ignores module locks, that there is no
authoritative per-learner weak-topic signal, and that a conversation's history kept the class of the
question, not of the answer — so an answer drawn from personal data could later be sent as course
data, to a stand-in not approved for it.

## Decision

1. **No memory.** The learner's context is resolved from the authoritative services when a run asks
   for it, for that run only. Nothing is stored for the agent: no profile, no summary of the learner,
   no new table. The conversation's last ten messages remain its only history (ADR-0039).
2. **Two more read-only tools**, on the allow-list, each with strict `{}` arguments — the learner,
   institute, course and lab come only from the run's pinned context:
   - `learning_state` (personal): for the pinned course, the progress the enrolment records, the
     lessons that count and how many are done, the modules and lessons as open or locked to the
     learner, and the next lesson by the player's own unlock rule (`lockedModules`) — when the next
     required lesson is locked, what opens it; with no course pinned, the learner's courses (at most
     eight). Then what is due: the assignments by state and the next three, the test windows still
     to sit. At most 3,000 characters and 40 lessons; facts only.
   - `lab_attempt` (personal): the pinned lab — named by the conversation, or opened by its lab
     lesson — and the learner's own latest attempt that did not pass: the statement, two visible
     examples, the attempt's verdict and passed/total, the visible examples it missed, the learner's
     code, and whether a later attempt has passed since (never that attempt's code). Only after an
     attempt that did not pass. At most 6,000 characters. It never runs, re-runs or submits.
     (`PracticeService.labHintBrief` gained `latestFailed` for it; the AI Hint's material is
     unchanged.)
3. **AI-safe reads**, each asking its own permission, module and reach, whoever calls it:
   - `CourseLearningStateService` (courses module): learner identity, `courses:read` and the
     Courses module, `progress:read` and the Progress module, the institute's published course, an
     enrolment that stands; reads only; lock-aware.
   - `LearnerAssignmentsService.aiDueSummary`: `assignments:read` and the Assignments module.
   - `AttemptsService.aiOpenWindows`: `tests:read` and the Tests module; titles and times only.
   - `PracticeService.aiLabSubject` and the AI Hint's own gate, `requireHintableLab`, made public
     on `AiSubjectsService` and shared — not duplicated.
   - Never called for the agent: `LessonsService.get`, `CoursesService.get`, `PracticeService.get`
     or `detail`, `LearnerAssignmentsService.workspace` or `answerContext`, `TestsService.results`,
     anything of execution, staff views or another learner.
4. **Capabilities and recipes** (routing adds `needsState`):
   - `learning_state`: the state (required) → a search if it would help → draft → verify.
   - `explain_lab_attempt`: the lab attempt (required) → a search if it would help → draft →
     verify; with no lab pinned, a refusal that says where to ask.
   - `clarify_doubt` with `needsState`: the lesson → the state (optional) → a search; without it,
     as in 9B.

   A capability's required context that is unavailable (not approved, no lab, no failed attempt)
   ends the run in the platform's words (`context_unavailable`, `needs_attempt`), never with an
   answer made without it. The 9B limits are unchanged; the state and the attempt cost no extra
   model call.

5. **Data classes, per call.** Every model call carries the most sensitive class of what it sends —
   the subject (`course` for a course, lesson or lab), the history messages it includes, and, for the
   follow-up and the draft, the evidence (`mostSensitive`). The learner's state and attempt are
   `personal`; a lab's statement is `course`. The audit and the ledger record the most sensitive
   class the run used.
6. **History taint.** An answer is kept with the class of the draft it came from: an answer drawn
   from the learner's records is stored as `personal`, and every later request that includes it is
   at least `personal`. Only the history a request actually sends counts: once a message leaves the
   last ten, it no longer raises a request. A history message of a class not approved now is left out
   of the request. The Phase 7 gateway refuses a request whose history is more sensitive than its
   conversation's own class (defence in depth: such history cannot arise there).
7. **Lab answers hold no code.** With the learner's own attempt in the evidence, a draft that writes
   code (a fenced block, a statement-shaped line, a long code span, indented code) fails verification
   (`solution_code`, a safety fault): regenerated once, then refused (ADR-0031).
8. **The last check** before an answer is given also re-asks, for state citations, the learner's
   right to their state (`assertMayRead`), and for lab citations, the AI Hint's gate and the pinned
   lab lesson — and that the answer's data class is still approved (ADR-0041).
9. **Signals.** Only facts the learner can already see are stated: completion, locked modules, the
   next open lesson, overdue and failed assignments, test windows. No "weak topic", "struggling" or
   mastery is inferred: there is no authoritative per-learner source for it, and the agent's
   instructions forbid judging the learner.

## Consequences

- No migration: `ai_messages.data_class` already existed; it now holds the answer's own class.
- Two narrow reads were added to the assignments and tests modules and one to practice; the AI
  module imports the assignments module.
- A learner without `progress:read` asking a doubt "with their state" still gets the doubt cleared:
  an optional state read refused for the tool's own permission or module is skipped; anything that
  concerns the run (a timed test, another learner) still stops it.
- The fake provider and the evaluation are deterministic; the verification stays lexical (ADR-0037's
  limits).
- Deferred beyond Phase 9 (client's Phase 9 completion brief): weak-topic or mastery models,
  recommendations beyond the next lesson, assignment feedback and test result detail, escalation to a
  trainer (a write tool), quizzes and generated practice, and re-running a learner's code.

## Alternatives considered

- **A learner profile or memory table.** Refused: stale by construction, a second source of truth,
  and personal data kept for the AI alone.
- **Calling the player's and staff services as they are.** Refused: they write, run the sandbox or
  rely on HTTP guards; reads the agent can trust ask for themselves.
- **Inferring weak topics from attempts.** Refused: the topic vocabularies do not align, results are
  gated by release, one question sits in several placements, and a false "you are weak in X" harms.
- **Tainting a whole conversation once personal.** Refused: only what a request sends should raise it.
