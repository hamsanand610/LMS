import { Inject, Injectable } from '@nestjs/common';
import { type AiAdminStatus, type AiMessageInput, aiAdminStatusSchema } from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { AI_PROVIDER, type AiProvider, AiUnavailableError } from '../providers/ai-provider.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';

/**
 * The only way into SI Academy AI (AI architecture §2). Phase 7A: a message is checked against the
 * policy and then refused as unavailable — conversations, streaming and usage arrive in Phase 7C, and
 * until then no provider is ever called (ADR-0029).
 */
@Injectable()
export class AiGatewayService {
  constructor(
    private readonly policy: AiPolicyService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  async send(user: AuthUser, input: AiMessageInput): Promise<never> {
    await this.policy.assertMayAsk(user, input);
    throw new AiUnavailableError();
  }

  /** Configured or not, answering or not; never which provider, model or key. */
  status(): AiAdminStatus {
    return aiAdminStatusSchema.parse({
      configured: this.provider.name !== 'none',
      gatewayReady: this.policy.gatewayReady(),
    });
  }
}
