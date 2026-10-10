# The sandbox runner image (ADR-0016): the small HTTP service that starts one locked-down sandbox
# container per job. It never runs learner code itself; it only needs Node and the Docker client.
# Built by CI next to the API and web images; see .github/workflows/ci.yml.
FROM node:22-bookworm-slim AS base
# The base image's Debian packages, brought up to their latest security fixes (Step 6 audit: the
# image scan found perl, pcre2 and tzdata behind the published fixes).
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY apps/runner/package.json apps/runner/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/module-sdk/package.json packages/module-sdk/
COPY packages/config/package.json packages/config/
# Only the runner and what it depends on; nothing here needs a native build.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@lms/runner..."

FROM deps AS build
COPY . .
RUN pnpm --filter @lms/shared build && pnpm --filter @lms/runner build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
# The Docker client, to talk to the host's Docker through the mounted socket: one static binary,
# nothing else from Docker.
ARG TARGETARCH
ARG DOCKER_CLI_VERSION=28.5.2
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && arch="$([ "$TARGETARCH" = "arm64" ] && echo aarch64 || echo x86_64)" \
  && curl -fsSL "https://download.docker.com/linux/static/stable/${arch}/docker-${DOCKER_CLI_VERSION}.tgz" \
    | tar -xz --strip-components=1 -C /usr/local/bin docker/docker \
  && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/runner/node_modules ./apps/runner/node_modules
COPY --from=build /repo/apps/runner/dist ./apps/runner/dist
COPY --from=build /repo/apps/runner/package.json ./apps/runner/package.json
WORKDIR /repo/apps/runner
USER node
EXPOSE 4100
CMD ["node", "dist/main.js"]
