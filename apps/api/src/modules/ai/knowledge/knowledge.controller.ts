import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  type KnowledgeAnswerRequest,
  type KnowledgeChunkQuery,
  type KnowledgeDocumentCreate,
  type KnowledgeDocumentUpdate,
  type KnowledgePreviewRequest,
  type KnowledgeRetrieveRequest,
  type KnowledgeSourceCreate,
  type KnowledgeSourceUpdate,
  type KnowledgeUpload,
  type KnowledgeVersionCreate,
  type KnowledgeVersionUpload,
  knowledgeAnswerRequestSchema,
  knowledgeAnswerSchema,
  knowledgeChunkPageSchema,
  knowledgeChunkQuerySchema,
  knowledgeDocumentCreateSchema,
  knowledgeDocumentUpdateSchema,
  knowledgeDocumentViewSchema,
  knowledgePreviewRequestSchema,
  knowledgeProcessingSummarySchema,
  knowledgeRetrievalSchema,
  knowledgeRetrieveRequestSchema,
  knowledgeSourceCreateSchema,
  knowledgeSourceUpdateSchema,
  knowledgeUploadSchema,
  knowledgeVersionCreateSchema,
  knowledgeVersionUploadSchema,
} from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../../core/auth/decorators.js';
import { RateLimit } from '../../../core/rate-limit/rate-limit.decorator.js';
import { KnowledgeAnswerService } from './answers/answer.service.js';
import { KnowledgeEmbeddingService } from './embedding/embedding.service.js';
import { KnowledgeIngestionService } from './ingestion/ingestion.service.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeProcessingService } from './processing.service.js';
import { KnowledgeRetrievalService } from './retrieval/retrieval.service.js';

const idSchema = z.uuid();

/**
 * The knowledge base's management (Roadmap Phase 8A; ADR-0033): sources, their documents and
 * versions, their ingestion (Phase 8B; ADR-0034) and embedding (Phase 8C; ADR-0035), and where they
 * stand — behind the platform's guards (authentication, CSRF and origin, `module.ai`), then
 * `ai:knowledge_manage` and the `ai.knowledge` flag. And retrieval (Phase 8D; ADR-0036), for whoever
 * may ask SI Academy AI, within the reach rule. And grounded answers (Phase 8E; ADR-0037): from
 * retrieval's passages alone, every sentence citing its passage, or declined. And the Knowledge base
 * page's routes (Phase 10): uploads processed on their own, documents changed and deleted, processing
 * asked for again, chunks inspected, and a question tried over the institute's published knowledge.
 */
