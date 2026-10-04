-- Roadmap Phase 8B: the knowledge base's ingestion and chunking (ADR-0034). Additive only: three
-- nullable columns on knowledge_document_versions and one CHECK; no row changes, no vector column.

-- AlterTable
ALTER TABLE "knowledge_document_versions" ADD COLUMN     "chunker_version" VARCHAR(60),
ADD COLUMN     "ingestion_started_at" TIMESTAMPTZ,
ADD COLUMN     "parser_version" VARCHAR(40);

-- A version being ingested records when its ingestion took it: the lease, and the token its writes
-- check (ADR-0034).
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_processing_started_check"
  CHECK ("status" <> 'processing' OR "ingestion_started_at" IS NOT NULL);
