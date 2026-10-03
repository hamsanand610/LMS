# reports module

The admin dashboard, the report pages and the export jobs (journey J-12).

| Aspect        | Detail                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes        | `GET /reports/dashboard`, `GET /reports`, `GET /reports/:name`, `POST /exports`, `GET /exports`, `GET /exports/:id`, `GET /exports/:id/download`, `GET /trainer/dashboard`                                                                                                                |
| Permissions   | `reports:read` (`all` or `batch`) for everything read; `reports:export` (`all` or `batch`) to ask for a file. The trainer dashboard is `authenticated` and limits itself to the caller's own batches                                                                                      |
| Reports       | students, attendance, progress, assessments, assignments. Each is a filtered table with a summary and a chart over the same rows                                                                                                                                                          |
| One code path | The page asks for a slice of the rows and an export asks for all of them, from the same builder and the same sort. A downloaded file cannot disagree with the table it came from — the criterion J-12 is judged on                                                                        |
| Where rows    | Built live from the source tables, not from aggregates. See ADR-0012 for why, and for what changes at scale                                                                                                                                                                               |
| Scope         | The batches a report may read are narrowed once — by the caller's scope, then the programme, trainer and batch filters — so no report repeats that reasoning. A trainer asking for a batch they do not teach gets no rows rather than somebody else's                                     |
| Definitions   | Every tile and every report carries the sentence that says how its figure is worked out, and the page shows them in a drawer. Nothing on the dashboard is a number without a definition                                                                                                   |
| Placeholders  | The customer asked for fifteen metrics. The six whose module is not in this build (projects, trainer performance, placement, company-wise placements, certificates, feedback) are returned with `value: null` and the reason, so the page states what is missing rather than inventing it |
| Exports       | A job writes CSV or `.xlsx` to private storage as the person who asked for it, so the rows are the ones their permissions allow. The file is kept seven days; the link is signed for five minutes. Three exports at once per person                                                       |
| Attention     | The dashboard's band counts what wants a person: classes without a roll call, learners below the threshold, answers awaiting marking, documents to verify, failed jobs. Each links to the rows behind it                                                                                  |
| Audit         | `export.requested`, `export.downloaded`                                                                                                                                                                                                                                                   |
| Tests         | `test/reports.e2e-spec.ts` (the tiles and their definitions, sorting, paging, scope, an export whose row count equals the filtered total, expiry); `apps/web/e2e/operations.spec.ts` (J-12 through the pages)                                                                             |

## Phases 3 and 4 (3 October 2026)

- **Feedback figures (D10; review M1, M2).** One helper (`feedback-rounds.ts`) serves the
  feedback report, the trainers report and the dashboard: a round (one period of one form) is
  in a date range when its date is, never split by the day each answer came in, and gives
  ratings only once it has five answers, so no choice of dates or filters narrows a figure to
  fewer people. Figures go only to `feedback:read` holders (a trainer's own at `own`); the
  dashboard says why when it shows none.
- **Filters narrow, never replace (review M1).** A report's `trainerId` filter is combined with
  the viewer's own limit, never put in its place.
- **The trainer's dashboard** needs `batches:read` at `batch` or wider (review L4): a trainer
  whose role was taken away keeps their assignments on record, not this view of them.

- **New reports (ADM-06):** certificates; placements (`requires: placements:read`); feedback
  (`requires: feedback:read`; a form's figures only from five answers); trainers (a trainer sees
  their own row; no composite score, Q-16). A report whose rows need a further permission is
  neither offered nor opened without it. Projects stay pending (F-15, a later phase).
- **Exports by export scope (SEC-05).** An export's batches are those both `reports:read` and
  `reports:export` reach. Export links point at the caller's portal (`/trainer/exports`, TRN-09).
- **Tests:** `test/reports.e2e-spec.ts`, `test/staff-scope.e2e-spec.ts`.

## Phase 5 (3 October 2026)

- **One course-progress rule** for the dashboard and the progress report: they count the learners
  taking a course (active or completed; a withdrawn enrolment is access that ended, D4) and, once
  a view is narrowed to batches, only the courses those batches have (D6). The report keeps
  withdrawn enrolments in its table, marked, and out of its figures.
