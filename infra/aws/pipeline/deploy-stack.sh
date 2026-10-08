#!/usr/bin/env bash
# Applies infra/aws/stack.yml to the environment's stack (deploy workflow, job "infrastructure"),
# through CloudFormation's own execution role, with the parameters in infra/aws/production.json and
# the CloudFront prefix list of the region. The stack never creates or replaces the host.
#
# A failed change is not rolled back (--disable-rollback): the database and the network stay as
# they are, the error is printed, and the next run carries on from where it stopped.
set -Eeuo pipefail
# shellcheck source=infra/aws/pipeline/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

stack_status() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query 'Stacks[0].StackStatus' --output text 2> /dev/null || echo NONE
}

failed_events() {
  aws cloudformation describe-stack-events --stack-name "$STACK" --max-items 60 \
    --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]" \
    --output table || true
}

status="$(stack_status)"
echo "stack $STACK in $REGION: $status"
case "$status" in
  *_IN_PROGRESS)
    echo "::error::the stack is busy ($status); run again once it settles"
    exit 1
    ;;
  ROLLBACK_COMPLETE | ROLLBACK_FAILED | DELETE_FAILED | UPDATE_ROLLBACK_FAILED)
    echo "::error::the stack is in $status: see docs/runbooks/aws-production.md (a failed stack)"
    exit 1
    ;;
esac

overrides=("EnvironmentName=$ENVIRONMENT")
while IFS=$'\t' read -r key value; do
  overrides+=("$key=$value")
done < <(jq -r '.parameters | to_entries[] | [.key, .value] | @tsv' "$CONFIG")

prefix_list="$(aws ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)"
if [[ "$prefix_list" != pl-* ]]; then
  echo "::error::no CloudFront origin-facing prefix list in $REGION"
  exit 1
fi
overrides+=("CloudFrontPrefixListId=$prefix_list")

# PostgreSQL's version is set in production.json: 16.5 or later (pgvector 0.8), offered here.
engine="$(jq -r .parameters.DbEngineVersion "$CONFIG")"
if [[ ! "$engine" =~ ^16\.([0-9]+)$ ]] || [ "${BASH_REMATCH[1]}" -lt 5 ]; then
  echo "::error::DbEngineVersion must be PostgreSQL 16.5 or later (pgvector 0.8), not $engine"
  exit 1
fi
offered="$(aws rds describe-db-engine-versions --engine postgres --engine-version "$engine" \
  --query 'DBEngineVersions[0].EngineVersion' --output text)"
if [ "$offered" != "$engine" ]; then
  echo "::error::PostgreSQL $engine is not offered in $REGION"
  exit 1
fi

set +e
aws cloudformation deploy \
  --stack-name "$STACK" \
  --template-file "$ROOT/infra/aws/stack.yml" \
  --s3-bucket "$PIPELINE_BUCKET" \
  --s3-prefix templates \
  --role-arn "$EXECUTION_ROLE_ARN" \
  --capabilities CAPABILITY_NAMED_IAM \
  --disable-rollback \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${overrides[@]}" \
  --tags Application=si-academy "Environment=$ENVIRONMENT"
result=$?
set -e

# The CLI stops waiting after an hour; a first creation (database, CloudFront) can take longer.
waited=false
status="$(stack_status)"
while [[ "$status" == *_IN_PROGRESS ]]; do
  waited=true
  echo "still $status"
  sleep 30
  status="$(stack_status)"
done
echo "stack $STACK: $status"
if [ "$result" -ne 0 ] && [ "$waited" = false ]; then
  # The CLI failed on its own (the template, a permission) or reported the stack's failure.
  failed_events
  echo "::error::the stack change failed ($status)"
  exit "$result"
fi
case "$status" in
  CREATE_COMPLETE | UPDATE_COMPLETE) ;;
  *)
    failed_events
    echo "::error::the stack change did not complete ($status)"
    exit 1
    ;;
esac
