# search module

One lookup behind the command palette (Ctrl/⌘+K).

| Aspect      | Detail                                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | `GET /search?q=&types=&limit=`                                                                                                                                                     |
| Permissions | `search:use` to reach the endpoint; every group is additionally gated by the permission that guards its own pages (`students:read`, `trainers:read`, `batches:read`, `users:read`) |
| Scope       | Batch-scoped callers only match records inside their batches, so search can never become a way around authorisation                                                                |
| Types       | student, trainer, batch, program, user. Courses, lessons and questions join as their modules arrive                                                                                |
| Result      | Groups with a route per hit; a batch links to the admin or the trainer page depending on what the caller may do                                                                    |
| Limits      | Two characters minimum, at most twenty hits per group, 120 requests per minute per user                                                                                            |
| Tests       | `test/notifications.e2e-spec.ts` (permitted groups only, batch scope, minimum length)                                                                                              |

Matching is a case-insensitive substring search on names, codes and emails. The plan's full-text
indexes arrive with the content modules, which is where result volume starts to matter.

## Phase 2 (2 October 2026)

- **Learners see only what they can reach:** published courses they are enrolled in and their
  lessons (also found by a resource's title), assignments published to them or their batch, tests
  scheduled for their batches, live labs at `/labs/:slug` (when the Labs are on) and their own
  announcements.
- **Staff scope:** a trainer finds only themselves among trainers and only programmes of batches
  they can see.
- **Order:** prefix matches first, then by title.

## Phases 3 and 4 (3 October 2026)

- **Reach (P0).** A staff member's search reaches the batches they teach; a learner's, the batches
  they learn in. Someone who is both gets each from its own role.

## Phase 5 (3 October 2026)

- **Staff find courses, assignments and tests** through `CoursesService.list`,
  `AssignmentsService.list` and `TestsService.list`, so search never reaches more than the list
  pages; a trainer who also learns keeps their learner hits beside them. Every staff hit opens in
  the portal the searcher's roles give them (a trainer's student, trainer and programme hits used
  to lead to admin pages). Tests: `test/integration.e2e-spec.ts`.
- **Labs and the question bank for staff** (completion pass) through `LabsStaffService.list` and
  `QuestionsService.list`: a trainer finds their own questions and their own and published labs,
  managers everything; a lab is listed once. Hits carry titles and statuses only, never bodies,
  answers or hidden tests.
- **A learner's Documents**: their own documents, résumés and issued certificates, and the files
  of the lessons and assignments they reach now. A hit names a page, never a file: downloads stay
  behind the pages' signed links. The learner's labs come from the catalogue only. Tests:
  `test/search-reach.e2e-spec.ts`.
