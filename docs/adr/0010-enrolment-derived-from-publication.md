# ADR-0010 — Enrolment is derived from publication, not entered

- **Status**: accepted
- **Date**: 2026-09-14
- **Phase**: 3 (Learning foundation)

## Context

Phase 3 had to answer one question before anything else could be built: how does a course reach a
learner? The reference portal that inspired this template shows learners a fixed set of content for
their batch, and the brief (plan §7, §24.1) asks for content to be published to a programme, a
batch, or everybody, with no per-learner administration.

Two shapes were possible. Either enrolment is a record staff create and maintain, with publication
as a separate hint, or publication is the only decision and enrolment follows from it.

An enrolment row is still needed, because progress hangs off it and because a learner must keep
their record when the content decision changes. The question is who writes that row.

## Decision

**Publishing a course derives the enrolments.** `EnrollmentService` in the progress module is the
only code that writes the `enrollments` table:

1. Publishing to an audience enrols every student that audience covers, once.
2. A student who joins a batch later picks up what that batch already has, through the
   `batch.members_changed` event.
3. Withdrawing a publication removes only the enrolments with **no progress at all**. A learner who
   has started keeps their row and their record.
4. There is no endpoint that enrols or unenrols one learner by hand.

Publishing to the same audience twice is refused rather than made idempotent, so an accidental
double publish is visible instead of silent.

## Consequences

- Staff manage cohorts and content; nobody maintains a per-learner enrolment list, which is the
  administrative burden the brief explicitly wanted removed.
- The set of learners who can see a course is always explainable from its publications, which is
  what the publishing tab shows.
- Progress survives a withdrawal, so a content decision can never destroy a record. The cost is that
  a learner who started a course they should not have keeps access to it; staff archive the course
  or move the learner's batch instead.
- A one-off exception ("give this one student the course") is not expressible. If a client needs it,
  the honest answer is a new audience type rather than a hand-written enrolment.
- Deriving on publish is O(audience) at publish time. For an institute of a few thousand learners
  this is one bulk insert; a much larger tenant would move it to the queue, which is a change of
  mechanism, not of this decision.

## Module dependencies this settles

The single direction between the three Phase 3 modules follows from it:

- `sessions` depends on nothing in this phase. Its row presenter is a pure module so others can show
  a class without importing it.
- `progress` owns enrolments and every percentage, reading course and class tables through Prisma.
- `courses` depends on `progress` (it calls `EnrollmentService` on publish and reads learner state)
  and on `sessions` only to link a recording back to the class it came from.

Attaching a class recording therefore lives in `courses`, not in `sessions`: creating a lesson is a
content action, and putting it there is what keeps the graph free of a cycle.

## Alternatives considered

- **Enrolment managed by hand, publication as a hint.** Rejected: it duplicates the roster that
  already exists on the batch, and every roster change would need a second administrative action.
- **No enrolment row; compute access from publications on every read.** Rejected: progress and
  completion need somewhere to live, and every learner page would repeat the same scope resolution.
- **Withdrawal deletes every enrolment.** Rejected: it destroys progress as a side effect of a
  content decision, which no member of staff would expect from the word "withdraw".
