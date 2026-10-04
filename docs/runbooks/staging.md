# Staging: putting the demo somewhere people can reach it

This is Option A of the architecture plan (§9.1): one virtual machine running the whole stack
behind a reverse proxy that obtains HTTPS on its own. It is the topology the plan recommends when
a VM can be had, and it is the one these files are written for.

**Staging holds demonstration data only.** Never point it at a real institute's records: the plan
sets that boundary in §9.5, and everything below assumes it.

---

## What you need before you start

| Thing                                              | Where                                                                       | Cost                           |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| A small VM, 2 vCPU and 4 GB or better, with Docker | Oracle Cloud Always Free (Ampere A1) is what the plan checked; any VM works | Free tier, capacity permitting |
| A hostname pointing at it                          | DuckDNS, or a domain you own                                                | Free                           |
| Ports 80 and 443 open to the internet              | The VM's firewall **and** the vendor's security list                        | —                              |
| A GitHub account that can read this repository     | For the images CI publishes                                                 | Free                           |

The plan's §9.2 records what each free tier actually allows, and what it does when you exceed it.
Re-read it before relying on any of it: those limits changed twice in 2026.

---

## First deployment

**1. Get the images.** CI builds four on every pull request and pushes them on every merge to
`main` (`.github/workflows/ci.yml`, job "Container images"): `ghcr.io/<owner>/lms-api`,
`lms-web`, `lms-runner` (the sandbox runner) and `lms-sandbox` (the image learners' code runs in,
ADR-0016). They are built for `linux/amd64`; on an Arm VM such as Ampere A1, either add
`platforms: linux/amd64,linux/arm64` to those steps in `ci.yml` (slower, emulated builds) or build
the four images on the VM. If the repository is private, make a read-only personal access token
with `read:packages` and sign the VM in once:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <your-github-user> --password-stdin
```

**2. Put the repository on the VM.** Only the infrastructure files are needed, but a clone keeps
updates simple:

```bash
git clone https://github.com/<owner>/<repo>.git ~/lms && cd ~/lms
```

**3. Write the environment file.**

```bash
cp .env.staging.example .env.staging
```

Fill in every placeholder. Generate each secret separately, and do not reuse one anywhere else:

```bash
openssl rand -base64 32          # once per JWT secret, for RUNNER_TOKEN, and for the database and MinIO passwords
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'a password for the mail page'
getent group docker | cut -d: -f3   # DOCKER_GID: the runner joins this group to reach Docker
```

Put the Caddy hash in single quotes in `.env.staging`, as the example shows: it contains `$`, and
Compose reads an unquoted `$` as the start of a variable, so the password would never match.

`.env.staging` is git-ignored. It never goes near the repository.

**4. Start it.**

```bash
COMPOSE="docker compose --env-file .env.staging -f infra/compose.staging.yml"
$COMPOSE --profile sandbox-image pull   # includes the sandbox image; the runner never pulls one itself
$COMPOSE up -d
```

PostgreSQL is not pulled: its image, PostgreSQL 16 on Alpine with pgvector compiled in
(`infra/postgres`, ADR-0026), is built on the VM by `up` the first time — the pull step says it must
be built, which is expected. The "Deploy to staging" workflow builds it and restarts it, on the same
volume, before the migrations run.

Caddy asks Let's Encrypt for a certificate the first time it starts. If it cannot, the cause is
almost always that port 80 is not actually reachable from the internet — check the vendor's
security list as well as the VM's own firewall.

**5. Create the schema and the demo.**

```bash
$COMPOSE run --rm api pnpm exec prisma migrate deploy
$COMPOSE run --rm api pnpm demo:reset
```

`demo:reset` drops and rebuilds everything, then seeds the demonstration institute. It refuses to
run when `APP_ENV=production`.

**6. Check it.**

```bash
curl -fsS https://<your-host>/api/v1/health/ready && echo ok
```

Then open `https://<your-host>/` and sign in. The accounts are in the demo script below. As an
administrator, Settings › System health shows whether the sandbox answers; a practice problem's
Run proves it end to end.

---

## Afterwards

**Deploying a new build.** Run the "Deploy to staging" workflow from the Actions tab, with the
image tag you want (a commit sha, or `latest`). It pulls, runs the migrations as their own step,
restarts, and then waits for the health endpoint to answer before reporting success. Doing it by
hand on the VM is the same three commands as step 4 and 5 above, without the reset.

**Keeping the demo current.** The seed writes a fortnight of classes either side of the day it
ran, so a demonstration prepared last month opens on an empty timetable.

```bash
$COMPOSE run --rm api pnpm demo:advance
```

moves every date by the same number of days so that today has classes and an open test window,
without disturbing the attendance, submissions and results already recorded. It also brings each
class's status up to the clock: a class carries its status as a column rather than working it out
when it is read, so without this the class taught this morning stays "scheduled" and is left out of
the roll-call nudge, the administrator's "waiting for a roll call" tile and the trainer's offer to
publish its recording. The deploy workflow runs it for you.

