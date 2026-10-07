import type { INestApplication } from '@nestjs/common';
import { inject } from 'vitest';
import {
  AI_FEATURE_FLAGS,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  AI_TASKS,
  SYSTEM_ROLES,
  type AiAgentRun,
  type AiConversationSummary,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
  type QuestionSummary,
} from '@lms/shared';
import { PrismaService } from '../../src/core/prisma/prisma.service.js';
import { FAKE_EMBEDDING_MODEL } from '../../src/modules/ai/providers/fake.provider.js';
import {
  AI_MODEL_REGISTRY,
  type AiModelSpec,
} from '../../src/modules/ai/routing/model-registry.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { createTestApp } from './app.js';
import { Session, expectStatus } from './http.js';
import { ScriptedAgentProvider } from './scripted-agent.provider.js';
import { TEST_ACCOUNTS } from './seed-users.js';

/**
 * The world the learning agent's learner-context suites run in (Phase 9C and 9E; ADR-0040): synthetic
 * learners and records only — no real learner's data is ever used.
 *
 * - A stand-in model approved for `public` and `course` only, as Groq is (ADR-0038): no request of
 *   the learner's own records may ever reach it.
 * - The deployment approves `personal` (AI_DATA_CLASSES), as a deployment would once the provider's
 *   data-use terms are recorded; a test narrows it through the institute's settings.
 * - A course of three modules — the third locked behind the second — with an open lesson, a lesson
 *   in progress, a lab lesson and, locked, a lesson and a lab lesson; a second course; a course whose
 *   only open module is optional, so its first required lesson is locked; labs whose hidden cases,
 *   reference solution, grader check, explanation, rubric and hints carry markers; an assignment
 *   overdue and one upcoming, with an answer key; a test window coming up, with instructions; a staff
 *   note; another learner's attempt; another institute's lab and attempt.
 */

/** Text that must never be sent to a model, given to a learner, streamed or recorded. */
export const MARKERS = {
  hiddenInput: 'HIDDENCASEMARKER',
  hiddenOutput: 'HIDDENOUTPUTMARKER',
  hiddenExplanation: 'HIDDENEXPLANATIONMARKER',
  hiddenLabel: 'HIDDENLABELMARKER',
  reference: 'REFERENCESOLUTIONMARKER',
  grader: 'GRADERCHECKMARKER',
  explanation: 'QUESTIONEXPLANATIONMARKER',
  rubric: 'RUBRICMARKER',
  hint: 'LABHINTMARKER',
  answerKey: 'ANSWERKEYMARKER',
  staffNote: 'STAFFNOTEMARKER',
  testInstructions: 'TESTINSTRUCTIONSMARKER',
  otherLearnerCode: 'OTHERLEARNERCODEMARKER',
  otherInstituteCode: 'OTHERINSTITUTECODEMARKER',
  lockedText: 'LOCKEDLESSONTEXTMARKER',
  programOutput: 'PROGRAMOUTPUTMARKER',
  draftCode: 'LABDRAFTMARKER',
} as const;

/** The stand-in: Groq-like, never approved for `personal` (ADR-0038). */
export const STANDIN = 'fake-groqlike';
export const AGENT_WORLD_MODELS: readonly AiModelSpec[] = [
  ...AI_MODEL_REGISTRY,
  {
    id: STANDIN,
    provider: 'fake',
    family: 'fake-standin',
    tasks: AI_TASKS,
    streaming: true,
    dataClasses: ['public', 'course'],
    contextTokens: 8192,
    outputTokens: 2048,
    fallback: true,
  },
];
export const AGENT_WORLD_ENV = {
  AI_PROVIDER: 'fake',
  AI_MODEL: 'fake-1',
  AI_FALLBACK_MODEL: STANDIN,
  AI_TIMEOUT_MS: '1500',
  AI_DATA_CLASSES: 'public,course,personal',
  AI_MODEL_COSTS: `fake-1=1/2,${STANDIN}=1/2,${FAKE_EMBEDDING_MODEL}=0.02/0`,
};
export const AGENT_WORLD_FLAGS = [
  AI_MODULE_FLAG,
  AI_FEATURE_FLAGS.agent,
  AI_KNOWLEDGE_FLAG,
] as const;

export const LESSON_TEXTS = {
  open: 'This lesson explains loop basics: a loop repeats its body while its condition holds.',
  counting: 'A counting loop runs a fixed number of times, from a start to an end value.',
  locked: `${MARKERS.lockedText} recursion calls a function from inside itself.`,
};

export interface WorldLearner {
  session: Session;
  userId: string;
  studentId: string;
  email: string;
}

