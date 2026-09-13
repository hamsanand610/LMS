-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('video', 'article', 'resources', 'practice');

-- CreateEnum
CREATE TYPE "CompletionRule" AS ENUM ('watch', 'view', 'manual');

-- CreateEnum
CREATE TYPE "PublicationScope" AS ENUM ('all', 'program', 'batch');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed');

-- CreateEnum
CREATE TYPE "LessonProgressStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'live', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "SeriesStatus" AS ENUM ('active', 'ended');

-- CreateTable
CREATE TABLE "taxonomy_terms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "taxonomy" VARCHAR(40) NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "taxonomy_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "level" VARCHAR(40) NOT NULL DEFAULT '',
    "subject" VARCHAR(60) NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnail_file_id" UUID,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "owner_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "position" INTEGER NOT NULL,
    "unlock_rule" JSONB NOT NULL DEFAULT '{"type":"always"}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "type" "LessonType" NOT NULL,
    "position" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "completion_rule" "CompletionRule" NOT NULL DEFAULT 'manual',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "file_id" UUID,
    "url" VARCHAR(500) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_publications" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "scope_type" "PublicationScope" NOT NULL,
    "scope_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "note" VARCHAR(240) NOT NULL DEFAULT '',
    "published_by_id" UUID,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unpublished_at" TIMESTAMPTZ,

    CONSTRAINT "course_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'publication',
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "last_accessed_at" TIMESTAMPTZ,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "LessonProgressStatus" NOT NULL DEFAULT 'not_started',
    "position_seconds" INTEGER NOT NULL DEFAULT 0,
    "watched_pct" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ,
    "last_accessed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL DEFAULT '',
    "entity_id" UUID,
    "title" VARCHAR(200) NOT NULL DEFAULT '',
    "link" VARCHAR(300),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(120),

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_series" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "subject" VARCHAR(60) NOT NULL,
    "title" VARCHAR(160) NOT NULL DEFAULT '',
    "trainer_id" UUID,
    "weekdays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starts_time" VARCHAR(5) NOT NULL,
    "ends_time" VARCHAR(5) NOT NULL,
    "from_date" DATE NOT NULL,
    "until_date" DATE NOT NULL,
    "join_url" VARCHAR(500) NOT NULL DEFAULT '',
    "provider" VARCHAR(20) NOT NULL DEFAULT 'none',
    "skip_dates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SeriesStatus" NOT NULL DEFAULT 'active',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "session_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "series_id" UUID,
    "batch_id" UUID NOT NULL,
    "trainer_id" UUID,
    "subject" VARCHAR(60) NOT NULL,
    "title" VARCHAR(160) NOT NULL DEFAULT '',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "join_url" VARCHAR(500) NOT NULL DEFAULT '',
    "provider" VARCHAR(20) NOT NULL DEFAULT 'none',
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "recording_lesson_id" UUID,
    "reminder_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taxonomy_terms_organization_id_taxonomy_archived_idx" ON "taxonomy_terms"("organization_id", "taxonomy", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_terms_organization_id_taxonomy_key_key" ON "taxonomy_terms"("organization_id", "taxonomy", "key");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_organization_id_status_idx" ON "courses"("organization_id", "status");

-- CreateIndex
CREATE INDEX "courses_subject_idx" ON "courses"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_course_id_position_key" ON "course_modules"("course_id", "position");

-- CreateIndex
CREATE INDEX "lessons_type_idx" ON "lessons"("type");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_module_id_position_key" ON "lessons"("module_id", "position");

-- CreateIndex
CREATE INDEX "lesson_resources_lesson_id_idx" ON "lesson_resources"("lesson_id");

-- CreateIndex
CREATE INDEX "course_publications_course_id_unpublished_at_idx" ON "course_publications"("course_id", "unpublished_at");

-- CreateIndex
CREATE INDEX "course_publications_scope_type_scope_id_idx" ON "course_publications"("scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "enrollments_course_id_status_idx" ON "enrollments"("course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_course_id_key" ON "enrollments"("student_id", "course_id");

-- CreateIndex
CREATE INDEX "lesson_progress_student_id_last_accessed_at_idx" ON "lesson_progress"("student_id", "last_accessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_student_id_lesson_id_key" ON "lesson_progress"("student_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_events_idempotency_key_key" ON "activity_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "activity_events_user_id_occurred_at_idx" ON "activity_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "session_series_batch_id_status_idx" ON "session_series"("batch_id", "status");

-- CreateIndex
CREATE INDEX "live_sessions_batch_id_starts_at_idx" ON "live_sessions"("batch_id", "starts_at");

-- CreateIndex
CREATE INDEX "live_sessions_trainer_id_starts_at_idx" ON "live_sessions"("trainer_id", "starts_at");

-- CreateIndex
CREATE INDEX "live_sessions_status_starts_at_idx" ON "live_sessions"("status", "starts_at");

-- AddForeignKey
ALTER TABLE "taxonomy_terms" ADD CONSTRAINT "taxonomy_terms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_publications" ADD CONSTRAINT "course_publications_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_series" ADD CONSTRAINT "session_series_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_series" ADD CONSTRAINT "session_series_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "session_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_recording_lesson_id_fkey" FOREIGN KEY ("recording_lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
