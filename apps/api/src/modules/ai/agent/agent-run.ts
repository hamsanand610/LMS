import { randomBytes } from 'node:crypto';
import {
  AI_AGENT_CITATIONS_MAX,
  AI_AGENT_TOOLS,
  type AiAgentCapability,
  type AiAgentCitation,
  type AiAgentRoute,
  type AiAgentStep,
  type AiAgentToolName,
  type AiDataClass,
} from '@lms/shared';
import { AppError } from '../../../core/http/errors.js';
import { KNOWLEDGE_ANSWER_LIMITS } from '../knowledge/answers/evidence.js';
import { AiProviderError, type AiChatMessage } from '../providers/ai-provider.js';
import type {
  AiAttempt,
  AiRouteRefusal,
  AiRouteRequest,
  AiRoutedChatRequest,
  AiRoutedResult,
} from '../routing/model-router.js';
import { toMicros } from '../usage/cost.js';
import type { AgentLimits } from './agent-limits.js';
import {
  type HistoryTurn,
  type ObservationSummary,
  type RoutingSubject,
  draftMessages,
  observationLines,
  planningMessages,
  routingMessages,
} from './agent-prompts.js';
import { followUpOf, routingDecisionOf, type RoutingDecision } from './agent-protocol.js';
import { AgentLimitError, type AgentLimitReason, RunBudget } from './run-budget.js';
import { RunEvidence } from './run-evidence.js';
import type { AgentToolContext } from './tools/agent-tool.js';
import type { KnowledgeSearchOutput } from './tools/knowledge-search.tool.js';
import type { LessonContent } from './tools/lesson-content.tool.js';
import type {
  AgentToolCall,
  AgentToolDescription,
  AgentToolOutcome,
} from './tools/tool-registry.js';
import { type DraftFault, SAFETY_FAULTS, type VerifiedDraft, verifyDraft } from './verification.js';

/** About four characters a token: what a call is estimated to send, before it is sent. */
const CHARACTERS_PER_TOKEN = 4;

/** Fewer passages than this after the recipe, and the model may ask for one more tool call. */
const THIN_EVIDENCE = 2;

/** The model calls the run makes, through the model router alone. */
export interface AgentModelPort {
  chat(request: AiRoutedChatRequest, signal: AbortSignal): Promise<AiRoutedResult>;
  refusalFor(request: AiRouteRequest): AiRouteRefusal | null;
}

/** The tools, through the tool registry alone. */
export interface AgentToolPort {
  descriptions(): AgentToolDescription[];
  execute(
    context: AgentToolContext,
    call: AgentToolCall,
    signal: AbortSignal,
    budgetMs?: number,
  ): Promise<AgentToolOutcome>;
}

/**
 * The learner's allowance and the institute's budget, counting the run's own calls so far: refuses
 * the next call by throwing `AgentLimitError` (Phase 7D's quotas, asked between steps).
 */
export interface AgentQuotaPort {
  check(run: { tokens: number; costMicros: number }): Promise<void>;
}

/** Whether the answer may still be given to the learner now, with these citations. */
export interface AgentDeliveryPort {
  mayDeliver(
    context: AgentToolContext,
    citations: readonly AiAgentCitation[],
    signal: AbortSignal,
  ): Promise<boolean>;
}

export interface AgentRunDeps {
  model: AgentModelPort;
  tools: AgentToolPort;
  quota: AgentQuotaPort;
  delivery: AgentDeliveryPort;
  limits: AgentLimits;
  /** The route of a call for this run: its task and data class, the learner and institute. */
  route: (task: 'classify' | 'chat', dataClass: AiDataClass) => AiRouteRequest;
  /** The output tokens the deployment allows a call (AI_MAX_OUTPUT_TOKENS). */
  maxOutputTokens: number;
  /** Told of each step as it begins: a state, never its content. */
  onStep?: (step: AiAgentStep) => void;
  now?: () => number;
}

/** What a run is asked: the pinned context, the learner's message and the conversation so far. */
export interface AgentRunInput {
  context: AgentToolContext;
  /** The open lesson's or course's titles, for routing and the search: course material. */
  subject: (RoutingSubject & { topic: string | null }) | null;
  question: string;
  history: readonly HistoryTurn[];
  /** Identifiers of the run (the learner's, the institute's, …) that no answer may hold. */
  identifiers: readonly string[];
  /** The client's: aborted when it goes away. */
  signal: AbortSignal;
}

