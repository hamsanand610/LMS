/**
 * Assessment sample data: SI Academy's question bank (prisma/seed/content), the assignments built
 * from it and given to batches and named learners, tests at different points in their life, and
 * a batch's worth of answers — objective answers marked, written work reviewed, projects waiting.
 *
 * Nothing here runs code (ADR-0007). A coding or SQL question is published as validated, and a
 * learner's run of it is recorded, only from the outcomes the verification suite produced by
 * running exactly that code in the sandbox (content/verified-runs.json). Where there is no current
 * verification the question stays a draft and no run is invented.
 *
 * Idempotent: questions are matched by slug, assignments and tests by title, answers by learner and
 * question; anything that exists is left alone.
 */
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { HAND_IN_APPROVALS, HAND_IN_NOTES, WRITTEN_ANSWERS } from './content/answers.js';
import {
  ASSIGNMENTS,
  BANK,
  runSettings,
  TECHNOLOGY_TERMS,
  TOPIC_TERMS,
  type AssignmentPlan,
  type BankQuestion,
} from './content/index.js';
import type { Case } from './content/types.js';
import {
  currentVerification,
  loadVerifiedRuns,
  type VerifiedQuestion,
} from './content/verified.js';
import { seedEmail } from './seed-identity.js';

export interface AssessmentSeedResult {
  questions: number;
  coding: number;
  unverified: number;
  assignments: number;
  publications: number;
  tests: number;
  schedules: number;
  attempts: number;
  submissions: number;
  reviews: number;
}

const DAY = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

/** A time of day in India, `offsetDays` from today. */
function istAt(offsetDays: number, hour: number, minute = 0): Date {
  const now = Date.now();
  const ist = new Date(now + IST_OFFSET_MS);
  const midnight =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  return new Date(midnight + offsetDays * DAY + (hour * 60 + minute) * 60_000);
}

/** A stable number in [0, 1) for a key, so the sample data is the same on every run. */
function chance(key: string): number {
  return createHash('sha256').update(key).digest().readUInt32BE(0) / 2 ** 32;
}

/** Which seeded account wrote questions on each technology. */
const AUTHOR_BY_TECHNOLOGY: Record<string, string> = {
  'core-java': 'trainer1',
  dsa: 'trainer1',
  git: 'trainer1',
  'spring-boot': 'trainer2',
  hibernate: 'trainer2',
  'rest-apis': 'trainer2',
  testing: 'trainer2',
  deployment: 'trainer2',
  'ai-assisted-development': 'trainer2',
  sql: 'trainer3',
  html: 'trainer4',
  css: 'trainer4',
  javascript: 'trainer5',
  php: 'trainer5',
  programming: 'trainer6',
  python: 'trainer6',
  aptitude: 'placement',
  career: 'placement',
};

type Behaviour = 'diligent' | 'steady' | 'struggling' | 'quiet';

/**
 * How a seeded learner works. Batch 1 has a few who finish everything, most who keep up, three
 * who struggle and five who have gone quiet; the completed batch mostly finished.
 */
function behaviourOf(local: string): Behaviour {
  const n = Number(local.replace('student', ''));
  if ([1, 2, 3, 6, 10].includes(n)) return 'diligent';
  if ([13, 14, 15].includes(n)) return 'struggling';
  if (n >= 16 && n <= 20) return 'quiet';
  if (n >= 41) return n % 4 === 0 ? 'steady' : 'diligent';
  return 'steady';
}

const OBJECTIVE = new Set(['mcq_single', 'mcq_multi', 'true_false']);
const HAND_IN = new Set(['file_upload', 'practical', 'project']);

