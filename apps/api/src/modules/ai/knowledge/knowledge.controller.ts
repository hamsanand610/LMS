import { Body, Controller, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  type KnowledgeAnswerRequest,
  type KnowledgeDocumentCreate,
  type KnowledgeRetrieveRequest,
  type KnowledgeSourceCreate,
  type KnowledgeSourceUpdate,
  type KnowledgeVersionCreate,
  knowledgeAnswerRequestSchema,
  knowledgeAnswerSchema,
  knowledgeDocumentCreateSchema,
  knowledgeRetrievalSchema,
  knowledgeRetrieveRequestSchema,
  knowledgeSourceCreateSchema,
  knowledgeSourceUpdateSchema,
  knowledgeVersionCreateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../../core/auth/decorators.js';
import { RateLimit } from '../../../core/rate-limit/rate-limit.decorator.js';
import { KnowledgeAnswerService } from './answers/answer.service.js';
import { KnowledgeEmbeddingService } from './embedding/embedding.service.js';
import { KnowledgeIngestionService } from './ingestion/ingestion.service.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeRetrievalService } from './retrieval/retrieval.service.js';

const idSchema = z.uuid();

/**
 * The knowledge base's management (Roadmap Phase 8A; ADR-0033): sources, their documents and
 * versions, their ingestion (Phase 8B; ADR-0034) and embedding (Phase 8C; ADR-0035), and where they
 * stand — behind the platform's guards (authentication, CSRF and origin, `module.ai`), then
 * `ai:knowledge_manage` and the `ai.knowledge` flag. And retrieval (Phase 8D; ADR-0036), for whoever
 * may ask SI Academy AI, within the reach rule. And grounded answers (Phase 8E; ADR-0037): from
 * retrieval's passages alone, every sentence citing its passage, or declined.
 */
@ApiTags('ai')
@Controller('ai/knowledge')
@ModuleScope('ai')
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly ingestion: KnowledgeIngestionService,
    private readonly embedding: KnowledgeEmbeddingService,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly answers: KnowledgeAnswerService,
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
  @ApiCookieAuth()
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
      'forbidden (no `ai:chat`), module_disabled (`module.ai` off), ai_feature_disabled (`ai.knowledge` off), knowledge_retrieval_forbidden (a course or lesson the person cannot open), or ai_data_not_approved (a question the provider may not be given). No search runs.',
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
  @ApiCookieAuth()
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
}