/** How a run ended, with what the service needs to give it — never a prompt or a tool's output. */
export type AgentRunOutcome =
  | {
      status: 'answered';
      kind: 'answer' | 'conflict';
      text: string;
      citations: AiAgentCitation[];
    }
  | { status: 'insufficient_evidence'; reason: 'no_evidence' | 'model_declined' }
  | { status: 'not_grounded'; reason: string }
  | { status: 'refused'; reason: string; notice: 'unsupported' | 'refused' }
  | { status: 'limit_reached'; reason: AgentLimitReason }
  | { status: 'failed'; reason: string; error: unknown }
  | { status: 'cancelled' };

/** What a run's audit entry and log line record: names, counts, codes, times — never content. */
export interface AgentRunTrace {
  route: AiAgentRoute | null;
  capability: AiAgentCapability | null;
  tools: { tool: string; outcome: string; code: string | null; durationMs: number }[];
  faults: string[];
  provider: string | null;
  model: string | null;
  fallback: boolean;
  dataClass: AiDataClass | null;
  passages: number;
  evidenceCharacters: number;
}

/** A run stopping with this outcome, from wherever it is. */
class AgentStop extends Error {
  constructor(readonly outcome: AgentRunOutcome) {
    super(`The learning agent's run stopped: ${outcome.status}`);
    this.name = 'AgentStop';
  }
}

/**
 * One run of the learning agent (Roadmap Phase 9B; ADR-0039): a bounded, deterministic recipe the
 * server executes — the model only ever proposes.
 *
 * ROUTE (strict JSON; one controlled retry, then a safe refusal) → the capability's RECIPE —
 * `explain_lesson`: the lesson, then a search if it would help; `clarify_doubt`: a search, then the
 * lesson if it would help — → at most ONE follow-up round, only while the evidence is thin and calls
 * remain for a draft and its regeneration → DRAFT from the evidence → VERIFY (`verifyDraft`; one
 * regeneration, every check again) → the learner's AUTHORIZATION once more → the outcome. Nothing is
 * given to the learner from here: the service streams the outcome only once it is complete.
 *
 * Every call is counted against `RunBudget` before it is made, and the quotas are asked between
 * steps and before a stand-in; the run's deadline and the client's going away abort whatever is in
 * flight — a model call (and its stand-in), a tool, a retrieval.
 */
export class AgentRun {
  readonly budget: RunBudget;
  readonly evidence: RunEvidence;
  readonly trace: AgentRunTrace = {
    route: null,
    capability: null,
    tools: [],
    faults: [],
    provider: null,
    model: null,
    fallback: false,
    dataClass: null,
    passages: 0,
    evidenceCharacters: 0,
  };
  /** Every call made to a provider, in order, with what it was for: the usage ledger's. */
  readonly attempts: { task: 'classify' | 'chat'; attempt: AiAttempt }[] = [];
  /** The run's own deadline, and it or the client's going away. */
  private readonly deadline: AbortSignal;
  private readonly signal: AbortSignal;
  /** The tool calls made, by tool and arguments: the same call twice is a loop. */
  private readonly calls = new Set<string>();
  private lesson: ObservationSummary['lesson'] = 'not_read';
  private readonly searches: ObservationSummary['searches'] = [];

  constructor(
    private readonly deps: AgentRunDeps,
    private readonly input: AgentRunInput,
    deadline?: AbortSignal,
  ) {
    this.budget = new RunBudget(deps.limits, deps.now);
    this.deadline = deadline ?? AbortSignal.timeout(deps.limits.runMs);
    this.signal = AbortSignal.any([input.signal, this.deadline]);
    this.evidence = new RunEvidence(deps.limits.evidenceCharacters, AI_AGENT_CITATIONS_MAX);
  }

  async execute(): Promise<AgentRunOutcome> {
    try {
      return await this.steps();
    } catch (error) {
      return this.ending(error);
    } finally {
      this.trace.passages = this.evidence.passages.length;
      this.trace.evidenceCharacters = this.evidence.characters;
    }
  }