**Watching it.** Uptime Kuma runs on the VM at `https://<your-host>/status/`, behind the same
password as the mail page. Add two monitors on first use: `https://<your-host>/api/v1/health/ready`
and `https://<your-host>/login`, both at five minutes. UptimeRobot's free tier became
non-commercial in December 2024 (plan §9.2), which is why the monitor is self-hosted.

**Reading the email the platform sends.** Mailpit catches everything and delivers nothing:
`https://<your-host>/mail/`, same password. This is how you show that an invitation really was
sent without sending anybody anything.

**Uploads and private files.** Signed upload and download links need a public host for the store
(`S3_PRESIGN_ENDPOINT` in `.env.staging`): a subdomain such as `files.<your-host>` whose proxy hands
requests to `minio:9000` unchanged. Without one, the API refuses those links (503) instead of
naming `http://minio:9000`, which no browser reaches; public files (logos, photos) work either way
through `/files`. See `docs/runbooks/operations.md` §6.

**Errors.** Sentry's free Developer tier (5,000 errors a month) is the plan's choice. It is not
wired in: nothing in this build sends to it, and adding it would put a third-party DSN into the
images. If you want it, add `@sentry/node` to the API and `@sentry/nextjs` to the web app behind an
environment variable, so a deployment without the DSN stays exactly as it is now.

**Backups.** There are none by default, and the free tiers offer none. If the demonstration data is
worth keeping, put a nightly dump somewhere else:

```bash
$COMPOSE exec -T postgres pg_dump -U lms lms | gzip > "lms-$(date +%F).sql.gz"
```

**Idle reclamation.** Oracle's Always Free tier may reclaim an instance whose 95th-percentile CPU
stays under 20% for a week (plan §9.2). A demonstration VM is idle almost all the time. Either
accept the risk and keep `demo:reset` to hand, or give it something light to do.

---

## What is deliberately not here

- **No production use.** Single VM, no redundancy, no backups, free-tier terms. The plan says so in
  §9.4 and §9.5, and so does this runbook.
- **No Judge0.** It needs privileged containers and cgroup v1 (plan §9.3). Learners' code runs in
  the first-party sandbox runner instead (ADR-0016): one throwaway container per job, with no
  network, a read-only root, no capabilities and CPU, memory and process limits. The runner holds
  the VM's Docker socket, which is why it is reachable only by the API and holds nothing else.
  A Java job needs about 640 MB while it runs; on a 4 GB VM keep `RUNNER_CONCURRENCY` at 2.
- **No real email delivery.** Mailpit catches it. Resend's free tier is the plan's choice when real
  delivery is wanted; that is a `SMTP_*` change and a domain to verify.

---

## The demo script

Twenty minutes, in the order the plan lays out (§21.5). Run `demo:advance` first so the dates are
today's.

| #   | As          | What to show                                                                                                                                                                                                     |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | —           | The branded sign-in page. Change the primary colour in Settings › Branding in another tab and reload: the whole application re-themes without a deployment.                                                      |
| 2   | Admin       | Students: the list, a record, the import wizard with its three deliberately bad rows and the error report.                                                                                                       |
| 3   | Admin       | Batches: the roster, the trainers, the timetable, the content published to it, and the Attendance tab.                                                                                                           |
| 4   | Admin       | Courses: the builder, a lesson, and publishing to a batch.                                                                                                                                                       |
| 5   | Trainer     | The dashboard: today's classes, the roll call waiting, the batches, the learners slipping. Mark a class: everybody starts present, toggle two, submit. Then correct one — it asks why, and keeps who changed it. |
| 6   | Student     | The dashboard, a course, a lesson, and the practice question that finishes it.                                                                                                                                   |
| 7   | Student     | An assignment: answer a question, see it marked, watch the next module unlock.                                                                                                                                   |
| 8   | Student     | Practice: solve a coding problem. Run checks the visible cases; Submit checks every case in the sandbox, and hidden cases come back as a verdict only (ADR-0016).                                                |
| 9   | Student     | The profile: completeness and what is missing, a resume, a document awaiting verification.                                                                                                                       |
| 10  | Admin       | The dashboard: the attention band, the fifteen tiles with their definitions, and the six that say which module would supply them.                                                                                |
| 11  | Admin       | A report: filter it, sort it, export it. Open Exports; the file has the same number of rows as the table did.                                                                                                    |
| 12  | Super Admin | Settings: feature flags, navigation labels, vocabularies, email wording with a test send visible in Mailpit, and the audit log behind all of it.                                                                 |

The accounts are `superadmin@siacademy.example`, `admin@siacademy.example`, `trainer1@siacademy.example` and
`student01@siacademy.example`. Their passwords are the ones you put in `.env.staging` as
`SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD`; they are never written into this repository.
