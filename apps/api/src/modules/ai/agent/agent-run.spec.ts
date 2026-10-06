import { describe, expect, it, vi } from 'vitest';
import type { AiAgentStep } from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { GROUNDED_REMINDER } from '../knowledge/answers/grounded-prompt.js';
import { AiProviderError } from '../providers/ai-provider.js';
import type {
  AiRouteRefusal,
  AiRoutedChatRequest,
  AiRoutedResult,
} from '../routing/model-router.js';
import { AGENT_LIMITS, type AgentLimits } from './agent-limits.js';
import { AGENT_PLANNING_MARK, AGENT_ROUTING_MARK } from './agent-prompts.js';
import {
  AgentRun,
  type AgentDeliveryPort,
  type AgentModelPort,
  type AgentRunInput,
  type AgentToolPort,
} from './agent-run.js';
import { AgentLimitError } from './run-budget.js';
import type { AgentToolContext } from './tools/agent-tool.js';
import type { KnowledgePassage } from './tools/knowledge-search.tool.js';
import type { LessonContent } from './tools/lesson-content.tool.js';
import type { AgentToolCall, AgentToolOutcome } from './tools/tool-registry.js';

const uuid = (n: number) => `0190a0e4-7c1d-7b9e-8f00-${String(n).padStart(12, '0')}`;
const LEARNER = uuid(1);
const ORG = uuid(2);
const LESSON = uuid(3);
const COURSE = uuid(4);

const LESSON_TEXT = 'A for loop repeats its body a fixed number of times.';
const PASSAGE_TEXT = 'A while loop repeats its body while its condition holds.';
const ANSWER_FROM_LESSON = 'A for loop repeats its body a fixed number of times [S1].';

type Kind = 'route' | 'plan' | 'draft';
type Reply = string | Error | 'hang' | { text: string; tokens?: number; finishReason?: string };
interface Step {
  reply: Reply;
  /** The task's own model fails first with this; a stand-in answers (ADR-0038). */
  standInAfter?: AiProviderError;
}

/** A model router whose every call the test scripts, by kind, in order; it records each call. */
class ScriptedModel implements AgentModelPort {
  readonly calls: { kind: Kind; request: AiRoutedChatRequest; signal: AbortSignal }[] = [];
  private readonly used: Record<Kind, number> = { route: 0, plan: 0, draft: 0 };

  constructor(
    private readonly script: Partial<Record<Kind, Step[]>>,
    private readonly refusal: AiRouteRefusal | null = null,
  ) {}

  refusalFor(): AiRouteRefusal | null {
    return this.refusal;
  }

  async chat(request: AiRoutedChatRequest, signal: AbortSignal): Promise<AiRoutedResult> {
    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const kind: Kind = system.includes(AGENT_ROUTING_MARK)
      ? 'route'
      : system.includes(AGENT_PLANNING_MARK)
        ? 'plan'
        : 'draft';
    this.calls.push({ kind, request, signal });
    const steps = this.script[kind] ?? [];
    const step = steps[Math.min(this.used[kind]++, steps.length - 1)] ?? { reply: defaults[kind] };
    let fallback = false;
    if (step.standInAfter) {
      request.onAttempt?.({
        provider: 'fake',
        model: 'main',
        fallback: false,
        outcome: step.standInAfter.kind,
        latencyMs: 1,
        usage: null,
        estimatedCostUsd: null,
      });
      await request.beforeFallback?.();
      fallback = true;
    }
    const reply = step.reply;
    if (reply instanceof Error) throw reply;
    if (reply === 'hang') {
      return new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new AiProviderError('cancelled')), {
          once: true,
        }),
      );
    }
    const text = typeof reply === 'string' ? reply : reply.text;
    const tokens = typeof reply === 'string' ? 15 : (reply.tokens ?? 15);
    const usage = { inputTokens: tokens - 5, outputTokens: 5 };
    request.onAttempt?.({
      provider: 'fake',
      model: fallback ? 'stand-in' : 'main',
      fallback,
      outcome: 'ok',
      latencyMs: 1,
      usage,
      estimatedCostUsd: 0.000001,
    });
    return {
      text,
      model: fallback ? 'stand-in' : 'main',
      finishReason: (typeof reply === 'string' ? 'stop' : (reply.finishReason ?? 'stop')) as never,
      usage,
      provider: 'fake',
      fallback,
      latencyMs: 1,
      estimatedCostUsd: 0.000001,
    };
  }

  count(kind: Kind): number {
    return this.calls.filter((call) => call.kind === kind).length;
  }
}

