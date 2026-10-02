import { Injectable } from '@nestjs/common';
import {
  questionSpecSchema,
  type CaseOutcome,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type QuestionProgress,
  type QuestionType,
  type ReviewDecision,
  type SubmissionHistoryItem,
  type SubmissionReviewContext,
  type SubmissionView,
  type TrustLevel,
} from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/** Everything a submission view is built from. */
export const SUBMISSION_VIEW_INCLUDE = {
  question: {
    select: {
      title: true,
      type: true,
      explanation: true,
      options: { select: { id: true, isCorrect: true } },
    },
  },
  results: { orderBy: { position: 'asc' as const } },
  reviews: {
    orderBy: { createdAt: 'asc' as const },
    include: { reviewer: { select: { name: true } } },
  },
  student: { select: { id: true, studentCode: true, user: { select: { name: true } } } },
} as const;

export interface SubmissionViewRow {
  id: string;
  assignmentId: string;
  assignmentQuestionId: string;
  questionId: string;
  attempt: number;
  status: string;
  marks: unknown;
  maxMarks: number;
  autoMarks: unknown;
  language: string;
  code: string;
  text: string;
  optionIds: string[];
  payload: unknown;
  fileIds: string[];
  submittedAt: Date;
  isLate: boolean;
  evaluatedAt: Date | null;
  trust: string | null;
  passedCount: number;
  totalCount: number;
  durationMs: number | null;
  memoryKb: number | null;
  compileOutput: string;
  evaluationError: string;
  reviewDecision: string | null;
  question: {
    title: string;
    type: string;
    explanation: string;
    options: { id: string; isCorrect: boolean }[];
  };
  results: {
    testCaseId: string | null;
    passed: boolean;
    verdict: string | null;
    actualOutput: string;
    stderr: string;
    durationMs: number;
    memoryKb: number | null;
    isSample: boolean;
    position: number;
  }[];
  reviews: {
    id: string;
    decision: string;
    marks: unknown;
    comment: string;
    createdAt: Date;
    reviewer: { name: string } | null;
  }[];
  student: { id: string; studentCode: string; user: { name: string } };
}

/** The status a submission shows, from what is stored on it. */
export function submissionProgress(row: {
  status: string;
  reviewDecision: string | null;
}): QuestionProgress {
  if (row.reviewDecision === 'resubmission_requested') return 'resubmit';
  switch (row.status) {
    case 'evaluating':
      return 'evaluating';
    case 'awaiting_grading':
      return 'awaiting_review';
    case 'error':
      return 'error';
    default:
      return row.status as QuestionProgress;
  }
}

/** The overall verdict of an evaluated code answer, from its stored cases. */
function overallVerdict(row: SubmissionViewRow): ExecutionVerdict | null {
  if (!['coding', 'sql'].includes(row.question.type)) return null;
  if (row.status === 'evaluating') return 'pending';
  if (row.status === 'error') return 'error';
  if (row.compileOutput && row.results.every((r) => r.verdict === 'compile_error')) {
    return 'compile_error';
  }
  if (row.results.length === 0) return null;
  const failed = row.results.find((r) => !r.passed);
  return failed ? ((failed.verdict as ExecutionVerdict | null) ?? 'failed') : 'passed';
}

/**
 * Builds the views of a submission. A learner sees their own answer, every visible case in full
 * and every hidden case as a verdict and a cost; staff who review it see everything.
 */
