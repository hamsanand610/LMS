-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq_single', 'mcq_multi', 'true_false', 'descriptive', 'coding');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('correct', 'incorrect', 'partial', 'awaiting_grading');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('practice', 'weekly', 'mock', 'final');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('in_progress', 'submitted', 'graded', 'abandoned');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('untrusted', 'trusted');

-- CreateEnum
CREATE TYPE "ExecutionVerdict" AS ENUM ('passed', 'failed', 'error', 'timeout', 'pending');

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "subject" VARCHAR(60) NOT NULL DEFAULT '',
    "topic" VARCHAR(60) NOT NULL DEFAULT '',
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'easy',
    "marks" INTEGER NOT NULL DEFAULT 1,
    "negative_marks" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "explanation" TEXT NOT NULL DEFAULT '',
    "rubric" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "QuestionStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "validation" JSONB,
    "in_practice" BOOLEAN NOT NULL DEFAULT false,
    "practice_points" INTEGER NOT NULL DEFAULT 10,
    "author_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "explanation" VARCHAR(2000) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_problems" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starter_code" JSONB NOT NULL DEFAULT '{}',
    "reference_solution" JSONB NOT NULL DEFAULT '{}',
    "time_limit_ms" INTEGER NOT NULL DEFAULT 5000,
    "memory_limit_mb" INTEGER NOT NULL DEFAULT 128,

    CONSTRAINT "coding_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "input" TEXT NOT NULL DEFAULT '',
    "expected_output" TEXT NOT NULL DEFAULT '',
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "summary" VARCHAR(240) NOT NULL DEFAULT '',
    "changed_by_id" UUID,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "subject" VARCHAR(60) NOT NULL DEFAULT '',
    "difficulty" VARCHAR(40) NOT NULL DEFAULT '',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'draft',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_modules" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "position" INTEGER NOT NULL,
    "unlock_rule" JSONB NOT NULL DEFAULT '{"type":"always"}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_questions" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,

    CONSTRAINT "assignment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_publications" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ,
    "note" VARCHAR(240) NOT NULL DEFAULT '',
    "published_by_id" UUID,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ,

    CONSTRAINT "assignment_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "assignment_question_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'awaiting_grading',
    "marks" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "max_marks" INTEGER NOT NULL DEFAULT 1,
    "option_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "text" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "language" VARCHAR(40) NOT NULL DEFAULT '',
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "grader_comment" VARCHAR(2000) NOT NULL DEFAULT '',
    "graded_by_id" UUID,
    "graded_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_results" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "test_case_id" UUID,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "actual_output" TEXT NOT NULL DEFAULT '',
    "stderr" TEXT NOT NULL DEFAULT '',
    "duration_ms" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "submission_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "kind" "TestKind" NOT NULL DEFAULT 'weekly',
    "subject" VARCHAR(60) NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "status" "TestStatus" NOT NULL DEFAULT 'draft',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_sections" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "instructions" VARCHAR(5000) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,

    CONSTRAINT "test_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "negative_marks" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_schedules" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "opens_at" TIMESTAMPTZ NOT NULL,
    "closes_at" TIMESTAMPTZ NOT NULL,
    "max_attempts" INTEGER,
    "released_at" TIMESTAMPTZ,
    "released_by_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempts" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "AttemptStatus" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "submitted_at" TIMESTAMPTZ,
    "auto_submitted" BOOLEAN NOT NULL DEFAULT false,
    "score" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "total_marks" INTEGER NOT NULL DEFAULT 0,
    "tab_switches" INTEGER NOT NULL DEFAULT 0,
    "integrity_log" JSONB NOT NULL DEFAULT '[]',
    "last_saved_at" TIMESTAMPTZ,
    "question_order" UUID[] DEFAULT ARRAY[]::UUID[],

    CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "test_question_id" UUID NOT NULL,
    "option_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "text" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "language" VARCHAR(40) NOT NULL DEFAULT '',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'awaiting_grading',
    "marks" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "grader_comment" VARCHAR(2000) NOT NULL DEFAULT '',
    "graded_by_id" UUID,
    "graded_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "test_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_runs" (
    "id" UUID NOT NULL,
    "question_id" UUID,
    "user_id" UUID,
    "context" VARCHAR(20) NOT NULL DEFAULT 'practice',
    "language" VARCHAR(40) NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "driver" VARCHAR(40) NOT NULL,
    "trust" "TrustLevel" NOT NULL DEFAULT 'untrusted',
    "verdict" "ExecutionVerdict" NOT NULL DEFAULT 'pending',
    "passed_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questions_slug_key" ON "questions"("slug");