@ApiTags('ai')
// Every route needs a signed-in session (Phase 8F: said for the management routes too).
@ApiCookieAuth()
@Controller('ai/knowledge')
@ModuleScope('ai')
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly ingestion: KnowledgeIngestionService,
    private readonly embedding: KnowledgeEmbeddingService,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly answers: KnowledgeAnswerService,
    private readonly processing: KnowledgeProcessingService,
  ) {}

  /** Counts by state, and whether the database can hold vectors yet. */
  @RequirePermission('ai:knowledge_manage')
  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.knowledge.status(user);
  }

  @RequirePermission('ai:knowledge_manage')
  @Get('sources')
  listSources(@CurrentUser() user: AuthUser) {
    return this.knowledge.listSources(user);
  }

  /** A new source, as a draft. */
  @RequirePermission('ai:knowledge_manage')
  @Post('sources')
  createSource(
    @Body({ schema: knowledgeSourceCreateSchema }) body: KnowledgeSourceCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.knowledge.createSource(user, body);
  }

  /** A source with its documents and their versions: metadata only, never the content. */
  @RequirePermission('ai:knowledge_manage')
  @Get('sources/:id')
  source(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.knowledge.source(user, id);
  }

  @RequirePermission('ai:knowledge_manage')
  @Patch('sources/:id')
  updateSource(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: knowledgeSourceUpdateSchema }) body: KnowledgeSourceUpdate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.knowledge.updateSource(user, id, body);
  }

  @RequirePermission('ai:knowledge_manage')
  @Post('sources/:id/publish')
  @HttpCode(200)
  publish(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.knowledge.publishSource(user, id);
  }

  /** For good: an archived source is never published again. */
  @RequirePermission('ai:knowledge_manage')
  @Post('sources/:id/archive')
  @HttpCode(200)
  archive(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.knowledge.archiveSource(user, id);
  }

  @RequirePermission('ai:knowledge_manage')
  @Post('sources/:id/documents')
  createDocument(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: knowledgeDocumentCreateSchema }) body: KnowledgeDocumentCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.knowledge.createDocument(user, id, body);
  }

  /** A new version of a document: its content stored through the storage driver, and hashed. */
  @RequirePermission('ai:knowledge_manage')
  @Post('documents/:id/versions')
  @ApiResponse({ status: 201, description: 'The version, stored and waiting to be ingested.' })
  @ApiResponse({
    status: 422,
    description:
      'ai_restricted_content — the content looks like it holds a password, key or token, which never enters the knowledge base (Phase 8F). Nothing is stored.',
  })
  createVersion(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: knowledgeVersionCreateSchema }) body: KnowledgeVersionCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.knowledge.createVersion(user, id, body);
  }

  /** One version: where its ingestion stands. Metadata only, never the content (Phase 8B). */
  @RequirePermission('ai:knowledge_manage')
  @Get('versions/:id')
  version(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.knowledge.version(user, id);
  }

  /** Asks for a version's ingestion; the queue runs it (Phase 8B). */
  @RequirePermission('ai:knowledge_manage')
  @Post('versions/:id/ingest')
  @HttpCode(202)
  ingest(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.ingestion.request(user, id);
  }

  /** Asks for a version's embedding under the active contract; the queue runs it (Phase 8C). */
  @RequirePermission('ai:knowledge_manage')
  @Post('versions/:id/embed')
  @HttpCode(202)
  embed(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.embedding.request(user, id);
  }

  /**
   * The passages a person may draw on for a question, best first, with their provenance (Phase 8D;
   * ADR-0036): for `ai:chat` — whoever may ask SI Academy AI, within what they may already see —
   * while `module.ai` and `ai.knowledge` are on, at most 30 times in five minutes. The server
   * decides what may be drawn on; the body names only the question, how many passages, and the
   * course or lesson it is asked from. A client that leaves stops the work.
   */
  @RequirePermission('ai:chat')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post('retrieve')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'The passages, best first: provenance (source, document, version, position, heading), text, hash and cosine similarity. Never a vector.',
    standardSchema: knowledgeRetrievalSchema,
  })
  @ApiResponse({
    status: 400,
    description:
      'validation_failed — a query shorter than 3 or longer than 1,000 characters, top-K outside 1 to 20, a malformed course or lesson id, a lesson outside the given course, or any other field (the institute, data classes, publication, versions, the model and vectors are the server’s).',
  })
  @ApiResponse({ status: 401, description: 'unauthenticated — no session.' })
  @ApiResponse({
    status: 403,
    description:
      'forbidden (no `ai:chat`), module_disabled (`module.ai` off), ai_feature_disabled (`ai.knowledge` off), ai_not_allowed (a timed test is open, Phase 8F), knowledge_retrieval_forbidden (a course or lesson the person cannot open), or ai_data_not_approved (a question the provider may not be given). No search runs.',
  })
  @ApiResponse({
    status: 422,
    description:
      'ai_restricted_content — the question looks like it holds a credential, which is never sent anywhere.',
  })
  @ApiResponse({
    status: 429,
    description:
      'rate_limited — more than 30 retrievals in five minutes; or ai_quota_exceeded — the person’s allowance or the institute’s budget.',
  })
  @ApiResponse({
    status: 500,
    description: 'knowledge_retrieval_failed — the search failed. Never the database’s own error.',
  })
  @ApiResponse({
    status: 502,
    description:
      'knowledge_retrieval_failed — the provider’s answer was not a vector the platform keeps.',
  })
  @ApiResponse({
    status: 503,
    description:
      'knowledge_retrieval_unavailable — nothing can embed a question on this installation, or the provider cannot now. Never the provider’s own words.',
  })
  @ApiResponse({
    status: 504,
    description: 'knowledge_retrieval_timeout — the retrieval did not finish within its deadline.',
  })
  retrieve(
    @Body({ schema: knowledgeRetrieveRequestSchema }) body: KnowledgeRetrieveRequest,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const caller = new AbortController();
    const left = () => {
      if (!res.writableFinished) caller.abort(new Error('The client went away'));
    };
    res.once('close', left);
    return this.retrieval.retrieve(user, body, caller.signal).finally(() => res.off('close', left));
  }

  /**
   * A question answered from the knowledge base, grounded (Phase 8E; ADR-0037): from the passages
   * retrieval returns for the person (8D, the reach rule) — only those similar enough to be evidence
   * and of data the provider may be given — every sentence citing its passage, or declined in the
   * platform's own words when the passages do not say. One JSON answer, or server-sent events with
   * `stream: true`. The server retrieves, chooses the evidence and writes the instructions: the
   * request names only the question and the course or lesson it is asked from.
   */
  @RequirePermission('ai:chat')
  @RateLimit({ points: 20, durationSec: 300, keyBy: 'user' })
  @Post('answer')
  @HttpCode(200)
  @ApiProduces('application/json', 'text/event-stream')
  @ApiOkResponse({
    description:
      'The answer: `answered` (every sentence cites `[S1]`-style the passages listed in `citations`), `insufficient_evidence` (nothing retrieved supports an answer — none is made up), `conflicting` (the sources disagree: each position with its source), or `not_grounded` (the model’s answer could not be supported, so it is withheld); the evidence retrieved and used; the usage once a model was called. With `stream: true`: server-sent events `meta` (once the evidence is chosen), `delta` and `sources` (only once the answer has been checked), `notice`, `usage`, `error` and `done`. Never a prompt, a vector or a provider’s own words.',
    standardSchema: knowledgeAnswerSchema,
  })
  @ApiResponse({
    status: 400,
    description:
      'validation_failed — a query shorter than 3 or longer than 1,000 characters, a malformed course or lesson id, a lesson outside the given course, or any other field (passages, citations, data classes, a model, a prompt or an institute are the server’s).',
  })
  @ApiResponse({ status: 401, description: 'unauthenticated — no session.' })
  @ApiResponse({
    status: 403,
    description:
      'forbidden (no `ai:chat`), module_disabled (`module.ai` off), ai_feature_disabled (`ai.knowledge` or `ai.knowledge_answers` off — nothing is retrieved or sent), ai_not_allowed (a timed test is open), knowledge_retrieval_forbidden (a course or lesson the person cannot open), or ai_data_not_approved (data the provider may not be given).',
  })
  @ApiResponse({
    status: 409,
    description: 'ai_generation_in_progress — another of the person’s answers is being written.',
  })
  @ApiResponse({
    status: 422,
    description:
      'ai_restricted_content — the question looks like it holds a credential, which is never sent anywhere.',
  })
  @ApiResponse({
    status: 429,
    description:
      'rate_limited — more than 20 answers in five minutes; or ai_quota_exceeded — the person’s allowance or the institute’s budget.',
  })
  @ApiResponse({
    status: 500,
    description: 'knowledge_retrieval_failed — the search failed.',
  })
  @ApiResponse({
    status: 502,
    description:
      'knowledge_answer_failed — the provider’s answer could not be read; knowledge_retrieval_failed — nor its vector.',
  })
  @ApiResponse({
    status: 503,
    description:
      'knowledge_answer_unavailable — no model can answer from the knowledge base here or now (or none is calibrated for the embedding model); ai_busy — too many answers at once; knowledge_retrieval_unavailable.',
  })
  @ApiResponse({
    status: 504,
    description:
      'knowledge_answer_timeout — the answer took too long; knowledge_retrieval_timeout — the retrieval did.',
  })
  async answer(
    @Body({ schema: knowledgeAnswerRequestSchema }) body: KnowledgeAnswerRequest,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    await this.answers.respond(user, body, res);
  }

  // ───────────────────────── the Knowledge base page (Phase 10) ─────────────────────────

  /**
   * A new document from an uploaded file: stored, then read, chunked and — while its source is
   * published — indexed by the queue on its own. At most 30 uploads in five minutes.
   */
  @RequirePermission('ai:knowledge_manage')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post('sources/:id/uploads')
  @ApiResponse({
    status: 201,
    description: 'The document, its first version stored and sent to be processed.',
    standardSchema: knowledgeDocumentViewSchema,
  })
  @ApiResponse({
    status: 400,
    description:
      'validation_failed — a title, a file name that is not .md, .markdown, .txt, .html or .htm, an empty file, one over 750 KB or 500,000 characters, one that is not UTF-8 text, or a lesson outside the source’s course.',
  })
  @ApiResponse({
    status: 409,
    description:
      'knowledge_source_archived, or knowledge_version_duplicate — the content is already a document of the source.',
  })
  @ApiResponse({
    status: 422,
    description:
      'ai_restricted_content — the file holds a password, key or token. Nothing is stored.',
  })
  upload(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: knowledgeUploadSchema }) body: KnowledgeUpload,
    @CurrentUser() user: AuthUser,
  ) {
    return this.processing.upload(user, id, body);
  }

  /** A document with its versions and the lesson it is about: metadata only. */
  @RequirePermission('ai:knowledge_manage')
  @Get('documents/:id')
  @ApiOkResponse({ standardSchema: knowledgeDocumentViewSchema })
  document(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.knowledge.document(user, id);
  }

  /** A document's title, or the lesson it is about. */
  @RequirePermission('ai:knowledge_manage')
  @Patch('documents/:id')
  @ApiOkResponse({ standardSchema: knowledgeDocumentViewSchema })
  updateDocument(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: knowledgeDocumentUpdateSchema }) body: KnowledgeDocumentUpdate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.knowledge.updateDocument(user, id, body);
  }

  /** A new version of a document from an uploaded file, processed as an upload is. */
  @RequirePermission('ai:knowledge_manage')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post('documents/:id/uploads')
  @ApiResponse({
    status: 201,
    description:
      'The document, its new version stored and sent to be processed. The older version is drawn on until the new one is read; then neither until the new one is indexed.',
    standardSchema: knowledgeDocumentViewSchema,
  })
  uploadVersion(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: knowledgeVersionUploadSchema }) body: KnowledgeVersionUpload,
    @CurrentUser() user: AuthUser,
  ) {
    return this.processing.uploadVersion(user, id, body);
  }

  /**
   * A document processed again: read again when its newest version failed or was never read,
   * otherwise its vectors rebuilt.
   */
  @RequirePermission('ai:knowledge_manage')
  @Post('documents/:id/process')
  @HttpCode(202)
  @ApiResponse({
    status: 202,
    description: 'The document, sent to be processed again.',
    standardSchema: knowledgeDocumentViewSchema,
  })
  @ApiResponse({
    status: 409,
    description:
      'knowledge_processing_running, knowledge_nothing_to_process, knowledge_source_archived, knowledge_version_not_embeddable (a draft source, among others) or knowledge_embeddings_unavailable.',
  })
  processDocument(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.processing.processDocument(user, id);
  }

  /** Every document of a source processed as far as it can be now: after publishing, above all. */
  @RequirePermission('ai:knowledge_manage')
  @Post('sources/:id/process')
  @HttpCode(202)
  @ApiResponse({ status: 202, standardSchema: knowledgeProcessingSummarySchema })
  processSource(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.processing.processSource(user, id);
  }

  /** A document deleted for good: its versions, chunks, vectors and stored files. */
  @RequirePermission('ai:knowledge_manage')
  @Delete('documents/:id')
  @HttpCode(204)
  async deleteDocument(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.knowledge.deleteDocument(user, id);
  }

  /** A source deleted for good, with every document in it. */
  @RequirePermission('ai:knowledge_manage')
  @Delete('sources/:id')
  @HttpCode(204)
  async deleteSource(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    await this.knowledge.deleteSource(user, id);
  }

  /** One page of a version's chunks, in order, to inspect what was read. */
  @RequirePermission('ai:knowledge_manage')
  @Get('versions/:id/chunks')
  @ApiOkResponse({ standardSchema: knowledgeChunkPageSchema })
  chunks(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: knowledgeChunkQuerySchema }) query: KnowledgeChunkQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.knowledge.chunks(user, id, query);
  }

  /**
   * A question tried from the Knowledge base page, by whoever manages it: a grounded answer, with
   * every check, over the institute's published knowledge — or one source, course or lesson of it.
   * Every other answer keeps the reach rule. At most 20 in five minutes.
   */
  @RequirePermission('ai:knowledge_manage')
  @RateLimit({ points: 20, durationSec: 300, keyBy: 'user' })
  @Post('preview')
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: knowledgeAnswerSchema })
  @ApiResponse({
    status: 403,
    description:
      'forbidden (no `ai:knowledge_manage`), module_disabled, ai_feature_disabled (`ai.knowledge` or `ai.knowledge_answers` off), ai_not_allowed (a timed test is open) or knowledge_retrieval_forbidden (a course or lesson not of this institute).',
  })
  preview(
    @Body({ schema: knowledgePreviewRequestSchema }) body: KnowledgePreviewRequest,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const caller = new AbortController();
    const left = () => {
      if (!res.writableFinished) caller.abort(new Error('The client went away'));
    };
    res.once('close', left);
    return this.answers.preview(user, body, caller.signal).finally(() => res.off('close', left));
  }
}
