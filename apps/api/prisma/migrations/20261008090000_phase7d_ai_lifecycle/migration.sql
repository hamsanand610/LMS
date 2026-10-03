-- Phase 7D (SI Academy AI: settings, jobs, retention and the answer cache). Additive only: new
-- columns on three of the Phase 7C tables, one new table (ai_cache_entries) with its enums and
-- indexes; no column is dropped or changed, and no other table is touched.
-- ai_requests.day is the institute day each call was counted on. Rows already there get the day of
-- their own time in the institute's time zone, and counts_as_question marks the first call of each
-- answered question, before the column becomes required. ai_messages_created_at_idx and
-- ai_requests_organization_id_day_idx serve the retention sweep and the usage roll-up.

-- CreateEnum
CREATE TYPE "AiTitleSource" AS ENUM ('user', 'question', 'model');

-- CreateEnum
CREATE TYPE "AiCacheScope" AS ENUM ('shared', 'user');

-- AlterTable
ALTER TABLE "ai_conversations" ADD COLUMN     "summarized_through_at" TIMESTAMPTZ,
ADD COLUMN     "summary_claimed_at" TIMESTAMPTZ,
ADD COLUMN     "title_claimed_at" TIMESTAMPTZ,
ADD COLUMN     "title_source" "AiTitleSource" NOT NULL DEFAULT 'question';

-- AlterTable
ALTER TABLE "ai_messages" ADD COLUMN     "cache_entry_id" UUID;

-- AlterTable
ALTER TABLE "ai_requests" ADD COLUMN     "counts_as_question" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "day" DATE;

-- Backfill: the day each existing call was counted on, in the institute's time zone, and the first
-- call of each answered question.
UPDATE "ai_requests" AS r
SET "day" = (r."created_at" AT TIME ZONE o."timezone")::date
FROM "organizations" AS o
WHERE o."id" = r."organization_id";

UPDATE "ai_requests" SET "counts_as_question" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("message_id") "id"
  FROM "ai_requests"
  WHERE "message_id" IS NOT NULL
  ORDER BY "message_id", "created_at", "id"
);

ALTER TABLE "ai_requests" ALTER COLUMN "day" SET NOT NULL;

-- CreateTable
CREATE TABLE "ai_cache_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "scope" "AiCacheScope" NOT NULL,
    "user_id" UUID,
    "conversation_id" UUID,
    "key_hash" CHAR(64) NOT NULL,
    "normalized_question" VARCHAR(400) NOT NULL,
    "answer" TEXT NOT NULL,
    "purpose" "AiPurpose" NOT NULL,
    "data_class" VARCHAR(20) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "model_family" VARCHAR(40) NOT NULL,
    "prompt_version" VARCHAR(40) NOT NULL,
    "knowledge_version" VARCHAR(40) NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "invalidated_at" TIMESTAMPTZ,
    "invalidation_reason" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_cache_entries_expires_at_idx" ON "ai_cache_entries"("expires_at");

-- CreateIndex
CREATE INDEX "ai_cache_entries_user_id_idx" ON "ai_cache_entries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_cache_entries_organization_id_key_hash_key" ON "ai_cache_entries"("organization_id", "key_hash");

-- CreateIndex
CREATE INDEX "ai_messages_created_at_idx" ON "ai_messages"("created_at");

-- CreateIndex
CREATE INDEX "ai_requests_organization_id_day_idx" ON "ai_requests"("organization_id", "day");

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_cache_entry_id_fkey" FOREIGN KEY ("cache_entry_id") REFERENCES "ai_cache_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_cache_entries" ADD CONSTRAINT "ai_cache_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_cache_entries" ADD CONSTRAINT "ai_cache_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_cache_entries" ADD CONSTRAINT "ai_cache_entries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
