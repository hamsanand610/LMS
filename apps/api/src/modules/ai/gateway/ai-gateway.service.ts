import { Injectable } from '@nestjs/common';
import { type AiAdminStatus, type AiMessageInput, aiAdminStatusSchema } from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { AiUnavailableError } from '../providers/ai-provider.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';
import { ModelRouter } from '../routing/model-router.js';

/**
 * The only way into SI Academy AI (AI architecture §2). Phases 7A and 7B: a message is checked
 * against the policy and then refused as unavailable — conversations, streaming and usage arrive in
 * Phase 7C, and until then no provider is ever called (ADR-0029). When they do, calls go through the
 * model router, which is the only path to a provider.
 */
@Injectable()
export class AiGatewayService {
  constructor(
    private readonly policy: AiPolicyService,
    private readonly router: ModelRouter,
  ) {}

  async send(user: AuthUser, input: AiMessageInput): Promise<never> {
    await this.policy.assertMayAsk(user, input);
    throw new AiUnavailableError();
  }

  /** Configured or not, answering or not, and how the service is doing; never which provider, model or key. */
  status(): AiAdminStatus {
    return aiAdminStatusSchema.parse({
      configured: this.router.configured,
      gatewayReady: this.policy.gatewayReady(),
      service: this.router.serviceState(),
    });
  }
}
