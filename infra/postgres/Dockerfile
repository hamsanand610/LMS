# PostgreSQL 16 on Alpine — musl, as every SI Academy environment runs today — with pgvector
# compiled in: the readiness path of ADR-0026, prepared in Roadmap Phase 8A. Nothing uses this image
# yet. Local (infra/compose.yml), CI and staging switch to it together in Phase 8C, when the first
# vector column arrives, and `lms` only under the database gate (runbook §5). Keeping musl keeps the
# databases' text ordering (en_US.utf8): the same data directories open unchanged.
#
# Pinned: the PostgreSQL major of every environment, and pgvector's release and the commit it names.
# OPTFLAGS="" builds for any x86-64 CPU rather than this machine's; with_llvm=no leaves out the JIT
# bitcode, which would need the exact clang the base image was built with.
ARG POSTGRES_IMAGE=postgres:16-alpine
FROM ${POSTGRES_IMAGE}

ARG PGVECTOR_VERSION=v0.8.7
ARG PGVECTOR_COMMIT=f37c13f68b57d2c3472b2214fbcff699d6d34876

RUN set -eux; \
    apk add --no-cache --virtual .pgvector-build git build-base; \
    git clone --branch "${PGVECTOR_VERSION}" --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector; \
    test "$(git -C /tmp/pgvector rev-parse HEAD)" = "${PGVECTOR_COMMIT}"; \
    make -C /tmp/pgvector OPTFLAGS="" with_llvm=no; \
    make -C /tmp/pgvector install with_llvm=no; \
    rm -rf /tmp/pgvector; \
    apk del .pgvector-build
