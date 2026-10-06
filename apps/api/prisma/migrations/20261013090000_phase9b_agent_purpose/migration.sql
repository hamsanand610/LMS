-- Roadmap Phase 9B: the learning agent (ADR-0039). Its conversations are ordinary conversations
-- of their own purpose, and its runs ordinary turns: no new table, column, index or row.

-- AlterEnum
ALTER TYPE "AiPurpose" ADD VALUE 'agent';
