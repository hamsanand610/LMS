# The web image: Next.js in standalone mode, so the runtime carries only what it traced.
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
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Read at build time: the API URL by the browser bundle, all three by the security headers
# (next.config.ts), which are fixed when the app is built.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_ENV=staging
ARG NEXT_PUBLIC_STORAGE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL   NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV   NEXT_PUBLIC_STORAGE_URL=$NEXT_PUBLIC_STORAGE_URL
RUN pnpm --filter @lms/shared build \
  && pnpm --filter @lms/ui build \
  && pnpm --filter @lms/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
