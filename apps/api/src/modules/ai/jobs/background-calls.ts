import { Injectable } from '@nestjs/common';
import { AI_PURPOSE_FEATURE, type AiDataClass } from '@lms/shared';
import { AuthContextService } from '../../../core/auth/auth-context.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { ModuleStateService } from '../../../core/registry/module-state.service.js';
import type { ConversationRow } from '../conversations/conversations.service.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';
import {
  type AiChatMessage,
  AiProviderError,
  type AiProviderFailure,
  AiUnavailableError,
} from '../providers/ai-provider.js';
import {
  type AiAttempt,
  type AiRouteRequest,
  type AiRoutedResult,
  ModelRouter,
} from '../routing/model-router.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import { toMicros } from '../usage/cost.js';
import { type AiLedgerTurn, AiUsageService } from '../usage/usage.service.js';

/** What a background call is for (Phase 7D): a title or notes, for one conversation's owner. */
export interface AiBackgroundRequest {
  task: 'title' | 'summarize';
  conversation: ConversationRow;
  /** The most sensitive data the call carries: that of the messages it is written from. */
  dataClass: AiDataClass;
  messages: AiChatMessage[];
  maxOutputTokens: number;
}

export type AiBackgroundResult =
  | { status: 'skipped'; reason: string }
  | { status: 'answered'; result: AiRoutedResult; ledger: AiLedgerTurn }
  | { status: 'failed'; kind: string; transient: boolean; ledger: AiLedgerTurn };

/** Failures worth another try later: the model service was busy, resting, down or slow. */
const TRANSIENT: readonly AiProviderFailure[] = [
  'rate_limited',
  'unavailable',
  'timeout',
  'circuit_open',
];

/** The data classes in order of sensitivity: a call carries its most sensitive message's. */
const SENSITIVITY: readonly AiDataClass[] = ['public', 'course', 'personal', 'restricted'];

/** The most sensitive of the classes given (`public` when there are none). */
export function mostSensitive(classes: readonly (string | null)[]): AiDataClass {
  let index = 0;
  for (const dataClass of classes) {
    const at = SENSITIVITY.indexOf((dataClass ?? 'public') as AiDataClass);
    // A class this build does not know is treated as the most sensitive.
    index = Math.max(index, at === -1 ? SENSITIVITY.length - 1 : at);
  }
  return SENSITIVITY[index]!;
}

/**
 * A model call made in the background for a conversation's owner (Phase 7D): a title or notes.
 * Nothing is done around the rules a question goes through. The owner is taken as they are now —
 * an account switched off, a permission or surface withdrawn, `module.ai` off, and nothing is
 * called — and the call goes through the router alone, with its data class approval, its
 * deadline and its circuits, within the owner's allowance and the institute's budget. Every call
 * made comes back for the ledger, so the caller records it with what it wrote.
 */
@Injectable()
export class AiBackgroundCalls {
  constructor(
    private readonly authContext: AuthContextService,
    private readonly modules: ModuleStateService,
    private readonly policy: AiPolicyService,
    private readonly router: ModelRouter,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
  ) {}

  /** The conversation's owner as they are now, if anything may be called for them at all. */
  async ownerOf(conversation: ConversationRow): Promise<AuthUser | null> {
    if (conversation.deletedAt || !(await this.modules.isEnabled('ai'))) return null;
    const loaded = await this.authContext.load(conversation.userId);
    if (!loaded || loaded.status !== 'active') return null;
    const owner: AuthUser = { ...loaded, sessionId: null };
    const features = await this.policy.features(owner);
    return features[AI_PURPOSE_FEATURE[conversation.purpose]] ? owner : null;
  }

  async call(owner: AuthUser, request: AiBackgroundRequest): Promise<AiBackgroundResult> {
    // The institute's settings first: they decide the routing and the allowances.
    await this.settings.current();
    const route: AiRouteRequest = {
      task: request.task,
      feature: AI_PURPOSE_FEATURE[request.conversation.purpose],
      dataClass: request.dataClass,
      userId: owner.id,
      organizationId: owner.organizationId,
    };
    const refusal = this.router.refusalFor(route);
    if (refusal) return { status: 'skipped', reason: refusal };
    try {
      const blocked = await this.usage.backgroundBlockedBy(owner.id, owner.organizationId);
      if (blocked) return { status: 'skipped', reason: `allowance_${blocked}` };
    } catch (error) {
      if (error instanceof AiUnavailableError) return { status: 'skipped', reason: 'unpriced' };
      throw error;
    }

    const calls: AiAttempt[] = [];
    const ledger = (): AiLedgerTurn => ({
      organizationId: owner.organizationId,
      userId: owner.id,
      conversationId: request.conversation.id,
      messageId: null,
      feature: route.feature,
      task: route.task,
      dataClass: route.dataClass,
      requestId: null,
      question: false,
      calls: calls.map((call) => ({
        provider: call.provider,
        model: call.model,
        fallback: call.fallback,
        outcome: call.outcome,
        latencyMs: call.latencyMs,
        // A whole answer reports its counts; a call that failed reported none, and wrote nothing.
        inputTokens: call.usage?.inputTokens ?? 0,
        outputTokens: call.usage?.outputTokens ?? 0,
        estimated: call.usage?.estimated === true,
        costMicros: toMicros(call.estimatedCostUsd),
      })),
    });
    try {
      const result = await this.router.chat(
        {
          ...route,
          messages: request.messages,
          maxOutputTokens: request.maxOutputTokens,
          onAttempt: (attempt) => calls.push(attempt),
        },
        new AbortController().signal,
      );
      return { status: 'answered', result, ledger: ledger() };
    } catch (error) {
      const kind = error instanceof AiProviderError ? error.kind : 'unavailable';
      return {
        status: 'failed',
        kind,
        transient: error instanceof AiProviderError && TRANSIENT.includes(error.kind),
        ledger: ledger(),
      };
    }
  }
}
