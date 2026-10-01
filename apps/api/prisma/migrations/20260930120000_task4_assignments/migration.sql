-- Task 4: the assignments module (ADR-0016). Additive only: new enum values, new columns with
-- defaults or nullable, two new tables, and assignment_publications.batch_id relaxed to allow a
-- publication to one learner. No existing value is changed or removed.

-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('coding', 'sql', 'quiz', 'written', 'file_upload', 'practical', 'project', 'mixed');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('graded', 'approved', 'resubmission_requested');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'sql';
ALTER TYPE "QuestionType" ADD VALUE 'file_upload';
ALTER TYPE "QuestionType" ADD VALUE 'practical';
ALTER TYPE "QuestionType" ADD VALUE 'project';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionDifficulty" ADD VALUE 'beginner';
ALTER TYPE "QuestionDifficulty" ADD VALUE 'foundation';
ALTER TYPE "QuestionDifficulty" ADD VALUE 'interview';
ALTER TYPE "QuestionDifficulty" ADD VALUE 'company';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubmissionStatus" ADD VALUE 'evaluating';
ALTER TYPE "SubmissionStatus" ADD VALUE 'error';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExecutionVerdict" ADD VALUE 'wrong_answer';
ALTER TYPE "ExecutionVerdict" ADD VALUE 'runtime_error';
ALTER TYPE "ExecutionVerdict" ADD VALUE 'memory_limit';
ALTER TYPE "ExecutionVerdict" ADD VALUE 'compile_error';
ALTER TYPE "ExecutionVerdict" ADD VALUE 'output_limit';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "spec" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "coding_problems" ADD COLUMN     "compare_mode" VARCHAR(20) NOT NULL DEFAULT 'trim',
ADD COLUMN     "constraints" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "input_format" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "output_format" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "setup_sql" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sql_check" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "test_cases" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "explanation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "label" VARCHAR(120) NOT NULL DEFAULT '',
ADD COLUMN     "memory_limit_mb" INTEGER,
ADD COLUMN     "time_limit_ms" INTEGER;

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "course_id" UUID,
ADD COLUMN     "estimated_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "instructions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kind" "AssignmentKind" NOT NULL DEFAULT 'mixed',
ADD COLUMN     "pass_percent" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "program_id" UUID;

-- AlterTable
ALTER TABLE "assignment_modules" ADD COLUMN     "course_module_id" UUID,
ADD COLUMN     "description" VARCHAR(1000) NOT NULL DEFAULT '',
ADD COLUMN     "due_after_days" INTEGER,
ADD COLUMN     "topic" VARCHAR(60) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "assignment_publications" ADD COLUMN     "closes_at" TIMESTAMPTZ,
ADD COLUMN     "opens_at" TIMESTAMPTZ,
ADD COLUMN     "student_id" UUID,
ALTER COLUMN "batch_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "auto_marks" DECIMAL(6,2),
ADD COLUMN     "compile_output" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "driver" VARCHAR(40) NOT NULL DEFAULT '',
ADD COLUMN     "duration_ms" INTEGER,
ADD COLUMN     "evaluated_at" TIMESTAMPTZ,
ADD COLUMN     "evaluation_error" VARCHAR(500) NOT NULL DEFAULT '',
ADD COLUMN     "file_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "idempotency_key" VARCHAR(64),
ADD COLUMN     "memory_kb" INTEGER,
ADD COLUMN     "passed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payload" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "question_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "review_decision" "ReviewDecision",
ADD COLUMN     "reviewed_at" TIMESTAMPTZ,
ADD COLUMN     "total_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trust" "TrustLevel";

-- AlterTable
ALTER TABLE "submission_results" ADD COLUMN     "is_sample" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memory_kb" INTEGER,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verdict" "ExecutionVerdict",
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "assignment_resources" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "url" VARCHAR(500) NOT NULL DEFAULT '',
    "file_id" UUID,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_reviews" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "decision" "ReviewDecision" NOT NULL,
    "marks" DECIMAL(6,2),
    "comment" VARCHAR(4000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_resources_assignment_id_position_key" ON "assignment_resources"("assignment_id", "position");

-- CreateIndex
CREATE INDEX "submission_reviews_submission_id_created_at_idx" ON "submission_reviews"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "assignments_course_id_idx" ON "assignments"("course_id");

-- CreateIndex
CREATE INDEX "assignment_publications_student_id_withdrawn_at_idx" ON "assignment_publications"("student_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "submissions_assignment_id_status_idx" ON "submissions"("assignment_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_student_id_idempotency_key_key" ON "submissions"("student_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_modules" ADD CONSTRAINT "assignment_modules_course_module_id_fkey" FOREIGN KEY ("course_module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_publications" ADD CONSTRAINT "assignment_publications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_resources" ADD CONSTRAINT "assignment_resources_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A publication reaches a batch or one learner, never both and never neither.
ALTER TABLE "assignment_publications" ADD CONSTRAINT "assignment_publications_audience_check" CHECK (("batch_id" IS NULL) <> ("student_id" IS NULL));
