# ADR-0042 — Production on AWS: CloudFront, a private load balancer and one Docker host

- **Status**: accepted — the client's AWS deployment brief of 7 October 2026 ("start the final AWS
  deployment execution … do not split this into multiple approval phases"), from the readiness
  review in `docs/runbooks/aws-readiness.md`. The production environment is created by the deploy
  workflow once the account's one-time bootstrap is done (`docs/runbooks/aws-production.md`).
- **Date**: 2026-10-07
- **Phase**: none — between Phase 9 (complete) and Phase 10 (not started). Building production
  before Phases 10 to 14 is a deviation from the roadmap's order, made on the client's instruction
  and recorded in `docs/ROADMAP.md` (operating rule 47).
- **Builds on**: ADR-0006 (pg-boss; one API replica), ADR-0016 (the sandbox runner needs a Docker
  host), ADR-0017 (S3-compatible storage), ADR-0024 and ADR-0041 (AI data classes; personal never
  without recorded terms), ADR-0026 (pgvector)
- **Supersedes**: `docs/architecture/OVERVIEW.md` §5's "Production — not defined yet"

## Context

The readiness review found nothing in the code blocking AWS, and set the constraints a design has to
meet:

- **One API replica.** Rate limits and the AI gates live in process memory until Phase 12.
- **A Docker host for the runner.** It starts one locked-down container per job through the Docker
  socket, which rules out Fargate.
- **HTTPS everywhere.** The API refuses to start in production without secure cookies and a public
  `https` address for public files.
- **Build-time addresses.** The web image builds its API and storage addresses into the bundle and
  its security headers, so it is built per site.
- **Exactly one trusted proxy.** The API trusts one hop (`trust proxy` 1). Sign-in and AI rate limits
  key on the address that hop reports.
- **Storage access keys.** The S3 driver signs with keys; there is no instance role yet.
- **The production seed guard.** The product seeds production only when told it is a new
  deployment (`LMS_ALLOW_PRODUCTION_SEED=1`). It adds a new module's permissions and flags itself
  when the API starts.
- **Operating rule 41.** Production changes only through the pipeline, and local tooling never
  points at production.
- **Rule 35.** AI and the optional modules stay off in production until the client approves them.

There is no custom domain yet. The institute is in India (`Asia/Kolkata`, `en-IN`).

## Decision

1. **Region**: `ap-south-1` (Mumbai). The data stays in India, close to the learners.
2. **Topology.**
   - **Edge**: CloudFront serves everyone over HTTPS, on its own certificate until a domain and an
     ACM certificate are configured.
   - **Load balancer**: CloudFront reaches an **internal** Application Load Balancer through a
     **VPC origin**, so nothing but CloudFront is reachable from the internet.
   - **Host**: the load balancer routes `/api/*` to the API (port 4000, health `/health/ready`) and
     everything else to the web app (port 3000, health `/login`). Both run on **one EC2 host**
     (Ubuntu 24.04, Docker Compose, `infra/compose.production.yml`) in a private subnet, with the
     sandbox runner, the sandbox image, and the API's embedded worker.
   - **Database**: **RDS PostgreSQL 16** (16.5 or later, for pgvector 0.8). It is encrypted, requires
     TLS, keeps 7 days of daily backups, and is protected from deletion.
   - **Files**: two **S3** buckets. Public files are served by CloudFront under `/files` (Origin Access
     Control), and both buckets stay private. Browsers upload and download through signed
     path-style links on `s3.<region>.amazonaws.com`.
   - **Network**: one NAT gateway gives the private subnets outbound access, and an S3 gateway
     endpoint keeps S3 traffic inside AWS.
3. **The client's address.** The load balancer passes CloudFront's `X-Forwarded-For` on unchanged
   (`preserve`). The API's single trusted hop therefore yields the address CloudFront saw, and no
   caller can forge it: the load balancer is reachable only through the VPC origin.
4. **Secrets.**
   - CloudFormation generates them in Secrets Manager: the database password, the JWT secrets, the
     data-encryption key, the runner token and the first Super Admin's password.
   - The storage key belongs to an IAM user that can touch the two buckets and nothing else. It goes
     straight from CloudFormation into Secrets Manager.
   - Only the host reads them, at release time, into files on tmpfs that only root can read. Each
     container gets only its own.
   - No secret is in GitHub, an image, a log, a stack output or the repository.
