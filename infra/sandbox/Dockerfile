# The sandbox image: the runtimes learner code runs in, the harness that drives them, nothing else.
#
# The runner service (apps/runner) starts one container from this image per run or submission:
# no network, read-only root, every capability dropped, an unprivileged user, CPU, memory and
# process limits, and a small tmpfs at /work that disappears with the container (ADR-0016).
#
#   docker build -t lms-sandbox:1 infra/sandbox
FROM eclipse-temurin:21-jdk-noble

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 nodejs php-cli \
  && rm -rf /var/lib/apt/lists/*

COPY harness.py sqlrun.py /opt/lms/
RUN chmod 0555 /opt/lms/harness.py /opt/lms/sqlrun.py

USER 65534:65534
WORKDIR /work
ENTRYPOINT ["python3", "-I", "/opt/lms/harness.py"]
