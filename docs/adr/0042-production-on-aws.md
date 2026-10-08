# ADR-0042 — Production on AWS: CloudFront, a private load balancer and the existing Docker host

- **Status**: accepted — the client's AWS deployment brief of 7 October 2026 ("start the final AWS
  deployment execution … do not split this into multiple approval phases"), from the readiness
  review in `docs/runbooks/aws-readiness.md`. **Amended on 8 October 2026** after the client's
  read-only reconciliation of the real account: Sydney instead of Mumbai, the existing EC2 instance
  and default VPC instead of new ones, no NAT gateway, Gemini as the only AI provider on its free
  tier, and a deploy user while the organization denies OpenID Connect providers. The production
  environment is created by the deploy workflow once the account's one-time bootstrap is done
  (`docs/runbooks/aws-production.md`).
- **Date**: 2026-10-07, amended 2026-10-08
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

The read-only inventory of the account (8 October 2026) added:

- **The account**: on AWS's Free plan with US$120 of credits, the plan ending on 7 April 2027. It is
  a member of an AWS Organization whose policy allows the deployment's regional services in
  ap-southeast-2 but denies them in us-east-1, and denies `iam:CreateOpenIDConnectProvider`
  everywhere.
- **The host already exists**: `i-0659cb9f754afdf5d`, a t3.small (2 vCPU, 2 GiB) running Amazon
  Linux 2023 on x86_64 with a 30 GiB encrypted gp3 disk, in the default VPC's public subnet in
  ap-southeast-2c. It has no IAM role and IMDSv2 with two hops, and its group launch-wizard-1 allows
  SSH from one address but ports 80 and 443 from anywhere.
- **Nothing else exists**: no other VPC, no NAT gateway, Elastic IP, RDS, S3, ECR, secret, stack,
  load balancer or CloudFront distribution. The only budget is the Zero Spend Alert.
- **RDS**: PostgreSQL 16.15 is offered, and db.t4g.micro only in ap-southeast-2b and 2c.

There is no custom domain yet. The institute is in India (`Asia/Kolkata`, `en-IN`).

## Decision

1. **Region**: `ap-southeast-2` (Sydney), locked; the client's choice, where the host already runs.
   The learners' data is stored in Australia, and requests from India take roughly 0.1–0.15 s more
   than they would from Mumbai.
