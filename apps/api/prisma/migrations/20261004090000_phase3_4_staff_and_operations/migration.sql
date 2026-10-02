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

-- CreateIndex
CREATE INDEX "course_staff_trainer_id_idx" ON "course_staff"("trainer_id");

-- AddForeignKey
ALTER TABLE "course_staff" ADD CONSTRAINT "course_staff_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_staff" ADD CONSTRAINT "course_staff_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

