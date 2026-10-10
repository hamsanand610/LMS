import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import {
  AI_FEATURE_FLAGS,
  AI_KNOWLEDGE_ANSWERS_FLAG,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  type AiConversationSummary,
  type KnowledgeAnswer,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import {
  type AiChatRequest,
  type AiChatResult,
  AiProviderError,
} from '../src/modules/ai/providers/ai-provider.js';
import { FakeAiProvider } from '../src/modules/ai/providers/fake.provider.js';
import { AiCircuitBreakers, DEFAULT_CIRCUIT } from '../src/modules/ai/routing/circuit-breaker.js';
import { ModelRouter } from '../src/modules/ai/routing/model-router.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { eventually } from './setup/eventually.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { emptyKnowledgeBase } from './setup/knowledge-base.js';
import { parseEvents } from './setup/scripted-ai.provider.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const AI_ENV = {
  AI_PROVIDER: 'fake',
  AI_TIMEOUT_MS: '10000',
  AI_DATA_CLASSES: 'public,course',
  // The fake's own evidence floor: a developer's configured one (apps/api/.env) has no place here.
  AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY: '',
};
// Not the semantic cache: an answer served from it would never reach the model.
const FLAGS = [
  AI_MODULE_FLAG,
  AI_FEATURE_FLAGS.workspace,
  AI_KNOWLEDGE_FLAG,
  AI_KNOWLEDGE_ANSWERS_FLAG,
];
const MODEL = 'fake-1';

/**
 * The fake model service with a switch: it answers (as the fake does, grounded requests included),
 * fails before writing anything (the service is down), or holds a call until the test releases it,
 * so that a probe can be caught in flight. Every call it receives is kept, by task.
 */
class SwitchedProvider extends FakeAiProvider {
  mode: 'answer' | 'fail' | 'hold' = 'answer';
  readonly tasks: string[] = [];
  private waiting: (() => void) | null = null;

  constructor() {
    super({ AI_MODEL: '' });
  }

  /** The answers asked of the model: the assistant's and grounded ones (a title is not one). */
  get answerCalls(): number {
    return this.tasks.filter((task) => task === 'chat').length;
  }

  get holding(): boolean {
    return this.waiting !== null;
  }

  /** Lets the held call go on, and the calls after it answer. */
  release(): void {
    const waiting = this.waiting;
    this.waiting = null;
    this.mode = 'answer';
    waiting?.();
  }

