import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { type AgentTool, type AgentToolContext, AgentToolError } from './agent-tool.js';
import { AgentToolRegistry } from './tool-registry.js';

const USER = '0190a0e4-7c1d-7b9e-8f00-0000000000a1';
const ORG = '0190a0e4-7c1d-7b9e-8f00-0000000000a2';
const STUDENT = '0190a0e4-7c1d-7b9e-8f00-0000000000a3';
const OTHER = '0190a0e4-7c1d-7b9e-8f00-0000000000a4';

const learner: AuthUser = {
  id: USER,
  organizationId: ORG,
  email: 'learner@test.local',
  name: 'Learner',
  status: 'active',
  roleKeys: ['student'],
  permissions: [
    { key: 'ai:agent', scope: 'own' },
    { key: 'courses:read', scope: 'own' },
  ],
  tokenVersion: 0,
  sessionId: 'session-1',
};

const context: AgentToolContext = Object.freeze({
  user: learner,
  studentId: STUDENT,
  conversationId: OTHER,
  courseId: null,
  lessonId: null,
});

type Run = (context: AgentToolContext, input: object, signal: AbortSignal) => Promise<object>;

/** A tool whose run the test decides, declared as the contract asks. */
function toolNamed(
  name: 'knowledge_search' | 'lesson_content',
  run: Run,
  extra: Partial<AgentTool> = {},
): AgentTool & { run: ReturnType<typeof vi.fn> } {
  const search = name === 'knowledge_search';
  return {
    name,
    description: `${name} test`,
    argumentsHint: search ? '{"query": "…"}' : '{}',
    input: search ? z.object({ query: z.string().min(3) }).strict() : z.object({}).strict(),
    output: z.object({ text: z.string() }).strict(),
    dataClass: 'course',
    permissions: search ? [] : ['courses:read'],
    modules: search ? [] : ['courses'],
    availableWith: search ? ['ai.knowledge'] : [],
    timeoutMs: 1_000,
    maxOutputCharacters: 20,
    availableInTimedTest: false,
    mutates: false,
    characters: (output: object) => (output as { text: string }).text.length,
    ...extra,
    run: vi.fn(run),
  } as AgentTool & { run: ReturnType<typeof vi.fn> };
}

interface World {
  permissions: string[];
  status: AuthUser['status'];
  studentId: string | null;
  flags: Record<string, boolean>;
  modules: Record<string, boolean>;
  timedTest: boolean;
  approved: string[];
  loadFails: boolean;
}

function setUp(
  options: { search?: Run; lesson?: Run; extra?: Partial<AgentTool> } = {},
  changes: Partial<World> = {},
) {
  const world: World = {
    permissions: ['ai:agent', 'courses:read'],
    status: 'active',
    studentId: STUDENT,
    flags: { 'module.ai': true, 'ai.agent': true, 'ai.knowledge': true },
    modules: { ai: true, courses: true },
    timedTest: false,
    approved: ['public', 'course'],
    loadFails: false,
    ...changes,
  };
  const answer: Run = () => Promise.resolve({ text: 'found' });
  const search = toolNamed('knowledge_search', options.search ?? answer, options.extra);
  const lesson = toolNamed('lesson_content', options.lesson ?? answer);
  const authContext = {
    load: vi.fn(() =>
      world.loadFails
        ? Promise.reject(new Error('database down'))
        : Promise.resolve({
            ...learner,
            sessionId: undefined,
            status: world.status,
            permissions: world.permissions.map((key) => ({ key, scope: 'own' as const })),
          }),
    ),
  };
  const registry = new AgentToolRegistry(
    search as never,
    lesson as never,
    authContext as never,
    { personFor: () => Promise.resolve({ studentId: world.studentId }) } as never,
    { effectiveFor: () => Promise.resolve(world.flags) } as never,
    { isEnabledFor: (key: string) => Promise.resolve(world.modules[key] ?? false) } as never,
    { hasOpenAttempt: () => Promise.resolve(world.timedTest) } as never,
    { approvedDataClasses: () => world.approved } as never,
  );
  return { registry, search, lesson, world, authContext };
}

const live = () => new AbortController().signal;
const searchFor = (query: unknown) => ({ tool: 'knowledge_search', arguments: { query } });

