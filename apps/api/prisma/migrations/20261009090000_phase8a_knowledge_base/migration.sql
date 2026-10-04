-- Roadmap Phase 8A: SI Academy AI's knowledge base (ADR-0033). Additive only: four new tables and
-- their enums; no existing table changes. No vector column and no extension: embeddings arrive in
-- Phase 8C (ADR-0026, ADR-0027).
-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('authored', 'uploaded', 'course');

-- CreateEnum
CREATE TYPE "KnowledgeAudience" AS ENUM ('institute', 'staff', 'course');

-- CreateEnum
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "KnowledgeVersionStatus" AS ENUM ('pending', 'processing', 'chunked', 'failed');

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "type" "KnowledgeSourceType" NOT NULL,
    "audience" "KnowledgeAudience" NOT NULL,
    "course_id" UUID,
    "data_class" VARCHAR(20) NOT NULL,
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" UUID,
    "published_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "canonical_ref" VARCHAR(400) NOT NULL,
    "lesson_id" UUID,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'active',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_document_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "file_id" UUID NOT NULL,
    "character_count" INTEGER NOT NULL,
    "status" "KnowledgeVersionStatus" NOT NULL DEFAULT 'pending',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "failure_code" VARCHAR(60),
    "chunked_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" VARCHAR(300) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "character_count" INTEGER NOT NULL,
    "token_estimate" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_sources_organization_id_status_idx" ON "knowledge_sources"("organization_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_sources_course_id_idx" ON "knowledge_sources"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_sources_id_organization_id_key" ON "knowledge_sources"("id", "organization_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_organization_id_idx" ON "knowledge_documents"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_lesson_id_idx" ON "knowledge_documents"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_source_id_canonical_ref_key" ON "knowledge_documents"("source_id", "canonical_ref");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_id_source_id_organization_id_key" ON "knowledge_documents"("id", "source_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_versions_file_id_key" ON "knowledge_document_versions"("file_id");

-- CreateIndex
CREATE INDEX "knowledge_document_versions_organization_id_status_idx" ON "knowledge_document_versions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_versions_document_id_version_key" ON "knowledge_document_versions"("document_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_versions_document_id_content_hash_key" ON "knowledge_document_versions"("document_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_versions_id_document_id_source_id_organi_key" ON "knowledge_document_versions"("id", "document_id", "source_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_versions_one_current_key" ON "knowledge_document_versions"("document_id") WHERE (is_current);

-- CreateIndex
CREATE INDEX "knowledge_chunks_organization_id_source_id_idx" ON "knowledge_chunks"("organization_id", "source_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_content_hash_idx" ON "knowledge_chunks"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_version_id_position_key" ON "knowledge_chunks"("version_id", "position");

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_source_id_organization_id_fkey" FOREIGN KEY ("source_id", "organization_id") REFERENCES "knowledge_sources"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_document_id_source_id_organiza_fkey" FOREIGN KEY ("document_id", "source_id", "organization_id") REFERENCES "knowledge_documents"("id", "source_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_version_id_document_id_source_id_organiza_fkey" FOREIGN KEY ("version_id", "document_id", "source_id", "organization_id") REFERENCES "knowledge_document_versions"("id", "document_id", "source_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- What the schema cannot say, held by the database itself (ADR-0033).
-- A course-audience source names its course; every other audience names none.
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_course_audience_check"
  CHECK (("audience" = 'course') = ("course_id" IS NOT NULL));
-- Knowledge is public, course or personal data (ADR-0024); restricted data is never knowledge.
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_data_class_check"
  CHECK ("data_class" IN ('public', 'course', 'personal'));
-- An archived source records when, and stays archived (no route publishes one again).
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_archived_at_check"
  CHECK (("status" = 'archived') = ("archived_at" IS NOT NULL));
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_version_check"
  CHECK ("version" >= 1);
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_content_hash_check"
  CHECK ("content_hash" ~ '^[0-9a-f]{64}$');
-- Only a version whose chunks are all recorded can be the one answers draw on.
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_current_check"
  CHECK (NOT "is_current" OR "status" = 'chunked');
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_position_check"
  CHECK ("position" >= 0);
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_content_hash_check"
  CHECK ("content_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_content_check"
  CHECK (char_length("content") > 0);
