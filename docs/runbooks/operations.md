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

## 6. Security settings and their limits (Phase 6)

**Storage links.** Browsers follow three kinds of link to stored files, and each has to name a host
they can reach:

| Link                                 | Set by                | Outside local                                                                                                                                                 |
| ------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public files (logos, photos)         | `S3_PUBLIC_BASE_URL`  | Required: a public `https` address, or the API does not start                                                                                                 |
| Signed uploads and private downloads | `S3_PRESIGN_ENDPOINT` | A public `https` host that proxies to the store unchanged. Unset, such links are refused with `503 storage_not_public` rather than naming `http://minio:9000` |
| The API's own calls to the store     | `S3_ENDPOINT`         | The internal address (`http://minio:9000` in the compose stacks)                                                                                              |

Caddy serves `/files/<public bucket>/…` for GET and HEAD only, under `Content-Security-Policy:
sandbox` and `nosniff`; every other `/files` path answers 404. SVG is not accepted for any image
shown to others.

**Stored secrets.** An integration's secret (Settings → Integrations) is sealed with AES-256-GCM
under `DATA_ENCRYPTION_KEY`, or, when that is empty, a key derived from `JWT_ACCESS_SECRET` for
this purpose only. Changing either key leaves the stored secrets unreadable: enter them again. The
API never returns a stored secret, only whether one is set.

**Sessions.** Signing out, revoking a device, an administrator ending a session, a role change, a
deactivation and a password reset end the session's access token too, within 15 seconds on a busy
process and at once on the process that made the change. A session lasts as long as its sign-in
(`JWT_REFRESH_TTL_DAYS`), however often it refreshes; "remember me" decides whether its cookies
outlive the browser. Two tabs refreshing with one token within 30 seconds both carry on; a rotated
token presented later ends its whole family (audited as `auth.refresh_reuse_detected`).

**Rate limits are per process.** The counters, the auth caches and the one-run-per-person gate live
in the API process's memory. One API instance is the supported deployment (the staging stack runs
one); behind several instances every limit would be multiplied by their number. A shared store is
Roadmap Phase 12. The limits worth knowing when a campus shares one address: sign-in 5 failed tries
per account and address in 15 minutes and 150 per address (a successful sign-in is not counted),
refresh 1,200 per address in 5 minutes, and 600 requests per session in 5 minutes for everything
else.

**SI Academy AI is off** (Roadmap Phase 7). `AI_PROVIDER=none`, the default, answers nothing;
`fake` is a deterministic stand-in for local development and tests, and the API refuses to start
with it outside local. The flag `module.ai` and its options (`ai.assistant`, `ai.workspace`,
`ai.lab_hints`, `ai.semantic_cache`) are off by default, and no option opens anything while
`module.ai` is off. Provider keys, when a cloud provider arrives (Phase 7B), are server-only
environment variables; the logger redacts provider keys and authorization headers.

**Start-up refusals outside local.** The API refuses to start with `COOKIE_SECURE=false`, a short
or placeholder (`change-me`, `replace-me`) secret, the local development passwords, a short
`RUNNER_TOKEN`, or an `S3_PUBLIC_BASE_URL` that is not a public `https` address. The route map
(Swagger) is published locally only.
