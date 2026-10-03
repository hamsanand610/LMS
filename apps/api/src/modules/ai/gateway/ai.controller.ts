import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  type AiConversationCreate,
  type AiMessageSend,
  aiConversationCreateSchema,
  aiMessageSendSchema,
  paginationQuerySchema,
} from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../../core/auth/decorators.js';
import { RateLimit } from '../../../core/rate-limit/rate-limit.decorator.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';
import { AiGatewayService } from './ai-gateway.service.js';

const idSchema = z.uuid();
const listQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true });

/**
 * SI Academy AI's gateway (ADR-0031). Every route passes the platform's guards in their usual order —
 * rate limit, authentication and session, CSRF and origin, module (`module.ai`, off by default),
 * permission — and there is no other way in. Conversations are their owner's alone (Phase 7C).
 */
@ApiTags('ai')
@Controller('ai')
@ModuleScope('ai')
export class AiController {
  constructor(
    private readonly policy: AiPolicyService,
    private readonly gateway: AiGatewayService,
  ) {}

  /** Whether the AI can answer the caller now, and which surfaces are on for them. */
  @RequirePermission('ai:chat')
  @Get('availability')
  availability(@CurrentUser() user: AuthUser) {
    return this.policy.availability(user);
  }

  /** The caller's own conversations, most recent first. */
  @RequirePermission('ai:chat')
  @Get('conversations')
  list(
    @Query({ schema: listQuerySchema }) query: z.infer<typeof listQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.gateway.listConversations(user, query);
  }

  /** A new conversation for one AI surface; a lab hint names its lab. */
  @RequirePermission('ai:chat')
  @RateLimit({ points: 20, durationSec: 300, keyBy: 'user' })
  @Post('conversations')
  create(
    @Body({ schema: aiConversationCreateSchema }) body: AiConversationCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.gateway.createConversation(user, body);
  }

  /** One of the caller's conversations with its messages; anybody else's is not found. */
  @RequirePermission('ai:chat')
  @Get('conversations/:id')
  detail(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.gateway.conversation(user, id);
  }

  /** Deletes one of the caller's conversations. */
  @RequirePermission('ai:chat')
  @Delete('conversations/:id')
  @HttpCode(204)
  async remove(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    await this.gateway.removeConversation(user, id);
  }

  /**
   * A question in one of the caller's conversations (20 in 5 minutes per person). The answer comes
   * back as server-sent events on this response: `meta`, `delta`…, `notice`/`error`, `usage`,
   * `done`, with a `ping` every 15 seconds. A refusal before the answer starts is an ordinary
   * problem response.
   */
  @RequirePermission('ai:chat')
  @RateLimit({ points: 20, durationSec: 300, keyBy: 'user' })
  @Post('conversations/:id/messages')
  @HttpCode(200)
  async ask(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: aiMessageSendSchema }) body: AiMessageSend,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    await this.gateway.ask(user, id, body, res);
  }

  /** The Super Admin's view of the gateway: configured or not, answering or not. */
  @RequirePermission('ai:manage')
  @Get('admin/status')
  status() {
    return this.gateway.status();
  }
}
