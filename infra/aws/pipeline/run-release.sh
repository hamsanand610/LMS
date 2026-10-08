#!/usr/bin/env bash
# Releases one commit on the production host (deploy workflow, job "release"):
#   IMAGE_SHA=<commit> WEB_TAG=<web image tag> [PROMOTE_CONTENT=content] infra/aws/pipeline/run-release.sh
#
# 1. uploads the release bundle (the compose file and the host's scripts; no secret);
# 2. waits for the host to answer Systems Manager;
# 3. snapshots the database (runbook: a migration is never applied without one);
# 4. runs infra/aws/host/release.sh on the host through SSM Run Command and prints its log;
# 5. keeps the five newest pre-release snapshots.
set -Eeuo pipefail
# shellcheck source=infra/aws/pipeline/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

: "${IMAGE_SHA:?IMAGE_SHA}" "${WEB_TAG:?WEB_TAG}"
# "content" only when the workflow was started with "promote content" (release.sh, step 4).
promote="${PROMOTE_CONTENT:-no}"
case "$promote" in content | no) ;; *)
  echo "::error::PROMOTE_CONTENT must be content or no"
  exit 1
  ;;
esac
instance="$(stack_output HostInstanceId)"
database="$(stack_output DatabaseInstanceId)"
log_group="$(stack_output ReleaseLogGroup)"
release_id="${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"
prefix="releases/$release_id"
target="/opt/si-academy/releases/$release_id"

# 1. The bundle.
bundle="$(mktemp -d)"
cp "$ROOT/infra/compose.production.yml" "$ROOT/infra/aws/host/release.sh" \
  "$ROOT/infra/aws/host/prepare-host.sh" "$ROOT/infra/aws/host/render_env.py" \
  "$ROOT/infra/aws/host/db-check.cjs" "$bundle/"
aws s3 cp --recursive --only-show-errors "$bundle" "s3://$PIPELINE_BUCKET/$prefix/"
echo "bundle uploaded to s3://$PIPELINE_BUCKET/$prefix/"

# 2. The host.
ping=""
for _ in $(seq 1 60); do
  ping="$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=$instance" \
    --query 'InstanceInformationList[0].PingStatus' --output text 2> /dev/null || true)"
  [ "$ping" = Online ] && break
  sleep 10
done
if [ "$ping" != Online ]; then
  echo "::error::the host $instance does not answer Systems Manager"
  exit 1
fi

# 3. The snapshot.
aws rds wait db-instance-available --db-instance-identifier "$database"
snapshot="si-academy-$ENVIRONMENT-pre-release-${IMAGE_SHA:0:12}-$release_id"
aws rds create-db-snapshot --db-instance-identifier "$database" \
  --db-snapshot-identifier "$snapshot" \
  --tags Key=Application,Value=si-academy "Key=Environment,Value=$ENVIRONMENT" \
  Key=Purpose,Value=pre-release > /dev/null
aws rds wait db-snapshot-available --db-snapshot-identifier "$snapshot"
echo "database snapshot $snapshot taken"

# 4. The release. (The $names in the jq program below are jq's, not this shell's.)
# shellcheck disable=SC2016
parameters="$(jq -n --arg dir "$target" --arg src "s3://$PIPELINE_BUCKET/$prefix/" \
  --arg region "$REGION" --arg args "$ENVIRONMENT $REGION $IMAGE_SHA $WEB_TAG $promote" '{
    commands: [
      "set -e",
      ("mkdir -p " + $dir),
      ("aws s3 cp --region " + $region + " --recursive --only-show-errors " + $src + " " + $dir + "/"),
      ("bash " + $dir + "/release.sh " + $args)
    ],
    executionTimeout: ["3600"]
  }')"
command_id="$(aws ssm send-command --instance-ids "$instance" \
  --document-name AWS-RunShellScript \
  --comment "SI Academy release ${IMAGE_SHA:0:12}" \
  --parameters "$parameters" \
  --cloud-watch-output-config "CloudWatchLogGroupName=$log_group,CloudWatchOutputEnabled=true" \
  --query Command.CommandId --output text)"
echo "release started on $instance (command $command_id)"

status=Pending
for _ in $(seq 1 380); do
  status="$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
    --query Status --output text 2> /dev/null || echo Pending)"
  case "$status" in Success | Failed | Cancelled | TimedOut) break ;; esac
  sleep 10
done
echo "----- release log (the full log is in CloudWatch: $log_group) -----"
aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
  --query StandardOutputContent --output text
errors="$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
  --query StandardErrorContent --output text)"
if [ -n "$errors" ] && [ "$errors" != None ]; then
  echo "----- standard error -----"
  echo "$errors"
fi
if [ "$status" != Success ]; then
  echo "::error::the release ended $status; the database snapshot $snapshot was taken before it"
  exit 1
fi

# 5. Older pre-release snapshots.
aws rds describe-db-snapshots --db-instance-identifier "$database" --snapshot-type manual \
  --query "sort_by(DBSnapshots[?starts_with(DBSnapshotIdentifier, 'si-academy-$ENVIRONMENT-pre-release-')], &SnapshotCreateTime)[].DBSnapshotIdentifier" \
  --output text | tr '\t' '\n' | sed '/^$/d' | head -n -5 | while read -r old; do
  aws rds delete-db-snapshot --db-snapshot-identifier "$old" > /dev/null
  echo "removed the old snapshot $old"
done
