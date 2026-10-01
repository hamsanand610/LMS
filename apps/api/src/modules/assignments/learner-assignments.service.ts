import { Inject, Injectable } from '@nestjs/common';
import {
  ASSIGNMENT_KIND_LABELS,
  EXECUTED_TYPES,
  LEARNER_STATUS_LABELS,
  PENDING_STATUSES,
  questionSpecSchema,
  type AssignmentResourceView,
  type AssignmentSettings,
  type CompareMode,
  type ExecutionLanguage,
  type FacetCount,
  type LearnerAssignmentDetail,
  type LearnerAssignmentList,
  type LearnerAssignmentQuery,
  type LearnerAssignmentRow,
  type LearnerQuestionWorkspace,
  type QuestionDifficulty,
  type QuestionType,
  type SubmissionHistoryItem,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { ExecutionService } from '../execution/index.js';
import { TaxonomiesService } from '../settings/taxonomies.service.js';
import { learnerState, type LearnerState, type PlacementState } from './learner-state.js';
import {
  loadLearnerSubmissions,
  loadReachedAssignments,
  type LearnerReach,
  type ReachedAssignment,
} from './reach.js';
import {
  SUBMISSION_VIEW_INCLUDE,
  SubmissionViewsService,
  toHistoryItem,
} from './submission-views.service.js';

/** Everything known about one question a learner is about to open, run or answer. */
export interface AnswerContext {
  reach: LearnerReach;
  reached: ReachedAssignment;
  state: LearnerState;
  placement: {
    id: string;
    marks: number;
    moduleId: string;
    moduleTitle: string;
    questionId: string;
  };
  placementState: PlacementState;
  question: {
    id: string;
    title: string;
    body: string;
    type: QuestionType;
    difficulty: QuestionDifficulty;
    version: number;
    hints: string[];
    spec: unknown;
    options: { id: string; body: string; position: number; isCorrect: boolean }[];
  };
}

/**
 * The learner's side of assignments: the list, the set page and the question workspace. What a
 * learner may see is decided by the publications that reach them (reach.ts) and where they stand
 * is worked out by learner-state.ts, the same calculation the staff progress table uses.
 */
@Injectable()
export class LearnerAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomies: TaxonomiesService,
    private readonly views: SubmissionViewsService,
    private readonly execution: ExecutionService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** The learner behind a signed-in user, and the batches they belong to. */
  async reach(user: AuthUser): Promise<LearnerReach> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, members: { where: { isActive: true }, select: { batchId: true } } },
    });
    if (!student) throw new ForbiddenError('Only a learner has assignments', 'not_a_learner');
    return { studentId: student.id, batchIds: student.members.map((m) => m.batchId) };
  }

  async list(user: AuthUser, query: LearnerAssignmentQuery): Promise<LearnerAssignmentList> {
    const reach = await this.reach(user);
    const reached = await loadReachedAssignments(this.prisma, reach);
    const submissions = await loadLearnerSubmissions(
      this.prisma,
      reach.studentId,
      reached.map((r) => r.assignment.id),
    );
    const now = new Date();
    const rows = reached.map(
      (r) =>
        learnerState(
          r.assignment,
          r.publication,
          submissions.filter((s) => s.assignmentId === r.assignment.id),
          now,
        ).row,
    );

    const labels = await this.labels();
    const count = (
      key: (row: LearnerAssignmentRow) => string | string[] | null,
      label: (key: string) => string,
    ) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const keys = key(row);
        for (const k of Array.isArray(keys) ? keys : keys ? [keys] : []) {
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .map<FacetCount>(([k, n]) => ({ key: k, label: label(k), count: n }))
        .sort((a, b) => a.label.localeCompare(b.label));
    };
    const courseTitles = new Map(
      rows.filter((r) => r.courseId).map((r) => [r.courseId!, r.courseTitle ?? '']),
    );

    const q = query.q?.trim().toLowerCase();
    const filtered = rows.filter(
      (row) =>
        (!q || row.title.toLowerCase().includes(q) || row.description.toLowerCase().includes(q)) &&
        (!query.technology || row.technology === query.technology) &&
        (!query.kind || row.kind === query.kind) &&
        (!query.level || row.level === query.level) &&
        (!query.status || row.status === query.status) &&
        (!query.courseId || row.courseId === query.courseId) &&
        (!query.topic || row.topics.includes(query.topic)),
    );
    const sorted = [...filtered].sort(SORTS[query.sort]);
    const start = (query.page - 1) * query.pageSize;

    return {
      summary: {
        total: rows.length,
        completed: rows.filter((r) => r.status === 'completed' || r.status === 'passed').length,
        pending: rows.filter((r) => PENDING_STATUSES.includes(r.status)).length,
        inProgress: rows.filter((r) => r.status === 'in_progress').length,
        overdue: rows.filter((r) => r.status === 'overdue').length,
        upcoming: rows.filter((r) => r.status === 'upcoming').length,
      },
      facets: {
        technologies: count(
          (r) => r.technology || null,
          (k) => labels.subject.get(k) ?? k,
        ),
        kinds: count(
          (r) => r.kind,
          (k) => ASSIGNMENT_KIND_LABELS[k as keyof typeof ASSIGNMENT_KIND_LABELS] ?? k,
        ),
        levels: count(
          (r) => r.level || null,
          (k) => labels.level.get(k) ?? k,
        ),
        courses: count(
          (r) => r.courseId,
          (k) => courseTitles.get(k) ?? k,
        ),
        topics: count(
          (r) => r.topics,
          (k) => labels.topic.get(k) ?? k,
        ),
        statuses: count(
          (r) => r.status,
          (k) => LEARNER_STATUS_LABELS[k as keyof typeof LEARNER_STATUS_LABELS] ?? k,
        ),
      },
      data: sorted.slice(start, start + query.pageSize),
      meta: { page: query.page, pageSize: query.pageSize, total: filtered.length },
    };
  }

  async detail(user: AuthUser, assignmentId: string): Promise<LearnerAssignmentDetail> {
    const reach = await this.reach(user);
    const reached = await this.requireReached(reach, assignmentId);
    const state = await this.stateOf(reach, reached);
    return {
      ...state.row,
      instructions: reached.instructions,
      settings: reached.assignment.settings,
      resources: await this.resources(assignmentId),
      modules: state.modules,
      closedReason: state.closedReason,
    };
  }

  /** One question as the workspace shows it. Hidden cases are counted, never included. */
  async workspace(
    user: AuthUser,
    assignmentId: string,
    placementId: string,
  ): Promise<LearnerQuestionWorkspace> {
    const context = await this.answerContext(user, assignmentId, placementId);
    const { state, placementState, question, reached } = context;

    const coding = EXECUTED_TYPES.includes(question.type)
      ? await this.prisma.codingProblem.findUnique({
          where: { questionId: question.id },
          include: { testCases: { where: { enabled: true }, orderBy: { position: 'asc' } } },
        })
      : null;

    const ordered = state.modules.flatMap((m) =>
      m.questions.map((q) => ({ placementId: q.placementId })),
    );
    const index = ordered.findIndex((p) => p.placementId === placementId);
    const last = await this.prisma.submission.findFirst({
      where: { assignmentQuestionId: placementId, studentId: context.reach.studentId },
      orderBy: { attempt: 'desc' },
      include: SUBMISSION_VIEW_INCLUDE,
    });
    const blockedReason = this.blockedReason(state, placementState);

    return {
      assignment: {
        id: reached.assignment.id,
        title: reached.assignment.title,
        status: state.row.status,
        dueAt: state.dueAt?.toISOString() ?? null,
        closesAt: reached.publication.closesAt?.toISOString() ?? null,
      },
      placement: {
        id: placementId,
        marks: context.placement.marks,
        moduleId: context.placement.moduleId,
        moduleTitle: context.placement.moduleTitle,
        index: index + 1,
        count: ordered.length,
        previousId: index > 0 ? (ordered[index - 1]?.placementId ?? null) : null,
        nextId:
          index >= 0 && index < ordered.length - 1
            ? (ordered[index + 1]?.placementId ?? null)
            : null,
      },
      question: {
        id: question.id,
        title: question.title,
        type: question.type,
        difficulty: question.difficulty,
        body: question.body,
        hints: question.hints,
        spec: parseSpec(question.spec),
        // Never whether an option is right: that is only ever in a result the policy allows.
        options: question.options.map((o) => ({ id: o.id, body: o.body, position: o.position })),
        coding: coding
          ? {
              languages: coding.languages as ExecutionLanguage[],
              starterCode: coding.starterCode as Record<string, string>,
              timeLimitMs: coding.timeLimitMs,
              memoryLimitMb: coding.memoryLimitMb,
              inputFormat: coding.inputFormat,
              outputFormat: coding.outputFormat,
              constraints: coding.constraints,
              compareMode: coding.compareMode as CompareMode,
              // The tables and rows an SQL answer runs against are part of the question.
              schemaSql: question.type === 'sql' ? coding.setupSql : '',
              samples: coding.testCases
                .filter((c) => c.isSample)
                .map((c) => ({
                  id: c.id,
                  label: c.label,
                  input: c.input,
                  expectedOutput: c.expectedOutput,
                  explanation: c.explanation,
                })),
              hiddenCount: coding.testCases.filter((c) => !c.isSample).length,
            }
          : null,
      },
      progress: {
        status: placementState.progress,
        attempts: placementState.attempts,
        attemptsLeft: placementState.attemptsLeft,
        awardedMarks: placementState.awardedMarks,
        canSubmit: blockedReason === null,
        blockedReason,
      },
      lastSubmission: last
        ? await this.views.toView(last, {
            staff: false,
            revealAnswers: revealAnswers(
              reached.assignment.settings,
              placementState,
              state,
              new Date(),
            ),
          })
        : null,
    };
  }

  /** The learner's attempts at one question, newest first. */
  async history(
    user: AuthUser,
    assignmentId: string,
    placementId: string,
  ): Promise<SubmissionHistoryItem[]> {
    const reach = await this.reach(user);
    await this.requireReached(reach, assignmentId);
    const rows = await this.prisma.submission.findMany({
      where: { assignmentId, assignmentQuestionId: placementId, studentId: reach.studentId },
      orderBy: { attempt: 'desc' },
      include: {
        question: { select: { type: true } },
        results: { select: { passed: true, verdict: true }, orderBy: { position: 'asc' } },
      },
    });
    return rows.map(toHistoryItem);
  }

  /**
   * Everything about one question that the workspace, a Run and a Submit need, after checking the
   * learner may open it: it reaches them, it has opened, and its module is unlocked.
   */
  async answerContext(
    user: AuthUser,
    assignmentId: string,
    placementId: string,
  ): Promise<AnswerContext> {
    const reach = await this.reach(user);
    const reached = await this.requireReached(reach, assignmentId);
    const module = reached.assignment.modules.find((m) =>
      m.questions.some((q) => q.id === placementId),
    );
    const placement = module?.questions.find((q) => q.id === placementId);
    if (!module || !placement) throw new NotFoundError('Question');

    const state = await this.stateOf(reach, reached);
    if (state.row.status === 'upcoming') {
      throw new ForbiddenError('This assignment has not opened yet', 'assignment_not_open');
    }
    const placementState = state.placements.get(placementId);
    if (!placementState) throw new NotFoundError('Question');
    if (!placementState.unlocked) {
      const view = state.modules.find((m) => m.id === module.id);
      throw new ForbiddenError(view?.lockReason ?? 'This module is locked', 'module_locked');
    }

    const question = await this.prisma.question.findUnique({
      where: { id: placement.questionId },
      include: { options: { orderBy: { position: 'asc' } } },
    });
    if (!question) throw new NotFoundError('Question');

    return {
      reach,
      reached,
      state,
      placement: {
        id: placement.id,
        marks: placement.marks,
        moduleId: module.id,
        moduleTitle: module.title,
        questionId: placement.questionId,
      },
      placementState,
      question: {
        id: question.id,
        title: question.title,
        body: question.body,
        type: question.type as QuestionType,
        difficulty: question.difficulty as QuestionDifficulty,
        version: question.version,
        hints: question.hints,
        spec: question.spec,
        options: question.options.map((o) => ({
          id: o.id,
          body: o.body,
          position: o.position,
          isCorrect: o.isCorrect,
        })),
      },
    };
  }

  /** Why a submit would be refused right now, in words the learner can act on; null when it would not be. */
  blockedReason(state: LearnerState, placement: PlacementState): string | null {
    return this.submitBlock(state, placement)?.message ?? null;
  }

  /** The same, with the problem code the API answers with. */
  submitBlock(
    state: LearnerState,
    placement: PlacementState,
  ): { code: string; message: string; status: 409 | 422 } | null {
    if (state.closedReason) {
      return {
        code: state.row.status === 'upcoming' ? 'assignment_not_open' : 'assignment_closed',
        message: state.closedReason,
        status: 422,
      };
    }
    if (placement.progress === 'evaluating') {
      return {
        code: 'evaluation_in_progress',
        message: 'Your last answer is still being checked',
        status: 409,
      };
    }
    if (placement.attemptsLeft === 0) {
      return {
        code: 'attempts_exhausted',
        message: 'You have used every attempt at this question',
        status: 422,
      };
    }
    return null;
  }

  /** A signed link to one of the assignment's files, for a learner it reaches. */
  async resourceLink(
    user: AuthUser,
    assignmentId: string,
    resourceId: string,
  ): Promise<{ url: string }> {
    const reach = await this.reach(user);
    await this.requireReached(reach, assignmentId);
    return this.resourceUrl(assignmentId, resourceId);
  }

  async resourceUrl(assignmentId: string, resourceId: string): Promise<{ url: string }> {
    const resource = await this.prisma.assignmentResource.findFirst({
      where: { id: resourceId, assignmentId },
    });
    if (!resource) throw new NotFoundError('Resource');
    if (!resource.fileId) return { url: resource.url };
    const file = await this.prisma.file.findUnique({ where: { id: resource.fileId } });
    if (!file || file.status !== 'ready') throw new NotFoundError('Resource');
    return {
      url: await this.storage.presignDownload('private', file.key, 900, file.originalName),
    };
  }

  // ───────────────────────── internals ─────────────────────────

  private async requireReached(
    reach: LearnerReach,
    assignmentId: string,
  ): Promise<ReachedAssignment> {
    const [reached] = await loadReachedAssignments(this.prisma, reach, [assignmentId]);
    // Not published to this learner reads the same as not existing.
    if (!reached) throw new NotFoundError('Assignment');
    return reached;
  }

  private async stateOf(reach: LearnerReach, reached: ReachedAssignment): Promise<LearnerState> {
    const submissions = await loadLearnerSubmissions(this.prisma, reach.studentId, [
      reached.assignment.id,
    ]);
    return learnerState(reached.assignment, reached.publication, submissions);
  }

  private async resources(assignmentId: string): Promise<AssignmentResourceView[]> {
    const rows = await this.prisma.assignmentResource.findMany({
      where: { assignmentId },
      orderBy: { position: 'asc' },
    });
    const fileIds = rows.map((r) => r.fileId).filter((id): id is string => !!id);
    const files =
      fileIds.length === 0
        ? []
        : await this.prisma.file.findMany({
            where: { id: { in: fileIds } },
            select: { id: true, originalName: true },
          });
    const names = new Map(files.map((f) => [f.id, f.originalName]));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      fileId: row.fileId,
      fileName: row.fileId ? (names.get(row.fileId) ?? null) : null,
      position: row.position,
    }));
  }

  private async labels() {
    const [subject, level, topic] = await Promise.all([
      this.taxonomies.list('subject'),
      this.taxonomies.list('course-level'),
      this.taxonomies.list('topic'),
    ]);
    const map = (terms: { key: string; label: string }[]) =>
      new Map(terms.map((t) => [t.key, t.label]));
    return { subject: map(subject), level: map(level), topic: map(topic) };
  }
}

