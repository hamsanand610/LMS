-- Roadmap Phase 8D: retrieval ranks the vectors of what a person may draw on (ADR-0036). A vector
-- of 768 dimensions is 3,080 bytes, and pgvector stores it EXTERNAL: above PostgreSQL's 2 KB
-- threshold each one was moved out of its row into the TOAST table, so ranking a scope exactly
-- fetched every vector back from there. Rows now stay whole up to the page's limit (two to a
-- page): exact ranking measured about ten times faster (Phase 8 plan, Performance). It applies to
-- rows written from now on; older rows stay as they are until re-embedded or the table is
-- rewritten (runbook). No column, index or row changes.
ALTER TABLE "knowledge_chunk_embeddings" SET (toast_tuple_target = 8160);