  private async steps(): Promise<AgentRunOutcome> {
    const decision = await this.route();
    this.trace.route = decision.capability;
    if (decision.capability === 'unsupported') {
      return { status: 'refused', reason: 'unsupported', notice: 'unsupported' };
    }
    // A lesson to explain is the open one: with none open, the message is a doubt to clear.
    const capability: AiAgentCapability =
      decision.capability === 'explain_lesson' && !this.input.context.lessonId
        ? 'clarify_doubt'
        : decision.capability;
    this.trace.capability = capability;

    const query = this.searchQuery(capability);
    if (capability === 'explain_lesson') {
      await this.useTool({ tool: 'lesson_content', arguments: {} });
      if (decision.needsKnowledge)
        await this.useTool({ tool: 'knowledge_search', arguments: { query } });
    } else {
      await this.useTool({ tool: 'knowledge_search', arguments: { query } });
      if (decision.needsLesson && this.input.context.lessonId) {
        await this.useTool({ tool: 'lesson_content', arguments: {} });
      }
    }

    // One follow-up round at most — and only with room left for a draft and its regeneration.
    if (
      this.evidence.passages.length < THIN_EVIDENCE &&
      this.budget.modelCallsLeft() >= 3 &&
      this.budget.stepsLeft() >= 4
    ) {
      await this.followUp(capability);
    }

    if (this.evidence.passages.length === 0) {
      return { status: 'insufficient_evidence', reason: 'no_evidence' };
    }
    const verdict = await this.draft(capability);
    if (!verdict.ok) {
      return SAFETY_FAULTS.has(verdict.fault)
        ? { status: 'refused', reason: verdict.fault, notice: 'refused' }
        : { status: 'not_grounded', reason: verdict.fault };
    }
    if (verdict.kind === 'declined') {
      return { status: 'insufficient_evidence', reason: 'model_declined' };
    }
    const citations = verdict.cited.map((id) => this.evidence.citation(id)!);
    // The learner may still have it — every source it cites — or nothing of it is given.
    this.throwIfStopped();
    if (!(await this.deps.delivery.mayDeliver(this.input.context, citations, this.signal))) {
      return { status: 'refused', reason: 'no_longer_authorized', notice: 'refused' };
    }
    return { status: 'answered', kind: verdict.kind, text: verdict.text, citations };
  }

  /** ROUTE: the capability for the message, as strict JSON — one retry, then a safe refusal. */
  private async route(): Promise<RoutingDecision> {
    this.observe('routing');
    const dataClass = this.subjectDataClass();
    for (let attempt = 1; attempt <= this.deps.limits.routingAttempts; attempt += 1) {
      const result = await this.callModel(
        'classify',
        routingMessages(this.input.question, this.input.history, this.input.subject, attempt > 1),
        this.deps.limits.planOutputTokens,
        dataClass,
      );
      const decision = routingDecisionOf(result.text);
      if (decision) return decision;
      this.trace.faults.push('invalid_routing');
    }
    throw new AgentStop({ status: 'refused', reason: 'invalid_routing', notice: 'refused' });
  }

  /** The follow-up round: finish, or one more allow-listed tool call — whatever the model says. */
  private async followUp(capability: AiAgentCapability): Promise<void> {
    this.budget.beginFollowUp();
    this.observe('planning');
    const observations = observationLines(
      { lesson: this.lesson, searches: this.searches },
      this.deps.limits.observationCharacters,
    );
    const result = await this.callModel(
      'classify',
      planningMessages(
        this.input.question,
        capability,
        observations,
        this.deps.tools.descriptions(),
      ),
      this.deps.limits.planOutputTokens,
      this.evidenceDataClass(),
    );
    const proposal = followUpOf(result.text);
    if (!proposal) {
      // Not the JSON asked for: nothing is run, and the run goes on with what it has.
      this.trace.faults.push('invalid_plan');
      return;
    }
    if (proposal.action === 'finish') return;
    await this.useTool({ tool: proposal.tool, arguments: proposal.arguments });
  }

  /** DRAFT and VERIFY: the first draft, and one regeneration after a failed one, if calls remain. */
  private async draft(capability: AiAgentCapability): Promise<VerifiedDraft> {
    const referenceCode = randomBytes(12).toString('base64url');
    const passages = this.evidence.passages;
    const checks = {
      ids: new Set(passages.map((passage) => passage.id)),
      passages: new Map(
        passages.map((passage) => [
          passage.id,
          `${passage.document}\n${passage.heading}\n${passage.content}`,
        ]),
      ),
      referenceCode,
      identifiers: this.input.identifiers,
      maxCharacters: this.deps.limits.answerCharacters,
    };
    let fault: DraftFault = 'empty';
    for (let attempt = 1; attempt <= this.deps.limits.draftAttempts; attempt += 1) {
      if (attempt > 1 && (this.budget.modelCallsLeft() === 0 || this.budget.stepsLeft() === 0)) {
        this.trace.faults.push('regeneration_skipped');
        break;
      }
      this.observe('drafting');
      const result = await this.callModel(
        'chat',
        draftMessages({
          capability,
          passages,
          question: this.draftQuestion(capability),
          history: this.input.history,
          referenceCode,
          retry: attempt > 1,
        }),
        Math.min(this.deps.maxOutputTokens, this.deps.limits.answerOutputTokens),
        this.evidenceDataClass(),
      );
      this.observe('verifying');
      const verdict = verifyDraft(result, checks);
      if (verdict.ok) return verdict;
      this.trace.faults.push(verdict.fault);
      fault = verdict.fault;
    }
    return { ok: false, fault };
  }

