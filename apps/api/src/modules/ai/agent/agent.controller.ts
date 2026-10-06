import { Body, Controller, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  type AiAgentRunQuery,
  type AiAgentRunRequest,
  aiAgentRunQuerySchema,
  aiAgentRunRequestSchema,
  aiAgentRunSchema,
} from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../../core/auth/decorators.js';
import { RateLimit } from '../../../core/rate-limit/rate-limit.decorator.js';
import { AGENT_RATE_LIMIT } from './agent-limits.js';
import { AgentService } from './agent.service.js';

const idSchema = z.uuid();

/**
 * The SI Academy learning agent (Roadmap Phase 9B; ADR-0039): one route, for a learner's run in one
 * of their own `agent` conversations — started with `POST /ai/conversations` (`purpose: "agent"`)
 * and read or deleted as any of their conversations. The platform's guards come first, in their
 * usual order: rate limit (10 runs in 5 minutes each), authentication and session, CSRF and
 * origin, `module.ai`, then `ai:agent`.
 */
@ApiTags('ai')
@Controller('ai/agent')
@ModuleScope('ai')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  /**
   * A run: the learner's message answered by the learning agent — routed to a capability (explain
   * the open lesson, clear a doubt), the lesson read and the knowledge base searched by its two
   * read-only tools, the answer drafted and verified — and only then given. Server-sent events by
   * default (`stream=false`: one JSON result). There is no stop route: closing the request cancels
   * the run.
   */
  @RequirePermission('ai:agent')
  @RateLimit({ ...AGENT_RATE_LIMIT, keyBy: 'user' })
  @Post('conversations/:id/runs')
  @HttpCode(200)
  @ApiProduces('text/event-stream', 'application/json')
  @ApiOkResponse({
    description:
      'The run, once complete. Server-sent events: `meta` (the turn has begun), `step` (a state: routing, reading_lesson, searching_knowledge, planning, drafting, verifying — never its content), then, only once the whole answer is verified, `delta`s and `sources`; `notice` or `error`; `usage`; `done` with the status — answered, insufficient_evidence, not_grounded, limit_reached, refused, failed or cancelled. With `stream=false`: one JSON result with the same status, the answer (or the platform’s own words), its citations, the notice or error and the usage. Never a prompt, a tool call, a model’s reasoning or a provider’s own words.',
    standardSchema: aiAgentRunSchema,
  })
  @ApiResponse({
    status: 400,
    description:
      'validation_failed — content empty or over 4,000 characters, a malformed id, `stream` other than true or false, or any other field (a model, a tool, a course, a learner or an institute are the server’s).',
  })
  @ApiResponse({ status: 401, description: 'unauthenticated — no session.' })
  @ApiResponse({
    status: 403,
    description:
      'forbidden (no `ai:agent`, or not a learner), module_disabled (`module.ai` off), ai_feature_disabled (`ai.agent` off), ai_not_allowed (a timed test is open), ai_data_not_approved, or the conversation’s course or lesson no longer open to the learner.',
  })
  @ApiResponse({ status: 404, description: 'not_found — not one of the caller’s conversations.' })
  @ApiResponse({
    status: 409,
    description: 'ai_generation_in_progress — another of the learner’s answers is being written.',
  })
  @ApiResponse({
    status: 422,
    description:
      'ai_restricted_content (the message holds a credential: never sent or stored), or ai_subject_not_supported (not a learning agent conversation).',
  })
  @ApiResponse({
    status: 429,
    description:
      'rate_limited (10 runs in 5 minutes), or ai_quota_exceeded (an allowance is used).',
  })
  @ApiResponse({
    status: 503,
    description: 'ai_unavailable or ai_busy — no model can answer now, or too many runs at once.',
  })
  async run(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: aiAgentRunQuerySchema }) query: AiAgentRunQuery,
    @Body({ schema: aiAgentRunRequestSchema }) body: AiAgentRunRequest,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    await this.agent.respond(user, id, body, query.stream === 'true', res);
  }
}
