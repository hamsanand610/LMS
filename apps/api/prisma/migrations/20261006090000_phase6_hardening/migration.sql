-- Phase 6 (code quality and security hardening). Additive only: no row is changed.
-- sessions.persistent defaults to true, which is how every existing session behaved.
-- sessions.rotated_at is set by a refresh only; existing rows keep NULL, so a session revoked
-- before this migration is treated as signed out, as it always was.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "persistent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rotated_at" TIMESTAMPTZ;