  /**
   * A tool call through the registry, once each: counted first (a step, a call, a search), the
   * quotas asked, the same call twice refused as a loop. Its output joins the evidence. A refusal
   * of the learner's authorization stops the run; a tool that is unavailable, failed or timed out
   * leaves it to go on without.
   */
  private async useTool(call: AgentToolCall): Promise<void> {
    this.throwIfStopped();
    const allowed = (AI_AGENT_TOOLS as readonly string[]).includes(call.tool);
    if (allowed) {
      const key = `${call.tool}:${canonical(call.arguments)}`;
      if (this.calls.has(key)) {
        this.trace.tools.push({
          tool: call.tool,
          outcome: 'repeated_call',
          code: null,
          durationMs: 0,
        });
        return;
      }
      this.budget.beginToolCall(call.tool as AiAgentToolName);
      this.calls.add(key);
      this.observe(call.tool === 'lesson_content' ? 'reading_lesson' : 'searching_knowledge');
      await this.checkQuota();
      this.throwIfStopped();
    }
    // An unknown tool is refused by the registry, before anything else: nothing is run.
    const outcome = await this.deps.tools.execute(
      this.input.context,
      call,
      this.signal,
      this.budget.remainingMs(),
    );
    this.trace.tools.push({
      tool: outcome.tool ?? 'unknown',
      outcome: outcome.ok ? 'ok' : outcome.failure,
      code: outcome.ok ? null : outcome.code,
      durationMs: outcome.durationMs,
    });
    if (!outcome.ok) {
      if (outcome.failure === 'cancelled') throw this.stopped();
      if (outcome.failure === 'forbidden') {
        throw new AgentStop({ status: 'refused', reason: outcome.code, notice: 'refused' });
      }
      if (outcome.failure === 'quota') throw new AgentLimitError(quotaReason(outcome.code));
      if (outcome.tool === 'lesson_content') this.lesson = 'unavailable';
      if (outcome.tool === 'knowledge_search') {
        this.searches.push({ used: 0, retrieved: 0, documents: [] });
      }
      return;
    }
    if (outcome.tool === 'lesson_content') {
      const lesson = outcome.output as LessonContent;
      if (lesson.withheld) {
        this.lesson = 'withheld';
        return;
      }
      this.evidence.addLesson(lesson);
      this.lesson = { title: lesson.title, characters: lesson.text.length };
      return;
    }
    const found = outcome.output as KnowledgeSearchOutput;
    const before = this.evidence.passages.length;
    const used = this.evidence.addKnowledge(found.passages);
    this.searches.push({
      used,
      retrieved: found.retrieved,
      documents: [
        ...new Set(this.evidence.passages.slice(before).map((passage) => passage.document)),
      ],
    });
  }

