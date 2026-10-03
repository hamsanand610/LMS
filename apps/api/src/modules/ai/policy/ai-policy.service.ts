import { Inject, Injectable } from '@nestjs/common';
import {
  AI_ERROR_CODES,
  AI_PURPOSE_FEATURE,
  type AiAvailability,
  type AiFeature,
  type AiFeatureMap,
  type AiMessageInput,
  type AiUnavailableReason,
  aiAvailabilitySchema,
  aiFeatureEnabled,
} from '@lms/shared';
import { type AuthUser, hasPermission } from '../../../core/auth/auth-user.js';
import { ForbiddenError } from '../../../core/http/errors.js';
import { FlagsService } from '../../settings/flags.service.js';
import { AttemptsService } from '../../tests/index.js';
import { AI_PROVIDER, type AiProvider } from '../providers/ai-provider.js';

/**
 * Whether the gateway answers at all. Phase 7A builds the boundary only: conversations, streaming
 * and usage accounting arrive in Phase 7C, and until then no provider is ever called.
 */
const GATEWAY_ANSWERS = false;

/** The permission each surface needs, beside its flags. */
const FEATURE_PERMISSION: Record<AiFeature, string> = {
  assistant: 'ai:chat',
  workspace: 'ai:chat',
  lab_hints: 'ai:hints',
  semantic_cache: 'ai:chat',
};

/**
 * Where SI Academy AI may answer, and for whom (ADR-0031).
 *
 * The AI always runs as the requesting user: what it may use is what the existing services give that
 * user, with their identity and scope. This service decides only whether a request may proceed at
 * all — module flag, the surface's own flag, the permission, and no help during a timed test. It
 * never reads content, and nothing here opens a path to the repository, the database, a shell or
 * the network; hidden test cases, reference solutions, grader logic and other learners' data stay
 * out of reach by construction, because no call here or later reads around the services that
 * already withhold them.
 */
@Injectable()
export class AiPolicyService {
  constructor(
    private readonly flags: FlagsService,
    private readonly attempts: AttemptsService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  /** The AI surfaces on for this person: `module.ai`, the surface's flag and its permission. */
  async features(user: AuthUser): Promise<AiFeatureMap> {
    const flags = await this.flags.effectiveFor(user);
    const on = (feature: AiFeature) =>
      aiFeatureEnabled(flags, feature) && hasPermission(user, FEATURE_PERMISSION[feature]);
    return {
      assistant: on('assistant'),
      workspace: on('workspace'),
      lab_hints: on('lab_hints'),
      semantic_cache: on('semantic_cache'),
    };
  }

  /** Whether the AI can answer this person now, and if not, why. Never names the provider. */
  async availability(user: AuthUser): Promise<AiAvailability> {
    const features = await this.features(user);
    const anySurface = features.assistant || features.workspace || features.lab_hints;
    let reason: AiUnavailableReason | null = null;
    if (await this.attempts.hasOpenAttempt(user.id)) reason = 'timed_assessment';
    else if (!anySurface) reason = 'feature_disabled';
    else if (!this.gatewayReady()) reason = 'not_ready';
    // Parsed on the way out: the strict schema lets nothing else through to the browser.
    return aiAvailabilitySchema.parse({ available: reason === null, reason, features });
  }

  /** A configured provider and a gateway that answers (Phase 7C). */
  gatewayReady(): boolean {
    return GATEWAY_ANSWERS && this.provider.name !== 'none';
  }

  /** Refuses a message the person may not send now, with the policy's reason (ADR-0031). */
  async assertMayAsk(user: AuthUser, input: AiMessageInput): Promise<void> {
    const feature = AI_PURPOSE_FEATURE[input.purpose];
    if (!hasPermission(user, FEATURE_PERMISSION[feature])) throw new ForbiddenError();
    const features = await this.features(user);
    if (!features[feature]) {
      throw new ForbiddenError(
        'This SI Academy AI feature is switched off.',
        AI_ERROR_CODES.FEATURE_DISABLED,
      );
    }
    if (await this.attempts.hasOpenAttempt(user.id)) {
      throw new ForbiddenError(
        'No AI help is given during a timed test. Finish the test first.',
        AI_ERROR_CODES.NOT_ALLOWED,
      );
    }
  }
}
