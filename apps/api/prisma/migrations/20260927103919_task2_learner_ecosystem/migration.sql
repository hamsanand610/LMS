-- CreateEnum
CREATE TYPE "DriveStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('applied', 'shortlisted', 'selected', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "DoubtStatus" AS ENUM ('open', 'answered', 'resolved');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "topic" VARCHAR(80) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "certifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "projects" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "industry" VARCHAR(80) NOT NULL DEFAULT '',
    "website" VARCHAR(300) NOT NULL DEFAULT '',
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "logo_file_id" UUID,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_kit_items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "topic" VARCHAR(80) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_kit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_favourites" (
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_favourites_pkey" PRIMARY KEY ("user_id","company_id")
);

-- CreateTable
CREATE TABLE "placement_drives" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "role" VARCHAR(120) NOT NULL,
    "employment_type" VARCHAR(20) NOT NULL DEFAULT 'full_time',
    "location" VARCHAR(120) NOT NULL DEFAULT '',
    "package_text" VARCHAR(80) NOT NULL DEFAULT '',
    "description" VARCHAR(4000) NOT NULL DEFAULT '',
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "apply_by" TIMESTAMPTZ NOT NULL,
    "status" "DriveStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "placement_drives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_applications" (
    "id" UUID NOT NULL,
    "drive_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "resume_id" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'applied',
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "drive_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID,
    "lesson_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "status" "DoubtStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "doubts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubt_replies" (
    "id" UUID NOT NULL,
    "doubt_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "from_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubt_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_organization_id_deleted_at_idx" ON "companies"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "companies_organization_id_slug_key" ON "companies"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "company_kit_items_company_id_position_idx" ON "company_kit_items"("company_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "company_kit_items_company_id_question_id_key" ON "company_kit_items"("company_id", "question_id");

-- CreateIndex
CREATE INDEX "placement_drives_organization_id_status_apply_by_idx" ON "placement_drives"("organization_id", "status", "apply_by");

-- CreateIndex
CREATE UNIQUE INDEX "placement_drives_organization_id_code_key" ON "placement_drives"("organization_id", "code");

-- CreateIndex
CREATE INDEX "drive_applications_student_id_status_idx" ON "drive_applications"("student_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "drive_applications_drive_id_student_id_key" ON "drive_applications"("drive_id", "student_id");

-- CreateIndex
CREATE INDEX "doubts_student_id_created_at_idx" ON "doubts"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "doubts_organization_id_status_created_at_idx" ON "doubts"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "doubts_lesson_id_idx" ON "doubts"("lesson_id");

-- CreateIndex
CREATE INDEX "doubt_replies_doubt_id_created_at_idx" ON "doubt_replies"("doubt_id", "created_at");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_kit_items" ADD CONSTRAINT "company_kit_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_kit_items" ADD CONSTRAINT "company_kit_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_favourites" ADD CONSTRAINT "company_favourites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_favourites" ADD CONSTRAINT "company_favourites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_applications" ADD CONSTRAINT "drive_applications_drive_id_fkey" FOREIGN KEY ("drive_id") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_applications" ADD CONSTRAINT "drive_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_replies" ADD CONSTRAINT "doubt_replies_doubt_id_fkey" FOREIGN KEY ("doubt_id") REFERENCES "doubts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_replies" ADD CONSTRAINT "doubt_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
