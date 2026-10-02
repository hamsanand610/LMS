# ADR-0018 — Labs are question-bank exercises run by the practice module

- **Status**: proposed — built in Roadmap Phase 1, for the client's approval at the Phase 1 gate
- **Date**: 2026-10-02
- **Phase**: Roadmap Phase 1 (Labs and Playground)
- **Builds on**: ADR-0016 (sandbox runner), ADR-0010 (enrolment from publication), ADR-0009 (role
  bundles)

## Context

Phase 1 adds practical exercises of four kinds — coding, SQL, web and debugging — plus a free
playground, attached to courses and counted in learner progress. The platform already has:

- a question bank with authorship, versions, publishing and validation of a reference solution in the
  sandbox;
- test cases with visibility and weights;
- a practice catalogue over coding and SQL questions, with run, submit and recorded history;
- a progress model built on lesson completion.

The client's brief asks that no entity be duplicated merely because a screen needs a different view.

## Decision

1. **An exercise is a question.**
   - `QuestionType` gains `debugging` and `web`, beside `coding` and `sql`.
   - A **debugging** challenge is a coding question whose starting code is the broken program. It
     names what the program should do (`expectedBehaviour`). It is only valid when the starting
     code fails at least one case and the reference fix passes them all.
   - A **web** exercise stores its starting and reference files (HTML, CSS, JavaScript) as one
     encoded bundle under the `web` runtime. Its checks are ordinary test cases: each case's input
     is one structured check (ADR-0019) and its expected output is `pass`. Visibility, weights,
     validation and history therefore work unchanged.
2. **The practice module becomes the Labs area.** Its key (`practice`), its permissions and its run
   context (`practice`) stay, so streaks, the leaderboard and points count lab solves as they count
   practice solves.
   - Learners see "Labs", at `/labs`; the old `/practice` addresses redirect there.
   - The module flag `module.practice` is now declared off by default, so a new institute switches
     Labs on deliberately (operating rule 35). SI Academy's configuration turns it on.
3. **Lab lessons.**
   - `LessonType` gains `lab`, whose content names a published lab question, checked when the
     outline is saved.
   - `CompletionRule` gains `pass`. A lab lesson completes only when a trusted submission passes
     every case, whether it is made in the lesson or in the catalogue (the progress module listens
     for `execution.completed`), and on opening when the learner has passed the lab already. "Mark
     complete" is refused for it. A lesson completes once however many of these arrive together.
   - Saving an outline checks only the references it adds or changes: a lab lesson's lab must be
     live, and a practice lesson's question published. A lab withdrawn later shows as unavailable.
4. **Drafts on the server.** A learner's unfinished work per lab (or per playground language) is
   kept in `lab_drafts`, so it follows them across devices.
5. **Who does what.** By the client's decision of 2 October 2026:
   - **Admins and content managers** place labs in course modules, through the course outline
     (`courses:manage`, unchanged).
   - **Trainers**:
     - author their own labs (`questions:create_own`, unchanged);
     - put them in the catalogue with the new `practice:publish_own` (own labs only), once the lab
       passes its own check;
     - see their batches' attempts with the new `practice:review` (batch scope; admins hold it at
       `all`). A reviewer also lists and previews every published lab, read-only, so they can follow
       their learners on labs others wrote.
6. **Scope boundary for this phase.** `debugging` and `web` questions are used in the Labs only.
   Assignments and timed tests refuse them until Roadmap Phase 3 adds their workspaces there.

## Consequences

- **Nothing duplicated.** No second exercise model, test-case model or progress system. A lab
  validated once is safe everywhere it is used.
- **Shared statistics.** Practice statistics now include web and debugging labs, which is intended.
- **Flag default.** An institute that never set `module.practice` explicitly gets the flag's new
  default only when its flag row is first created. Existing rows keep their value.
- **Assignments.** The two new types become available to assignments in Roadmap Phase 3.

## Alternatives considered

- **A separate `labs` module and `Lab` model.** It would duplicate test cases, validation and
  history, and a learner's solves would be split across two catalogues. Rejected.
- **A web exercise as its own table of files and checks.** It would need its own validation,
  visibility and results machinery. The test-case mapping gives all of that for free. Rejected.