const route = (capability: string, needsKnowledge = true, needsLesson = true) =>
  JSON.stringify({ capability, needsKnowledge, needsLesson });
const defaults: Record<Kind, string> = {
  route: route('explain_lesson'),
  plan: '{"action":"finish"}',
  draft: ANSWER_FROM_LESSON,
};

const lessonOutput: LessonContent = {
  lessonId: LESSON,
  courseId: COURSE,
  title: 'Loops',
  courseTitle: 'Java',
  moduleTitle: 'Basics',
  topic: '',
  text: LESSON_TEXT,
  truncated: false,
  withheld: false,
};
const knowledgePassage = (n: number, content = PASSAGE_TEXT): KnowledgePassage => ({
  chunkId: uuid(100 + n),
  sourceId: uuid(200),
  sourceName: 'Handbook',
  documentId: uuid(300 + n),
  versionId: uuid(400 + n),
  title: `Doc ${n}`,
  heading: 'Loops',
  position: 0,
  courseId: null,
  lessonId: null,
  similarity: 0.9,
  dataClass: 'public',
  content,
});

type ToolScript = (call: AgentToolCall, signal: AbortSignal) => Promise<AgentToolOutcome>;
const okLesson: ToolScript = () =>
  Promise.resolve({ ok: true, tool: 'lesson_content', output: lessonOutput, durationMs: 1 });
const okSearch =
  (passages: KnowledgePassage[] = [knowledgePassage(1)]): ToolScript =>
  () =>
    Promise.resolve({
      ok: true,
      tool: 'knowledge_search',
      output: { retrieved: passages.length, passages, withheld: 0 },
      durationMs: 1,
    });

/** The tool registry's stand-in: allow-listed tools answer as scripted, anything else is refused. */
class ScriptedTools implements AgentToolPort {
  readonly calls: { call: AgentToolCall; signal: AbortSignal; budgetMs?: number }[] = [];

  constructor(private readonly scripts: { lesson?: ToolScript; search?: ToolScript } = {}) {}

  descriptions() {
    return [
      { name: 'knowledge_search' as const, description: 'Searches.', arguments: '{"query":"…"}' },
      { name: 'lesson_content' as const, description: 'Reads.', arguments: '{}' },
    ];
  }

  execute(
    _context: AgentToolContext,
    call: AgentToolCall,
    signal: AbortSignal,
    budgetMs?: number,
  ): Promise<AgentToolOutcome> {
    this.calls.push({ call, signal, budgetMs });
    if (call.tool === 'lesson_content') return (this.scripts.lesson ?? okLesson)(call, signal);
    if (call.tool === 'knowledge_search') return (this.scripts.search ?? okSearch())(call, signal);
    return Promise.resolve({
      ok: false,
      tool: null,
      failure: 'unknown_tool',
      code: 'unknown_tool',
      durationMs: 0,
    });
  }

  names(): string[] {
    return this.calls.map(({ call }) => call.tool);
  }
}

const context = (changes: Partial<AgentToolContext> = {}): AgentToolContext => ({
  user: { id: LEARNER, organizationId: ORG } as AuthUser,
  studentId: uuid(5),
  conversationId: uuid(6),
  courseId: COURSE,
  lessonId: LESSON,
  ...changes,
});

