-- Roadmap Phase 8C: the knowledge base's embeddings (ADR-0035). The pgvector extension (0.8.7, built
-- into the platform's PostgreSQL image, ADR-0026), a table of embedding runs and a table of vectors
-- beside the chunks — 768 dimensions, unit length, an HNSW index for cosine distance. Additive: the
-- one change to an existing table is a unique key on knowledge_chunks' whole provenance.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('pending', 'embedding', 'embedded', 'failed');

-- CreateTable
CREATE TABLE "knowledge_version_embeddings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "dimension" INTEGER NOT NULL,
    "embedding_version" VARCHAR(40) NOT NULL,
    "status" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'pending',
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "embedded_count" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failure_code" VARCHAR(60),
    "requested_by_id" UUID,
    "claimed_at" TIMESTAMPTZ,
    "embedded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_version_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunk_embeddings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "dimension" INTEGER NOT NULL,
    "embedding_version" VARCHAR(40) NOT NULL,
    "embedding" vector(768) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunk_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_version_embeddings_organization_id_status_idx" ON "knowledge_version_embeddings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_version_embeddings_document_id_idx" ON "knowledge_version_embeddings"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_version_embeddings_version_id_provider_model_dime_key" ON "knowledge_version_embeddings"("version_id", "provider", "model", "dimension", "embedding_version");

-- CreateIndex
CREATE INDEX "knowledge_chunk_embeddings_organization_id_source_id_idx" ON "knowledge_chunk_embeddings"("organization_id", "source_id");

-- CreateIndex
CREATE INDEX "knowledge_chunk_embeddings_version_id_idx" ON "knowledge_chunk_embeddings"("version_id");

-- CreateIndex
CREATE INDEX "knowledge_chunk_embeddings_document_id_idx" ON "knowledge_chunk_embeddings"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunk_embeddings_chunk_id_provider_model_dimensio_key" ON "knowledge_chunk_embeddings"("chunk_id", "provider", "model", "dimension", "embedding_version");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_id_version_id_document_id_source_id_organi_key" ON "knowledge_chunks"("id", "version_id", "document_id", "source_id", "organization_id");

-- AddForeignKey
ALTER TABLE "knowledge_version_embeddings" ADD CONSTRAINT "knowledge_version_embeddings_version_id_document_id_source_fkey" FOREIGN KEY ("version_id", "document_id", "source_id", "organization_id") REFERENCES "knowledge_document_versions"("id", "document_id", "source_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_version_embeddings" ADD CONSTRAINT "knowledge_version_embeddings_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_chunk_id_version_id_document_id_fkey" FOREIGN KEY ("chunk_id", "version_id", "document_id", "source_id", "organization_id") REFERENCES "knowledge_chunks"("id", "version_id", "document_id", "source_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- What the schema cannot say, held by the database itself (ADR-0035).
-- One dimension for every stored vector: the column's type enforces it, and the rows say it.
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_dimension_check"
  CHECK ("dimension" = 768);
-- Every vector is kept at unit length, so cosine distance and inner product agree; a zero vector,
-- which has no direction, can never be stored.
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_unit_length_check"
  CHECK (abs(vector_norm("embedding") - 1) < 0.001);
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_content_hash_check"
  CHECK ("content_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "knowledge_version_embeddings" ADD CONSTRAINT "knowledge_version_embeddings_dimension_check"
  CHECK ("dimension" = 768);
ALTER TABLE "knowledge_version_embeddings" ADD CONSTRAINT "knowledge_version_embeddings_counts_check"
  CHECK ("chunk_count" >= 0 AND "embedded_count" >= 0 AND "attempts" >= 0);
-- A run in progress records when it took the version: the lease, and the token its writes check.
ALTER TABLE "knowledge_version_embeddings" ADD CONSTRAINT "knowledge_version_embeddings_claim_check"
  CHECK ("status" <> 'embedding' OR "claimed_at" IS NOT NULL);
ALTER TABLE "knowledge_version_embeddings" ADD CONSTRAINT "knowledge_version_embeddings_embedded_check"
  CHECK ("status" <> 'embedded' OR "embedded_at" IS NOT NULL);

-- Cosine distance over the vectors (pgvector HNSW; ADR-0035): no training, so it serves from the
-- first row, and it is kept up to date as vectors are written. Retrieval (Phase 8D) filters by the
-- reach rule in the same query, with pgvector's iterative index scans.
CREATE INDEX "knowledge_chunk_embeddings_embedding_hnsw_idx" ON "knowledge_chunk_embeddings"
  USING hnsw ("embedding" vector_cosine_ops);
