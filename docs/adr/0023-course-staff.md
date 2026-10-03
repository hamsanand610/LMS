# ADR-0023 — Course staff: trainers given authority over a course's content

- **Status**: accepted (proposed on 2026-10-03 and built in Roadmap Phases 3 and 4)
- **Approved**: 2026-10-03, by the client, at the Phases 3–4 gate
- **Date**: 2026-10-03
- **Phase**: Roadmap Phases 3 and 4 (Trainer and staff completion; Admin and operations)
- **Implements**: decision D1 of `docs/phases/PHASE-03-04-trainer-and-admin.md`, item TRN-03
  (lesson management for trainers); amends ADR-0009 (default permission bundles)

## Context

A trainer's reach is their batches (the requirements' permission matrix). A course reaches a batch
through a publication (ADR-0010): to the batch, to its programme or to the whole institute. Course
content is written by administrators and content managers, who hold `courses:manage` for every
course. The roadmap gives trainers lesson management in Phase 3, and nothing links a trainer to a
course:

- giving trainers `courses:manage` for the courses their batches have would let any trainer of one
  batch rewrite a course every other batch is following (decision D2: reaching content through a
  batch is enough to use it, not to change it for every batch);
- copying a course per batch would split its content and its learners' progress.

Separately, the seeder grants a role's default bundle once per permission key (ADR-0009). It
cannot tell a permission added to a role's bundle from one a client removed, so adding an existing
permission to the trainer's bundle, or widening an administrator's scope, never reaches a running
institute.

## Decision

1. **A course has staff**: trainers an administrator assigns to it (`course_staff`: the course, the
   trainer, who assigned them and when). Assigning and removing are audited. Several trainers may
   share a course; the course keeps its owner.
2. **`courses:author`** is a new permission with scopes `all` and `own`. At `all` it changes any
   course's content (administrators and content managers; the Super Admin through the full
   catalogue); at `own`, the courses one is staff of (trainers). Content is the course's details
   (title, description, level, subject, tags, thumbnail, estimate) and its outline (modules,
   lessons, resources). Creating, archiving and assigning staff stay with `courses:manage`.
3. **Trainers publish to their own batches.** The trainer's bundle gains `courses:publish` at
   `batch`: a course they are staff of, to a batch they teach, and withdrawing such a publication.
   Publications to a programme or to the institute stay with institute-wide publishers.
4. **Staff see their courses whole**: in any status, drafts included, with every lesson open
   without an enrolment, so they can prepare a course before it is published.
5. **A class recording may go into a course its trainer is staff of**, into any of its modules.
   The recordings rule of D2 (only a course given to the trainer's batches and no others) applies
   to everyone else.
6. **Lesson media** (`lesson-video`, `lesson-resource`, `course-thumbnail` uploads) need
   `courses:author` at any scope; attaching a file still goes through a save that checks the course.
7. **Named bundle changes** (amends ADR-0009). A change to the default bundle of a permission the
   catalogue already had is written as a named change and applied once per institute: grants are
   added where missing, and a scope is widened only where the role still holds the scope the change
   replaces. A client's later removal is never undone, as before. A new institute receives the
   bundles whole and marks every change as applied.

## Consequences

- An additive migration (`course_staff`); new permission rows reach running institutes through the
  base seed, as every new permission does; bundle changes through the same seed.
- Every check that asked "may manage courses" now asks the right question: `courses:manage` for
  the catalogue's administration, `courses:author` with the course's staff for content, and the
  publish scope for audiences.
- Staff edits change the course for everyone it is published to. That is what an administrator
  grants by assigning staff, and the audit log names who changed what.

## Alternatives considered

- **`courses:manage` at batch scope** (courses published to one's batches): rejected by D2.
- **The course's owner as its only editor**: a course taught by several trainers needs several.
- **A copy of the course per batch**: duplicated content and progress split between copies.
