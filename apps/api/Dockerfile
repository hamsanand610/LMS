# The API image: a pnpm workspace build, then a runtime with only what the server needs.
# Built by CI on every push; see .github/workflows/ci.yml.
FROM node:22-bookworm-slim AS base
# The base image's Debian packages, brought up to their latest security fixes (Step 6 audit: the
# image scan found perl, pcre2 and tzdata behind the published fixes).
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
# argon2 is a native module; these are what it needs when no prebuild matches the platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY apps/runner/package.json apps/runner/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/module-sdk/package.json packages/module-sdk/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Prisma loads prisma.config.ts for every command, and its env('DATABASE_URL') refuses to load
# without one, although generating the client never connects. The build has no database and no
# .env (.dockerignore keeps it out), so that one command gets a placeholder nothing connects to.
RUN pnpm --filter @lms/shared build \
  && pnpm --filter @lms/module-sdk build \
  && DATABASE_URL=postgresql://localhost:5432/unused pnpm --filter @lms/api exec prisma generate \
  && pnpm --filter @lms/api build

FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /repo/apps/api/src/generated ./apps/api/src/generated
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
# Migrations run as their own step in the deploy, not on boot: two instances starting at once
# must not race each other through the same migration.
CMD ["node", "dist/main.js"]