export async function seedAssessment(
  prisma: PrismaClient,
  organization: { id: string },
  lookup: {
    batchIdByCode: Map<string, string>;
    adminUserId: string | null;
    trainerUserIdByEmail: Map<string, string>;
  },
): Promise<AssessmentSeedResult> {
  const result: AssessmentSeedResult = {
    questions: 0,
    coding: 0,
    unverified: 0,
    assignments: 0,
    publications: 0,
    tests: 0,
    schedules: 0,
    attempts: 0,
    submissions: 0,
    reviews: 0,
  };

  const users = await prisma.user.findMany({
    where: { organizationId: organization.id, email: { endsWith: seedEmail('') } },
    select: { id: true, email: true, studentProfile: { select: { id: true, studentCode: true } } },
  });
  const userByLocal = new Map(users.map((u) => [u.email.split('@')[0]!, u]));
  const userIdOf = (local: string) => userByLocal.get(local)?.id ?? lookup.adminUserId;

  // ───────────────── taxonomy: the technologies and topics the bank uses ─────────────────
  for (const [taxonomy, terms] of [
    ['subject', TECHNOLOGY_TERMS],
    ['topic', TOPIC_TERMS],
  ] as const) {
    const count = await prisma.taxonomyTerm.count({
      where: { organizationId: organization.id, taxonomy },
    });
    for (const [index, term] of terms.entries()) {
      await prisma.taxonomyTerm.upsert({
        where: {
          organizationId_taxonomy_key: { organizationId: organization.id, taxonomy, key: term.key },
        },
        create: {
          organizationId: organization.id,
          taxonomy,
          key: term.key,
          label: term.label,
          position: count + index,
        },
        update: {},
      });
    }
  }

  // ───────────────── the question bank ─────────────────
  const verifiedRuns = loadVerifiedRuns();
  const verificationBySlug = new Map<string, VerifiedQuestion>();
  const questionBySlug = new Map<
    string,
    { id: string; marks: number; status: string; plan: BankQuestion }
  >();

  for (const plan of BANK) {
    const executed = plan.type === 'coding' || plan.type === 'sql';
    const verification = executed ? currentVerification(verifiedRuns, plan) : null;
    if (verification) verificationBySlug.set(plan.slug, verification);

    const existing = await prisma.question.findUnique({ where: { slug: plan.slug } });
    if (existing) {
      questionBySlug.set(plan.slug, {
        id: existing.id,
        marks: existing.marks,
        status: existing.status,
        plan,
      });
      result.questions += 1;
      if (executed) result.coding += 1;
      continue;
    }

    const status = executed && !verification ? 'draft' : 'published';
    if (executed && !verification) result.unverified += 1;
    const options: [string, boolean, string][] =
      plan.type === 'true_false'
        ? [
            ['True', plan.answer, ''],
            ['False', !plan.answer, ''],
          ]
        : plan.type === 'mcq_single' || plan.type === 'mcq_multi'
          ? plan.options.map(([body, correct, why]) => [body, correct, why ?? ''])
          : [];
    const settings = executed ? runSettings(plan) : null;

    const question = await prisma.question.create({
      data: {
        organizationId: organization.id,
        slug: plan.slug,
        title: plan.title,
        body: plan.body,
        type: plan.type,
        subject: plan.technology,
        topic: plan.topic,
        difficulty: plan.level,
        marks: plan.marks,
        explanation: plan.explanation ?? '',
        rubric:
          plan.type === 'descriptive' || HAND_IN.has(plan.type)
            ? (plan as { rubric: string }).rubric
            : '',
        hints: plan.hints ?? [],
        tags: plan.tags ?? [],
        spec: HAND_IN.has(plan.type)
          ? (plan as { spec: object }).spec
          : { fileKinds: [], maxFiles: 0, linkRequired: false, linkLabel: '', checklist: [] },
        status,
        authorId: userIdOf(AUTHOR_BY_TECHNOLOGY[plan.technology] ?? 'admin'),
        inPractice: executed && status === 'published' && (plan.practicePoints ?? 0) > 0,
        practicePoints: executed ? (plan.practicePoints ?? 10) : 10,
        ...(verification && settings
          ? {
              validation: {
                ok: true,
                driver: verifiedRuns!.driver,
                trust: 'trusted',
                languages: settings.languages.map((language) => ({
                  language,
                  ok: true,
                  passed: verification.languages[language]!.solution.passed,
                  total: verification.languages[language]!.solution.total,
                  message: 'The reference solution passes every case',
                })),
                validatedAt: verifiedRuns!.generatedAt,
              },
            }
          : {}),
        options: {
          create: options.map(([body, isCorrect, explanation], position) => ({
            body,
            isCorrect,
            explanation,
            position,
          })),
        },
        ...(settings
          ? {
              coding: {
                create: {
                  languages: settings.languages,
                  starterCode: settings.starterCode,
                  referenceSolution: settings.referenceSolution,
                  timeLimitMs: settings.timeLimitMs,
                  memoryLimitMb: settings.memoryLimitMb,
                  inputFormat: plan.type === 'coding' ? plan.inputFormat : '',
                  outputFormat: plan.type === 'coding' ? plan.outputFormat : '',
                  constraints: plan.type === 'coding' ? plan.constraints : '',
                  compareMode: settings.compareMode,
                  setupSql: settings.setupSql,
                  sqlCheck: settings.sqlCheck,
                  testCases: {
                    create: (plan as { cases: Case[] }).cases.map((c, position) => ({
                      input: c.input,
                      expectedOutput: c.expected,
                      isSample: c.sample ?? false,
                      weight: c.weight ?? 1,
                      label: c.label ?? '',
                      explanation: c.explanation ?? '',
                      enabled: true,
                      position,
                    })),
                  },
                },
              },
            }
          : {}),
      },
    });
    questionBySlug.set(plan.slug, { id: question.id, marks: question.marks, status, plan });
    result.questions += 1;
    if (executed) result.coding += 1;
  }

  // The options each objective question offers, so seeded answers name real choices.
  const optionRows = await prisma.questionOption.findMany({
    where: {
      questionId: {
        in: [...questionBySlug.values()].filter((q) => OBJECTIVE.has(q.plan.type)).map((q) => q.id),
      },
    },
    orderBy: { position: 'asc' },
    select: { id: true, questionId: true, isCorrect: true },
  });
  const optionsByQuestion = new Map<string, { correct: string[]; wrong: string[] }>();
  for (const row of optionRows) {
    const entry = optionsByQuestion.get(row.questionId) ?? { correct: [], wrong: [] };
    (row.isCorrect ? entry.correct : entry.wrong).push(row.id);
    optionsByQuestion.set(row.questionId, entry);
  }

  // ───────────────── assignments ─────────────────
  const program = await prisma.program.findUnique({ where: { code: 'JFS' }, select: { id: true } });
  const courses = await prisma.course.findMany({
    where: { organizationId: organization.id },
    select: { id: true, slug: true, modules: { select: { id: true, title: true } } },
  });
  const courseBySlug = new Map(courses.map((c) => [c.slug, c]));

  interface Placed {
    id: string;
    marks: number;
    slug: string;
    moduleIndex: number;
  }
  const placedByAssignment = new Map<string, { plan: AssignmentPlan; placed: Placed[][] }>();

  for (const plan of ASSIGNMENTS) {
    const authorId = userIdOf(plan.author);
    let assignment = await prisma.assignment.findFirst({
      where: { organizationId: organization.id, title: plan.title, deletedAt: null },
    });
    if (!assignment) {
      const course = plan.course ? courseBySlug.get(plan.course) : undefined;
      assignment = await prisma.assignment.create({
        data: {
          organizationId: organization.id,
          title: plan.title,
          description: plan.description,
          instructions: plan.instructions,
          subject: plan.technology,
          difficulty: plan.level,
          kind: plan.kind,
          courseId: course?.id ?? null,
          programId: program?.id ?? null,
          estimatedMinutes: plan.estimatedMinutes,
          passPercent: plan.passPercent,
          status: plan.audiences.length > 0 ? 'published' : 'draft',
          settings: plan.settings,
          createdById: authorId,
        },
      });
      let position = 0;
      for (const modulePlan of plan.modules) {
        // Only questions that are ready go in; an unverified coding question waits for its author.
        const questions = modulePlan.questions
          .map((slug) => questionBySlug.get(slug))
          .filter((q): q is NonNullable<typeof q> => q !== undefined && q.status === 'published');
        if (questions.length === 0) continue;
        const courseModuleId = modulePlan.courseModule
          ? (course?.modules.find((m) => m.title === modulePlan.courseModule)?.id ?? null)
          : null;
        await prisma.assignmentModule.create({
          data: {
            assignmentId: assignment.id,
            title: modulePlan.title,
            description: modulePlan.description,
            topic: modulePlan.topic,
            courseModuleId,
            dueAfterDays: modulePlan.dueAfterDays ?? null,
            position,
            unlockRule: modulePlan.gatedAt
              ? { type: 'after_previous', minPercent: modulePlan.gatedAt }
              : { type: 'always' },
            questions: {
              create: questions.map((q, index) => ({
                questionId: q.id,
                marks: q.marks,
                position: index,
              })),
            },
          },
        });
        position += 1;
      }
      for (const [index, resource] of plan.resources.entries()) {
        await prisma.assignmentResource.create({
          data: {
            assignmentId: assignment.id,
            title: resource.title,
            url: resource.url,
            position: index,
          },
        });
      }
    }
    result.assignments += 1;

    const modules = await prisma.assignmentModule.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { position: 'asc' },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { question: { select: { slug: true } } },
        },
      },
    });
    placedByAssignment.set(assignment.id, {
      plan,
      placed: modules.map((m, moduleIndex) =>
        m.questions.map((q) => ({ id: q.id, marks: q.marks, slug: q.question.slug, moduleIndex })),
      ),
    });

    // Who has it, and when.
    for (const audience of plan.audiences) {
      const opensAt = istAt(audience.opensInDays, 9);
      const dueAt = audience.dueInDays === null ? null : istAt(audience.dueInDays, 23, 59);
      const closesAt = audience.closesInDays == null ? null : istAt(audience.closesInDays, 23, 59);
      const publishedAt =
        audience.opensInDays <= 0
          ? new Date(opensAt.getTime() - DAY)
          : new Date(Date.now() - 3_600_000);
      const targets: { batchId: string | null; studentId: string | null }[] = [];
      if (audience.batch) {
        const batchId = lookup.batchIdByCode.get(audience.batch);
        if (batchId) targets.push({ batchId, studentId: null });
      }
      for (const local of audience.students ?? []) {
        const studentId = userByLocal.get(local)?.studentProfile?.id;
        if (studentId) targets.push({ batchId: null, studentId });
      }
      for (const target of targets) {
        const live = await prisma.assignmentPublication.findFirst({
          where: {
            assignmentId: assignment.id,
            batchId: target.batchId,
            studentId: target.studentId,
            withdrawnAt: null,
          },
        });
        if (!live) {
          await prisma.assignmentPublication.create({
            data: {
              assignmentId: assignment.id,
              batchId: target.batchId,
              studentId: target.studentId,
              opensAt,
              dueAt,
              closesAt,
              note: audience.note ?? '',
              publishedById: authorId,
              publishedAt,
            },
          });
        }
        result.publications += 1;
      }
    }
  }

  // ───────────────── learners' answers ─────────────────
  await seedAnswers(prisma, {
    assignments: placedByAssignment,
    questionBySlug,
    verificationBySlug,
    optionsByQuestion,
    batchIdByCode: lookup.batchIdByCode,
    userByLocal,
    userIdOf,
    result,
  });

  // ───────────────── tests ─────────────────
  await seedTests(prisma, organization, lookup, result);

  return result;
}