export interface AgentWorld {
  app: INestApplication;
  prisma: PrismaService;
  provider: ScriptedAgentProvider;
  admin: Session;
  organizationId: string;
  unique: string;
  batchId: string;
  course: {
    id: string;
    title: string;
    open: string;
    counting: string;
    lab: string;
    locked: string;
    lockedLab: string;
  };
  secondCourse: { id: string; title: string; first: string };
  /** A course whose first module is optional: its first required lesson is locked (Phase 9C). */
  lockedCourse: { id: string; title: string; warmupA: string; warmupB: string; required: string };
  /** The lab the lab lesson opens: not in the catalogue. */
  lab: { id: string; slug: string; title: string };
  /** A lab in the catalogue. */
  catalogueLab: { id: string; slug: string; title: string };
  /** A lab opened only by the locked lab lesson. */
  lockedLab: { id: string };
  assignments: { overdue: string; upcoming: string };
  test: { title: string };
  otherInstitute: { organizationId: string; labId: string; lessonId: string };
  other: WorldLearner;
  setFlag: (key: string, enabled: boolean) => Promise<void>;
  learner: (
    label: string,
    options?: {
      courses?: string[];
      without?: string[];
      batch?: boolean;
      completed?: string[];
      inProgress?: string[];
      progressPct?: number;
    },
  ) => Promise<WorldLearner>;
  agentConversation: (
    session: Session,
    context?: { courseId?: string; lessonId?: string; questionId?: string },
  ) => Promise<AiConversationSummary>;
  runOf: (
    session: Session,
    conversationId: string,
    content: string,
    stream?: boolean,
  ) => ReturnType<Session['post']>;
  ran: (session: Session, conversationId: string, content: string) => Promise<AiAgentRun>;
  /** A submission of the learner's own at the lab lesson, as the workspace sends it. */
  submitLab: (learner: WorldLearner, code: string) => Promise<void>;
  /** A failed attempt of the learner's own, written as the sandbox records one (Phase 7F). */
  failedAttempt: (
    userId: string,
    questionId: string,
    code: string,
    detail?: unknown,
  ) => Promise<void>;
  sentSince: (mark: number) => string;
  close: () => Promise<void>;
}

