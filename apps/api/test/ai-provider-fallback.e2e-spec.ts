import { type INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import {
  AI_FEATURE_FLAGS,
  AI_KNOWLEDGE_ANSWERS_FLAG,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  API_PREFIX,
  SYSTEM_ROLES,
  type AiConversationSummary,
  type KnowledgeAnswer,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AiConversationsService } from '../src/modules/ai/conversations/conversations.service.js';
import { AI_PROVIDER } from '../src/modules/ai/index.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
import {
  AI_FALLBACK_PROVIDER,
  type AiChatMessage,
} from '../src/modules/ai/providers/ai-provider.js';
import { fakeEmbedding, fakeGroundedAnswer } from '../src/modules/ai/providers/fake.provider.js';
import { GeminiAiProvider } from '../src/modules/ai/providers/gemini.provider.js';
import { GroqAiProvider } from '../src/modules/ai/providers/groq.provider.js';
import { AiCircuitBreakers } from '../src/modules/ai/routing/circuit-breaker.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { AttemptsService } from '../src/modules/tests/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { emptyKnowledgeBase } from './setup/knowledge-base.js';
import { parseEvents } from './setup/scripted-ai.provider.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const GEMINI_KEY = 'e2e-gemini-key-CANARY-5e21';
const GROQ_KEY = 'e2e-groq-key-CANARY-77a0';
const MAIN = 'gemini-3.8-flash';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const AI_ENV = {
  AI_PROVIDER: 'gemini',
  GEMINI_API_KEY: GEMINI_KEY,
  AI_MODEL: MAIN,
  AI_FALLBACK_PROVIDER: 'groq',
  GROQ_API_KEY: GROQ_KEY,
  AI_FALLBACK_MODEL: GROQ_MODEL,
  AI_DATA_CLASSES: 'public,course',
  AI_TIMEOUT_MS: '1000',
  // The stand-in network below embeds with the fake's vectors under Gemini's model name: the floor
  // measured for those vectors (ADR-0037) — a test value; a deployment sets its own measured one.
  AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY: '0.4',
};
const FLAGS = [
  AI_MODULE_FLAG,
  AI_FEATURE_FLAGS.workspace,
  AI_KNOWLEDGE_FLAG,
  AI_KNOWLEDGE_ANSWERS_FLAG,
];

type GeminiMode = 'answer' | 'unavailable' | 'quota' | 'bad-key' | 'hang';
type GroqMode = 'answer' | 'fabricate' | 'unavailable' | 'quota';

interface ProviderCall {
  provider: 'gemini' | 'groq';
  url: string;
  headers: Headers;
  body: string;
}

interface GeminiBody {
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[];
  systemInstruction?: { parts: { text: string }[] };
}

/** The turns a Gemini request carries, as SI Academy wrote them. */
function geminiMessages(body: string): AiChatMessage[] {
  const parsed = JSON.parse(body) as GeminiBody;
  return [
    ...(parsed.systemInstruction?.parts ?? []).map((part) => ({
      role: 'system' as const,
      content: part.text,
    })),
    ...parsed.contents.map((turn) => ({
      role: turn.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: turn.parts.map((part) => part.text).join(''),
    })),
  ];
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

function sse(events: unknown[], end = ''): Response {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + end;
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Never answers; rejects as fetch does when its signal aborts. */
const hangs = (signal: AbortSignal | null | undefined) =>
  new Promise<Response>((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

/**
 * The secondary provider (ADR-0038), end to end: Gemini and Groq configured with made-up keys, the
 * real adapters of both, and a stand-in for `fetch` that answers as each API does — Gemini failing
 * on cue, Groq answering as a model would — so nothing leaves the machine. A grounded answer whose
 * Gemini call fails for a reason that may pass is written by Groq from exactly the evidence Gemini
 * was given, checked and cited by the same rules, and audited and counted as the stand-in's; what
 * the platform refuses before any call never reaches Groq; neither key goes anywhere but its own
 * provider's header.
 */
describe('SI Academy AI — Groq standing in for Gemini (ADR-0038)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reach: KnowledgeReachService;
  let circuits: AiCircuitBreakers;
  let admin: Session;
  let organizationId = '';
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;
  let geminiMode: GeminiMode = 'answer';
  let groqMode: GroqMode = 'answer';
  /** This test's calls, and every call the spec made (for the key checks at the end). */
  const calls: ProviderCall[] = [];
  const allCalls: ProviderCall[] = [];
  const shown: string[] = [];
  const logged: unknown[][] = [];
  const topic = `standin${unique}`;
  const passage = `${topic} the reading room opens at nine on weekdays for registered learners.`;
  const question = (n: number) => `${topic} when does the reading room open on weekdays? ${n}`;
  let documentId = '';

  /** The calls that asked a model for an answer, by provider. */
  const answerCalls = (provider: 'gemini' | 'groq') =>
    calls.filter((call) =>
      provider === 'gemini'
        ? /:(stream)?[gG]enerateContent/.test(call.url)
        : call.url.endsWith('/chat/completions'),
    );

  function gemini(url: string, init: RequestInit | undefined): Promise<Response> | Response {
    const body = String(init?.body ?? '');
    if (url.includes(':batchEmbedContents')) {
      const asked = JSON.parse(body) as {
        requests: { content: { parts: { text: string }[] }; outputDimensionality: number }[];
      };
      return json({
        embeddings: asked.requests.map((r) => ({
          values: fakeEmbedding(r.content.parts[0]!.text, r.outputDimensionality).map((v) => v * 7),
        })),
        usageMetadata: { promptTokenCount: 11 * asked.requests.length },
      });
    }
    const messages = geminiMessages(body);
    const echo = messages.at(-1)?.content.slice(0, 80) ?? '';
    switch (geminiMode) {
      case 'unavailable':
        return json(
          {
            error: {
              code: 503,
              status: 'UNAVAILABLE',
              message: `Overloaded while reading ${echo}`,
            },
          },
          503,
        );
      case 'quota':
        return json(
          {
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: `Quota exceeded for ${echo}`,
              details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '31s' }],
            },
          },
          429,
        );
      case 'bad-key':
        return json(
          {
            error: {
              code: 400,
              status: 'INVALID_ARGUMENT',
              message: `API key not valid: ${GEMINI_KEY}`,
              details: [{ reason: 'API_KEY_INVALID' }],
            },
          },
          400,
        );
      case 'hang':
        return hangs(init?.signal);
      case 'answer': {
        const text = fakeGroundedAnswer(messages) ?? 'Loops repeat work.';
        const usageMetadata = { promptTokenCount: 50, candidatesTokenCount: 12 };
        if (!url.includes(':streamGenerateContent')) {
          return json({
            candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
            usageMetadata,
          });
        }
        return sse([
          {
            candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
            usageMetadata,
          },
        ]);
      }
    }
  }

  function groq(url: string, init: RequestInit | undefined): Response {
    if (url.endsWith('/models')) return json({ data: [{ id: GROQ_MODEL }] });
    const body = JSON.parse(String(init?.body ?? '')) as {
      messages: AiChatMessage[];
      stream?: boolean;
    };
    const echo = body.messages.at(-1)?.content.slice(0, 80) ?? '';
    if (groqMode === 'unavailable') {
      return json({ error: { message: `Down for ${echo}`, type: 'internal_server_error' } }, 503);
    }
    if (groqMode === 'quota') {
      return json(
        {
          error: { message: `Rate limit for ${echo}`, type: 'tokens', code: 'rate_limit_exceeded' },
        },
        429,
        { 'retry-after': '9' },
      );
    }
    const grounded = fakeGroundedAnswer(body.messages);
    const text =
      groqMode === 'fabricate'
        ? 'The reading room opens at nine [S9].'
        : (grounded ?? 'Loops repeat a block of code.');
    const usage = { prompt_tokens: 60, completion_tokens: 14 };
    if (!body.stream) {
      return json({
        id: 'chatcmpl-MARKER',
        choices: [
          { index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' },
        ],
        usage,
        x_groq: { id: 'req_MARKER' },
      });
    }
    const words = text.split(/(?<= )/);
    return sse(
      [
        ...words.map((word, i) => ({
          choices: [
            {
              index: 0,
              delta: { content: word },
              finish_reason: i === words.length - 1 ? 'stop' : null,
            },
          ],
        })),
        { choices: [], usage },
      ],
      'data: [DONE]\n\n',
    );
  }

  async function learner(label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `ai-standin-${label}-${counter}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI stand-in ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        studentProfile: {
          create: { studentCode: `STU-AI-STANDIN-${counter}-${unique}`, status: 'active' },
        },
      },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    const auth = (await app.get(AuthContextService).load(user.id))!;
    return { session, auth: { ...auth, sessionId: '' } as AuthUser };
  }

  /** A grounded question, with a request id of its own: its audit entry and ledger rows carry it. */
  async function ask(session: Session, query: string) {
    const requestId = `standin-${unique}-${++counter}`;
    const res = await request(session.server)
      .post(`${API_PREFIX}/ai/knowledge/answer`)
      .set('Accept', 'application/json')
      .set('Cookie', session.cookieHeader())
      .set('x-csrf-token', session.cookie('lms_csrf') ?? '')
      .set('x-request-id', requestId)
      .send({ query });
    shown.push(JSON.stringify(res.body), JSON.stringify(res.headers), res.text ?? '');
    return { res, requestId };
  }

  const auditOf = (requestId: string) =>
    prisma.auditLog.findFirstOrThrow({ where: { action: 'ai.knowledge.answer', requestId } });
  const ledgerOf = (requestId: string) =>
    prisma.aiRequest.findMany({ where: { requestId }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const provider = /googleapis\.com/.test(url)
        ? 'gemini'
        : /api\.groq\.com/.test(url)
          ? 'groq'
          : null;
      if (!provider) return realFetch(input, init);
      const call: ProviderCall = {
        provider,
        url,
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ''),
      };
      calls.push(call);
      allCalls.push(call);
      return provider === 'gemini' ? gemini(url, init) : groq(url, init);
    });
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    app = await createTestApp();
    prisma = app.get(PrismaService);
    reach = app.get(KnowledgeReachService);
    circuits = app.get(AiCircuitBreakers);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) {
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: true }), 200);
    }
    await emptyKnowledgeBase(admin);
    // One passage, through the platform's own path: embedded by Gemini (the stand-in never embeds).
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Stand-in ${unique}`,
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
      }),
      201,
    ).body as KnowledgeSourceView;
    documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: 'Reading room',
          canonicalRef: `authored:standin-${unique}`,
        }),
        201,
      ).body as { id: string }
    ).id;
    const version = expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
        content: passage,
        format: 'markdown',
      }),
      201,
    ).body as KnowledgeVersionView;
    expectStatus(await admin.post(`/ai/knowledge/versions/${version.id}/ingest`), 202);
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
    const embedded = expectStatus(
      await admin.post(`/ai/knowledge/versions/${version.id}/embed`),
      202,
    ).body as KnowledgeVersionView;
    expect(embedded.embedding?.status).toBe('embedded');
  });
  beforeEach(() => {
    geminiMode = 'answer';
    groqMode = 'answer';
    calls.length = 0;
    for (const [provider, model] of [
      ['gemini', MAIN],
      ['groq', GROQ_MODEL],
    ] as const) {
      circuits.circuitOf(provider, model).succeeded();
    }
  });
  afterAll(async () => {
    for (const key of FLAGS) {
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: false }), 200);
    }
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
    vi.restoreAllMocks();
  });

  it('builds Gemini and Groq, and nothing else', () => {
    expect(app.get(AI_PROVIDER)).toBeInstanceOf(GeminiAiProvider);
    expect(app.get(AI_FALLBACK_PROVIDER)).toBeInstanceOf(GroqAiProvider);
  });

  it('lets Gemini answer, and asks Groq nothing', async () => {
    const { session } = await learner('gemini');
    const { res, requestId } = await ask(session, question(1));
    expect(expectStatus(res, 200).body as KnowledgeAnswer).toMatchObject({ status: 'answered' });
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([1, 0]);
    expect((await auditOf(requestId)).after).toMatchObject({
      provider: 'gemini',
      model: MAIN,
      fallback: false,
    });
    const ledger = await ledgerOf(requestId);
    expect(ledger.map((r) => [r.provider, r.model, r.outcome, r.fallback])).toEqual([
      ['gemini', MAIN, 'ok', false],
    ]);
  });

  it('Gemini unavailable: Groq answers from the very same evidence, checked, cited, and audited as the stand-in', async () => {
    geminiMode = 'unavailable';
    const { session, auth } = await learner('fallback');
    const { res, requestId } = await ask(session, question(2));
    const answer = expectStatus(res, 200).body as KnowledgeAnswer;
    expect(answer.status).toBe('answered');
    expect(answer.answer).toContain('[S1]');
    expect(answer.citations.map((c) => c.documentId)).toEqual([documentId]);
    // Gemini was asked once; Groq was then given exactly what Gemini was — nothing more or less.
    const [geminiCall] = answerCalls('gemini');
    const [groqCall] = answerCalls('groq');
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([1, 1]);
    const groqBody = JSON.parse(groqCall!.body) as { model: string; messages: AiChatMessage[] };
    expect(groqBody.model).toBe(GROQ_MODEL);
    expect(groqBody.messages).toEqual(geminiMessages(geminiCall!.body));
    expect(groqBody.messages.map((m) => m.content).join('\n')).toContain(passage);
    // Every citation is one the learner may draw on, drawn by this request's retrieval.
    for (const citation of answer.citations) {
      expect(await reach.mayRetrieve(auth, citation.chunkId)).toBe(true);
    }
    const audit = await auditOf(requestId);
    expect(audit.after).toMatchObject({
      status: 'answered',
      provider: 'groq',
      model: GROQ_MODEL,
      fallback: true,
      citations: 1,
      documentIds: [documentId],
    });
    // The audit keeps no question, passage, answer or key.
    const kept = JSON.stringify(audit);
    for (const text of [question(2), passage, answer.answer, GEMINI_KEY, GROQ_KEY]) {
      expect(kept).not.toContain(text);
    }
    const ledger = await ledgerOf(requestId);
    expect(ledger.map((r) => [r.provider, r.model, r.outcome, r.fallback])).toEqual([
      ['gemini', MAIN, 'unavailable', false],
      ['groq', GROQ_MODEL, 'ok', true],
    ]);
    expect(ledger[1]!.inputTokens).toBe(60);
    expect(ledger[1]!.outputTokens).toBe(14);
  });

  it('Gemini out of quota (429): Groq answers', async () => {
    geminiMode = 'quota';
    const { session } = await learner('quota');
    const { res, requestId } = await ask(session, question(3));
    expect((expectStatus(res, 200).body as KnowledgeAnswer).status).toBe('answered');
    expect((await ledgerOf(requestId)).map((r) => [r.provider, r.outcome])).toEqual([
      ['gemini', 'rate_limited'],
      ['groq', 'ok'],
    ]);
  });

  it('Gemini too slow: Groq answers within a deadline of its own', async () => {
    geminiMode = 'hang';
    const { session } = await learner('slow');
    const { res, requestId } = await ask(session, question(4));
    expect((expectStatus(res, 200).body as KnowledgeAnswer).status).toBe('answered');
    expect((await ledgerOf(requestId)).map((r) => [r.provider, r.outcome, r.fallback])).toEqual([
      ['gemini', 'timeout', false],
      ['groq', 'ok', true],
    ]);
  });

  it('Gemini refuses the key: Groq is never asked, and the answer fails cleanly', async () => {
    geminiMode = 'bad-key';
    const { session } = await learner('key');
    const { res, requestId } = await ask(session, question(5));
    expect(res.status).toBe(503);
    expect(problemCode(res)).toBe('knowledge_answer_unavailable');
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([1, 0]);
    expect((await ledgerOf(requestId)).map((r) => [r.provider, r.outcome])).toEqual([
      ['gemini', 'auth'],
    ]);
  });

  it('never reaches Groq for what the platform refuses first: a timed test, a credential, no evidence', async () => {
    geminiMode = 'unavailable';
    const { session } = await learner('refused');
    const spy = vi.spyOn(app.get(AttemptsService), 'hasOpenAttempt').mockResolvedValue(true);
    const timed = await ask(session, question(6));
    expect(timed.res.status).toBe(403);
    expect(problemCode(timed.res)).toBe('ai_not_allowed');
    spy.mockRestore();
    const credential = await ask(session, `${topic} why does ghp_${'B'.repeat(36)} fail?`);
    expect(credential.res.status).toBe(422);
    expect(problemCode(credential.res)).toBe('ai_restricted_content');
    const nothing = await ask(session, 'What will the weather be like in Chennai tomorrow?');
    expect((expectStatus(nothing.res, 200).body as KnowledgeAnswer).status).toBe(
      'insufficient_evidence',
    );
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([0, 0]);
  });

  it('holds Groq’s answer to the same checks: a citation of evidence it was not given is withheld', async () => {
    geminiMode = 'unavailable';
    groqMode = 'fabricate';
    const { session } = await learner('checked');
    const { res, requestId } = await ask(session, question(7));
    const answer = expectStatus(res, 200).body as KnowledgeAnswer;
    expect(answer.status).toBe('not_grounded');
    expect(answer.answer).not.toContain('[S9]');
    expect(answer.citations).toEqual([]);
    expect((await auditOf(requestId)).after).toMatchObject({ status: 'not_grounded', attempts: 2 });
    // Two attempts, each Gemini then Groq: bounded, and never another loop.
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([2, 2]);
  });

  it('lets Groq serve while Gemini’s model rests, without calling Gemini', async () => {
    for (let i = 0; i < 5; i += 1) circuits.circuitOf('gemini', MAIN).failed();
    const { session } = await learner('resting');
    const { res, requestId } = await ask(session, question(8));
    expect((expectStatus(res, 200).body as KnowledgeAnswer).status).toBe('answered');
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([0, 1]);
    expect((await auditOf(requestId)).after).toMatchObject({ provider: 'groq', fallback: true });
  });

  it('fails cleanly when Gemini fails and Groq rests, or fails too: one call each, no loop', async () => {
    geminiMode = 'unavailable';
    const { session } = await learner('both');
    for (let i = 0; i < 5; i += 1) circuits.circuitOf('groq', GROQ_MODEL).failed();
    const resting = await ask(session, question(9));
    expect(resting.res.status).toBe(503);
    expect(problemCode(resting.res)).toBe('knowledge_answer_unavailable');
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([1, 0]);
    circuits.circuitOf('groq', GROQ_MODEL).succeeded();
    calls.length = 0;
    groqMode = 'quota';
    const failing = await ask(session, question(10));
    expect(failing.res.status).toBe(503);
    expect(problemCode(failing.res)).toBe('knowledge_answer_unavailable');
    expect([answerCalls('gemini').length, answerCalls('groq').length]).toEqual([1, 1]);
    expect((await ledgerOf(failing.requestId)).map((r) => [r.provider, r.outcome])).toEqual([
      ['gemini', 'unavailable'],
      ['groq', 'rate_limited'],
    ]);
  });

  it('the assistant: Groq streams the answer when Gemini fails before writing, and is recorded as its writer', async () => {
    geminiMode = 'unavailable';
    const { session } = await learner('assistant');
    const id = (
      expectStatus(
        await session.post('/ai/conversations', { purpose: 'workspace', title: 'Loops' }),
        201,
      ).body as AiConversationSummary
    ).id;
    const res = await session.post(`/ai/conversations/${id}/messages`, {
      content: 'Explain loops, please.',
    });
    shown.push(res.text ?? '');
    expect(res.status).toBe(200);
    const events = parseEvents(res.text);
    expect(events.at(-1)!.data['status']).toBe('complete');
    const written = events
      .filter((e) => e.event === 'delta')
      .map((e) => String(e.data['text'] ?? ''))
      .join('');
    expect(written).toBe('Loops repeat a block of code.');
    const message = await prisma.aiMessage.findUniqueOrThrow({
      where: { id: events[0]!.data['assistantMessageId'] as string },
    });
    expect(message).toMatchObject({ provider: 'groq', model: GROQ_MODEL, status: 'complete' });
    const ledger = await prisma.aiRequest.findMany({
      where: { messageId: message.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(ledger.map((r) => [r.provider, r.model, r.outcome, r.fallback])).toEqual([
      ['gemini', MAIN, 'unavailable', false],
      ['groq', GROQ_MODEL, 'ok', true],
    ]);
  });

  it('keeps an answer open while its stand-in may still be writing: abandoned only past both deadlines', async () => {
    const { session, auth } = await learner('window');
    const id = (
      expectStatus(
        await session.post('/ai/conversations', { purpose: 'workspace', title: 'Window' }),
        201,
      ).body as AiConversationSummary
    ).id;
    const started = new Date(Date.now() - 5 * 60_000);
    const writing = await prisma.aiMessage.create({
      data: {
        conversationId: id,
        userId: auth.id,
        role: 'assistant',
        status: 'streaming',
        createdAt: started,
      },
    });
    const conversations = app.get(AiConversationsService);
    const at = (ms: number) => new Date(started.getTime() + ms);
    // AI_TIMEOUT_MS is 1000 here: past one model's deadline and the 30 seconds, not both models'.
    await conversations.closeAbandonedEverywhere(at(1_000 + 30_000 + 500));
    expect((await prisma.aiMessage.findUniqueOrThrow({ where: { id: writing.id } })).status).toBe(
      'streaming',
    );
    await conversations.closeAbandonedEverywhere(at(2 * 1_000 + 30_000 + 500));
    expect(await prisma.aiMessage.findUniqueOrThrow({ where: { id: writing.id } })).toMatchObject({
      status: 'failed',
      errorCode: 'interrupted',
    });
  });

  it('sends each key to its own provider’s header alone — never in an answer, the audit, the ledger, a message or a log line', async () => {
    expect(allCalls.filter((c) => c.provider === 'gemini').length).toBeGreaterThan(0);
    expect(allCalls.filter((c) => c.provider === 'groq').length).toBeGreaterThan(0);
    for (const call of allCalls) {
      const [own, other] =
        call.provider === 'gemini' ? [GEMINI_KEY, GROQ_KEY] : [GROQ_KEY, GEMINI_KEY];
      // In its own provider's header, and nowhere else in the call.
      if (call.provider === 'gemini') expect(call.headers.get('x-goog-api-key')).toBe(own);
      else expect(call.headers.get('authorization')).toBe(`Bearer ${own}`);
      expect(call.url).not.toContain(own);
      expect(call.body).not.toContain(own);
      expect(`${call.url}${call.body}${JSON.stringify([...call.headers])}`).not.toContain(other);
    }
    const audit = await prisma.auditLog.findMany({ where: { action: { startsWith: 'ai.' } } });
    const ledger = await prisma.aiRequest.findMany({});
    const messages = await prisma.aiMessage.findMany({});
    const everything = [
      ...shown,
      JSON.stringify(audit),
      JSON.stringify(ledger),
      JSON.stringify(messages),
      JSON.stringify(logged),
    ].join('\n');
    for (const key of [GEMINI_KEY, GROQ_KEY]) expect(everything).not.toContain(key);
    // Nor the providers' own words, which quoted the question.
    expect(everything).not.toContain('Overloaded while reading');
    expect(everything).not.toContain('Rate limit for');
  });
});