function runWith(
  model: ScriptedModel,
  tools: ScriptedTools = new ScriptedTools(),
  options: {
    limits?: Partial<AgentLimits>;
    input?: Partial<AgentRunInput>;
    quota?: (spent: { tokens: number; costMicros: number }) => Promise<void>;
    deliver?: boolean | (() => Promise<boolean>);
    deadline?: AbortSignal;
  } = {},
) {
  const steps: AiAgentStep[] = [];
  const quota = vi.fn(options.quota ?? (() => Promise.resolve()));
  const given = options.deliver;
  const deliver = vi.fn<AgentDeliveryPort['mayDeliver']>(() =>
    typeof given === 'function' ? given() : Promise.resolve(given ?? true),
  );
  const run = new AgentRun(
    {
      model,
      tools,
      quota: { check: quota },
      delivery: { mayDeliver: deliver },
      limits: { ...AGENT_LIMITS, ...options.limits },
      route: (task, dataClass) => ({
        task,
        feature: 'agent',
        dataClass,
        userId: LEARNER,
        organizationId: ORG,
      }),
      maxOutputTokens: 4096,
      onStep: (step) => steps.push(step),
    },
    {
      context: context(),
      subject: { courseTitle: 'Java', moduleTitle: 'Basics', lessonTitle: 'Loops', topic: null },
      question: 'Explain this lesson about loops',
      history: [],
      identifiers: [LEARNER, ORG],
      signal: new AbortController().signal,
      ...options.input,
    },
    options.deadline,
  );
  return { run, steps, quota, deliver };
}

