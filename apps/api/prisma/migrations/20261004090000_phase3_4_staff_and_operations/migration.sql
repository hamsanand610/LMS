-- Roadmap Phases 3 and 4: trainer and staff completion, admin and operations.
-- Additive only: new tables, columns, indexes and enum values; nothing is dropped or rewritten.

-- CreateTable
CREATE TABLE "course_staff" (
    "course_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_staff_pkey" PRIMARY KEY ("course_id","trainer_id")
);

-- CreateTable
CREATE TABLE "feedback_forms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "batch_id" UUID NOT NULL,
    "trainer_id" UUID,
    "course_id" UUID,
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "cadence" VARCHAR(10) NOT NULL DEFAULT 'once',
    "questions" JSONB NOT NULL,
    "opens_at" TIMESTAMPTZ NOT NULL,
    "closes_at" TIMESTAMPTZ,
    "notified_period" VARCHAR(10),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "feedback_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_responses" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "respondent_token" VARCHAR(64) NOT NULL,
    "student_id" UUID,
    "answers" JSONB NOT NULL,
    "submitted_on" DATE NOT NULL,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_staff_trainer_id_idx" ON "course_staff"("trainer_id");

-- CreateIndex
CREATE INDEX "feedback_forms_organization_id_deleted_at_idx" ON "feedback_forms"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "feedback_forms_batch_id_idx" ON "feedback_forms"("batch_id");

-- CreateIndex
CREATE INDEX "feedback_forms_trainer_id_idx" ON "feedback_forms"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_responses_form_id_period_respondent_token_key" ON "feedback_responses"("form_id", "period", "respondent_token");

-- AddForeignKey
ALTER TABLE "course_staff" ADD CONSTRAINT "course_staff_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_staff" ADD CONSTRAINT "course_staff_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_forms" ADD CONSTRAINT "feedback_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_forms" ADD CONSTRAINT "feedback_forms_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_forms" ADD CONSTRAINT "feedback_forms_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_forms" ADD CONSTRAINT "feedback_forms_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