  private async gate(request: AiChatRequest, signal: AbortSignal): Promise<void> {
    this.tasks.push(request.task);
    if (this.mode === 'fail') throw new AiProviderError('unavailable', { httpStatus: 503 });
    if (this.mode === 'hold') {
      await new Promise<void>((resolve, reject) => {
        this.waiting = resolve;
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
  }

  /** Every answer passes here: the fake's stream writes what `chat` answers. */
  override async chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    await this.gate(request, signal);
    return super.chat(request, signal);
  }
}

/**
 * A model's circuit after repeated failures (Phase 7B), through the two ways a person reaches the
 * model: grounded answers (Phase 8E) and the assistant's conversations (Phase 7C). Both ask how the
 * service is doing before any call; a rested model they turned away was never probed, so it never
 * recovered (found by the Gemini evaluation, 5 October 2026). With the circuits' own threshold and
 * rest, on a clock the test moves: the circuit opens after the failures; nothing is sent while it
 * rests; once the rest is over exactly one probe goes, and nothing beside it; a probe that answers
 * closes the circuit, and one that fails rests the model again at once.
 */
describe('SI Academy AI — a rested model recovers (circuits)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let router: ModelRouter;
  let admin: Session;
  let organizationId = '';
  const provider = new SwitchedProvider();
  let clock = Date.now();
  const circuits = new AiCircuitBreakers({
    failureThreshold: DEFAULT_CIRCUIT.failureThreshold,
    cooldownMs: DEFAULT_CIRCUIT.cooldownMs,
    now: () => clock,
  });
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  const circuit = () => circuits.state('fake', MODEL);
  /** The rest a failing model gets, passed. */
  const rest = (ms: number = DEFAULT_CIRCUIT.cooldownMs) => {
    clock += ms;
  };

  async function learner(label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `ai-circuit-${label}-${counter}-${unique}@test.local`;
    await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI circuit ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        studentProfile: {
          create: { studentCode: `STU-AI-CIRCUIT-${counter}-${unique}`, status: 'active' },
        },
      },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return session;
  }

  /** Whether the browser is told the AI answers now (what offers the assistant at all). */
  async function available(session: Session): Promise<{ available: boolean; reason: unknown }> {
    return expectStatus(await session.get('/ai/availability'), 200).body as {
      available: boolean;
      reason: unknown;
    };
  }

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    app = await createTestApp({ aiProvider: provider, circuits });
    prisma = app.get(PrismaService);
    router = app.get(ModelRouter);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) {
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: true }), 200);
    }
    await emptyKnowledgeBase(admin);
  });
  beforeEach(() => {
    provider.release();
    provider.tasks.length = 0;
    circuits.circuitOf('fake', MODEL).succeeded();
  });
  afterAll(async () => {
    provider.release();
    for (const key of FLAGS) {
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: false }), 200);
    }
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
  });

  it('grounded answers: open after the failures, refuse while the model rests, then one probe — closed by its answer, rested again by its failure', async () => {
    const topic = `circuit${unique}x${++counter}`;
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Circuit ${counter}`,
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
      }),
      201,
    ).body as KnowledgeSourceView;
    const documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: `Reading room ${counter}`,
          canonicalRef: `authored:circuit-${counter}-${unique}`,
        }),
        201,
      ).body as { id: string }
    ).id;
    const version = expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
        content: `${topic} the reading room opens at nine on weekdays for registered learners.`,
        format: 'markdown',
      }),
      201,
    ).body as KnowledgeVersionView;
    expectStatus(await admin.post(`/ai/knowledge/versions/${version.id}/ingest`), 202);
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
    expectStatus(await admin.post(`/ai/knowledge/versions/${version.id}/embed`), 202);

    const people = [await learner('answers'), await learner('answers'), await learner('answers')];
    let turn = 0;
    const ask = (session: Session = people[turn++ % people.length]!): Promise<Response> =>
      session.post('/ai/knowledge/answer', {
        query: `${topic} when does the reading room open on weekdays? ask${++counter}`,
      });
    const answered = (res: Response) => {
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect((res.body as KnowledgeAnswer).status).toBe('answered');
    };
    const refused = (res: Response, code: string) => {
      expect(res.status).toBe(503);
      expect(problemCode(res)).toBe(code);
    };

    answered(await ask());
    expect(provider.answerCalls).toBe(1);

    // 1. The circuit opens after its threshold of consecutive failures.
    provider.mode = 'fail';
    for (let i = 0; i < DEFAULT_CIRCUIT.failureThreshold; i += 1) {
      refused(await ask(), 'knowledge_answer_unavailable');
    }
    expect(provider.answerCalls).toBe(1 + DEFAULT_CIRCUIT.failureThreshold);
    expect(circuit()).toBe('open');
    expect(router.serviceState()).toBe('unavailable');

    // 2. While the model rests, a question is refused before anything is sent.
    refused(await ask(), 'ai_busy');
    rest(DEFAULT_CIRCUIT.cooldownMs - 1);
    refused(await ask(), 'ai_busy');
    expect(await available(people[0]!)).toMatchObject({ available: false, reason: 'not_ready' });
    expect(provider.answerCalls).toBe(6);

    // 3. Its rest over, the service answers again: one probe, and nothing beside it.
    rest(1);
    expect(circuit()).toBe('half_open');
    expect(router.serviceState()).toBe('ready');
    expect(await available(people[0]!)).toMatchObject({ available: true, reason: null });
    provider.mode = 'hold';
    const probe = ask(people[0]!);
    await eventually(
      async () => provider.holding,
      (holding) => holding,
    );
    expect(router.serviceState()).toBe('unavailable');
    refused(await ask(people[1]!), 'ai_busy');
    expect(provider.answerCalls).toBe(7);

    // 4. The probe answers: the circuit closes, and questions are answered again.
    provider.release();
    answered(await probe);
    expect(circuit()).toBe('closed');
    expect(router.serviceState()).toBe('ready');
    answered(await ask());
    expect(provider.answerCalls).toBe(8);

    // 5. A probe that fails rests the model again at once: one failure, not the threshold.
    provider.mode = 'fail';
    for (let i = 0; i < DEFAULT_CIRCUIT.failureThreshold; i += 1) {
      refused(await ask(), 'knowledge_answer_unavailable');
    }
    rest();
    expect(circuit()).toBe('half_open');
    refused(await ask(), 'knowledge_answer_unavailable');
    expect(circuit()).toBe('open');
    refused(await ask(), 'ai_busy');
    expect(provider.answerCalls).toBe(14);
    rest();
    provider.mode = 'answer';
    answered(await ask());
    expect(circuit()).toBe('closed');
    expect(provider.answerCalls).toBe(15);
  }, 60_000);

  it('the assistant: open after the failures, refuse while the model rests, then one probe — closed by its answer, rested again by its failure', async () => {
    const people = [
      await learner('assistant'),
      await learner('assistant'),
      await learner('assistant'),
    ];
    const conversations = new Map<Session, string>();
    for (const session of people) {
      // A title of their own: none is written in the background — on the same model, after a
      // complete answer — while the test turns the switch.
      const id = (
        expectStatus(
          await session.post('/ai/conversations', { purpose: 'workspace', title: 'Loops' }),
          201,
        ).body as AiConversationSummary
      ).id;
      conversations.set(session, id);
    }
    let turn = 0;
    const ask = (session: Session = people[turn++ % people.length]!): Promise<Response> =>
      session.post(`/ai/conversations/${conversations.get(session)}/messages`, {
        content: `Explain loops, please (${++counter}).`,
      });
    const ended = (res: Response, status: string, code?: string) => {
      expect(res.status, res.text).toBe(200);
      const events = parseEvents(res.text);
      expect(events.at(-1)!.data['status']).toBe(status);
      if (code) expect(events.find((e) => e.event === 'error')?.data['code']).toBe(code);
    };
    const refused = (res: Response) => {
      expect(res.status).toBe(503);
      expect(problemCode(res)).toBe('ai_busy');
    };

    ended(await ask(), 'complete');
    expect(provider.answerCalls).toBe(1);

    // 1. The circuit opens after its threshold of consecutive failures.
    provider.mode = 'fail';
    for (let i = 0; i < DEFAULT_CIRCUIT.failureThreshold; i += 1) {
      ended(await ask(), 'failed', 'ai_unavailable');
    }
    expect(provider.answerCalls).toBe(1 + DEFAULT_CIRCUIT.failureThreshold);
    expect(circuit()).toBe('open');

    // 2. While the model rests, a message is refused before anything is sent or written.
    refused(await ask());
    rest(DEFAULT_CIRCUIT.cooldownMs - 1);
    refused(await ask());
    expect(await available(people[0]!)).toMatchObject({ available: false, reason: 'not_ready' });
    expect(provider.answerCalls).toBe(6);

    // 3. Its rest over, the assistant answers again: one probe, and nothing beside it.
    rest(1);
    expect(circuit()).toBe('half_open');
    expect(await available(people[0]!)).toMatchObject({ available: true, reason: null });
    provider.mode = 'hold';
    const probe = ask(people[0]!);
    await eventually(
      async () => provider.holding,
      (holding) => holding,
    );
    refused(await ask(people[1]!));
    expect(provider.answerCalls).toBe(7);

    // 4. The probe answers: the circuit closes, and messages are answered again.
    provider.release();
    ended(await probe, 'complete');
    expect(circuit()).toBe('closed');
    ended(await ask(people[2]!), 'complete');
    expect(provider.answerCalls).toBe(8);

    // 5. A probe that fails rests the model again at once: one failure, not the threshold.
    provider.mode = 'fail';
    for (let i = 0; i < DEFAULT_CIRCUIT.failureThreshold; i += 1) {
      ended(await ask(), 'failed', 'ai_unavailable');
    }
    rest();
    expect(circuit()).toBe('half_open');
    ended(await ask(), 'failed', 'ai_unavailable');
    expect(circuit()).toBe('open');
    refused(await ask());
    expect(provider.answerCalls).toBe(14);
    rest();
    provider.mode = 'answer';
    ended(await ask(), 'complete');
    expect(circuit()).toBe('closed');
    expect(provider.answerCalls).toBe(15);
  }, 60_000);
});
