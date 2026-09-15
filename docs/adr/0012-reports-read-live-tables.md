# ADR-0012 — Reports read the live tables, and one code path serves the page and the file

- **Status**: accepted
- **Date**: 2026-09-15
- **Phase**: 5 (Attendance and reporting)

## Context

The master report (F-19 §5) describes reporting as "read models: nightly and on-demand aggregation
tables (`agg_batch_daily`, `agg_course_progress`, `agg_test_scores`, …) plus live queries for small
scopes", and sets AC-01.4: the dashboard loads in under two seconds at the 95th percentile with
pre-aggregated data for 5,000 students.

Phase 5 had to make reporting real, and two questions had to be settled before any of it was built.

**Where do the figures come from?** Aggregate tables are a performance decision, and they carry a
cost of their own: a second copy of every number, a job that keeps it current, and a class of bug
where the copy and the source disagree. Nothing else in this build has a second copy of anything —
one of the rules the platform has held to since Phase 3 is that every percentage comes from one
place, so two pages cannot show different numbers for the same thing.

**What guarantees that an exported file matches the table it came from?** J-12's exit criterion is
"export equals filtered rows". It would be easy to build the table with one query and the file with
another, and easy for the two to drift apart the first time a filter changes.

## Decision

**1. Reports are computed from the source tables on every request.** There are no aggregate tables
in this build. Each report is a builder that reads what it needs, narrows it to the batches the
caller may see, and returns rows, a summary and a chart. The demo's volumes (60 learners, 6 courses,
three batches) are answered in tens of milliseconds, and the figures cannot be stale because there
is nothing to be stale.

**2. The page and the export share one builder and one sort.** `ReportsService.page` returns a slice
of the sorted rows; `ReportsService.allRows` returns all of them in the same order, and that is what
the export job writes. A filter, a sort or a new column changes both at once because there is only
one of each. The API test asserts that the file's row count equals the filtered total the page
showed.

**3. An export runs as the person who asked for it.** The job reloads that user's permissions and
builds the rows through the same scope narrowing, so a trainer's export carries their batches and
nobody else's. A job is not a way around a permission.

**4. The rows a report can sort by are declared, not inferred.** Each builder names its columns and
which of them are sortable; anything else is refused with a validation error rather than silently
ignored, so a saved link with a stale column says so.

## Alternatives considered

- **Aggregate tables now.** Rejected for the demo: they solve a problem this build does not have,
  and they introduce a source of disagreement between two copies of the same figure at exactly the
  moment the product is trying to demonstrate that its numbers agree.
- **A separate export query.** Rejected: it is the cheapest way to build the defect J-12 exists to
  catch.
- **Streaming the file in the request.** Rejected: an export of every student in an institute is
  not a request-sized piece of work, and the plan (DP-A26) already describes exports as jobs with a
  list, a status and an expiry.

## Consequences

- **AC-01.4 is not demonstrated at 5,000 students.** It is met at demo volumes; the aggregate tables
  the master report names remain the documented path to that scale and are not built here. This is
  recorded as a stated deviation in the Phase 5 progress log rather than quietly assumed away.
- **A report that grows expensive is visible.** Because every report is a plain query against the
  source, a slow one shows up as a slow request rather than as a stale row, and the fix (an
  aggregate for that one report) can be made where it is needed instead of everywhere.
- **Adding a report is adding a builder.** Its columns, definitions, summary and chart live
  together, and it is exportable the moment it exists, with no second implementation to write.
- **Column changes reach exported files immediately.** There is no separate export template to
  update, and no window in which the two disagree.
