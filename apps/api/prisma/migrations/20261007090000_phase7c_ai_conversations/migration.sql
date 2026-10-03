-- Phase 7C (SI Academy AI: conversations, messages, usage). Additive only: four new tables and
-- their enums and indexes; no existing table or row changes. ai_messages_one_generation_per_user_key
-- is the generation gate: at most one answer being written (status 'streaming') per person.
-- ai_conversations_deleted_at_idx indexes only deleted conversations, for the retention sweep (7D).

-- CreateEnum
CREATE TYPE "AiPurpose" AS ENUM ('assistant', 'workspace', 'lab_hint');

-- CreateEnum
CREATE TYPE "AiConversationStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "AiMessageStatus" AS ENUM ('streaming', 'complete', 'failed', 'cancelled', 'blocked');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "AiPurpose" NOT NULL,
    "course_id" UUID,
    "lesson_id" UUID,
    "question_id" UUID,
    "title" VARCHAR(120) NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "status" "AiConversationStatus" NOT NULL DEFAULT 'active',
    "last_message_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" "AiMessageStatus" NOT NULL,
    "provider" VARCHAR(20),
    "model" VARCHAR(80),
    "prompt_version" VARCHAR(40),
    "data_class" VARCHAR(20),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "tokens_estimated" BOOLEAN NOT NULL DEFAULT false,
    "latency_ms" INTEGER,
    "finish_reason" VARCHAR(20),
    "error_code" VARCHAR(40),
    "policy_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "context_refs" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "conversation_id" UUID,
    "message_id" UUID,
    "feature" VARCHAR(20) NOT NULL,
    "task" VARCHAR(20) NOT NULL,
    "data_class" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "tokens_estimated" BOOLEAN NOT NULL DEFAULT false,
    "estimated_cost_micros" INTEGER,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_requests" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_micros" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_last_message_at_idx" ON "ai_conversations"("user_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "ai_conversations_deleted_at_idx" ON "ai_conversations"("deleted_at") WHERE (deleted_at IS NOT NULL);

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_messages_user_id_status_idx" ON "ai_messages"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_messages_one_generation_per_user_key" ON "ai_messages"("user_id") WHERE (status = 'streaming');

-- CreateIndex
CREATE INDEX "ai_requests_user_id_created_at_idx" ON "ai_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_requests_organization_id_created_at_idx" ON "ai_requests"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_requests_conversation_id_idx" ON "ai_requests"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_requests_message_id_idx" ON "ai_requests"("message_id");

-- CreateIndex
CREATE INDEX "ai_usage_daily_organization_id_day_idx" ON "ai_usage_daily"("organization_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_daily_user_id_day_key" ON "ai_usage_daily"("user_id", "day");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
