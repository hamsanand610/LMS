# The sandbox image: the runtimes learner code runs in, the harness that drives them, nothing else.
#
# The runner service (apps/runner) starts one container from this image per run or submission:
# no network, read-only root, every capability dropped, an unprivileged user, CPU, memory and
# process limits, and a small tmpfs at /work that disappears with the container (ADR-0016).
#
#   docker build -t lms-sandbox:1 infra/sandbox

# The Web Lab's one dependency, jsdom (ADR-0019), installed exactly as package-lock.json records it,
# without install scripts, in a stage of its own: the image that runs learner code gets the files
# and no package manager.
FROM node:22-bookworm-slim AS web
WORKDIR /opt/lms/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM eclipse-temurin:21-jdk-noble

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 nodejs php-cli \
  && rm -rf /var/lib/apt/lists/*

COPY --from=web /opt/lms/web/node_modules /opt/lms/web/node_modules
COPY harness.py sqlrun.py /opt/lms/
COPY web/webpage.js web/webcheck.js /opt/lms/web/
RUN chmod 0555 /opt/lms/harness.py /opt/lms/sqlrun.py /opt/lms/web/webpage.js /opt/lms/web/webcheck.js \
  && chmod -R a-w /opt/lms/web/node_modules

USER 65534:65534
WORKDIR /work
ENTRYPOINT ["python3", "-I", "/opt/lms/harness.py"]