2. **Topology.**
   - **Edge**: CloudFront serves everyone over HTTPS, on its own `*.cloudfront.net` certificate. A
     custom domain needs an ACM certificate in us-east-1, which the organization denies today.
   - **Load balancer**: CloudFront reaches an **internal** Application Load Balancer through a
     **VPC origin**, so nothing but CloudFront reaches the application.
   - **Host**: the **existing EC2 instance**, never created, replaced or stopped by the stack. The
     load balancer routes `/api/*` to the API (port 4000, health `/health/ready`) and everything else
     to the web app (port 3000, health `/login`), both in Docker Compose
     (`infra/compose.production.yml`), with the sandbox runner, the sandbox image and the API's
     embedded worker. Its own security group allows only the load balancer on those ports.
   - **Database**: **RDS PostgreSQL 16.15** on db.t4g.micro, single zone (the host's), 20 GiB gp3
     (up to 40 by itself), encrypted, TLS required, protected from deletion. Daily backups are
     kept **1 day**: the Free plan rejects 7, 3 and 2 days (RDS: "exceeds the maximum available
     to free tier customers"), and the client chose not to upgrade the plan. Every release also
     takes a manual pre-release snapshot (the newest five are kept), which this limit does not
     affect. Raise `DbBackupRetentionDays` once the account is on the Paid plan.
   - **Files**: two **S3** buckets. Public files are served by CloudFront under `/files` (Origin Access
     Control), and both buckets stay private. Browsers upload and download through signed
     path-style links on `s3.<region>.amazonaws.com`.
   - **Network**: the account's **default VPC**. The stack adds two private subnets without an
     internet route: 172.31.48.0/24 in ap-southeast-2c (the host's zone, for the load balancer) and
     172.31.49.0/24 in 2b. **No NAT gateway**: the host keeps its public subnet and reaches the
     internet itself, with no inbound rule but SSH from one address.
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
   - No secret is in an image, a log, a stack output or the repository.
5. **Pipeline** (`.github/workflows/deploy-production.yml`): the only way production changes.
   - **Trigger**: a `production-*` tag on a commit of `main`, or a manual run, which also rolls back.
   - **Credentials**: every job assumes the deploy role. Preferred: GitHub's OpenID Connect, trusted
     only from this repository's `production` environment, with no key stored anywhere. While the
     organization denies OpenID Connect providers, the fallback (`deployAuth: iam-user`) is a deploy
     user that can do **nothing but assume that role**. Its access key is made by an administrator
     in the console and kept only in the `production` environment's secrets. No restriction is
     bypassed: switching to OIDC later is a change of `deployAuth` and the removal of the key.
   - **Stack**: CloudFormation changes it with an execution role of its own, without automatic
     rollback, so a failed change leaves the database and the network as they were.
   - **Adopting the host** (`infra/aws/pipeline/adopt-host.sh`, each step only if not already so):
     1. tag it `Application=si-academy` and `Environment=production`;
     2. attach the stack's instance profile and app security group;
     3. set IMDSv2 to one hop, after the role is attached;
     4. close launch-wizard-1's ports 80 and 443 to the internet, leaving SSH as it is.

     The deploy role may do this to that one instance and that one group only.

   - **Images**: built per commit **in CI** into ECR with immutable tags, never on the host. The web
     image's tag adds a fingerprint of the site's addresses.
   - **Release**:
     - The host prepares itself (`infra/aws/host/prepare-host.sh`): Docker and the CloudWatch agent
       from Amazon Linux's repositories, Docker Compose v5.5.1 checked against its published
       SHA-256, 2 GiB of swap, the RDS authority.
     - Before each release the database is snapshotted.
     - The release runs through SSM Run Command, not SSH. Migrations run as a one-off task from the
       release image, the API's build stage.
   - **New deployment only**: the base seed and the first Super Admin run once, with the product's
     production-seed flag on that one command.
   - **Checks**: the load balancer's health, then anonymous smoke checks through CloudFront.
6. **Sized for 2 GiB.**
   - **Memory limits**: API 900 MiB with a 640 MiB heap, web 512 MiB with a 320 MiB heap, runner
     256 MiB, plus 2 GiB of swap.
   - **Learner code**: **one job at a time** (`RunnerConcurrency=1`), each in its own limited
     container.
7. **The production overlay** `clients/si-academy` has SI Academy's branding and settings, with every
   AI flag and every optional module **off** (rule 35). A Super Admin turns modules on after
   approval.
8. **AI.**
   - **Off**: the provider is `none`, and every AI flag is off.
   - **Gemini only**: no stand-in provider (Groq is removed from the deployment). When the client
     enables AI, it is Gemini **on its free tier**: the key comes from a Google project without
     billing, so usage cannot become paid. There are no model prices and no AI budget, and a small
     daily allowance per person (5 questions) protects the shared quota.
   - **Public only**: the allowed data is `public` until the client approves more. Free-tier prompts
     may be used by Google, and the learner's own records need ADR-0041's terms. The template and the
     host both refuse anything else.
   - **The key** goes only to Secrets Manager (`si-academy/production/ai`), entered there by the
     client and never through the repository.
9. **Email** is `none` until Amazon SES has a verified sender and production access. Then
   `EmailDriver=ses` gives the API SES's SMTP endpoint, with the password derived on the host from a
   sending-only key.
10. **Observability and cost control.**
    - **Logs**: CloudWatch Logs, kept 30 days. The releases' full logs go there too.
    - **Ten alarms**, within CloudWatch's free tier: host recovery and reboot, host memory and disk,
      API and web health, server errors, database CPU, storage and memory.
    - **Images**: ECR keeps the last 5 (release images 3).
    - **No budget** is created: the account keeps its own Zero Spend Alert.

## Consequences

- Production can be created and changed from GitHub alone, after one bootstrap by an account
  administrator. A rollback is a manual run with an earlier commit, and a database restore uses the
  pre-release snapshot (a decision for a person, never automatic).
- **One host is a single point of failure.** EC2 recovers it onto healthy hardware, and it holds no
  data: the database and files are managed services. Scaling out needs Phase 12's shared store
  first.
- **Cost** at low traffic is roughly US$70 a month at Sydney list prices, before tax and credits:
  - **Already running**: the existing host about $26, with its disk and public IPv4 address.
  - **New**:
    - the load balancer about $20;
    - the database about $20 with its storage;
    - Secrets Manager about $3;
    - logs, images and files about $1–2.
  - **No charge**: CloudFront, the alarms and the custom metrics stay within their free tiers.

  The credits last about 1.7 months. The Free plan closes the account when they run out or the plan
  ends, unless it is upgraded.

- **A long-lived key exists** while the deploy user is the fallback. It can only assume the deploy
  role, but it must be rotated, and deleted once OIDC is allowed.
- **The site's address** is CloudFront's until a custom domain is possible. Adding one changes the
  web image (its addresses are built in), and the pipeline rebuilds it.

## Alternatives considered

- **A new host and VPC with a NAT gateway** (this ADR's first version): about US$175 a month with the
  existing host still running. It would duplicate compute and spend the credits in about three
  weeks.
- **No load balancer**: CloudFront would reach the host's public address, guarded by a secret header.
  It saves about US$20 a month, but the application would no longer be private.
- **ECS on Fargate**: it cannot give the runner a Docker host. ECS on EC2 would add a cluster to run
  one host.
- **Pulling the images from GHCR**: it needs a GitHub token on the host. Building into ECR in the
  pipeline needs none, and the web image must be built per site anyway.
- **Running the base seed on every release**: the product forbids it, and the API keeps permissions
  and flags current itself.
- **Working around the OIDC denial**: not considered. The fallback uses only what the organization
  allows.

## Not done here (follow-ups)

- GitHub OIDC instead of the deploy user, once the organization allows OpenID Connect providers.
- A custom domain, once the organization allows ACM in us-east-1.
- Amazon SES (a verified sender, production access).
- A budget that ignores credits: the Zero Spend Alert counts them, so it stays silent until they run
  out.
- Upgrading the account from the Free plan before learners depend on it.
- AWS WAF, a Multi-AZ database, CloudTrail, GuardDuty and Security Hub.
- An instance role for storage instead of keys (a code change).
- The shared store for rate limits and gates (Phase 12).
- Staging on AWS and the final UAT (Phase 14).
