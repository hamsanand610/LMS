import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AiMessageInput, aiMessageInputSchema } from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../../core/auth/decorators.js';
import { RateLimit } from '../../../core/rate-limit/rate-limit.decorator.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';
import { AiGatewayService } from './ai-gateway.service.js';

/**
 * SI Academy AI's gateway (ADR-0031). Every route passes the platform's guards in their usual order —
 * rate limit, authentication and session, CSRF and origin, module (`module.ai`, off by default),
 * permission — and there is no other way in.
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

  /** A message to the AI. Phase 7A checks it against the policy and answers that AI is unavailable. */
  @RequirePermission('ai:chat')
  @RateLimit({ points: 20, durationSec: 300, keyBy: 'user' })
  @Post('messages')
  send(
    @Body({ schema: aiMessageInputSchema }) body: AiMessageInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.gateway.send(user, body);
  }

  /** The Super Admin's view of the gateway: configured or not, answering or not. */
  @RequirePermission('ai:manage')
  @Get('admin/status')
  status() {
    return this.gateway.status();
  }
}