/**
 * Whether the worked answer (explanation, correct options) may be shown with a learner's result:
 * never; after the due date (or, with no date, once solved or out of attempts); or once solved.
 */
export function revealAnswers(
  settings: AssignmentSettings,
  placement: PlacementState,
  state: LearnerState,
  now: Date,
): boolean {
  if (settings.explanationPolicy === 'never') return false;
  const finished = placement.progress === 'correct' || placement.attemptsLeft === 0;
  if (settings.explanationPolicy === 'after_due') {
    const deadline = state.dueAt;
    return deadline ? now > deadline : finished;
  }
  return finished && placement.progress !== 'evaluating';
}

function parseSpec(value: unknown) {
  const parsed = questionSpecSchema.safeParse(value ?? {});
  return parsed.success
    ? parsed.data
    : { fileKinds: [], maxFiles: 0, linkRequired: false, linkLabel: '', checklist: [] };
}

const byTitle = (a: LearnerAssignmentRow, b: LearnerAssignmentRow) =>
  a.title.localeCompare(b.title);
const time = (value: string | null, missing: number) => (value ? Date.parse(value) : missing);

/** The orders the list offers. Due first puts what is closest to its date on top. */
const SORTS: Record<
  LearnerAssignmentQuery['sort'],
  (a: LearnerAssignmentRow, b: LearnerAssignmentRow) => number
> = {
  due: (a, b) =>
    time(a.dueAt, Number.POSITIVE_INFINITY) - time(b.dueAt, Number.POSITIVE_INFINITY) ||
    byTitle(a, b),
  recent: (a, b) =>
    time(b.lastActivityAt, Number.NEGATIVE_INFINITY) -
      time(a.lastActivityAt, Number.NEGATIVE_INFINITY) || byTitle(a, b),
  title: byTitle,
  progress: (a, b) => b.progressPct - a.progressPct || byTitle(a, b),
};
