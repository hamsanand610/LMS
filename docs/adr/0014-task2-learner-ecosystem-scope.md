# ADR-0014 — Task 2: the learner ecosystem pulls four future modules forward, behind flags

- **Status**: accepted (proposed on 2026-09-27 and implemented in Task 2; the plan amendments below
  are approved with it)
- **Approved**: 2026-10-01, by the client
- **Date**: 2026-09-27
- **Phase**: Task 2, real-world LMS transformation

## Context

The client asked for the demonstration to become a product an academy could run every day, with a
mature learner portal as the reference (docs/product/TASK2_AUDIT_AND_GAP_ANALYSIS.md). Several of
the features that make such a portal feel complete are, in the approved architecture plan, _future_
modules: gamification (streaks, leaderboards; plan §12.3, §16 privacy baseline "leaderboards/ranks
off by default"), the placement portal (F-17, "tables and role seeded only"), doubts (F-27) and
profile projects and certificates (F-15, F-16). Operating rule 45 asks for the amendment to be
proposed rather than worked around, and DR-07 names exactly this risk: scope creep from the master
catalogue into the demo.

The client decided (27 September 2026): the institute is SI Academy; a basic placement drives
board is in scope; the rest follows the gap analysis priorities.

## Decision

**1. Pull four capabilities forward, each as a manifest module or an extension of one, each behind a
flag, each with explicit permissions.**

| Capability                                                     | Module                                             | Flag (template default → SI Academy) | Permissions                                                |
| -------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Learning streak, daily adherence                               | `progress` (extension)                             | always on                            | `progress:read`                                            |
| Leaderboard                                                    | `gamification` (new)                               | `module.gamification` off → on       | `leaderboard:read` (own, batch, all)                       |
| Companies, interview-prep kits, placement drives, applications | `placement` (new; its keys were seeded in Phase 6) | `module.placement` off → on          | `placements:read`, `placements:apply`, `placements:manage` |
| Doubts on courses and lessons                                  | `doubts` (new)                                     | `module.doubts` off → on             | `doubts:ask` (own), `doubts:answer` (batch, all)           |
| Profile projects, certificates, photo                          | `profile` (extension)                              | always on                            | `profile:update`                                           |

A client that does not want one of these switches its module off; nothing else depends on them.

**2. Measures are computed from records that already exist**, on read, with no second copy
(consistent with ADR-0012): lesson progress, assignment submissions, practice runs, test attempts
and attendance. The definitions are fixed in the gap analysis §5 and are shown to learners beside
each figure ("how we count").

**3. The leaderboard shows a learner only their own batch**, names as first name plus last initial,
and nothing else about anybody. Trainers see their batches, administrators any batch.

**4. Placement is deliberately small**: companies, drives (role, location, package, eligibility by
batch or programme and an optional attendance floor, a deadline), applications with a staff-set
status. No offers workflow, no company accounts, no resume generation.

**5. Topics are a label on a lesson**, not a new level of tables, so grouping lessons never changes a
lesson id, a completion or an enrolment.

## Alternatives considered

- **Keep everything future and polish only what exists.** Rejected by the client's brief: the
  learner portal would still lack the daily-habit and career parts that define the reference.
- **Store streaks and points in their own tables, updated by jobs.** Rejected for now: a second copy
  of every number is the disagreement ADR-0012 avoided; per-learner and per-batch reads are cheap at
  this scale. An aggregate can be added per measure if one becomes slow.
- **A third-party chat widget for support** (as the reference does). Rejected: it sends learner
  conversations to another vendor and routes nothing to the learner's own trainer.
- **An AI assistant, QR check-in, employability score, skill levels, contests, course reviews.**
  Excluded (gap analysis §3): each needs a provider, a device, a definition or a module the plan
  still defers.

## Consequences

- Plan §12.3 (deliberately out of the demo) and §24 (future phases) move gamification, the placement
  drives board, doubts and profile projects/certificates into the build. Proposed amendment: list
  them under §12.2 with their flags, and keep the rest of §12.3 as it is.
- Plan §16's privacy baseline stays true for the template (the leaderboard ships off); SI Academy's
  seed turns it on as a client choice.
- New tables: `companies`, `company_kit_items`, `company_favourites`, `placement_drives`,
  `drive_applications`, `doubts`, `doubt_replies`; new columns: `lessons.topic`,
  `student_profiles.projects`, `student_profiles.certifications`.
- Three permissions are added (`leaderboard:read`, `doubts:ask`, `doubts:answer`); the placement
  ones stop being seeded-only. System role bundles gain them once through `syncSystemRoles`
  (ADR-0009).
- Navigation items gain an optional `minScope`: a staff page reached through a permission learners
  also hold (`leaderboard:read` at `own`) names the narrowest scope that shows it, so learners'
  menus never carry staff entries. The API still refuses what the scope does not allow.
- Role bundles after Task 2: Admin gains `placements:manage`, `leaderboard:read` (all) and
  `doubts:answer` (all); Trainer `leaderboard:read` and `doubts:answer` (batch); Student
  `leaderboard:read` and `doubts:ask` (own). Trainers get no placement permission — placement is
  run by administrators and the placement coordinator. An existing database receives the new keys
  once at boot; `placements:manage` for Admin reaches existing databases only after a reset,
  because that key was already past the ADR-0009 watermark.

## Implementation notes (Task 2)

- Migration `20260927103919_task2_learner_ecosystem`: additive only (no drop, no rename).
- API: `progress` (`/me/consistency`, `/students/:id/consistency`), `gamification`
  (`/leaderboard`), `placement` (`/companies…`, `/drives…`, `/me/placement`), `doubts`
  (`/me/doubts…` for learners, `/doubts…` for staff). Every route declares a permission and its
  module scope; every mutation is audited; the route-table test covers them.
- Tests: `test/engagement.e2e-spec.ts` (what each role may and may not do), unit specs for the
  streak rule and drive eligibility, and the role matrix.
