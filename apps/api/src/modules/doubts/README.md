# doubts module

A learner's questions about a course or lesson, answered by the staff who teach them (F-27).

| Aspect      | Detail                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | Learner: `GET/POST /me/doubts`, `GET /me/doubts/:id`, `POST /me/doubts/:id/replies`, `POST /me/doubts/:id/status`. Staff: `GET /doubts` (filters: status, course, batch), `GET /doubts/:id`, `POST /doubts/:id/replies`, `POST /doubts/:id/status`                               |
| Permissions | `doubts:ask` (own), `doubts:answer` (`all` or `batch`)                                                                                                                                                                                                                           |
| Reach       | A learner asks only about a course they are enrolled in (the course pages' reach rule). Staff at `batch` see the doubts of learners in the batches they teach, about no course or about a course published to those batches (D6); at `all`, every doubt                          |
| Notices     | `doubt.asked` to the trainers who teach the learner; `doubt.answered` and `doubt.follow_up` between the two sides; `doubt.resolved` and `doubt.reopened` to the learner when staff change the status, `doubt.reopened` to the staff in the thread when the learner does (TRN-07) |
| Erasure     | ADM-11 removes the text of an erased learner's doubts and replies; the threads and counts stay                                                                                                                                                                                   |
| Tests       | `test/engagement.e2e-spec.ts`, `test/staff-scope.e2e-spec.ts` (D6), `test/trainer-workflows.e2e-spec.ts` (notices, filters)                                                                                                                                                      |

Attachments, turning a doubt into an FAQ and response-time figures are Phase 5 (F-27 extras).

## Phase 5 (3 October 2026)

- **Opening a thread reads its notices**: the learner or staff member who opens a doubt has the
  notices that lead to it marked read (`NotificationsService.markReadAt`), whichever portal they
  were sent for. Tests: `test/integration.e2e-spec.ts`.
