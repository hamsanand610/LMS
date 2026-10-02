-- Roadmap Phase 2: complete learner experience (docs/phases/PHASE-02-learner-experience.md).
-- Additive: a new enum value, new columns with defaults, a new table. Two kinds of row change:
-- - completion rules a lesson's type can actually meet (D3): practice lessons complete when their
--   question is answered correctly (`pass`); a rule a type can never meet moves to its default;
-- - nothing else. No column, row or value is removed, and no learner progress is touched.

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('issued', 'revoked');

-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'withdrawn';

-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN     "last_progress_at" TIMESTAMPTZ,
ADD COLUMN     "watched_seconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "is_late" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "learner_name" VARCHAR(160) NOT NULL,
    "course_title" VARCHAR(200) NOT NULL,
    "institute" VARCHAR(160) NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CertificateStatus" NOT NULL DEFAULT 'issued',
    "revoked_at" TIMESTAMPTZ,
    "revoked_reason" VARCHAR(500) NOT NULL DEFAULT '',
    "object_key" VARCHAR(400) NOT NULL DEFAULT '',

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE INDEX "certificates_organization_id_issued_at_idx" ON "certificates"("organization_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_student_id_course_id_key" ON "certificates"("student_id", "course_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Completion rules each lesson type can meet (D3).
UPDATE "lessons" SET "completion_rule" = 'pass' WHERE "type" = 'practice' AND "completion_rule" <> 'pass';
UPDATE "lessons" SET "completion_rule" = 'manual' WHERE "type" IN ('article', 'resources') AND "completion_rule" IN ('watch', 'pass');
UPDATE "lessons" SET "completion_rule" = 'watch' WHERE "type" = 'video' AND "completion_rule" = 'pass';