-- CreateIndex
CREATE INDEX "questions_organization_id_status_type_idx" ON "questions"("organization_id", "status", "type");

-- CreateIndex
CREATE INDEX "questions_subject_topic_difficulty_idx" ON "questions"("subject", "topic", "difficulty");

-- CreateIndex
CREATE INDEX "questions_in_practice_status_idx" ON "questions"("in_practice", "status");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_position_key" ON "question_options"("question_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "coding_problems_question_id_key" ON "coding_problems"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_problem_id_position_key" ON "test_cases"("problem_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_question_id_version_key" ON "question_versions"("question_id", "version");

-- CreateIndex
CREATE INDEX "assignments_organization_id_status_idx" ON "assignments"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_modules_assignment_id_position_key" ON "assignment_modules"("assignment_id", "position");

-- CreateIndex
CREATE INDEX "assignment_questions_question_id_idx" ON "assignment_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_questions_module_id_position_key" ON "assignment_questions"("module_id", "position");

-- CreateIndex
CREATE INDEX "assignment_publications_assignment_id_withdrawn_at_idx" ON "assignment_publications"("assignment_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "assignment_publications_batch_id_withdrawn_at_idx" ON "assignment_publications"("batch_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "submissions_student_id_assignment_id_idx" ON "submissions"("student_id", "assignment_id");

-- CreateIndex
CREATE INDEX "submissions_status_submitted_at_idx" ON "submissions"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignment_question_id_student_id_attempt_key" ON "submissions"("assignment_question_id", "student_id", "attempt");

-- CreateIndex
CREATE INDEX "submission_results_submission_id_idx" ON "submission_results"("submission_id");

-- CreateIndex
CREATE INDEX "tests_organization_id_status_idx" ON "tests"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "test_sections_test_id_position_key" ON "test_sections"("test_id", "position");

-- CreateIndex
CREATE INDEX "test_questions_question_id_idx" ON "test_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_questions_section_id_position_key" ON "test_questions"("section_id", "position");

-- CreateIndex
CREATE INDEX "test_schedules_opens_at_closes_at_idx" ON "test_schedules"("opens_at", "closes_at");

-- CreateIndex
CREATE UNIQUE INDEX "test_schedules_test_id_batch_id_key" ON "test_schedules"("test_id", "batch_id");

-- CreateIndex
CREATE INDEX "test_attempts_test_id_status_idx" ON "test_attempts"("test_id", "status");

-- CreateIndex
CREATE INDEX "test_attempts_status_expires_at_idx" ON "test_attempts"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempts_schedule_id_student_id_attempt_key" ON "test_attempts"("schedule_id", "student_id", "attempt");

-- CreateIndex
CREATE INDEX "test_answers_status_idx" ON "test_answers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_answers_attempt_id_test_question_id_key" ON "test_answers"("attempt_id", "test_question_id");

-- CreateIndex
CREATE INDEX "execution_runs_question_id_user_id_created_at_idx" ON "execution_runs"("question_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "execution_runs_context_created_at_idx" ON "execution_runs"("context", "created_at");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_problems" ADD CONSTRAINT "coding_problems_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "coding_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_modules" ADD CONSTRAINT "assignment_modules_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "assignment_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_publications" ADD CONSTRAINT "assignment_publications_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_publications" ADD CONSTRAINT "assignment_publications_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_question_id_fkey" FOREIGN KEY ("assignment_question_id") REFERENCES "assignment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_results" ADD CONSTRAINT "submission_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sections" ADD CONSTRAINT "test_sections_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "test_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedules" ADD CONSTRAINT "test_schedules_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedules" ADD CONSTRAINT "test_schedules_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "test_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_answers" ADD CONSTRAINT "test_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_answers" ADD CONSTRAINT "test_answers_test_question_id_fkey" FOREIGN KEY ("test_question_id") REFERENCES "test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