interface AnswerContext {
  assignments: Map<
    string,
    {
      plan: AssignmentPlan;
      placed: { id: string; marks: number; slug: string; moduleIndex: number }[][];
    }
  >;
  questionBySlug: Map<string, { id: string; marks: number; status: string; plan: BankQuestion }>;
  verificationBySlug: Map<string, VerifiedQuestion>;
  optionsByQuestion: Map<string, { correct: string[]; wrong: string[] }>;
  batchIdByCode: Map<string, string>;
  userByLocal: Map<
    string,
    { id: string; email: string; studentProfile: { id: string; studentCode: string } | null }
  >;
  userIdOf: (local: string) => string | null;
  result: AssessmentSeedResult;
}

/**
 * Answers from the learners an assignment has reached, shaped by how each of them works: what
 * they attempted, in which order, how often they got it right first time, and what their reviewers
 * decided. Every mark follows the platform's own rules (objective answers marked by the options,
 * code by the recorded sandbox outcome, written work by a reviewer).
 */
async function seedAnswers(prisma: PrismaClient, ctx: AnswerContext): Promise<void> {
  const now = Date.now();
  for (const [assignmentId, { plan, placed }] of ctx.assignments) {
    if (placed.length === 0) continue;
    const reviewerId = ctx.userIdOf(plan.author);
    for (const audience of plan.audiences) {
      if (audience.opensInDays > 0) continue;
      const opensAt = istAt(audience.opensInDays, 9).getTime();
      const dueAt =
        audience.dueInDays === null ? null : istAt(audience.dueInDays, 23, 59).getTime();
      const closesAt =
        audience.closesInDays == null ? null : istAt(audience.closesInDays, 23, 59).getTime();
      const lastMoment = Math.min(now - 30 * 60_000, closesAt ?? Number.POSITIVE_INFINITY);
      const daysOpen = (lastMoment - opensAt) / DAY;
      // Opened only this morning (or later today): nobody has answered yet.
      if (daysOpen < 0.1) continue;

      const locals: string[] = [];
      if (audience.batch) {
        const batchId = ctx.batchIdByCode.get(audience.batch);
        if (!batchId) continue;
        const members = await prisma.batchMember.findMany({
          where: { batchId, isActive: true },
          select: { student: { select: { user: { select: { email: true } } } } },
        });
        locals.push(...members.map((m) => m.student.user.email.split('@')[0]!));
      }
      locals.push(...(audience.students ?? []));

      for (const local of locals) {
        const learner = ctx.userByLocal.get(local)?.studentProfile;
        if (!learner) continue;
        const behaviour = behaviourOf(local);
        if (behaviour === 'quiet') continue;
        const already = await prisma.submission.count({
          where: { assignmentId, studentId: learner.id },
        });
        if (already > 0) continue;

        const rows: Prisma.SubmissionCreateManyInput[] = [];
        const reviews: {
          key: string;
          decision: 'graded' | 'approved' | 'resubmission_requested';
          marks: number | null;
          comment: string;
          at: Date;
        }[] = [];
        const workDays = behaviour === 'diligent' ? 0.8 : behaviour === 'steady' ? 1.4 : 2.2;
        let step = 0;
        // Modules are opened in order; a gated module needs its predecessor's share of solved questions.
        let previousShare = 1;
        for (const [moduleIndex, questions] of placed.entries()) {
          const gate = plan.modules[moduleIndex]?.gatedAt ?? 0;
          if (moduleIndex > 0 && previousShare * 100 < gate) break;
          let solved = 0;
          for (const [index, placement] of questions.entries()) {
            const key = `${local}:${placement.slug}`;
            const attemptQuestion =
              behaviour === 'diligent'
                ? daysOpen > 2 || moduleIndex === 0
                : behaviour === 'steady'
                  ? moduleIndex === 0
                    ? daysOpen > 1 || index < questions.length / 2
                    : moduleIndex === 1 && daysOpen > 3 && chance(`${key}:try`) < 0.6
                  : moduleIndex === 0 && chance(`${key}:try`) < 0.5;
            if (!attemptQuestion) continue;

            step += 1;
            const at = (offsetSteps: number) => {
              const planned =
                opensAt +
                (step + offsetSteps) * workDays * 0.45 * DAY +
                chance(`${key}:minute`) * 5 * 3_600_000;
              const latest =
                dueAt !== null && behaviour === 'diligent'
                  ? Math.min(lastMoment, dueAt - 3_600_000)
                  : lastMoment;
              return new Date(Math.min(planned, latest - (3 - offsetSteps) * 60_000));
            };
            const answer = buildAnswers(ctx, placement, behaviour, key, local);
            if (answer.length === 0) continue;
            for (const [attemptIndex, a] of answer.entries()) {
              const submittedAt = at(attemptIndex * 0.2);
              rows.push({
                assignmentId,
                assignmentQuestionId: placement.id,
                questionId: ctx.questionBySlug.get(placement.slug)!.id,
                studentId: learner.id,
                attempt: attemptIndex + 1,
                maxMarks: placement.marks,
                submittedAt,
                timeSpentSeconds: 240 + Math.round(chance(`${key}:time:${attemptIndex}`) * 1500),
                ...a.data(placement.marks, submittedAt),
              });
              if (a.review && attemptIndex === answer.length - 1) {
                const reviewedAt = new Date(
                  Math.min(
                    now - 10 * 60_000,
                    submittedAt.getTime() + (1 + chance(`${key}:review`)) * DAY,
                  ),
                );
                if (reviewedAt.getTime() > submittedAt.getTime() && daysOpen > 3) {
                  reviews.push({
                    key: `${placement.id}:${attemptIndex + 1}`,
                    ...a.review(placement.marks),
                    at: reviewedAt,
                  });
                }
              }
            }
            if (answer[answer.length - 1]!.solved) solved += 1;
          }
          previousShare = questions.length === 0 ? 1 : solved / questions.length;
        }
        if (rows.length === 0) continue;
        await prisma.submission.createMany({ data: rows });
        ctx.result.submissions += rows.length;

        // Reviews are added the way a reviewer would: a decision row, and the cached figures updated.
        for (const review of reviews) {
          const [placementId, attempt] = review.key.split(':');
          const submission = await prisma.submission.findFirst({
            where: {
              assignmentQuestionId: placementId,
              studentId: learner.id,
              attempt: Number(attempt),
            },
          });
          if (!submission) continue;
          // As a reviewer's decision does: given marks stand; approving an unmarked answer gives full
          // marks; otherwise the marks it had are kept.
          const marks =
            review.marks ??
            (review.decision === 'approved' && submission.status === 'awaiting_grading'
              ? submission.maxMarks
              : Number(submission.marks));
          await prisma.submissionReview.create({
            data: {
              submissionId: submission.id,
              reviewerId,
              decision: review.decision,
              marks: review.marks,
              comment: review.comment,
              createdAt: review.at,
            },
          });
          await prisma.submission.update({
            where: { id: submission.id },
            data: {
              marks,
              status:
                marks >= submission.maxMarks ? 'correct' : marks > 0 ? 'partial' : 'incorrect',
              reviewDecision: review.decision,
              reviewedAt: review.at,
              graderComment: review.comment.slice(0, 2000),
              gradedById: reviewerId,
              gradedAt: review.at,
            },
          });
          ctx.result.reviews += 1;
        }
      }
    }
  }
}

