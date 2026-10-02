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
