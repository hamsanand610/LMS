import { Injectable } from '@nestjs/common';
import {
  AI_ERROR_CODES,
  AI_PURPOSE_FEATURE,
  type AiAvailability,
  type AiFeature,
  type AiFeatureMap,
  type AiPurpose,
  type AiUnavailableReason,
  aiAvailabilitySchema,
  aiFeatureEnabled,
} from '@lms/shared';
import { type AuthUser, hasPermission } from '../../../core/auth/auth-user.js';
import { ForbiddenError } from '../../../core/http/errors.js';
import { FlagsService } from '../../settings/flags.service.js';
import { AttemptsService } from '../../tests/index.js';
import { type AiRouteRequest, ModelRouter } from '../routing/model-router.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';

/**
 * Whether the gateway answers at all. Phases 7A and 7B built the boundary, the providers and the
 * router; Phase 7C brings conversations, streaming and usage accounting, so it answers — still
 * only behind `module.ai`, the surface's flag, the permission, the quotas and a configured provider.
 */
const GATEWAY_ANSWERS = true;

/** The permission each surface needs, beside its flags. */
const FEATURE_PERMISSION: Record<AiFeature, string> = {
  assistant: 'ai:chat',
  workspace: 'ai:chat',
  lab_hints: 'ai:hints',
  semantic_cache: 'ai:chat',
  // Phase 9B (ADR-0039): the learning agent, a learner's own.
  agent: 'ai:agent',
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
    private readonly router: ModelRouter,
    private readonly settings: AiSettingsService,
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
      agent: on('agent'),
    };
  }

  /**
   * Whether the AI can answer this person now, and if not, why. Never names the provider. With it,
   * which subjects the institute's approvals let a question bring (Phase 7E): course material to
   * the assistant or the learning agent beside a course or lesson, the learner's own attempt to a
   * lab hint, and the learner's own learning state and lab attempts to the learning agent (Phase
   * 9C). The browser uses them only to offer the entry points; every question is checked again here.
   */
  async availability(user: AuthUser): Promise<AiAvailability> {
    // The institute's settings decide which models route, and so whether one is answering.
    await this.settings.current();
    const features = await this.features(user);
    const approved = (route: Pick<AiRouteRequest, 'task' | 'feature' | 'dataClass'>) =>
      this.router.refusalFor(
        { ...route, userId: user.id, organizationId: user.organizationId },
        true,
      ) === null;
    const subjects = {
      course:
        (features.assistant || features.agent) &&
        approved({ task: 'chat', feature: 'assistant', dataClass: 'course' }),
      labHints:
        features.lab_hints &&
        approved({ task: 'hint', feature: 'lab_hints', dataClass: 'personal' }),
      learnerContext:
        features.agent && approved({ task: 'chat', feature: 'agent', dataClass: 'personal' }),
    };
    const anySurface =
      features.assistant || features.workspace || features.lab_hints || features.agent;
    let reason: AiUnavailableReason | null = null;
    if (await this.attempts.hasOpenAttempt(user.id)) reason = 'timed_assessment';
    else if (!anySurface) reason = 'feature_disabled';
    else if (!this.gatewayReady()) reason = 'not_ready';
    // Parsed on the way out: the strict schema lets nothing else through to the browser.
    return aiAvailabilitySchema.parse({ available: reason === null, reason, features, subjects });
  }

  /** A gateway that answers (Phase 7C), and a model service the router can call now. */
  gatewayReady(): boolean {
    const service = this.router.serviceState();
    return GATEWAY_ANSWERS && (service === 'ready' || service === 'degraded');
  }

  /**
   * Refuses a question for a surface the person may not use now, with the policy's reason
   * (ADR-0031): its permission, its flags, and no help during a timed test.
   */
  async assertMayAsk(user: AuthUser, purpose: AiPurpose): Promise<void> {
    const feature = AI_PURPOSE_FEATURE[purpose];
    if (!hasPermission(user, FEATURE_PERMISSION[feature])) throw new ForbiddenError();
    const features = await this.features(user);
    if (!features[feature]) {
      throw new ForbiddenError(
        'This SI Academy AI feature is switched off.',
        AI_ERROR_CODES.FEATURE_DISABLED,
      );
    }
    await this.assertNotInTimedTest(user);
  }

  /**
   * No AI during a timed test (ADR-0031): no question, and no reading of earlier answers, while an
   * attempt is open. The browser is never trusted with this.
   */
  async assertNotInTimedTest(user: AuthUser): Promise<void> {
    if (await this.attempts.hasOpenAttempt(user.id)) {
      throw new ForbiddenError(
        'No AI help is given during a timed test. Finish the test first.',
        AI_ERROR_CODES.NOT_ALLOWED,
      );
    }
  }
}
