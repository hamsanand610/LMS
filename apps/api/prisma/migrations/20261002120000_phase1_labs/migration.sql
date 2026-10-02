-- Roadmap Phase 1: Labs and Playground (ADR-0018). Additive only: new enum values (two question
-- types, the lab lesson type, the pass completion rule), two coding_problems columns with a
-- default or nullable, and the lab_drafts table. No existing value is changed or removed.

-- AlterEnum
ALTER TYPE "CompletionRule" ADD VALUE 'pass';

-- AlterEnum
ALTER TYPE "LessonType" ADD VALUE 'lab';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'debugging';
ALTER TYPE "QuestionType" ADD VALUE 'web';

-- AlterTable
ALTER TABLE "coding_problems" ADD COLUMN     "expected_behaviour" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sql_schema" JSONB;

-- CreateTable
CREATE TABLE "lab_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID,
    "scope" VARCHAR(40) NOT NULL,
    "language" VARCHAR(20) NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "stdin" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lab_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_drafts_user_id_updated_at_idx" ON "lab_drafts"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "lab_drafts_user_id_scope_language_key" ON "lab_drafts"("user_id", "scope", "language");

-- AddForeignKey
ALTER TABLE "lab_drafts" ADD CONSTRAINT "lab_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_drafts" ADD CONSTRAINT "lab_drafts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