describe('the learning agent’s tool registry (Phase 9B; ADR-0039)', () => {
  it('holds exactly its two read-only tools, never available in a timed test', () => {
    const answer: Run = () => Promise.resolve({ text: '' });
    const build = (a: AgentTool, b: AgentTool) =>
      new AgentToolRegistry(
        a as never,
        b as never,
        ...(Array.from({ length: 6 }, () => ({})) as [never, never, never, never, never, never]),
      );
    expect(() =>
      build(toolNamed('knowledge_search', answer), toolNamed('lesson_content', answer)),
    ).not.toThrow();
    expect(() =>
      build(toolNamed('knowledge_search', answer), toolNamed('knowledge_search', answer)),
    ).toThrow(/two read-only tools/);
    expect(() =>
      build(
        toolNamed('knowledge_search', answer, { mutates: true as never }),
        toolNamed('lesson_content', answer),
      ),
    ).toThrow(/two read-only tools/);
    expect(() =>
      build(
        toolNamed('knowledge_search', answer, { availableInTimedTest: true as never }),
        toolNamed('lesson_content', answer),
      ),
    ).toThrow(/two read-only tools/);
    const { registry } = setUp();
    expect(registry.descriptions().map((tool) => tool.name)).toEqual([
      'knowledge_search',
      'lesson_content',
    ]);
  });

  it('refuses a tool not on the allow-list, by any name, and runs nothing', async () => {
    const { registry, search, lesson } = setUp();
    for (const tool of [
      'shell',
      'sql_query',
      'http_get',
      'read_file',
      '__proto__',
      'constructor',
      'toString',
      'Knowledge_Search',
      'knowledge_search ',
    ]) {
      expect(await registry.execute(context, { tool, arguments: {} }, live()), tool).toMatchObject({
        ok: false,
        tool: null,
        failure: 'unknown_tool',
      });
    }
    expect(search.run).not.toHaveBeenCalled();
    expect(lesson.run).not.toHaveBeenCalled();
  });

  it('refuses arguments that are not exactly the tool’s: an identity, a scope, an extra field', async () => {
    const { registry, search, lesson } = setUp();
    for (const args of [
      { query: 'loops', courseId: OTHER },
      { query: 'loops', lessonId: OTHER },
      { query: 'loops', learnerId: OTHER },
      { query: 'loops', organizationId: OTHER },
      { query: 'loops', topK: 50 },
      { query: 'x' },
      {},
      null,
      ['loops'],
    ]) {
      expect(
        await registry.execute(context, { tool: 'knowledge_search', arguments: args }, live()),
        JSON.stringify(args),
      ).toMatchObject({ ok: false, tool: 'knowledge_search', failure: 'invalid_arguments' });
    }
    expect(
      await registry.execute(
        context,
        { tool: 'lesson_content', arguments: { lessonId: OTHER } },
        live(),
      ),
    ).toMatchObject({ failure: 'invalid_arguments' });
    expect(search.run).not.toHaveBeenCalled();
    expect(lesson.run).not.toHaveBeenCalled();
  });

  it('authorizes every call afresh, as the learner is now', async () => {
    const cases: [Partial<World>, 'knowledge_search' | 'lesson_content', string, string][] = [
      [{ permissions: ['courses:read'] }, 'knowledge_search', 'forbidden', 'permission'],
      [{ permissions: ['ai:agent'] }, 'lesson_content', 'forbidden', 'permission'],
      [{ status: 'suspended' }, 'knowledge_search', 'forbidden', 'not_active'],
      [{ studentId: null }, 'knowledge_search', 'forbidden', 'not_learner'],
      [{ studentId: OTHER }, 'knowledge_search', 'forbidden', 'not_learner'],
      [
        { flags: { 'module.ai': true, 'ai.knowledge': true } },
        'knowledge_search',
        'forbidden',
        'agent_off',
      ],
      [
        { flags: { 'ai.agent': true, 'ai.knowledge': true } },
        'knowledge_search',
        'forbidden',
        'agent_off',
      ],
      [{ modules: { ai: true, courses: false } }, 'lesson_content', 'forbidden', 'module_off'],
      [{ modules: { ai: false, courses: true } }, 'knowledge_search', 'forbidden', 'module_off'],
      [{ timedTest: true }, 'knowledge_search', 'forbidden', 'timed_test'],
      [{ timedTest: true }, 'lesson_content', 'forbidden', 'timed_test'],
      [{ approved: ['public'] }, 'lesson_content', 'unavailable', 'data_not_approved'],
      [
        { flags: { 'module.ai': true, 'ai.agent': true } },
        'knowledge_search',
        'unavailable',
        'switched_off',
      ],
      [{ loadFails: true }, 'knowledge_search', 'forbidden', 'unverifiable'],
    ];
    for (const [change, tool, failure, code] of cases) {
      const { registry, search, lesson } = setUp({}, change);
      const call = tool === 'knowledge_search' ? searchFor('loops') : { tool, arguments: {} };
      expect(await registry.execute(context, call, live()), JSON.stringify(change)).toMatchObject({
        ok: false,
        tool,
        failure,
        code,
      });
      expect(search.run).not.toHaveBeenCalled();
      expect(lesson.run).not.toHaveBeenCalled();
    }
    // Courses do not matter to the knowledge base's own search (its reach rule decides).
    const { registry } = setUp({}, { permissions: ['ai:agent'], modules: { ai: true } });
    expect(await registry.execute(context, searchFor('loops'), live())).toMatchObject({ ok: true });
  });

  it('runs a tool with the learner as they are now, and the pinned context, frozen', async () => {
    const { registry, search } = setUp();
    expect(await registry.execute(context, searchFor('loops'), live())).toEqual({
      ok: true,
      tool: 'knowledge_search',
      output: { text: 'found' },
      durationMs: expect.any(Number),
    });
    const [given, input] = search.run.mock.calls[0]! as [AgentToolContext, object];
    expect(input).toEqual({ query: 'loops' });
    expect(Object.isFrozen(given)).toBe(true);
    expect(given).toMatchObject({ studentId: STUDENT, courseId: null, lessonId: null });
    expect(given.user).toMatchObject({ id: USER, sessionId: 'session-1' });
  });

  it('stops a tool at its deadline, or when the run ends, and says which', async () => {
    const hangs: Run = (_, __, signal) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    const slow = setUp({ search: hangs, extra: { timeoutMs: 20 } });
    expect(await slow.registry.execute(context, searchFor('loops'), live())).toMatchObject({
      ok: false,
      failure: 'timeout',
    });
    expect((slow.search.run.mock.calls[0]![2] as AbortSignal).aborted).toBe(true);

    const run = new AbortController();
    const cancelled = setUp({ search: hangs });
    const pending = cancelled.registry.execute(context, searchFor('loops'), run.signal);
    await vi.waitFor(() => expect(cancelled.search.run).toHaveBeenCalled());
    run.abort(new Error('The client went away'));
    expect(await pending).toMatchObject({ ok: false, failure: 'cancelled' });
    expect((cancelled.search.run.mock.calls[0]![2] as AbortSignal).aborted).toBe(true);

    // The run's own time left bounds a tool's deadline too.
    const short = setUp({ search: hangs });
    expect(await short.registry.execute(context, searchFor('loops'), live(), 15)).toMatchObject({
      failure: 'timeout',
    });
  });

  it('uses nothing of an output that is not exactly the tool’s, or more than it may return', async () => {
    const extra = setUp({ search: () => Promise.resolve({ text: 'x', secret: 'y' }) });
    expect(await extra.registry.execute(context, searchFor('loops'), live())).toMatchObject({
      failure: 'invalid_output',
    });
    const large = setUp({ search: () => Promise.resolve({ text: 'x'.repeat(21) }) });
    expect(await large.registry.execute(context, searchFor('loops'), live())).toMatchObject({
      failure: 'invalid_output',
    });
  });

  it('reports a tool’s own refusal by its code, and anything else as a failure', async () => {
    const refused = setUp({
      search: () => Promise.reject(new AgentToolError('forbidden', 'context_forbidden')),
    });
    expect(await refused.registry.execute(context, searchFor('loops'), live())).toMatchObject({
      failure: 'forbidden',
      code: 'context_forbidden',
    });
    const broken = setUp({ search: () => Promise.reject(new Error('boom: SELECT * FROM users')) });
    expect(await broken.registry.execute(context, searchFor('loops'), live())).toEqual({
      ok: false,
      tool: 'knowledge_search',
      failure: 'failed',
      code: 'internal',
      durationMs: expect.any(Number),
    });
  });
});
