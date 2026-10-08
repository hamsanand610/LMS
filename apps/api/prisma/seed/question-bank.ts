/**
 * SI Academy's own question bank and the assignment definitions built from it (prisma/seed/content),
 * written in one place for two callers: the demo seed (demo-assessment.ts: authors, a programme,
 * courses and audiences) and the production content promotion (content.ts: no people, drafts only).
 *
 * Nothing here runs code (ADR-0007). A coding, SQL, debugging or web question is published as
 * validated only from the outcome the verification suite produced by running exactly that code in
 * the sandbox (content/verified-runs.json); without a current verification it stays a draft.
 *
 * Create-only: questions are matched by slug and assignments by title; anything that exists is left
 * as it is, so an edit made in the product is never overwritten.
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  BANK,
  casesOf,
  isRunnable,
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

const HAND_IN = new Set(['file_upload', 'practical', 'project']);

export interface BankEntry {
  id: string;
  marks: number;
  status: string;
  plan: BankQuestion;
}

export interface QuestionBankResult {
  questionBySlug: Map<string, BankEntry>;
  verificationBySlug: Map<string, VerifiedQuestion>;
  /** Questions in the bank (existing or created). */
  questions: number;
  /** Of those, the ones that run code. */
  coding: number;
  /** Runnable questions created as drafts for want of a current verification. */
  unverified: number;
  /** Questions this run created. */
  created: number;
}

/** The technologies and topics the bank uses; terms that exist are left as they are. */
export async function seedBankTaxonomy(
  prisma: PrismaClient,
  organizationId: string,
): Promise<number> {
  let created = 0;
  for (const [taxonomy, terms] of [
    ['subject', TECHNOLOGY_TERMS],
    ['topic', TOPIC_TERMS],
  ] as const) {
    const count = await prisma.taxonomyTerm.count({ where: { organizationId, taxonomy } });
    for (const [index, term] of terms.entries()) {
      const key = { organizationId_taxonomy_key: { organizationId, taxonomy, key: term.key } };
      if (await prisma.taxonomyTerm.findUnique({ where: key, select: { id: true } })) continue;
      await prisma.taxonomyTerm.create({
        data: {
          organizationId,
          taxonomy,
          key: term.key,
          label: term.label,
          position: count + index,
        },
      });
      created += 1;
    }
  }
  return created;
}

/** Every question of the bank, created if its slug is new. `authorIdOf` names who wrote it, or null. */
export async function seedQuestionBank(
  prisma: PrismaClient,
  organizationId: string,
  authorIdOf: (plan: BankQuestion) => string | null,
): Promise<QuestionBankResult> {
  const verifiedRuns = loadVerifiedRuns();
  const result: QuestionBankResult = {
    questionBySlug: new Map(),
    verificationBySlug: new Map(),
    questions: 0,
    coding: 0,
    unverified: 0,
    created: 0,
  };

  for (const plan of BANK) {
    // Coding, SQL, debugging and web: published only once proved in the sandbox (verified-runs.json).
    const executed = isRunnable(plan);
    const verification = isRunnable(plan) ? currentVerification(verifiedRuns, plan) : null;
    if (verification) result.verificationBySlug.set(plan.slug, verification);

    const existing = await prisma.question.findUnique({ where: { slug: plan.slug } });
    if (existing) {
      result.questionBySlug.set(plan.slug, {
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
    const settings = isRunnable(plan) ? runSettings(plan) : null;
    const cases = isRunnable(plan) ? casesOf(plan) : [];
    const described = plan.type === 'coding' || plan.type === 'debugging' ? plan : null;

    const question = await prisma.question.create({
      data: {
        organizationId,
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
        authorId: authorIdOf(plan),
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
                  inputFormat: described?.inputFormat ?? '',
                  outputFormat: described?.outputFormat ?? '',
                  constraints: described?.constraints ?? '',
                  expectedBehaviour: plan.type === 'debugging' ? plan.expectedBehaviour : '',
                  compareMode: settings.compareMode,
                  setupSql: settings.setupSql,
                  sqlCheck: settings.sqlCheck,
                  testCases: {
                    create: cases.map((c: Case, position) => ({
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
    result.questionBySlug.set(plan.slug, { id: question.id, marks: question.marks, status, plan });
    result.questions += 1;
    result.created += 1;
    if (executed) result.coding += 1;
  }
  return result;
}

/** Where an assignment definition is attached, who wrote it and in what state it starts. */
export interface AssignmentPlacement {
  authorId: string | null;
  programId: string | null;
  course: { id: string; modules: { id: string; title: string }[] } | undefined;
  status: 'draft' | 'published';
}

/**
 * One assignment definition — its modules, their questions and its resources — created if no live
 * assignment has its title. Only questions that are ready (published) go in; an unverified coding
 * question waits for its author. Returns the assignment and whether this call created it.
 */
export async function ensureAssignmentDefinition(
  prisma: PrismaClient,
  organizationId: string,
  plan: AssignmentPlan,
  questionBySlug: Map<string, BankEntry>,
  placement: AssignmentPlacement,
): Promise<{ assignment: { id: string }; created: boolean }> {
  const existing = await prisma.assignment.findFirst({
    where: { organizationId, title: plan.title, deletedAt: null },
    select: { id: true },
  });
  if (existing) return { assignment: existing, created: false };

  const { course } = placement;
  const assignment = await prisma.assignment.create({
    data: {
      organizationId,
      title: plan.title,
      description: plan.description,
      instructions: plan.instructions,
      subject: plan.technology,
      difficulty: plan.level,
      kind: plan.kind,
      courseId: course?.id ?? null,
      programId: placement.programId,
      estimatedMinutes: plan.estimatedMinutes,
      passPercent: plan.passPercent,
      status: placement.status,
      settings: plan.settings,
      createdById: placement.authorId,
    },
    select: { id: true },
  });
  let position = 0;
  for (const modulePlan of plan.modules) {
    const questions = modulePlan.questions
      .map((slug) => questionBySlug.get(slug))
      .filter((q): q is BankEntry => q !== undefined && q.status === 'published');
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
  return { assignment, created: true };
}
