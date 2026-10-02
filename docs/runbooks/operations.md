# Operations

Procedures for the Super Admin and administrators that the Phases 3–4 build added, and the
procedure for taking a phase's migration onto the main local database. Every action below is
audited; the audit log (Super Admin: the whole institute; an administrator: their own actions)
is where to confirm what happened.

## 1. Failed background jobs

Background work (e-mail, notifications, imports, exports, reminders, alerts) runs as pg-boss jobs
(ADR-0006). A job that fails after its retries is kept as failed.

1. Open **System health** (admin portal, Super Admin). The **Failed jobs** card lists recent
   failures: the queue, when it failed and the error message. Nothing else of the job (its data
   may hold personal details) is shown.
2. Read the message first. Retry only when the cause has gone (the mail server is back, the
   sandbox runner is up); a job that fails on its own data will fail again.
3. **Retry** sends that job back to its queue (`POST /admin/jobs/:id/retry`, audited `jobs.retried`).
4. If the same job keeps failing, leave it, note the message and the queue, and raise it with the
   development team; do not delete rows from the `pgboss` schema by hand.

## 2. Retention

The `retention.sweep` job runs every night at 02:30 India time (the queue schedules in Asia/Kolkata) and removes what the platform no
longer needs. Each sweep that removes anything records `retention.swept` with the counts.

| What                | When it goes                                                            | What stays                       |
| ------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| Report export files | When their download link expires                                        | The export row, marked `expired` |
| Import sheets' rows | 30 days after the import finished                                       | The import's counts and outcome  |
| Audit entries       | Only when **Settings → Records → Keep audit entries for (days)** is set | Everything newer than the period |

- The audit period is off by default (the log is kept for ever). When set, it is at least 1,095
  days (three years, the requirements' retention schedule) and at most 3,650.
- Changing it is a settings change: Super Admin only, and audited.
- To confirm a sweep ran: the audit log, action `retention.swept` (only when something was
  removed), or the API log line "Retention sweep".

## 3. A learner's privacy request (export or erasure)

Requests come from the learner through the contact named in the privacy notice (IR-24). The
platform does not take them itself, so **confirm the requester's identity outside the platform**
(for example a reply from the e-mail address on the account) before acting.

**Export.** Open the learner (admin portal → Students → the learner) → **Privacy** tab →
**Export data**. A JSON file downloads: account, profile, batches, enrolments, lessons,
attendance, submissions, tests (scores only once released), documents and résumés by name,
applications, doubts, certificates, named feedback answers, recent notifications, active
sessions. Staff notes and staff-only fields are not included. Hand the file over through a
channel the learner controls; do not keep copies. Audited `privacy.exported`.

**Erasure.** Export first if the learner asked for both. Then **Privacy** tab → **Erase…**, type
the learner's e-mail address and the reason (for example "Requested by e-mail on 3 October
2026"), and confirm. It cannot be undone. What happens:

- the account becomes "Erased learner" with an address nobody can use, no password and no
  sessions; it leaves every list;
- profile details, documents, résumés, photo, staff notes, notifications, activity and drafts are
  deleted, their files removed from storage;
- certificates are withdrawn (a verifier is told so) and their PDFs deleted;
- batch places end; the text of answers, doubts and comments is removed;
- marks, attendance, progress and counts stay, belonging to nobody, so reports do not change;
- the audit log keeps its entries (the security record), subject to the retention period above.

An account that also holds a staff role is refused: remove the staff roles (or deactivate a staff
account) first. Audited `privacy.erased`, with the counts and the reason.

## 4. Certificates

- **Revoke** (Certificates page, administrators): give the reason; the learner is told, the public
  check says "revoked", the PDF no longer downloads. **Reinstate** restores it, again with a
  reason. Both are audited; the certificate's words never change (D9).
- **Redraw** draws the PDF again from the stored record, for example after a storage problem.
- **Signatory** (Settings → Records, Super Admin): the name and title printed under the
  signature line of certificates issued **from then on**; one already issued keeps the
  signatory it was issued with.

## 5. A phase's migration on the main local database

The main local database is `lms` in the Docker container `lms-postgres-1` (port 5433). Other
PostgreSQL instances on the machine (port 5432 and other projects' containers) are never touched.
Only do this after the client approves the phase.

1. **Back up.** `docker exec lms-postgres-1 pg_dump -U lms -d lms -Fc` to a file outside the
   repository (`E:\LMS-backups\lms-before-<phase>.dump`), and write its SHA-256 beside it.
2. **Verify the backup.** Restore it into a scratch database in the same container
   (`createdb lms_backup_check`, `pg_restore --no-owner`), compare row counts of every table with
   `lms`, then drop the scratch database.
3. **Record the counts** of every table in `lms` (before).
4. **Migrate.** `pnpm db:migrate` (Prisma `migrate deploy`: only the phase's new, additive
   migration applies).
5. **Seed the base only.** `pnpm db:seed` (the permission catalogue, role bundles and their named
   changes, flags). Never `db:seed:demo` or `demo:reset` on `lms`: they replace sample data.
6. **Compare.** Row counts after against before: only the expected rows change (new permissions,
   role grants, settings rows).
7. Write the result in `docs/PROGRESS_LOG.md`: file, size, checksum, verification, migration names,
   counts before and after.