  /**
   * A model call, through the router: counted first, its tokens reserved within the run's budget,
   * the quotas asked; within its own deadline and the run's. A stand-in for it is counted, reserved
   * and asked for the same way, before it is tried.
   */
  private async callModel(
    task: 'classify' | 'chat',
    messages: AiChatMessage[],
    maxOutputTokens: number,
    dataClass: AiDataClass,
  ): Promise<AiRoutedResult> {
    this.throwIfStopped();
    const route = this.deps.route(task, dataClass);
    const refusal = this.deps.model.refusalFor(route);
    if (refusal) {
      throw new AgentStop(
        refusal === 'data_class_not_approved'
          ? { status: 'refused', reason: 'data_not_approved', notice: 'refused' }
          : { status: 'failed', reason: refusal, error: new AiProviderError('configuration') },
      );
    }
    const reserve =
      Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / CHARACTERS_PER_TOKEN) +
      maxOutputTokens;
    this.budget.beginModelCall();
    this.budget.reserve(reserve);
    await this.checkQuota();
    // The client may have gone while the quotas were read: a cancelled run starts no call.
    this.throwIfStopped();
    this.trace.dataClass =
      this.trace.dataClass === 'course' || dataClass === 'course' ? 'course' : dataClass;
    const callDeadline = AbortSignal.timeout(
      Math.max(1, Math.min(this.deps.limits.modelCallMs, this.budget.remainingMs())),
    );
    try {
      const result = await this.deps.model.chat(
        {
          ...route,
          messages,
          maxOutputTokens,
          temperature: task === 'chat' ? KNOWLEDGE_ANSWER_LIMITS.temperature : 0,
          onAttempt: (attempt) => {
            this.attempts.push({ task, attempt });
            this.budget.spend(
              (attempt.usage?.inputTokens ?? 0) + (attempt.usage?.outputTokens ?? 0),
              toMicros(attempt.estimatedCostUsd) ?? 0,
            );
          },
          beforeFallback: async () => {
            this.throwIfStopped();
            this.budget.beginStandIn();
            this.budget.reserve(reserve);
            await this.checkQuota();
            this.throwIfStopped();
          },
        },
        AbortSignal.any([this.signal, callDeadline]),
      );
      this.trace.provider = result.provider;
      this.trace.model = result.model;
      this.trace.fallback ||= result.fallback;
      return result;
    } catch (error) {
      if (error instanceof AgentStop || error instanceof AgentLimitError) throw error;
      if (this.signal.aborted) throw this.stopped();
      if (callDeadline.aborted) {
        throw new AgentStop({
          status: 'failed',
          reason: 'timeout',
          error: new AiProviderError('timeout'),
        });
      }
      const reason =
        error instanceof AiProviderError
          ? error.kind
          : error instanceof AppError
            ? error.code
            : 'internal';
      throw new AgentStop({ status: 'failed', reason, error });
    }
  }

  /** The quotas, counting the run's calls so far. Unreadable usage stops the run (fails closed). */
  private async checkQuota(): Promise<void> {
    try {
      await this.deps.quota.check({
        tokens: this.budget.tokens,
        costMicros: this.budget.costMicros,
      });
    } catch (error) {
      if (error instanceof AgentLimitError) throw error;
      throw new AgentStop({ status: 'failed', reason: 'quota_unreadable', error });
    }
  }

  private observe(step: AiAgentStep): void {
    this.deps.onStep?.(step);
  }

  private throwIfStopped(): void {
    if (this.signal.aborted) throw this.stopped();
  }

  /** The client went away (cancelled), or the run's deadline passed (its limit). */
  private stopped(): Error {
    return this.input.signal.aborted
      ? new AgentStop({ status: 'cancelled' })
      : new AgentLimitError('run_time');
  }

  private ending(error: unknown): AgentRunOutcome {
    // The client going away ends the run as cancelled, whatever else was happening.
    if (this.input.signal.aborted) return { status: 'cancelled' };
    if (error instanceof AgentStop) return error.outcome;
    if (error instanceof AgentLimitError) return { status: 'limit_reached', reason: error.reason };
    if (this.deadline.aborted) return { status: 'limit_reached', reason: 'run_time' };
    return { status: 'failed', reason: 'internal', error };
  }

  /** What the search asks: the learner's words, with the open lesson's title and topic to explain it. */
  private searchQuery(capability: AiAgentCapability): string {
    const subject = this.input.subject;
    const words =
      capability === 'explain_lesson' && subject?.lessonTitle
        ? [subject.lessonTitle, subject.topic ?? '', this.input.question]
        : [this.input.question];
    return words.join(' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
  }

  /** The question the draft answers: the learner's words, and for a lesson to explain, its title. */
  private draftQuestion(capability: AiAgentCapability): string {
    const title = this.input.subject?.lessonTitle;
    return capability === 'explain_lesson' && title
      ? `${this.input.question}\n(The open lesson: ${title})`
      : this.input.question;
  }

  /** Routing sends the subject's titles: course data when there is one. */
  private subjectDataClass(): AiDataClass {
    return this.input.subject ? 'course' : 'public';
  }

  private evidenceDataClass(): AiDataClass {
    return this.input.subject || this.evidence.dataClass() === 'course' ? 'course' : 'public';
  }
}

/** A value as canonical JSON — keys sorted — so the same arguments always compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function quotaReason(code: string): AgentLimitReason {
  if (code === 'quota_requests' || code === 'quota_tokens' || code === 'quota_budget') return code;
  return 'quota_budget';
}