/** The world, built once per suite: its app, its records and its helpers. */
export async function buildAgentWorld(name: string): Promise<AgentWorld> {
  Object.assign(process.env, AGENT_WORLD_ENV);
  const provider = new ScriptedAgentProvider();
  const app = await createTestApp({ aiProvider: provider, aiModels: AGENT_WORLD_MODELS });
  const prisma = app.get(PrismaService);
  const password = inject('password');
  const unique = `${name}${String(Date.now()).slice(-6)}`;
  let counter = 0;
  const organizationId = (
    await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
  ).organizationId;
  const admin = new Session(app);
  expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
  const setFlag = async (key: string, enabled: boolean) => {
    expectStatus(await admin.patch(`/flags/${key}`, { enabled }), 200);
  };
  for (const key of AGENT_WORLD_FLAGS) await setFlag(key, true);

  // ── labs ──
  async function labQuestion(label: string, inPractice: boolean, org = organizationId) {
    counter += 1;
    const question = await prisma.question.create({
      data: {
        organizationId: org,
        slug: `ai9c-${label}-${counter}-${unique}`,
        title: `Sum two numbers ${label}`,
        body: '<p>Read two integers and print their sum.</p>',
        type: 'coding',
        status: 'published',
        inPractice,
        validation: { ok: true },
        explanation: MARKERS.explanation,
        rubric: MARKERS.rubric,
        hints: [MARKERS.hint],
      },
    });
    await prisma.codingProblem.create({
      data: {
        questionId: question.id,
        languages: ['python'],
        referenceSolution: { python: `print(${MARKERS.reference})` },
        sqlCheck: MARKERS.grader,
        inputFormat: 'Two integers on one line.',
        outputFormat: 'Their sum.',
        testCases: {
          create: [
            {
              input: '1 2',
              expectedOutput: '3',
              isSample: true,
              position: 0,
              label: 'Two small numbers',
            },
            {
              input: MARKERS.hiddenInput,
              expectedOutput: MARKERS.hiddenOutput,
              explanation: MARKERS.hiddenExplanation,
              label: MARKERS.hiddenLabel,
              position: 1,
            },
          ],
        },
      },
    });
    return question;
  }
  const lab = await labQuestion('lesson', false);
  const catalogueLab = await labQuestion('catalogue', true);
  const lockedLab = await labQuestion('locked', false);

  // ── courses ──
  const courseTitle = `Agent context course ${unique}`;
  const course = await prisma.course.create({
    data: {
      organizationId,
      slug: `ai9c-course-${unique}`,
      title: courseTitle,
      status: 'published',
      modules: {
        create: [
          {
            title: 'Loop basics',
            position: 0,
            lessons: {
              create: [
                {
                  title: `Loop basics ${unique}`,
                  type: 'article',
                  position: 0,
                  content: { html: `<p>${LESSON_TEXTS.open}</p>` },
                },
                {
                  title: 'Counting loops',
                  type: 'article',
                  position: 1,
                  content: { html: `<p>${LESSON_TEXTS.counting}</p>` },
                },
                {
                  title: 'Sum lab',
                  type: 'lab',
                  position: 2,
                  completionRule: 'pass',
                  content: { html: '', questionId: lab.id },
                },
              ],
            },
          },
          {
            title: 'Recursion',
            position: 1,
            unlockRule: { type: 'after_previous', minPercent: 100 },
            lessons: {
              create: [
                {
                  title: 'Recursion basics',
                  type: 'article',
                  position: 0,
                  content: { html: `<p>${LESSON_TEXTS.locked}</p>` },
                },
                {
                  title: 'Recursion lab',
                  type: 'lab',
                  position: 1,
                  completionRule: 'pass',
                  content: { html: '', questionId: lockedLab.id },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' } } },
      },
    },
  });
  const [basics, recursion] = course.modules;
  const secondTitle = `Second course ${unique}`;
  const second = await prisma.course.create({
    data: {
      organizationId,
      slug: `ai9c-second-${unique}`,
      title: secondTitle,
      status: 'published',
      modules: {
        create: [
          {
            title: 'Select',
            position: 0,
            lessons: {
              create: [
                {
                  title: 'Selecting rows',
                  type: 'article',
                  position: 0,
                  content: { html: '<p>x</p>' },
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });
  const lockedTitle = `Warm-up course ${unique}`;
  const locked = await prisma.course.create({
    data: {
      organizationId,
      slug: `ai9c-warmup-${unique}`,
      title: lockedTitle,
      status: 'published',
      modules: {
        create: [
          {
            title: 'Warm-up',
            position: 0,
            lessons: {
              create: [
                {
                  title: 'Warm-up A',
                  type: 'article',
                  position: 0,
                  isMandatory: false,
                  content: { html: '<p>a</p>' },
                },
                {
                  title: 'Warm-up B',
                  type: 'article',
                  position: 1,
                  isMandatory: false,
                  content: { html: '<p>b</p>' },
                },
              ],
            },
          },
          {
            title: 'Core',
            position: 1,
            unlockRule: { type: 'after_previous', minPercent: 100 },
            lessons: {
              create: [
                {
                  title: 'Required core lesson',
                  type: 'article',
                  position: 0,
                  content: { html: `<p>${MARKERS.lockedText} core.</p>` },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' } } },
      },
    },
  });

  // ── a batch, its assignments and a test window ──
  const programId = (
    expectStatus(
      await admin.post('/programs', {
        code: `AI9C-${unique}`.toUpperCase().slice(0, 30),
        name: `Agent context ${unique}`,
        durationWeeks: 12,
      }),
      201,
    ).body as { id: string }
  ).id;
  const batchId = (
    expectStatus(
      await admin.post('/batches', {
        programId,
        code: `AI9C-${unique}-B`.toUpperCase().slice(0, 30),
        name: 'Agent context batch',
        startDate: '2026-01-05',
        endDate: '2026-12-18',
      }),
      201,
    ).body as { id: string }
  ).id;
  const question = expectStatus(
    await admin.post('/questions', {
      title: `Agent check ${unique}`,
      body: 'Pick the true one.',
      type: 'mcq_single',
      subject: 'javascript',
      difficulty: 'easy',
      marks: 1,
      explanation: MARKERS.explanation,
      options: [
        { body: `${MARKERS.answerKey} true`, isCorrect: true },
        { body: 'False', isCorrect: false },
      ],
    }),
    201,
  ).body as QuestionSummary;
  expectStatus(await admin.post(`/questions/${question.id}/status`, { status: 'published' }), 201);
  const HOUR = 3_600_000;
  async function assignment(title: string, opensIn: number, dueIn: number) {
    const created = expectStatus(
      await admin.post('/assignments', {
        title,
        subject: 'javascript',
        difficulty: 'beginner',
        kind: 'mixed',
        settings: { duePolicy: 'allow_late' },
      }),
      201,
    ).body as { id: string };
    expectStatus(
      await admin.put(`/assignments/${created.id}/structure`, {
        modules: [
          {
            title: 'Only',
            unlockRule: { type: 'always' },
            questions: [{ questionId: question.id }],
          },
        ],
      }),
      200,
    );
    expectStatus(
      await admin.post(`/assignments/${created.id}/publish`, {
        batchId,
        opensAt: new Date(Date.now() + opensIn * HOUR).toISOString(),
        dueAt: new Date(Date.now() + dueIn * HOUR).toISOString(),
      }),
      201,
    );
    return created.id;
  }
  const overdue = await assignment(`Overdue arrays ${unique}`, -72, -24);
  const upcoming = await assignment(`Upcoming strings ${unique}`, 48, 96);
  const testTitle = `Java checkpoint ${unique}`;
  const test = await prisma.test.create({
    data: {
      organizationId,
      title: testTitle,
      status: 'published',
      instructions: MARKERS.testInstructions,
      settings: { durationMinutes: 30, maxAttempts: 1 },
    },
  });
  await prisma.testSchedule.create({
    data: {
      testId: test.id,
      batchId,
      opensAt: new Date(Date.now() + 48 * HOUR),
      closesAt: new Date(Date.now() + 72 * HOUR),
    },
  });

  // ── another institute ──
  const otherOrg = await prisma.organization.create({
    data: { name: `Other institute ${unique}`, key: `ai9c-other-${unique}` },
  });
  const otherLab = await labQuestion('elsewhere', true, otherOrg.id);
  const otherCourse = await prisma.course.create({
    data: {
      organizationId: otherOrg.id,
      slug: `ai9c-elsewhere-${unique}`,
      title: `Elsewhere ${unique}`,
      status: 'published',
      modules: {
        create: [
          {
            title: 'Only',
            position: 0,
            lessons: {
              create: [
                {
                  title: 'Elsewhere lab',
                  type: 'lab',
                  position: 0,
                  content: { html: '', questionId: otherLab.id },
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  async function failedAttempt(userId: string, questionId: string, code: string, detail?: unknown) {
    await prisma.executionRun.create({
      data: {
        questionId,
        userId,
        context: 'practice',
        language: 'python',
        code,
        driver: 'runner',
        trust: 'trusted',
        verdict: 'wrong_answer',
        passedCount: 1,
        totalCount: 2,
        ...(detail === undefined ? {} : { detail: detail as object }),
      },
    });
  }

  const learner: AgentWorld['learner'] = async (label, options = {}) => {
    counter += 1;
    const student = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
      include: { permissions: { include: { permission: true } } },
    });
    let roleId = student.id;
    const without = options.without ?? [];
    if (without.length > 0) {
      roleId = (
        await prisma.role.create({
          data: {
            organizationId,
            key: `ai9c_${label}_${counter}_${unique}`,
            name: `Agent context ${label} ${counter}`,
            permissions: {
              create: student.permissions
                .filter((grant) => !without.includes(grant.permission.key))
                .map((grant) => ({ permissionId: grant.permissionId, scope: grant.scope })),
            },
          },
        })
      ).id;
    }
    const email = `ai9c-${label}-${counter}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 9C ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId }] },
        studentProfile: {
          create: { studentCode: `STU-AI9C-${counter}-${unique}`, status: 'active' },
        },
      },
      include: { studentProfile: true },
    });
    const studentId = user.studentProfile!.id;
    for (const courseId of options.courses ?? [course.id]) {
      await prisma.enrollment.create({
        data: {
          studentId,
          courseId,
          progressPct: courseId === course.id ? (options.progressPct ?? 0) : 0,
        },
      });
    }
    if (options.batch !== false) {
      await prisma.batchMember.create({ data: { batchId, studentId } });
    }
    for (const lessonId of options.completed ?? []) {
      await prisma.lessonProgress.create({
        data: {
          studentId,
          lessonId,
          status: 'completed',
          completedAt: new Date(),
          watchedPct: 100,
        },
      });
    }
    for (const lessonId of options.inProgress ?? []) {
      await prisma.lessonProgress.create({ data: { studentId, lessonId, status: 'in_progress' } });
    }
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return { session, userId: user.id, studentId, email };
  };

  // Another learner of the same course, with their own progress and attempt.
  const other = await learner('other', {
    completed: [basics!.lessons[0]!.id, basics!.lessons[1]!.id],
    progressPct: 50,
  });
  await failedAttempt(other.userId, lab.id, `print(${MARKERS.otherLearnerCode})`);
  await prisma.studentNote.create({
    data: {
      studentId: other.studentId,
      authorId: (
        await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
      ).id,
      text: MARKERS.staffNote,
    },
  });
  // Another institute's learner, with an attempt at its lab.
  const elsewhereUser = await prisma.user.create({
    data: {
      organizationId: otherOrg.id,
      email: `ai9c-elsewhere-${unique}@test.local`,
      name: 'Elsewhere',
      passwordHash: await hashPassword(password),
      status: 'active',
      studentProfile: { create: { studentCode: `STU-AI9C-X-${unique}`, status: 'active' } },
    },
  });
  await failedAttempt(elsewhereUser.id, otherLab.id, `print(${MARKERS.otherInstituteCode})`);

  // Course knowledge about loops, through the platform's own path.
  counter += 1;
  const source = expectStatus(
    await admin.post('/ai/knowledge/sources', {
      name: `Agent context ${counter}`,
      type: 'authored',
      audience: 'course',
      dataClass: 'course',
      courseId: course.id,
    }),
    201,
  ).body as KnowledgeSourceView;
  const documentId = (
    expectStatus(
      await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
        title: `Loop notes ${unique}`,
        canonicalRef: `authored:ai9c-${unique}`,
      }),
      201,
    ).body as { id: string }
  ).id;
  const version = expectStatus(
    await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
      content: `Loop notes ${unique}: a loop that never changes its condition runs forever. Learners who struggle with loops should trace each pass on paper.`,
      format: 'markdown',
    }),
    201,
  ).body as KnowledgeVersionView;
  expectStatus(await admin.post(`/ai/knowledge/versions/${version.id}/ingest`), 202);
  expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
  expectStatus(await admin.post(`/ai/knowledge/versions/${version.id}/embed`), 202);

  const agentConversation: AgentWorld['agentConversation'] = async (session, context) =>
    expectStatus(
      await session.post('/ai/conversations', {
        purpose: 'agent',
        ...(context ? { context } : {}),
      }),
      201,
    ).body as AiConversationSummary;
  const runOf: AgentWorld['runOf'] = (session, conversationId, content, stream = false) =>
    session.post(`/ai/agent/conversations/${conversationId}/runs${stream ? '' : '?stream=false'}`, {
      content,
    });

  return {
    app,
    prisma,
    provider,
    admin,
    organizationId,
    unique,
    batchId,
    course: {
      id: course.id,
      title: courseTitle,
      open: basics!.lessons[0]!.id,
      counting: basics!.lessons[1]!.id,
      lab: basics!.lessons[2]!.id,
      locked: recursion!.lessons[0]!.id,
      lockedLab: recursion!.lessons[1]!.id,
    },
    secondCourse: { id: second.id, title: secondTitle, first: second.modules[0]!.lessons[0]!.id },
    lockedCourse: {
      id: locked.id,
      title: lockedTitle,
      warmupA: locked.modules[0]!.lessons[0]!.id,
      warmupB: locked.modules[0]!.lessons[1]!.id,
      required: locked.modules[1]!.lessons[0]!.id,
    },
    lab: { id: lab.id, slug: lab.slug, title: lab.title },
    catalogueLab: { id: catalogueLab.id, slug: catalogueLab.slug, title: catalogueLab.title },
    lockedLab: { id: lockedLab.id },
    assignments: { overdue, upcoming },
    test: { title: testTitle },
    otherInstitute: {
      organizationId: otherOrg.id,
      labId: otherLab.id,
      lessonId: otherCourse.modules[0]!.lessons[0]!.id,
    },
    other,
    setFlag,
    learner,
    agentConversation,
    runOf,
    ran: async (session, conversationId, content) =>
      expectStatus(await runOf(session, conversationId, content), 200).body as AiAgentRun,
    submitLab: async (who, code) => {
      expectStatus(
        await who.session.post(`/lessons/${course.modules[0]!.lessons[2]!.id}/lab/submissions`, {
          language: 'python',
          code,
        }),
        201,
      );
    },
    failedAttempt,
    sentSince: (mark) =>
      provider.requests
        .slice(mark)
        .flatMap((r) => r.messages.map((m) => m.content))
        .join('\n'),
    close: async () => {
      // The institute's AI settings back to the deployment's (no stored row), as the next spec expects.
      await prisma.setting.deleteMany({ where: { organizationId, key: 'ai' } });
      for (const key of AGENT_WORLD_FLAGS) await setFlag(key, false);
      await app.close();
      for (const key of Object.keys(AGENT_WORLD_ENV)) delete process.env[key];
    },
  };
}
