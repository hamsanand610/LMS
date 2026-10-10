# ADR-0044 — The learning agent reads the open course's outline

- **Status**: accepted — built on 10 October 2026 under the client's final completion brief
  ("investigate the course-outline suggestion limitation and fix it if it belongs within the agreed
  scope"); within Phase 10's context-selection and learner-usefulness criteria
- **Date**: 2026-10-10
- **Phase**: Roadmap Phase 10 (AI evaluation and security), closure
- **Builds on**: ADR-0039 (the native, bounded learning agent and its allow-list of tools), ADR-0040
  (the learner's own context), ADR-0031 (the Phase 7E assistant's course and lesson material)

## Context

On a course's own page the web offers learners one suggested question, "What does this course
cover?" (Phase 9D). The learning agent answered it from the knowledge base alone: with no lesson open,
`clarify_doubt` only searches. Unless an administrator had uploaded and published knowledge about
that course, the run declined ("couldn't find enough information"), verified on 9 October 2026 on a
local stack. The Phase 7E assistant, which the agent replaced for learners, did read a course's
outline for a course subject (`courseMaterial`), so learners had lost an answer they used to get.

## Decision

1. **A fifth read-only tool, `course_outline`.** No arguments: the course is the run's pinned one,
   never one a model names. It reads `CoursesService.aiContextFor` — the course page's own rule,
   checked now for this learner (`courses:read`, the Courses module, the institute's own published
   course, published to them) — and gives the outline as `courseMaterial` writes it: the title, the
   description, the modules and their lessons' titles. Never a lesson's text, a resource, a lab, a
   question, a hidden test or a staff note. Text holding a credential is withheld whole; the rest is
   cut to 4,000 characters (`AGENT_LIMITS.outlineCharacters`). Data class `course`, approved in
   production as `public,course`; nothing personal.
2. **Read only on a course's own page.** In `clarify_doubt`, when the run is pinned to a course with
   no lesson and no lab open, the outline is read first, then the knowledge base as before. It is
   hoped for, not required: without the tool's own permission or module the run goes on; a course no
   longer open to the learner stops the run (`course_not_open`), as a lesson does.
3. **Cited like everything else.** The outline is evidence, cited with the kind `course`, the
   course's id and its title, shown as "Course outline: <title>" and verified like any passage;
   before delivery the cited course must still be the run's and open to the learner.
4. **The run's limits stay as ADR-0039 set them.** Routing, the outline, a search, one follow-up, a
   draft and its regeneration fit within the eight steps and four model calls.

## Consequences

- "What does this course cover?" is answered from the course itself, with a source, whatever the
  knowledge base holds; the knowledge base still adds to it.
- The tool contract (`AI_AGENT_TOOLS`), the steps (`reading_course`) and the citation union grow by
  one each; the web labels the new step and source.
- Lesson titles of modules still locked to the learner are in the outline, as on the course page;
  their words are not.

## Alternatives considered

- **Dropping the suggestion on course pages.** Rejected: hides the defect instead of fixing it, and
  leaves course questions declining.
- **Ingesting every course into the knowledge base automatically.** Rejected for now: a pipeline and
  storage change, not a context-selection fix; the outline is already authorised material.