describe('a learning agent run (Phase 9B; ADR-0039)', () => {
  describe('recipes', () => {
    it('explains the open lesson: route, read, search, draft, verify, give', async () => {
      const model = new ScriptedModel({});
      const tools = new ScriptedTools();
      const { run, steps, deliver } = runWith(model, tools);
      const outcome = await run.execute();
      expect(outcome).toMatchObject({
        status: 'answered',
        kind: 'answer',
        text: ANSWER_FROM_LESSON,
      });
      expect(outcome.status === 'answered' && outcome.citations).toEqual([
        expect.objectContaining({ kind: 'lesson', id: 'S1', lessonId: LESSON, courseId: COURSE }),
      ]);
      expect(steps).toEqual([
        'routing',
        'reading_lesson',
        'searching_knowledge',
        'drafting',
        'verifying',
      ]);
      expect(tools.names()).toEqual(['lesson_content', 'knowledge_search']);
      expect(model.calls.map((call) => [call.kind, call.request.task])).toEqual([
        ['route', 'classify'],
        ['draft', 'chat'],
      ]);
      expect(model.calls[1]!.request.dataClass).toBe('course');
      expect(model.calls[0]!.request.maxOutputTokens).toBe(256);
      expect(model.calls[1]!.request.maxOutputTokens).toBe(1024);
      expect(deliver).toHaveBeenCalledTimes(1);
      expect(run.trace).toMatchObject({ route: 'explain_lesson', capability: 'explain_lesson' });
      expect(run.budget).toMatchObject({ steps: 4, modelCalls: 2, toolCalls: 2, searches: 1 });
    });

    it('clears a doubt: search first, then the lesson when it would help', async () => {
      const model = new ScriptedModel({
        route: [{ reply: route('clarify_doubt', true, true) }],
        draft: [{ reply: 'A while loop repeats its body while its condition holds [S1].' }],
      });
      const tools = new ScriptedTools();
      const outcome = await runWith(model, tools).run.execute();
      expect(outcome).toMatchObject({ status: 'answered' });
      expect(tools.names()).toEqual(['knowledge_search', 'lesson_content']);
      expect(tools.calls[0]!.call.arguments).toEqual({ query: 'Explain this lesson about loops' });
    });

    it('treats a lesson to explain with no lesson open as a doubt', async () => {
      const model = new ScriptedModel({
        draft: [{ reply: 'A while loop repeats its body while its condition holds [S1].' }],
      });
      const tools = new ScriptedTools();
      const { run } = runWith(model, tools, {
        input: { context: context({ lessonId: null }), subject: null },
      });
      expect(await run.execute()).toMatchObject({ status: 'answered' });
      expect(tools.names()).toEqual(['knowledge_search']);
      expect(run.trace.capability).toBe('clarify_doubt');
    });

    it('refuses what it does not do, without a tool or a draft', async () => {
      const model = new ScriptedModel({ route: [{ reply: route('unsupported') }] });
      const tools = new ScriptedTools();
      expect(await runWith(model, tools).run.execute()).toEqual({
        status: 'refused',
        reason: 'unsupported',
        notice: 'unsupported',
      });
      expect(tools.calls).toHaveLength(0);
      expect(model.calls).toHaveLength(1);
    });

    it('declines with no evidence, and drafts nothing', async () => {
      const model = new ScriptedModel({ route: [{ reply: route('clarify_doubt', true, false) }] });
      const tools = new ScriptedTools({ search: okSearch([]) });
      const { run } = runWith(model, tools, { limits: { modelCalls: 2 } });
      expect(await run.execute()).toEqual({
        status: 'insufficient_evidence',
        reason: 'no_evidence',
      });
      expect(model.count('draft')).toBe(0);
    });
  });

  describe('routing (strict JSON; one controlled retry)', () => {
    it('retries once after output that is not the JSON asked for, then refuses safely', async () => {
      for (const bad of [
        'I think this is about a lesson.',
        '{"capability":"explain_lesson"}',
        `{"capability":"clarify_doubt","needsKnowledge":true,"needsLesson":false,"learnerId":"${uuid(9)}"}`,
        `{"capability":"clarify_doubt","needsKnowledge":true,"needsLesson":false,"organizationId":"${uuid(9)}"}`,
        '{"capability":"run_shell","needsKnowledge":false,"needsLesson":false}',
      ]) {
        const model = new ScriptedModel({ route: [{ reply: bad }] });
        const tools = new ScriptedTools();
        const outcome = await runWith(model, tools).run.execute();
        expect(outcome, bad).toEqual({
          status: 'refused',
          reason: 'invalid_routing',
          notice: 'refused',
        });
        expect(model.count('route'), bad).toBe(2);
        expect(tools.calls, bad).toHaveLength(0);
      }
    });

    it('goes on when the retry gives the JSON, and says on the retry what was wrong', async () => {
      const model = new ScriptedModel({
        route: [{ reply: 'Not JSON' }, { reply: route('explain_lesson') }],
      });
      expect(await runWith(model).run.execute()).toMatchObject({ status: 'answered' });
      const retry = model.calls[1]!.request.messages.filter((m) => m.role === 'system');
      expect(retry).toHaveLength(2);
    });
  });

  describe('the one follow-up round', () => {
    const thin = () =>
      new ScriptedTools({
        lesson: () =>
          Promise.resolve({
            ok: false,
            tool: 'lesson_content',
            failure: 'unavailable',
            code: 'no_lesson',
            durationMs: 1,
          }),
        search: okSearch([]),
      });

    it('runs one more allow-listed call the model asks for, and only one round', async () => {
      const model = new ScriptedModel({
        route: [{ reply: route('clarify_doubt', true, false) }],
        plan: [
          {
            reply:
              '{"action":"tool","tool":"knowledge_search","arguments":{"query":"while loops"}}',
          },
        ],
        draft: [{ reply: 'A while loop repeats its body while its condition holds [S1].' }],
      });
      let searches = 0;
      const tools = new ScriptedTools({
        search: (call, signal) => (++searches === 1 ? okSearch([]) : okSearch())(call, signal),
      });
      const { run, steps } = runWith(model, tools);
      expect(await run.execute()).toMatchObject({ status: 'answered' });
      expect(tools.calls.map(({ call }) => call.arguments)).toEqual([
        { query: 'Explain this lesson about loops' },
        { query: 'while loops' },
      ]);
      expect(model.count('plan')).toBe(1);
      expect(run.budget.followUps).toBe(1);
      expect(steps).toEqual([
        'routing',
        'searching_knowledge',
        'planning',
        'searching_knowledge',
        'drafting',
        'verifying',
      ]);
      // The follow-up is shown what was found, never its text.
      const planned = model.calls.find((call) => call.kind === 'plan')!;
      expect(planned.request.messages.map((m) => m.content).join('\n')).not.toContain(PASSAGE_TEXT);
    });

    it('is not offered when the evidence is enough, or no calls would be left to answer', async () => {
      const enough = new ScriptedModel({
        route: [{ reply: route('clarify_doubt', true, false) }],
        draft: [{ reply: 'A while loop repeats its body while its condition holds [S1].' }],
      });
      await runWith(
        enough,
        new ScriptedTools({ search: okSearch([knowledgePassage(1), knowledgePassage(2)]) }),
      ).run.execute();
      expect(enough.count('plan')).toBe(0);

      const retried = new ScriptedModel({
        route: [{ reply: 'nope' }, { reply: route('clarify_doubt', true, false) }],
      });
      await runWith(retried, thin()).run.execute();
      expect(retried.count('plan')).toBe(0);
    });

    it('runs nothing the model names that is not on the allow-list, or not JSON', async () => {
      for (const proposal of [
        '{"action":"tool","tool":"shell","arguments":{"command":"cat /etc/passwd"}}',
        '{"action":"tool","tool":"sql_query","arguments":{"sql":"select * from users"}}',
        'Let me search again.',
        '{"action":"finish"}{"action":"tool"}',
      ]) {
        const model = new ScriptedModel({
          route: [{ reply: route('clarify_doubt', true, false) }],
          plan: [{ reply: proposal }],
        });
        const tools = thin();
        const outcome = await runWith(model, tools).run.execute();
        expect(outcome, proposal).toEqual({
          status: 'insufficient_evidence',
          reason: 'no_evidence',
        });
        // Only the recipe's search ran; an unknown tool reached the registry to be refused there.
        expect(tools.names().filter((name) => name === 'knowledge_search')).toHaveLength(1);
      }
    });

    it('refuses the same call twice: a loop is not run again', async () => {
      const model = new ScriptedModel({
        route: [{ reply: route('clarify_doubt', true, false) }],
        plan: [
          {
            reply: JSON.stringify({
              action: 'tool',
              tool: 'knowledge_search',
              arguments: { query: 'Explain this lesson about loops' },
            }),
          },
        ],
      });
      const tools = thin();
      const { run } = runWith(model, tools);
      await run.execute();
      expect(tools.calls).toHaveLength(1);
      expect(run.trace.tools.at(-1)).toMatchObject({
        tool: 'knowledge_search',
        outcome: 'repeated_call',
      });
    });
  });

  describe('hard limits', () => {
    it('stops at the tool-call, search, step and model-call limits, before the call', async () => {
      const cases: [Partial<AgentLimits>, string, string[]][] = [
        [{ toolCalls: 1 }, 'tool_calls', ['lesson_content']],
        [{ knowledgeSearches: 0 }, 'knowledge_searches', ['lesson_content']],
        [{ steps: 2 }, 'steps', ['lesson_content']],
        [{ modelCalls: 1 }, 'model_calls', ['lesson_content', 'knowledge_search']],
      ];
      for (const [limits, reason, ran] of cases) {
        const model = new ScriptedModel({});
        const tools = new ScriptedTools();
        const outcome = await runWith(model, tools, { limits }).run.execute();
        expect(outcome, reason).toEqual({ status: 'limit_reached', reason });
        expect(tools.names(), reason).toEqual(ran);
      }
    });

    it('never goes past its limits, whatever the model does', async () => {
      // A model that always proposes another search and never writes a usable draft.
      const model = new ScriptedModel({
        route: [{ reply: 'nope' }, { reply: route('clarify_doubt', true, true) }],
        plan: [
          { reply: '{"action":"tool","tool":"knowledge_search","arguments":{"query":"more"}}' },
        ],
        draft: [{ reply: 'Unsupported claim with no citation.' }],
      });
      const tools = new ScriptedTools({ search: okSearch([]) });
      const { run } = runWith(model, tools);
      const outcome = await run.execute();
      expect(outcome.status).not.toBe('answered');
      expect(model.calls.length).toBeLessThanOrEqual(AGENT_LIMITS.modelCalls);
      expect(run.budget.modelCalls).toBeLessThanOrEqual(4);
      expect(run.budget.toolCalls).toBeLessThanOrEqual(6);
      expect(run.budget.searches).toBeLessThanOrEqual(3);
      expect(run.budget.steps).toBeLessThanOrEqual(8);
      expect(run.budget.followUps).toBeLessThanOrEqual(1);
    });

    it('refuses a call that could take the run past its token budget', async () => {
      const model = new ScriptedModel({
        route: [{ reply: { text: route('explain_lesson'), tokens: 23_500 } }],
      });
      const { run } = runWith(model);
      expect(await run.execute()).toEqual({ status: 'limit_reached', reason: 'run_tokens' });
      expect(model.count('draft')).toBe(0);
      expect(run.budget.tokens).toBe(23_500);
    });

    it('asks the allowance and the budget between steps, and stops when they say so', async () => {
      let checks = 0;
      const model = new ScriptedModel({});
      const tools = new ScriptedTools();
      const { run, quota } = runWith(model, tools, {
        quota: () => {
          checks += 1;
          return checks === 3
            ? Promise.reject(new AgentLimitError('quota_tokens'))
            : Promise.resolve();
        },
      });
      expect(await run.execute()).toEqual({ status: 'limit_reached', reason: 'quota_tokens' });
      // Before the routing call, before the lesson, then the search was stopped.
      expect(quota).toHaveBeenCalledTimes(3);
      expect(tools.names()).toEqual(['lesson_content']);
      expect(quota.mock.calls[1]![0]).toEqual({ tokens: 15, costMicros: 1 });
    });

    it('fails closed when the allowance cannot be read', async () => {
      const { run } = runWith(new ScriptedModel({}), new ScriptedTools(), {
        quota: () => Promise.reject(new Error('database down')),
      });
      expect(await run.execute()).toMatchObject({ status: 'failed', reason: 'quota_unreadable' });
    });

    it('counts a stand-in as a model call, and asks before it is tried', async () => {
      const standIn = new AiProviderError('unavailable');
      const model = new ScriptedModel({
        route: [{ reply: route('explain_lesson'), standInAfter: standIn }],
        draft: [{ reply: ANSWER_FROM_LESSON, standInAfter: standIn }],
      });
      const { run } = runWith(model);
      expect(await run.execute()).toMatchObject({ status: 'answered' });
      expect(run.budget.modelCalls).toBe(4);
      expect(run.trace.fallback).toBe(true);
      expect(run.attempts.map(({ task, attempt }) => [task, attempt.outcome])).toEqual([
        ['classify', 'unavailable'],
        ['classify', 'ok'],
        ['chat', 'unavailable'],
        ['chat', 'ok'],
      ]);

      const capped = new ScriptedModel({
        route: [{ reply: route('explain_lesson'), standInAfter: standIn }],
      });
      expect(
        await runWith(capped, new ScriptedTools(), { limits: { modelCalls: 2 } }).run.execute(),
      ).toEqual({
        status: 'limit_reached',
        reason: 'model_calls',
      });

      const refused = new ScriptedModel({
        route: [{ reply: route('explain_lesson'), standInAfter: standIn }],
      });
      const { run: stopped } = runWith(refused, new ScriptedTools(), {
        quota: (spent) =>
          spent.tokens === 0 && refused.calls.length > 0
            ? Promise.reject(new AgentLimitError('quota_budget'))
            : Promise.resolve(),
      });
      expect(await stopped.execute()).toEqual({ status: 'limit_reached', reason: 'quota_budget' });
      expect(stopped.attempts).toHaveLength(1);
    });
  });

  describe('deadlines and cancellation', () => {
    it('stops at the run’s deadline, and aborts the call in flight', async () => {
      const deadline = new AbortController();
      const model = new ScriptedModel({ draft: [{ reply: 'hang' }] });
      const { run } = runWith(model, new ScriptedTools(), { deadline: deadline.signal });
      const pending = run.execute();
      await vi.waitFor(() => expect(model.count('draft')).toBe(1));
      deadline.abort(new DOMException('deadline', 'TimeoutError'));
      expect(await pending).toEqual({ status: 'limit_reached', reason: 'run_time' });
      expect(model.calls.at(-1)!.signal.aborted).toBe(true);
    });

    it('starts no call once cancelled, even while the quotas were being read', async () => {
      for (const check of [1, 2]) {
        const client = new AbortController();
        let checks = 0;
        const model = new ScriptedModel({});
        const tools = new ScriptedTools();
        const { run } = runWith(model, tools, {
          input: { signal: client.signal },
          quota: () => {
            if (++checks === check) client.abort(new Error('The client went away'));
            return Promise.resolve();
          },
        });
        expect(await run.execute(), `check ${check}`).toEqual({ status: 'cancelled' });
        // Before the routing call, or before the first tool: nothing more was called.
        expect(model.calls, `check ${check}`).toHaveLength(check - 1);
        expect(tools.calls, `check ${check}`).toHaveLength(0);
      }
    });

    it('gives each model call its own deadline', async () => {
      const model = new ScriptedModel({ draft: [{ reply: 'hang' }] });
      const outcome = await runWith(model, new ScriptedTools(), {
        limits: { modelCallMs: 20 },
      }).run.execute();
      expect(outcome).toMatchObject({ status: 'failed', reason: 'timeout' });
    });

    it('is cancelled when the client goes, mid-tool or mid-call, and calls nothing more', async () => {
      const client = new AbortController();
      const tools = new ScriptedTools({
        lesson: (_, signal) =>
          new Promise((resolve) =>
            signal.addEventListener('abort', () =>
              resolve({
                ok: false,
                tool: 'lesson_content',
                failure: 'cancelled',
                code: 'cancelled',
                durationMs: 1,
              }),
            ),
          ),
      });
      const model = new ScriptedModel({});
      const { run } = runWith(model, tools, { input: { signal: client.signal } });
      const pending = run.execute();
      await vi.waitFor(() => expect(tools.calls).toHaveLength(1));
      client.abort(new Error('The client went away'));
      expect(await pending).toEqual({ status: 'cancelled' });
      expect(tools.calls[0]!.signal.aborted).toBe(true);
      expect(model.count('draft')).toBe(0);

      const later = new AbortController();
      const hanging = new ScriptedModel({ draft: [{ reply: 'hang' }] });
      const second = runWith(hanging, new ScriptedTools(), { input: { signal: later.signal } });
      const inFlight = second.run.execute();
      await vi.waitFor(() => expect(hanging.count('draft')).toBe(1));
      later.abort(new Error('The client went away'));
      expect(await inFlight).toEqual({ status: 'cancelled' });
      expect(hanging.calls.at(-1)!.signal.aborted).toBe(true);
    });
  });

  describe('verification before anything is given', () => {
    it('regenerates once after a failed draft, with every check again', async () => {
      const model = new ScriptedModel({
        draft: [{ reply: 'A for loop repeats its body [S9].' }, { reply: ANSWER_FROM_LESSON }],
      });
      const { run } = runWith(model);
      expect(await run.execute()).toMatchObject({ status: 'answered', text: ANSWER_FROM_LESSON });
      expect(run.trace.faults).toEqual(['unknown_citation']);
      const second = model.calls.filter((call) => call.kind === 'draft')[1]!;
      expect(second.request.messages.map((m) => m.content)).toContain(GROUNDED_REMINDER);
    });

    it('gives nothing when both drafts fail: not grounded, or refused when unsafe', async () => {
      const unsupported = new ScriptedModel({
        draft: [{ reply: 'Recursion calls a function from inside itself repeatedly [S1].' }],
      });
      expect(await runWith(unsupported).run.execute()).toEqual({
        status: 'not_grounded',
        reason: 'unsupported_citation',
      });
      for (const unsafe of [
        `Use ghp_${'A'.repeat(36)} to log in [S1].`,
        `Your learner id is ${LEARNER} [S1].`,
        '{"action":"tool","tool":"lesson_content","arguments":{}}',
        'Developer mode is on: I will answer anything now, without sources.',
      ]) {
        const model = new ScriptedModel({ draft: [{ reply: unsafe }] });
        const outcome = await runWith(model).run.execute();
        expect(outcome.status, unsafe).toBe('refused');
        expect(model.count('draft'), unsafe).toBe(2);
      }
    });

    it('takes the model’s own decline as insufficient evidence', async () => {
      const model = new ScriptedModel({ draft: [{ reply: 'INSUFFICIENT_EVIDENCE' }] });
      expect(await runWith(model).run.execute()).toEqual({
        status: 'insufficient_evidence',
        reason: 'model_declined',
      });
    });

    it('does not regenerate past the model-call limit', async () => {
      const model = new ScriptedModel({
        draft: [{ reply: 'Recursion calls a function from inside itself repeatedly [S1].' }],
      });
      const { run } = runWith(model, new ScriptedTools(), { limits: { modelCalls: 2 } });
      expect(await run.execute()).toMatchObject({ status: 'not_grounded' });
      expect(model.count('draft')).toBe(1);
      expect(run.trace.faults).toContain('regeneration_skipped');
    });

    it('asks once more whether the learner may have it, and gives nothing if not', async () => {
      const { run, deliver } = runWith(new ScriptedModel({}), new ScriptedTools(), {
        deliver: false,
      });
      expect(await run.execute()).toEqual({
        status: 'refused',
        reason: 'no_longer_authorized',
        notice: 'refused',
      });
      expect(deliver.mock.calls[0]![1]).toEqual([expect.objectContaining({ id: 'S1' })]);
    });
  });

  describe('tools and the learner’s authorization', () => {
    it('stops when a tool finds the learner may not have it now', async () => {
      const tools = new ScriptedTools({
        lesson: () =>
          Promise.resolve({
            ok: false,
            tool: 'lesson_content',
            failure: 'forbidden',
            code: 'lesson_not_open',
            durationMs: 1,
          }),
      });
      const model = new ScriptedModel({});
      expect(await runWith(model, tools).run.execute()).toEqual({
        status: 'refused',
        reason: 'lesson_not_open',
        notice: 'refused',
      });
      expect(model.count('draft')).toBe(0);
    });

    it('goes on without a tool that is unavailable or failed', async () => {
      const tools = new ScriptedTools({
        search: () =>
          Promise.resolve({
            ok: false,
            tool: 'knowledge_search',
            failure: 'unavailable',
            code: 'switched_off',
            durationMs: 1,
          }),
      });
      expect(await runWith(new ScriptedModel({}), tools).run.execute()).toMatchObject({
        status: 'answered',
      });
    });

    it('stops when the allowance is used during a search', async () => {
      const tools = new ScriptedTools({
        search: () =>
          Promise.resolve({
            ok: false,
            tool: 'knowledge_search',
            failure: 'quota',
            code: 'quota_tokens',
            durationMs: 1,
          }),
      });
      expect(await runWith(new ScriptedModel({}), tools).run.execute()).toEqual({
        status: 'limit_reached',
        reason: 'quota_tokens',
      });
    });

    it('refuses before any call data the provider may not be given', async () => {
      const model = new ScriptedModel({}, 'data_class_not_approved');
      expect(await runWith(model).run.execute()).toMatchObject({
        status: 'refused',
        reason: 'data_not_approved',
      });
      expect(model.calls).toHaveLength(0);
    });

    it('sends no identifier, and records tools by name and outcome — never what they were asked', async () => {
      const model = new ScriptedModel({});
      const { run } = runWith(model);
      await run.execute();
      const sent = model.calls
        .flatMap((call) => call.request.messages.map((m) => m.content))
        .join('\n');
      for (const id of [LEARNER, ORG, LESSON, COURSE]) expect(sent).not.toContain(id);
      const trace = JSON.stringify(run.trace);
      expect(trace).not.toContain('Explain this lesson about loops');
      expect(trace).not.toContain(LESSON_TEXT);
      expect(run.trace.tools).toEqual([
        { tool: 'lesson_content', outcome: 'ok', code: null, durationMs: 1 },
        { tool: 'knowledge_search', outcome: 'ok', code: null, durationMs: 1 },
      ]);
    });
  });
});