@Injectable()
export class SubmissionViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async toView(
    row: SubmissionViewRow,
    options: { staff: boolean; revealAnswers: boolean },
  ): Promise<SubmissionView> {
    const caseIds = row.results.map((r) => r.testCaseId).filter((id): id is string => !!id);
    const [cases, files] = await Promise.all([
      caseIds.length === 0
        ? []
        : this.prisma.testCase.findMany({
            where: { id: { in: caseIds } },
            select: { id: true, label: true, input: true, expectedOutput: true, explanation: true },
          }),
      row.fileIds.length === 0
        ? []
        : this.prisma.file.findMany({
            where: { id: { in: row.fileIds } },
            select: { id: true, originalName: true, size: true },
          }),
    ]);
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const outcomes: CaseOutcome[] = row.results.map((result, index) => {
      const number = index + 1;
      const current = result.testCaseId ? caseById.get(result.testCaseId) : undefined;
      const show = result.isSample || options.staff;
      return {
        testCaseId: result.testCaseId,
        number,
        label: current?.label || `Test ${number}`,
        hidden: !result.isSample,
        verdict:
          (result.verdict as ExecutionVerdict | null) ?? (result.passed ? 'passed' : 'failed'),
        passed: result.passed,
        durationMs: result.verdict === 'compile_error' ? null : result.durationMs,
        memoryKb: result.verdict === 'compile_error' ? null : result.memoryKb,
        ...(show
          ? {
              input: current?.input ?? '',
              expectedOutput: current?.expectedOutput ?? '',
              actualOutput: result.actualOutput,
              stderr: result.stderr,
              explanation: current?.explanation ?? '',
            }
          : {}),
      };
    });
    const payload = (row.payload ?? {}) as { links?: unknown; checklist?: unknown };
    const objective = ['mcq_single', 'mcq_multi', 'true_false'].includes(row.question.type);

    return {
      id: row.id,
      assignmentId: row.assignmentId,
      placementId: row.assignmentQuestionId,
      questionId: row.questionId,
      questionTitle: row.question.title,
      questionType: row.question.type as QuestionType,
      attempt: row.attempt,
      status: submissionProgress(row),
      marks: Number(row.marks ?? 0),
      maxMarks: row.maxMarks,
      autoMarks:
        row.autoMarks === null || row.autoMarks === undefined ? null : Number(row.autoMarks),
      language: (row.language || null) as ExecutionLanguage | null,
      code: row.code,
      text: row.text,
      optionIds: row.optionIds,
      links: Array.isArray(payload.links) ? payload.links.map(String) : [],
      files: files.map((f) => ({ id: f.id, name: f.originalName, size: f.size })),
      checklist: Array.isArray(payload.checklist) ? payload.checklist.map(Number) : [],
      submittedAt: row.submittedAt.toISOString(),
      isLate: row.isLate,
      evaluatedAt: row.evaluatedAt?.toISOString() ?? null,
      verdict: overallVerdict(row),
      trust: (row.trust as TrustLevel | null) ?? null,
      passed: row.passedCount,
      total: row.totalCount,
      durationMs: row.durationMs,
      memoryKb: row.memoryKb,
      compileOutput: row.compileOutput,
      evaluationError: row.evaluationError,
      cases: outcomes,
      reviews: row.reviews.map((review) => ({
        id: review.id,
        decision: review.decision as ReviewDecision,
        marks: review.marks === null || review.marks === undefined ? null : Number(review.marks),
        comment: review.comment,
        reviewerName: review.reviewer?.name ?? null,
        createdAt: review.createdAt.toISOString(),
      })),
      explanation: options.revealAnswers || options.staff ? row.question.explanation : null,
      correctOptionIds:
        objective && (options.revealAnswers || options.staff)
          ? row.question.options.filter((o) => o.isCorrect).map((o) => o.id)
          : null,
      student: options.staff
        ? { id: row.student.id, name: row.student.user.name, code: row.student.studentCode }
        : null,
      reviewContext: null,
    };
  }

  /**
   * What a reviewer needs beside the answer: the question as set, its mark scheme and hand-in
   * checklist, and every attempt the learner made at it. Staff only; the caller has checked access.
   */
  async reviewContext(row: {
    assignmentId: string;
    assignmentQuestionId: string;
    questionId: string;
    studentId: string;
  }): Promise<SubmissionReviewContext> {
    const [question, assignment, attempts] = await Promise.all([
      this.prisma.question.findUnique({
        where: { id: row.questionId },
        select: {
          body: true,
          rubric: true,
          spec: true,
          options: {
            select: { id: true, body: true, isCorrect: true },
            orderBy: { position: 'asc' },
          },
        },
      }),
      this.prisma.assignment.findUnique({
        where: { id: row.assignmentId },
        select: { title: true },
      }),
      this.prisma.submission.findMany({
        where: {
          assignmentId: row.assignmentId,
          assignmentQuestionId: row.assignmentQuestionId,
          studentId: row.studentId,
        },
        orderBy: { attempt: 'desc' },
        include: {
          question: { select: { type: true } },
          results: { select: { passed: true, verdict: true }, orderBy: { position: 'asc' } },
        },
      }),
    ]);
    return {
      assignmentTitle: assignment?.title ?? '',
      body: question?.body ?? '',
      rubric: question?.rubric ?? '',
      spec: questionSpecSchema.parse(question?.spec ?? {}),
      options: question?.options ?? [],
      attempts: attempts.map(toHistoryItem),
    };
  }
}

/** One line of a learner's history on a question. */
export function toHistoryItem(row: {
  id: string;
  attempt: number;
  status: string;
  reviewDecision: string | null;
  language: string;
  marks: unknown;
  maxMarks: number;
  passedCount: number;
  totalCount: number;
  durationMs: number | null;
  memoryKb: number | null;
  submittedAt: Date;
  compileOutput: string;
  results: { passed: boolean; verdict: string | null }[];
  question: { type: string };
}): SubmissionHistoryItem {
  const executed = ['coding', 'sql'].includes(row.question.type);
  const failed = row.results.find((r) => !r.passed);
  return {
    id: row.id,
    attempt: row.attempt,
    status: submissionProgress(row),
    language: (row.language || null) as ExecutionLanguage | null,
    verdict: !executed
      ? null
      : row.status === 'evaluating'
        ? 'pending'
        : row.status === 'error'
          ? 'error'
          : row.results.length === 0
            ? null
            : failed
              ? ((failed.verdict as ExecutionVerdict | null) ?? 'failed')
              : 'passed',
    marks: Number(row.marks ?? 0),
    maxMarks: row.maxMarks,
    passed: row.passedCount,
    total: row.totalCount,
    durationMs: row.durationMs,
    memoryKb: row.memoryKb,
    reviewDecision: (row.reviewDecision as ReviewDecision | null) ?? null,
    submittedAt: row.submittedAt.toISOString(),
  };
}
