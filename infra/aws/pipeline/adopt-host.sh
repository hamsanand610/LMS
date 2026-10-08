#!/usr/bin/env bash
# Adopts the existing host into the deployment (deploy workflow, job "infrastructure", after the
# stack). Every step checks first and changes nothing that is already right, and only that one
# instance and its own security group are touched:
#   1. the tags Application=si-academy and Environment=<environment> (releases run only on them);
#   2. the stack's instance profile (SSM, image pulls, its own secrets), if it has none;
#   3. the stack's app security group, next to the groups it already has;
#   4. IMDSv2 with one hop, once the role is attached: containers cannot borrow the role;
#   5. its own group's ports 80 and 443 closed to the internet (SSH stays as it is): the site is
#      reached only through CloudFront and the private load balancer.
# Then it waits for the host to answer Systems Manager.
set -Eeuo pipefail
# shellcheck source=infra/aws/pipeline/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

instance="$(jq -r .parameters.HostInstanceId "$CONFIG")"
own_group="$(jq -r .host.ownSecurityGroupId "$CONFIG")"
profile_arn="$(stack_output HostInstanceProfileArn)"
app_group="$(stack_output HostSecurityGroupId)"
host() {
  aws ec2 describe-instances --instance-ids "$instance" \
    --query "Reservations[0].Instances[0].$1" --output text
}
echo "adopting $instance"

# 1. Tags.
aws ec2 create-tags --resources "$instance" \
  --tags Key=Application,Value=si-academy "Key=Environment,Value=$ENVIRONMENT"
echo "tags: Application=si-academy, Environment=$ENVIRONMENT"

# 2. The instance profile.
current="$(aws ec2 describe-iam-instance-profile-associations \
  --filters "Name=instance-id,Values=$instance" Name=state,Values=associating,associated \
  --query 'IamInstanceProfileAssociations[0].IamInstanceProfile.Arn' --output text)"
if [ -z "$current" ] || [ "$current" = None ]; then
  aws ec2 associate-iam-instance-profile --instance-id "$instance" \
    --iam-instance-profile "Arn=$profile_arn" > /dev/null
  echo "instance profile attached: $profile_arn"
elif [ "$current" = "$profile_arn" ]; then
  echo "instance profile already attached"
else
  echo "::error::$instance already has another instance profile ($current); nothing was replaced"
  exit 1
fi

# 3. The app security group, next to the instance's own.
read -r -a groups <<< "$(host 'SecurityGroups[].GroupId')"
if [[ " ${groups[*]} " == *" $app_group "* ]]; then
  echo "app security group already attached"
else
  aws ec2 modify-instance-attribute --instance-id "$instance" --groups "${groups[@]}" "$app_group"
  echo "app security group attached: $app_group (kept: ${groups[*]})"
fi

# 4. IMDSv2, one hop.
if [ "$(host 'MetadataOptions.HttpTokens')" = required ] &&
  [ "$(host 'MetadataOptions.HttpPutResponseHopLimit')" = 1 ]; then
  echo "metadata already IMDSv2 with one hop"
else
  aws ec2 modify-instance-metadata-options --instance-id "$instance" --http-endpoint enabled \
    --http-tokens required --http-put-response-hop-limit 1 > /dev/null
  echo "metadata set to IMDSv2 with one hop"
fi

# 5. Ports 80 and 443 closed to the internet on the instance's own group.
rules="$(aws ec2 describe-security-groups --group-ids "$own_group" \
  --query 'SecurityGroups[0].IpPermissions' --output json)"
for port in 80 443; do
  if jq -e --argjson p "$port" 'any(.[]; .IpProtocol == "tcp" and .FromPort == $p and .ToPort == $p
    and any(.IpRanges[]?; .CidrIp == "0.0.0.0/0"))' <<< "$rules" > /dev/null; then
    aws ec2 revoke-security-group-ingress --group-id "$own_group" \
      --ip-permissions "IpProtocol=tcp,FromPort=$port,ToPort=$port,IpRanges=[{CidrIp=0.0.0.0/0}]" > /dev/null
    echo "closed tcp $port to 0.0.0.0/0 on $own_group"
  fi
  if jq -e --argjson p "$port" 'any(.[]; .IpProtocol == "tcp" and .FromPort == $p and .ToPort == $p
    and any(.Ipv6Ranges[]?; .CidrIpv6 == "::/0"))' <<< "$rules" > /dev/null; then
    aws ec2 revoke-security-group-ingress --group-id "$own_group" \
      --ip-permissions "IpProtocol=tcp,FromPort=$port,ToPort=$port,Ipv6Ranges=[{CidrIpv6=::/0}]" > /dev/null
    echo "closed tcp $port to ::/0 on $own_group"
  fi
done
echo "public ports checked on $own_group (SSH left as it is)"

# The SSM agent picks up the new role within minutes.
ping=""
for _ in $(seq 1 80); do
  ping="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$instance" \
    --query 'InstanceInformationList[0].PingStatus' --output text 2> /dev/null || true)"
  [ "$ping" = Online ] && break
  sleep 15
done
if [ "$ping" != Online ]; then
  echo "::error::$instance has not registered with Systems Manager within 20 minutes; run the workflow again"
  exit 1
fi
echo "$instance answers Systems Manager"
