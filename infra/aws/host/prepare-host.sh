#!/usr/bin/env bash
# Prepares the existing host for releases (release.sh runs it first, as root, on every release;
# each step is skipped once done). Amazon Linux 2023 on x86_64 only:
#   Docker and the CloudWatch agent (memory and disk) from Amazon Linux's own repositories;
#   Docker Compose, pinned and checked against its published SHA-256;
#   2 GiB of swap, since the host has 2 GiB of memory;
#   the RDS certificate authority, so the API verifies the database's certificate.
# Nothing here is a secret, and no image is ever built here: CI builds them.
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

APP=/opt/si-academy
COMPOSE_VERSION=v5.5.1
COMPOSE_SHA256=db1889184726840f75c4f9c001048430d4f25b3be3cb084d3ddd762bc0aed576
COMPOSE_PLUGIN=/usr/local/lib/docker/cli-plugins/docker-compose
CLOUDWATCH_CONFIG=/opt/aws/amazon-cloudwatch-agent/etc/si-academy.json

say() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# shellcheck source=/dev/null
. /etc/os-release
if [ "${ID:-}" != amzn ] || [ "${VERSION_ID:-}" != 2023 ]; then
  say "this host runs ${PRETTY_NAME:-an unknown system}; prepare-host.sh supports Amazon Linux 2023"
  exit 1
fi
if [ "$(uname -m)" != x86_64 ]; then
  say "the images are built for x86_64, not $(uname -m)"
  exit 1
fi
install -d -m 755 "$APP" "$APP/certs" "$APP/releases"

# Docker and the CloudWatch agent.
missing=()
rpm -q docker > /dev/null 2>&1 || missing+=(docker)
rpm -q amazon-cloudwatch-agent > /dev/null 2>&1 || missing+=(amazon-cloudwatch-agent)
if [ "${#missing[@]}" -gt 0 ]; then
  dnf install -y -q "${missing[@]}"
  say "installed: ${missing[*]}"
fi

# Docker's settings: the sandbox containers' local logs rotate, and running containers survive a
# daemon restart (a security update of Docker itself).
docker_settings='{"log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "3"}, "live-restore": true}'
if [ "$(cat /etc/docker/daemon.json 2> /dev/null)" != "$docker_settings" ]; then
  install -d -m 755 /etc/docker
  printf '%s' "$docker_settings" > /etc/docker/daemon.json
  systemctl enable docker > /dev/null 2>&1
  systemctl restart docker
  say "Docker configured"
fi
systemctl enable --now docker > /dev/null 2>&1

# Docker Compose (Amazon Linux has no package for it).
if ! docker compose version 2> /dev/null | grep -q "$COMPOSE_VERSION"; then
  download="$(mktemp)"
  curl -fsSL --retry 3 -o "$download" \
    "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-x86_64"
  if ! printf '%s  %s\n' "$COMPOSE_SHA256" "$download" | sha256sum -c --status; then
    rm -f "$download"
    say "the Docker Compose download does not match its published SHA-256"
    exit 1
  fi
  install -D -m 755 "$download" "$COMPOSE_PLUGIN"
  rm -f "$download"
  say "Docker Compose $COMPOSE_VERSION installed"
fi

# Swap: a short burst (a release's one-off tasks next to the running services) slows down instead
# of being killed.
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  if [ ! -f /swapfile ]; then
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile
    mkswap /swapfile > /dev/null
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap defaults 0 0' >> /etc/fstab
  say "2 GiB of swap on"
fi
printf 'vm.swappiness=10\n' > /etc/sysctl.d/90-si-academy.conf
sysctl -q -p /etc/sysctl.d/90-si-academy.conf

# The CloudWatch agent: memory and disk, which the host's alarms watch. (${aws:InstanceId} is the
# agent's own placeholder, not this shell's.)
# shellcheck disable=SC2016
cloudwatch_settings='{"agent": {"metrics_collection_interval": 60}, "metrics": {"namespace": "SIAcademy/Host", "append_dimensions": {"InstanceId": "${aws:InstanceId}"}, "aggregation_dimensions": [["InstanceId"]], "metrics_collected": {"mem": {"measurement": ["mem_used_percent"]}, "disk": {"measurement": ["used_percent"], "resources": ["/"], "drop_device": true}}}}'
if [ "$(cat "$CLOUDWATCH_CONFIG" 2> /dev/null)" != "$cloudwatch_settings" ]; then
  printf '%s' "$cloudwatch_settings" > "$CLOUDWATCH_CONFIG"
  /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s \
    -c "file:$CLOUDWATCH_CONFIG" > /dev/null
  say "CloudWatch agent configured"
fi

# The RDS certificate authority.
if [ ! -s "$APP/certs/rds-global-bundle.pem" ]; then
  curl -fsSL --retry 3 -o "$APP/certs/rds-global-bundle.pem" \
    https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
  chmod 644 "$APP/certs/rds-global-bundle.pem"
  say "RDS certificate authority saved"
fi

say "host ready: $(docker --version), $(docker compose version)"