interface PlannedAnswer {
  solved: boolean;
  data: (
    maxMarks: number,
    submittedAt: Date,
  ) => Omit<
    Prisma.SubmissionCreateManyInput,
    | 'assignmentId'
    | 'assignmentQuestionId'
    | 'questionId'
    | 'studentId'
    | 'attempt'
    | 'maxMarks'
    | 'submittedAt'
    | 'timeSpentSeconds'
  >;
  review?: (maxMarks: number) => {
    decision: 'graded' | 'approved' | 'resubmission_requested';
    marks: number | null;
    comment: string;
  };
}

/** One learner's attempts at one question, oldest first; empty when nothing honest can be recorded. */
function buildAnswers(
  ctx: AnswerContext,
  placement: { slug: string },
  behaviour: Behaviour,
  key: string,
  local: string,
): PlannedAnswer[] {
  const entry = ctx.questionBySlug.get(placement.slug);
  if (!entry) return [];
  const plan = entry.plan;

  if (OBJECTIVE.has(plan.type)) {
    const options = ctx.optionsByQuestion.get(entry.id);
    if (!options || options.correct.length === 0 || options.wrong.length === 0) return [];
    const rightFirst =
      chance(`${key}:a1`) <
      (behaviour === 'diligent' ? 0.88 : behaviour === 'steady' ? 0.68 : 0.35);
    const objective = (correct: boolean): PlannedAnswer => ({
      solved: correct,
      data: (maxMarks) => ({
        status: correct ? 'correct' : 'incorrect',
        marks: correct ? maxMarks : 0,
        autoMarks: correct ? maxMarks : 0,
        optionIds: correct ? options.correct : [options.wrong[0]!],
      }),
    });
    if (rightFirst) return [objective(true)];
    if (behaviour === 'struggling') return [objective(false)];
    return [objective(false), objective(chance(`${key}:a2`) < 0.8)];
  }

  if (plan.type === 'coding' || plan.type === 'sql') {
    const verification = ctx.verificationBySlug.get(plan.slug);
    if (!verification || entry.status !== 'published') return [];
    const settings = runSettings(plan);
    const prefersPython =
      ['student04', 'student09'].includes(local) && settings.languages.includes('python');
    const language = prefersPython
      ? 'python'
      : settings.languages.includes('java')
        ? 'java'
        : settings.languages[0]!;
    const outcomes = verification.languages[language];
    if (!outcomes) return [];
    const coded = (kind: 'solution' | 'starter'): PlannedAnswer | null => {
      const outcome = kind === 'solution' ? outcomes.solution : outcomes.starter;
      const code =
        kind === 'solution' ? settings.referenceSolution[language] : settings.starterCode[language];
      if (!outcome || !code) return null;
      const ratio = outcome.total === 0 ? 0 : outcome.passed / outcome.total;
      return {
        solved: ratio >= 1,
        data: (maxMarks, submittedAt) => {
          const marks = Math.round(maxMarks * ratio * 100) / 100;
          return {
            status: ratio >= 1 ? 'correct' : ratio > 0 ? 'partial' : 'incorrect',
            marks,
            autoMarks: marks,
            language,
            code,
            driver: 'runner',
            trust: 'trusted',
            passedCount: outcome.passed,
            totalCount: outcome.total,
            durationMs: outcome.durationMs,
            memoryKb: outcome.memoryKb,
            evaluatedAt: new Date(submittedAt.getTime() + 6_000),
          };
        },
      };
    };
    const solution = coded('solution');
    const starter = coded('starter');
    if (behaviour === 'struggling') return starter ? [starter] : [];
    if (behaviour === 'steady' && chance(`${key}:first`) < 0.5 && starter && solution)
      return [starter, solution];
    return solution ? [solution] : [];
  }

  if (plan.type === 'descriptive') {
    const sample = WRITTEN_ANSWERS[plan.slug];
    if (!sample) return [];
    const strong =
      behaviour === 'diligent' || (behaviour === 'steady' && chance(`${key}:strong`) < 0.5);
    const verdict = strong ? sample.strongReview : sample.weakReview;
    return [
      {
        solved: strong,
        data: () => ({
          status: 'awaiting_grading',
          marks: 0,
          text: strong ? sample.strong : sample.weak,
        }),
        review:
          chance(`${key}:reviewed`) < 0.75
            ? (maxMarks) => ({
                decision:
                  !strong && sample.weakReview.resubmit ? 'resubmission_requested' : 'graded',
                marks:
                  !strong && sample.weakReview.resubmit
                    ? null
                    : Math.round(maxMarks * verdict.marksShare * 2) / 2,
                comment: verdict.comment,
              })
            : undefined,
      },
    ];
  }

  if (HAND_IN.has(plan.type)) {
    const spec = (
      plan as { spec: { linkRequired: boolean; maxFiles: number; checklist: string[] } }
    ).spec;
    // Files cannot be seeded honestly without real uploads, so only link hand-ins are recorded.
    if (!spec.linkRequired) return [];
    if (behaviour === 'struggling') return [];
    const code = ctx.userByLocal.get(local)?.studentProfile?.studentCode.toLowerCase() ?? local;
    const approval = HAND_IN_APPROVALS[plan.slug];
    return [
      {
        solved: false,
        data: () => ({
          status: 'awaiting_grading',
          marks: 0,
          text: HAND_IN_NOTES[plan.slug] ?? '',
          payload: {
            links: [`https://git.siacademy.example/${code}/${plan.slug}`],
            checklist: spec.checklist.map((_, index) => index),
          },
        }),
        review:
          approval && behaviour === 'diligent' && chance(`${key}:approved`) < 0.6
            ? () => ({ decision: 'approved', marks: null, comment: approval })
            : undefined,
      },
    ];
  }
  return [];
}

