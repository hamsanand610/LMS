-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late', 'excused');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('queued', 'running', 'ready', 'failed', 'expired');

-- AlterTable
ALTER TABLE "live_sessions" ADD COLUMN     "attendance_marked_at" TIMESTAMPTZ,
ADD COLUMN     "attendance_marked_by_id" UUID,
ADD COLUMN     "attendance_reminder_sent_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" VARCHAR(300) NOT NULL DEFAULT '',
    "marked_by_id" UUID,
    "marked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corrected_by_id" UUID,
    "corrected_at" TIMESTAMPTZ,
    "correction_reason" VARCHAR(300) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "report" VARCHAR(40) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" "ExportStatus" NOT NULL DEFAULT 'queued',
    "row_count" INTEGER,
    "size_bytes" INTEGER,
    "filename" VARCHAR(200) NOT NULL DEFAULT '',
    "object_key" VARCHAR(400) NOT NULL DEFAULT '',
    "error" VARCHAR(500) NOT NULL DEFAULT '',
    "requested_by_id" UUID,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_student_id_marked_at_idx" ON "attendance_records"("student_id", "marked_at");

-- CreateIndex
CREATE INDEX "attendance_records_batch_id_status_idx" ON "attendance_records"("batch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key" ON "attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "report_exports_organization_id_requested_at_idx" ON "report_exports"("organization_id", "requested_at");

-- CreateIndex
CREATE INDEX "report_exports_status_idx" ON "report_exports"("status");

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_attendance_marked_by_id_fkey" FOREIGN KEY ("attendance_marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
