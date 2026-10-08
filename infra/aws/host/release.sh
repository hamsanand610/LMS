#!/usr/bin/env bash
# One release of SI Academy on the production host (ADR-0042). Started by the deploy workflow
# through SSM Run Command, as root, from the bundle it uploaded:
#
#   release.sh <environment> <region> <image-tag> <web-image-tag> [content|no]
#
# 1. prepares the host (prepare-host.sh); 2. renders the environment files (tmpfs, root only);
# 3. pulls the commit's images; 4. checks the database (TLS verified, pgvector >= 0.8.0), applies
# the migrations and the base seed, and creates the first Super Admin once; 5. replaces the
# services and waits until they are healthy; 6. records the release and removes old images.
# It never prints a secret.
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

ENVIRONMENT="${1:?environment}"
REGION="${2:?region}"
TAG="${3:?image tag}"
WEB_TAG="${4:?web image tag}"
PROMOTE="${5:-no}"
BUNDLE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP=/opt/si-academy
RUN=/run/si-academy
PROJECT=si-academy

say() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() {
  say "release failed: $*"
  exit 1
}
# The files that hold secrets live only while a release runs: a running container keeps its own
# environment, and the next release renders them again.
trap 'rm -f "$RUN/release.env" "$RUN/api.env" "$RUN/runner.env"' EXIT
trap 'say "release failed (line $LINENO)"' ERR

# 1. The host: Docker, Compose, the CloudWatch agent, swap, the RDS authority (each set up once).
bash "$BUNDLE/prepare-host.sh"
for tool in docker aws python3 curl; do
  command -v "$tool" > /dev/null || die "$tool is missing on this host"
done
docker compose version > /dev/null || die "docker compose is missing on this host"
[ -s "$APP/certs/rds-global-bundle.pem" ] || die "the RDS certificate authority is missing"

# 2. Configuration and secrets, straight into files only root can read.
install -d -m 700 "$RUN"
python3 "$BUNDLE/render_env.py" --environment "$ENVIRONMENT" --region "$REGION" \
  --tag "$TAG" --web-tag "$WEB_TAG" --out "$RUN" --certs-dir "$APP/certs"
set -a
# shellcheck source=/dev/null
. "$RUN/compose.env"
set +a
COMPOSE=(docker compose -p "$PROJECT" --env-file "$RUN/compose.env" -f "$BUNDLE/compose.production.yml")
REGISTRY_HOST="${IMAGE_REGISTRY%%/*}"
RELEASE_IMAGE="$IMAGE_REGISTRY/lms-api-release:$TAG"
say "release $TAG (web $WEB_TAG) of $SITE_URL"

# 3. The commit's images.
aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REGISTRY_HOST" > /dev/null
"${COMPOSE[@]}" --profile sandbox-image pull --quiet api web runner sandbox
docker pull --quiet "$RELEASE_IMAGE" > /dev/null
docker logout "$REGISTRY_HOST" > /dev/null
say "images pulled"

# One-off tasks run from the release image (the API's build stage: its sources, Prisma and tsx),
# never from the serving containers, and before anything new serves traffic.
one_off() {
  docker run --rm --env-file "$RUN/release.env" -v "$APP/certs:/certs:ro" \
    -v "$BUNDLE:/release:ro" -w /repo/apps/api "$RELEASE_IMAGE" "$@"
}
# The product refuses to seed production unless told this is a new deployment's base seed
# (core/prisma/standalone.ts); the flag is given to that one command only.
seed_task() {
  docker run --rm --env-file "$RUN/release.env" -e LMS_ALLOW_PRODUCTION_SEED=1 \
    -v "$APP/certs:/certs:ro" -w /repo/apps/api "$RELEASE_IMAGE" "$@"
}
# missing <organization|admin>: true while the new deployment still lacks it.
missing() {
  local status=0
  one_off node /release/db-check.cjs "$1" || status=$?
  case "$status" in
    0) return 0 ;;
    3) return 1 ;;
    *) die "could not check the $1" ;;
  esac
}

# 4. The database: checked, migrated, and on a new deployment only, seeded.
one_off node /release/db-check.cjs
one_off node_modules/.bin/prisma migrate deploy
if missing organization; then
  # The institute, its settings, branding and starting flags (clients/<CLIENT_KEY>: AI and the
  # optional modules off). Later releases leave them alone: the API adds a new module's
  # permissions and flags itself when it starts, and never changes a flag's state.
  seed_task node_modules/.bin/tsx prisma/seed/base.ts
else
  say "the institute is already set up: base seed not needed"
fi
if missing admin; then
  # The password is in Secrets Manager (si-academy/<environment>/admin); it is not printed.
  seed_task node_modules/.bin/tsx src/cli/main.ts users:create-admin --name "Super Admin"
else
  say "the Super Admin already exists: left as it is"
fi
# On request only (the deploy workflow's "promote content"): SI Academy's own content, the question
# bank and the assignment definitions as drafts, never people or activity (prisma/seed/content.ts).
# Create-only: a second promotion changes nothing, and staff edits are never overwritten.
case "$PROMOTE" in
  content) seed_task node_modules/.bin/tsx prisma/seed/content.ts ;;
  no) ;;
  *) die "unknown promotion '$PROMOTE'" ;;
esac
# What AI the release leaves running: the flags in the database and the API's configuration.
one_off node /release/db-check.cjs ai
rm -f "$RUN/release.env"

# 5. The services, replaced in place, then healthy.
previous="$(readlink -f "$APP/current" 2> /dev/null || true)"
"${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 300 api web runner
curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:4000/health/ready || die "the API is not ready"
curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:3000/login || die "the web app does not answer"
"${COMPOSE[@]}" ps
say "services healthy"

# 6. Record it; keep this release's images and the previous one's, remove the rest.
printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$TAG" "$WEB_TAG" >> "$APP/releases.log"
ln -sfn "$BUNDLE" "$APP/current"
keep=("$TAG" "$WEB_TAG")
if [ -n "$previous" ] && [ -f "$previous/tags" ]; then
  read -r -a old < "$previous/tags"
  keep+=("${old[@]}")
fi
printf '%s %s\n' "$TAG" "$WEB_TAG" > "$BUNDLE/tags"
docker images --format '{{.Repository}}:{{.Tag}}' | grep "^$IMAGE_REGISTRY/" | while read -r image; do
  for tag in "${keep[@]}"; do
    [ "${image##*:}" = "$tag" ] && continue 2
  done
  docker rmi "$image" > /dev/null 2>&1 || true
done
find "$APP/releases" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
say "release $TAG complete"