5. **Pipeline** (`.github/workflows/deploy-production.yml`): the only way production changes.
   - **Trigger**: a `production-*` tag on a commit of `main`, or a manual run, which also rolls back.
   - **Credentials**: jobs assume a role through GitHub's OpenID Connect, trusted only from this
     repository's `production` environment. No AWS key is stored in GitHub.
   - **Stack**: CloudFormation changes it with an execution role of its own, without automatic
     rollback, so a failed change leaves the database and the network as they were.
   - **Images**: built per commit into ECR with immutable tags. The web image's tag adds a
     fingerprint of the site's addresses.
   - **Release**: before each release the database is snapshotted. The release runs on the host
     through SSM Run Command (no SSH, no key pair). Migrations run as a one-off task from the
     release image, the API's build stage.
   - **New deployment only**: the base seed and the first Super Admin run once, with the product's
     production-seed flag on that one command.
   - **Checks**: the load balancer's health, then anonymous smoke checks through CloudFront.
6. **The production overlay** `clients/si-academy` has SI Academy's branding and settings, with every
   AI flag and every optional module **off** (rule 35). A Super Admin turns modules on after
   approval.
7. **AI.**
   - The provider is `none`.
   - The data classes are `public,course`, as the readiness review set them. The template cannot
     express `personal` (ADR-0041), and the host refuses it as well.
   - The keys go only to Secrets Manager (`si-academy/production/ai`), entered there by the client
     and never through the repository.
8. **Email** is `none` until Amazon SES has a verified sender and production access. Then
   `EmailDriver=ses` gives the API SES's SMTP endpoint, with the password derived on the host from a
   sending-only key.
9. **Observability.**
   - **Logs**: the containers write to CloudWatch Logs (90 days). The releases' full logs go there
     too.
   - **Alarms**: host recovery and reboot; API and web health; server errors; database CPU,
     storage and memory; host memory and disk.
   - **Optional**: an alarm address and a monthly budget.

## Consequences

- Production can be created and changed from GitHub alone, after one bootstrap by an account
  administrator. A rollback is a manual run with an earlier commit, and a database restore uses the
  pre-release snapshot (a decision for a person, never automatic).
- **One host is a single point of failure.** EC2 recovers it onto healthy hardware, and it holds no
  data: the database and files are managed services. Scaling out needs Phase 12's shared store
  first.
- **Cost** at low traffic is roughly US$135–150 a month before tax:
  - the host (t3.medium) about $33;
  - the database (db.t4g.small) about $29;
  - the NAT gateway about $45;
  - the load balancer about $20;
  - the rest (storage, logs, alarms, secrets, CloudFront) under $15.

  The NAT gateway is the largest lever. A host in a public subnet with no inbound rule would avoid
  it, but the readiness review placed the host in a private subnet.

- **The site's address** is CloudFront's until a custom domain is added. Adding one changes the web
  image (its addresses are built in), and the pipeline rebuilds it.

## Alternatives considered

- **ECS on Fargate**: it cannot give the runner a Docker host. ECS on EC2 would add a cluster to run
  one host.
- **An internet-facing load balancer behind CloudFront, guarded by a secret header**: it works, but
  the load balancer stays reachable from the internet, and the hop from CloudFront travels outside
  the VPC.
- **Pulling the images from GHCR**: it needs a GitHub token on the host. Building into ECR in the
  pipeline needs none, and the web image must be built per site anyway.
- **Running the base seed on every release**: the product forbids it, and the API keeps permissions
  and flags current itself.

## Not done here (follow-ups)

- A custom domain (an ACM certificate in us-east-1 and DNS).
- Amazon SES (a verified sender, production access).
- AWS WAF.
- A Multi-AZ database.
- CloudTrail, GuardDuty and Security Hub at the account level.
- An instance role for storage instead of keys (a code change).
- The shared store for rate limits and gates (Phase 12).
- Staging on AWS and the final UAT (Phase 14).
