-- Phase 5 (cross-module integration). Additive only: one nullable column and five indexes; no
-- row is changed. Checked on the main database first: no course or assignment had two live
-- publications for one audience, so the unique indexes build without cleaning anything up.

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" VARCHAR(160);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "course_publications_live_scope_key" ON "course_publications"("course_id", "scope_type", "scope_id") WHERE (unpublished_at IS NULL AND scope_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "course_publications_live_everyone_key" ON "course_publications"("course_id", "scope_type") WHERE (unpublished_at IS NULL AND scope_id IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_publications_live_batch_key" ON "assignment_publications"("assignment_id", "batch_id") WHERE (withdrawn_at IS NULL AND batch_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_publications_live_learner_key" ON "assignment_publications"("assignment_id", "student_id") WHERE (withdrawn_at IS NULL AND student_id IS NOT NULL);

