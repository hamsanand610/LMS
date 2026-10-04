import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  type KnowledgeDocumentCreate,
  type KnowledgeSourceCreate,
  type KnowledgeSourceUpdate,
  type KnowledgeVersionCreate,
  knowledgeDocumentCreateSchema,
  knowledgeSourceCreateSchema,
  knowledgeSourceUpdateSchema,
  knowledgeVersionCreateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../../core/auth/decorators.js';
import { KnowledgeService } from './knowledge.service.js';

const idSchema = z.uuid();

/**
 * The knowledge base's management (Roadmap Phase 8A; ADR-0033): sources, their documents and
 * versions, and where ingestion stands. Behind the platform's guards — authentication, CSRF and
 * origin, `module.ai` — then `ai:knowledge_manage` and the `ai.knowledge` flag. Nothing here
 * retrieves knowledge or answers with it: that is Phases 8D and 8E, by `KnowledgeReachService`.
 */
@ApiTags('ai')
@Controller('ai/knowledge')
@ModuleScope('ai')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

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
}