// ───────────────────────── tests ─────────────────────────

async function seedTests(
  prisma: PrismaClient,
  organization: { id: string },
  lookup: { batchIdByCode: Map<string, string>; adminUserId: string | null },
  result: AssessmentSeedResult,
): Promise<void> {
  const pick = (
    subject: string,
    take: number,
    types: ('mcq_single' | 'mcq_multi' | 'true_false' | 'descriptive')[],
  ) =>
    prisma.question.findMany({
      where: { organizationId: organization.id, subject, status: 'published', type: { in: types } },
      orderBy: { createdAt: 'asc' },
      take,
      select: { id: true, marks: true },
    });
  const objective: ('mcq_single' | 'mcq_multi' | 'true_false')[] = [
    'mcq_single',
    'mcq_multi',
    'true_false',
  ];

  const batchB1 = lookup.batchIdByCode.get('JFS-2026-B1');
  interface SectionPlan {
    title: string;
    subject: string;
    count: number;
    written?: boolean;
  }
  interface TestPlan {
    title: string;
    kind: 'weekly' | 'practice' | 'mock' | 'final';
    subject: string;
    opensOffsetHours: number;
    closesOffsetHours: number;
    release: boolean;
    sections: SectionPlan[];
  }
  const testPlans: TestPlan[] = [
    {
      title: 'Core Java weekly test 3',
      kind: 'weekly',
      subject: 'core-java',
      opensOffsetHours: -24 * 7,
      closesOffsetHours: -24 * 7 + 3,
      release: true,
      sections: [
        { title: 'Objective', subject: 'core-java', count: 5 },
        { title: 'Written', subject: 'core-java', count: 1, written: true },
      ],
    },
    {
      title: 'SQL check, open today',
      kind: 'practice',
      subject: 'sql',
      opensOffsetHours: -2,
      closesOffsetHours: 10,
      release: false,
      sections: [{ title: 'Queries and joins', subject: 'sql', count: 5 }],
    },
    {
      title: 'Java Full-Stack mock test',
      kind: 'mock',
      subject: 'programming',
      opensOffsetHours: 24 * 5,
      closesOffsetHours: 24 * 5 + 4,
      release: false,
      sections: [
        { title: 'Core Java', subject: 'core-java', count: 4 },
        { title: 'SQL', subject: 'sql', count: 3 },
        { title: 'JavaScript', subject: 'javascript', count: 3 },
      ],
    },
  ];

  for (const plan of testPlans) {
    const existing = await prisma.test.findFirst({
      where: { organizationId: organization.id, title: plan.title },
    });
    let testId = existing?.id;
    if (!testId) {
      const created = await prisma.test.create({
        data: {
          organizationId: organization.id,
          title: plan.title,
          description:
            plan.kind === 'weekly'
              ? 'This week’s check on objects, collections and exceptions.'
              : plan.kind === 'practice'
                ? 'A short practice paper on queries and joins; it does not count towards your grade.'
                : 'A full-length mock of a placement written round.',
          kind: plan.kind,
          subject: plan.subject,
          instructions:
            'Answer every question. The timer is the server’s: it keeps running if you close the tab, and the paper is submitted for you when it reaches zero.',
          status: 'published',
          settings: {
            durationMinutes: 45,
            maxAttempts: 1,
            shuffleQuestions: false,
            shuffleOptions: false,
            resultPolicy: 'on_release',
            reviewPolicy: 'full',
            trackTabSwitches: true,
            requireFullScreen: false,
            showRank: true,
          },
          createdById: lookup.adminUserId,
        },
      });
      testId = created.id;
      for (const [sectionIndex, sectionPlan] of plan.sections.entries()) {
        const section = await prisma.testSection.create({
          data: { testId, title: sectionPlan.title, instructions: '', position: sectionIndex },
        });
        const picked = await pick(
          sectionPlan.subject,
          sectionPlan.count,
          sectionPlan.written ? ['descriptive'] : objective,
        );
        for (const [index, question] of picked.entries()) {
          await prisma.testQuestion.create({
            data: {
              sectionId: section.id,
              questionId: question.id,
              marks: question.marks,
              negativeMarks: 0,
              position: index,
            },
          });
        }
      }
    }
    result.tests += 1;

    if (!batchB1) continue;
    let schedule = await prisma.testSchedule.findFirst({ where: { testId, batchId: batchB1 } });
    if (!schedule) {
      schedule = await prisma.testSchedule.create({
        data: {
          testId,
          batchId: batchB1,
          opensAt: new Date(Date.now() + plan.opensOffsetHours * 3_600_000),
          closesAt: new Date(Date.now() + plan.closesOffsetHours * 3_600_000),
          createdById: lookup.adminUserId,
        },
      });
    }
    result.schedules += 1;

    // The test that has already happened gets sittings, so results and review have something real.
    if (!plan.release) continue;
    const attemptsMade = await prisma.testAttempt.count({ where: { scheduleId: schedule.id } });
    if (attemptsMade === 0) {
      const placements = await prisma.testQuestion.findMany({
        where: { section: { testId } },
        orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
        include: { question: { include: { options: true } } },
      });
      const totalMarks = placements.reduce((n, p) => n + p.marks, 0);
      const members = await prisma.batchMember.findMany({
        where: { batchId: batchB1, isActive: true },
        take: 12,
        select: { studentId: true },
      });
      for (const [index, member] of members.entries()) {
        const share = 0.45 + ((index * 7) % 6) * 0.1;
        const submittedAt = new Date(schedule.opensAt.getTime() + 40 * 60_000);
        const attempt = await prisma.testAttempt.create({
          data: {
            testId,
            scheduleId: schedule.id,
            studentId: member.studentId,
            attempt: 1,
            status: 'graded',
            startedAt: schedule.opensAt,
            expiresAt: new Date(schedule.opensAt.getTime() + 45 * 60_000),
            submittedAt,
            totalMarks,
            tabSwitches: index % 5 === 0 ? 2 : 0,
            questionOrder: placements.map((p) => p.id),
          },
        });
        let score = 0;
        for (const [placementIndex, placement] of placements.entries()) {
          const correct = placement.question.options.filter((o) => o.isCorrect);
          const written = placement.question.type === 'descriptive';
          const sample = WRITTEN_ANSWERS[placement.question.slug];
          const gotItRight = placementIndex / placements.length < share;
          const marks = written
            ? gotItRight
              ? placement.marks
              : Math.floor(placement.marks / 2)
            : gotItRight
              ? placement.marks
              : 0;
          score += marks;
          await prisma.testAnswer.create({
            data: {
              attemptId: attempt.id,
              testQuestionId: placement.id,
              optionIds: written
                ? []
                : gotItRight
                  ? correct.map((o) => o.id)
                  : placement.question.options
                      .filter((o) => !o.isCorrect)
                      .slice(0, 1)
                      .map((o) => o.id),
              text: written ? (gotItRight ? (sample?.strong ?? '') : (sample?.weak ?? '')) : '',
              status: marks >= placement.marks ? 'correct' : marks > 0 ? 'partial' : 'incorrect',
              marks,
              graderComment: written
                ? gotItRight
                  ? (sample?.strongReview.comment ?? '')
                  : (sample?.weakReview.comment ?? '')
                : '',
              gradedAt: submittedAt,
              timeSpentSeconds: 120 + placementIndex * 30,
            },
          });
        }
        await prisma.testAttempt.update({ where: { id: attempt.id }, data: { score } });
        result.attempts += 1;
      }
    }
    if (!schedule.releasedAt) {
      await prisma.testSchedule.update({
        where: { id: schedule.id },
        data: { releasedAt: new Date(), releasedById: lookup.adminUserId },
      });
    }
  }
}
