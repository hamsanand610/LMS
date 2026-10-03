import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  formatDateTime,
  TEST_QUESTION_TYPES,
  testSettingsSchema,
  type AttemptStatus,
  type Paginated,
  type QuestionType,
  type TestCreateInput,
  type TestDetail,
  type TestKind,
  type TestMonitor,
  type TestPaperInput,
  type TestResultRow,
  type TestScheduleInput,
  type TestScheduleUpdateInput,
  type TestScheduleRecord,
  type TestSettings,
  type TestStatus,
  type TestSummary,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { requireAuthorOrInstituteWide } from '../../core/scope/ownership.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { requireOpenAudience } from '../../core/scope/open-audience.js';
import { NotificationsService } from '../notifications/index.js';
import { QuestionsService } from '../questions/index.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: TestStatus;
  kind?: TestKind;
  batchId?: string;
}

const REORDER_OFFSET = -100_000;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export const DEFAULT_TEST_SETTINGS: TestSettings = {
  durationMinutes: 60,
  maxAttempts: 1,
  shuffleQuestions: false,
  shuffleOptions: false,
  resultPolicy: 'on_release',
  reviewPolicy: 'full',
  trackTabSwitches: true,
  requireFullScreen: false,
  showRank: false,
};

/** Building a paper, opening it to a batch, and everything staff see about how it went. */
@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly questions: QuestionsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────── authoring ─────────────────────────

  async list(query: ListQuery, user: AuthUser): Promise<Paginated<TestSummary>> {
    const org = await this.tenant.getOrganization();
    const visible = await this.visibleTestIds(user);
    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...(visible === null ? {} : { id: { in: visible } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.batchId ? { schedules: { some: { batchId: query.batchId } } } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        include: TEST_INCLUDE,
      }),
      this.prisma.test.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async get(id: string, user: AuthUser): Promise<TestDetail> {
    const test = await this.findForStaff(id, user);
    const sections = await this.prisma.testSection.findMany({
      where: { testId: id },
      orderBy: { position: 'asc' },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { question: { select: { title: true, type: true } } },
        },
      },
    });
    return {
      ...toSummary(test),
      instructions: test.instructions,
      sections: sections.map((section) => ({
        id: section.id,
        title: section.title,
        instructions: section.instructions,
        position: section.position,
        questions: section.questions.map((q) => ({
          id: q.id,
          questionId: q.questionId,
          title: q.question.title,
          type: q.question.type as QuestionType,
          marks: q.marks,
          negativeMarks: Number(q.negativeMarks),
          position: q.position,
        })),
      })),
    };
  }

  async create(input: TestCreateInput, user: AuthUser): Promise<TestSummary> {
    const org = await this.tenant.getOrganization();
    const test = await this.prisma.test.create({
      data: {
        organizationId: org.id,
        title: input.title,
        description: input.description,
        kind: input.kind,
        subject: input.subject,
        instructions: input.instructions,
        settings: asJson(input.settings),
        createdById: user.id,
      },
      include: TEST_INCLUDE,
    });
    await this.audit.record({
      action: 'test.created',
      resourceType: 'test',
      resourceId: test.id,
      summary: `Test "${test.title}" created`,
      after: { kind: test.kind },
    });
    return toSummary(test);
  }

  async update(id: string, input: Partial<TestCreateInput>, user: AuthUser): Promise<TestSummary> {
    const test = await this.findForStaff(id, user);
    requireAuthorOrInstituteWide(test, user, 'tests:manage', 'test');
    if (input.settings) await this.requireNoLiveAttempts(id, 'settings');
    const updated = await this.prisma.test.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.subject === undefined ? {} : { subject: input.subject }),
        ...(input.instructions === undefined ? {} : { instructions: input.instructions }),
        ...(input.settings === undefined ? {} : { settings: asJson(input.settings) }),
      },
      include: TEST_INCLUDE,
    });
    await this.audit.record({
      action: 'test.updated',
      resourceType: 'test',
      resourceId: id,
      summary: `Test "${updated.title}" updated`,
      before: { title: test.title },
      after: { title: updated.title },
    });
    return toSummary(updated);
  }

  /**
   * Replaces the paper. Refused once anybody has sat the test: removing a question would delete the
   * answers given to it, and changing marks would leave the scores already given wrong.
   */
  async savePaper(id: string, input: TestPaperInput, user: AuthUser): Promise<TestDetail> {
    const test = await this.findForStaff(id, user);
    requireAuthorOrInstituteWide(test, user, 'tests:manage', 'test');
    await this.requireNoLiveAttempts(id, 'paper');
    const sat = await this.prisma.testAttempt.count({ where: { testId: id } });
    if (sat > 0) {
      throw new DomainRuleError(
        `${sat} attempt(s) have been made at this test, so its paper is fixed; write a new test to change the questions`,
        'test_paper_fixed',
      );
    }

    const questionIds = input.sections.flatMap((s) => s.questions.map((q) => q.questionId));
    const pickable = await this.questions.pickable(questionIds, user);
    const missing = questionIds.filter((questionId) => !pickable.has(questionId));
    if (missing.length > 0) {
      throw new ValidationError([
        {
          path: 'sections',
          message: `${missing.length} question(s) are not published, or not yours to use`,
        },
      ]);
    }
    // A paper that holds a question it cannot answer would cost the learner its marks.
    const unanswerable = [...pickable.values()].filter(
      (question) => !TEST_QUESTION_TYPES.includes(question.type),
    );
    if (unanswerable.length > 0) {
      throw new ValidationError([
        {
          path: 'sections',
          message: `${unanswerable.length} question(s) cannot be answered in a timed test, which takes choices, written answers and code`,
        },
      ]);
    }

    const existing = await this.prisma.testSection.findMany({ where: { testId: id } });
    const keptSections = new Set(input.sections.map((s) => s.id).filter(Boolean) as string[]);
    for (const sectionId of keptSections) {
      if (!existing.some((s) => s.id === sectionId)) throw new NotFoundError('Section');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.testSection.deleteMany({
        where: { testId: id, id: { notIn: [...keptSections, ZERO_UUID] } },
      });
      let parked = REORDER_OFFSET;
      for (const sectionId of keptSections) {
        await tx.testSection.update({ where: { id: sectionId }, data: { position: parked } });
        parked += 1;
      }

      for (const [sectionIndex, sectionInput] of input.sections.entries()) {
        const sectionId = sectionInput.id
          ? (
              await tx.testSection.update({
                where: { id: sectionInput.id },
                data: {
                  title: sectionInput.title,
                  instructions: sectionInput.instructions,
                  position: sectionIndex,
                },
              })
            ).id
          : (
              await tx.testSection.create({
                data: {
                  testId: id,
                  title: sectionInput.title,
                  instructions: sectionInput.instructions,
                  position: sectionIndex,
                },
              })
            ).id;

        const placed = await tx.testQuestion.findMany({ where: { sectionId } });
        const wanted = new Set(sectionInput.questions.map((q) => q.questionId));
        await tx.testQuestion.deleteMany({
          where: { sectionId, questionId: { notIn: [...wanted, ZERO_UUID] } },
        });
        const byQuestion = new Map(placed.map((p) => [p.questionId, p]));
        let parkedQuestion = REORDER_OFFSET;
        for (const placement of placed) {
          if (!wanted.has(placement.questionId)) continue;
          await tx.testQuestion.update({
            where: { id: placement.id },
            data: { position: parkedQuestion },
          });
          parkedQuestion += 1;
        }
        for (const [index, question] of sectionInput.questions.entries()) {
          const marks = question.marks ?? pickable.get(question.questionId)?.marks ?? 1;
          const negativeMarks = question.negativeMarks ?? 0;
          const current = byQuestion.get(question.questionId);
          if (current) {
            await tx.testQuestion.update({
              where: { id: current.id },
              data: { position: index, marks, negativeMarks },
            });
          } else {
            await tx.testQuestion.create({
              data: {
                sectionId,
                questionId: question.questionId,
                position: index,
                marks,
                negativeMarks,
              },
            });
          }
        }
      }
    });

    await this.audit.record({
      action: 'test.paper_saved',
      resourceType: 'test',
      resourceId: id,
      summary: `${test.title}: ${input.sections.length} section(s)`,
      after: {
        sections: input.sections.length,
        questions: input.sections.reduce((n, s) => n + s.questions.length, 0),
      },
    });
    return this.get(id, user);
  }

  async setStatus(id: string, status: TestStatus, user: AuthUser): Promise<TestSummary> {
    const test = await this.findForStaff(id, user);
    requireAuthorOrInstituteWide(test, user, 'tests:manage', 'test');
    // Taking a test away from learners in the middle of a sitting would strand them.
    if (test.status === 'published' && status !== 'published') {
      await this.requireNoLiveAttempts(id, 'status');
    }
    if (status === 'published') {
      const questions = await this.prisma.testQuestion.count({
        where: { section: { testId: id } },
      });
      if (questions === 0) {
        throw new DomainRuleError(
          'Add at least one question before publishing this test',
          'test_has_no_questions',
        );
      }
    }
    const updated = await this.prisma.test.update({
      where: { id },
      data: { status },
      include: TEST_INCLUDE,
    });
    await this.audit.record({
      action: `test.${status}`,
      resourceType: 'test',
      resourceId: id,
      summary: `Test "${test.title}" is now ${status}`,
      before: { status: test.status },
      after: { status },
    });
    return toSummary(updated);
  }

  // ───────────────────────── schedules ─────────────────────────

  async schedules(id: string, user: AuthUser): Promise<TestScheduleRecord[]> {
    await this.findForStaff(id, user);
    const visible = await this.scope.visibleBatchIds(user, 'tests:manage');
    const rows = await this.prisma.testSchedule.findMany({
      where: { testId: id, ...(visible === null ? {} : { batchId: { in: visible } }) },
      orderBy: { opensAt: 'desc' },
      include: {
        batch: { select: { code: true, name: true } },
        _count: { select: { attempts: true } },
      },
    });
    return Promise.all(rows.map((row) => this.toScheduleRecord(row)));
  }

  async schedule(
    id: string,
    input: TestScheduleInput,
    user: AuthUser,
  ): Promise<TestScheduleRecord> {
    const test = await this.findForStaff(id, user);
    if (test.status !== 'published') {
      throw new DomainRuleError('Publish the test before scheduling it', 'test_not_published');
    }
    await this.requireBatchScope(input.batchId, user, 'tests:schedule');
    await requireOpenAudience(this.prisma, { batchIds: [input.batchId] });
    const existing = await this.prisma.testSchedule.findFirst({
      where: { testId: id, batchId: input.batchId },
    });
    if (existing) throw new ConflictError('That batch already has a window', 'already_scheduled');

    const created = await this.prisma.testSchedule.create({
      data: {
        testId: id,
        batchId: input.batchId,
        opensAt: new Date(input.opensAt),
        closesAt: new Date(input.closesAt),
        maxAttempts: input.maxAttempts,
        createdById: user.id,
      },
      include: {
        batch: { select: { code: true, name: true } },
        _count: { select: { attempts: true } },
      },
    });

    const members = await this.prisma.batchMember.findMany({
      where: { batchId: input.batchId, isActive: true },
      select: { student: { select: { userId: true } } },
    });
    if (members.length > 0) {
      await this.notifications.deliver({
        category: 'assessment',
        type: 'test.scheduled',
        title: `${test.title} is scheduled`,
        body: `It opens on ${formatDateTime(input.opensAt, { timeZone: (await this.tenant.getOrganization()).timezone })}.`,
        link: '/tests',
        channels: ['in_app', 'email'],
        userIds: members.map((m) => m.student.userId),
      });
    }
    await this.audit.record({
      action: 'test.scheduled',
      resourceType: 'test',
      resourceId: id,
      summary: `${test.title} opened to ${created.batch.code}`,
      after: { batchId: input.batchId, opensAt: input.opensAt, closesAt: input.closesAt },
    });
    this.events.emit('test.scheduled', { testId: id, scheduleId: created.id });
    return this.toScheduleRecord(created);
  }

  /**
   * Moves a batch's window. Before anyone starts it may change freely; once someone has, it may
   * only stay open longer and allow more attempts, so nobody loses time or a try they had. Learners
   * are told when it is extended.
   */
  async updateSchedule(
    id: string,
    scheduleId: string,
    input: TestScheduleUpdateInput,
    user: AuthUser,
  ): Promise<TestScheduleRecord> {
    const test = await this.findForStaff(id, user);
    const schedule = await this.findScheduleForStaff(id, scheduleId, user, 'tests:schedule');
    const opensAt = input.opensAt ? new Date(input.opensAt) : schedule.opensAt;
    const closesAt = input.closesAt ? new Date(input.closesAt) : schedule.closesAt;
    const maxAttempts = input.maxAttempts === undefined ? schedule.maxAttempts : input.maxAttempts;
    if (closesAt <= opensAt) {
      throw new ValidationError([
        { path: 'closesAt', message: 'The window must close after it opens' },
      ]);
    }
    const started = await this.prisma.testAttempt.count({ where: { scheduleId } });
    if (started > 0) {
      const issues: { path: string; message: string }[] = [];
      if (opensAt.getTime() !== schedule.opensAt.getTime()) {
        issues.push({ path: 'opensAt', message: 'Learners have started; the opening cannot move' });
      }
      if (closesAt < schedule.closesAt) {
        issues.push({
          path: 'closesAt',
          message: 'Learners have started; the window can only be extended',
        });
      }
      if (
        (schedule.maxAttempts ?? 0) > 0 &&
        maxAttempts !== null &&
        maxAttempts < schedule.maxAttempts!
      ) {
        issues.push({
          path: 'maxAttempts',
          message: 'Learners have started; attempts can only be added',
        });
      }
      if (issues.length > 0) throw new ValidationError(issues);
    }
    const updated = await this.prisma.testSchedule.update({
      where: { id: scheduleId },
      data: { opensAt, closesAt, maxAttempts },
      include: {
        batch: { select: { code: true, name: true } },
        _count: { select: { attempts: true } },
      },
    });
    await this.audit.record({
      action: 'test.window_changed',
      resourceType: 'test',
      resourceId: id,
      summary: `${test.title} for ${updated.batch.code}: ${opensAt.toISOString()} to ${closesAt.toISOString()}`,
      before: {
        opensAt: schedule.opensAt,
        closesAt: schedule.closesAt,
        maxAttempts: schedule.maxAttempts,
      },
      after: { opensAt, closesAt, maxAttempts },
    });
    if (closesAt > schedule.closesAt) {
      const members = await this.prisma.batchMember.findMany({
        where: { batchId: schedule.batchId, isActive: true },
        select: { student: { select: { userId: true } } },
      });
      if (members.length > 0) {
        await this.notifications.deliver({
          category: 'assessment',
          type: 'test.window_extended',
          title: `More time for ${test.title}`,
          body: `It now closes on ${formatDateTime(closesAt, { timeZone: (await this.tenant.getOrganization()).timezone })}.`,
          link: '/tests',
          channels: ['in_app'],
          userIds: members.map((m) => m.student.userId),
        });
      }
    }
    return this.toScheduleRecord(updated);
  }

  async unschedule(id: string, scheduleId: string, user: AuthUser): Promise<void> {
    const test = await this.findForStaff(id, user);
    await this.findScheduleForStaff(id, scheduleId, user, 'tests:schedule');
    const attempts = await this.prisma.testAttempt.count({ where: { scheduleId } });
    if (attempts > 0) {
      throw new DomainRuleError(
        `${attempts} learner(s) have already started; the window cannot be removed`,
        'schedule_in_use',
      );
    }
    await this.prisma.testSchedule.delete({ where: { id: scheduleId } });
    await this.audit.record({
      action: 'test.unscheduled',
      resourceType: 'test',
      resourceId: id,
      summary: `${test.title} withdrawn from a batch`,
    });
  }

  // ───────────────────────── results ─────────────────────────

  /** Staff see scores as soon as they exist; learners wait for the release (AC-07.3). */
  async results(id: string, scheduleId: string, user: AuthUser): Promise<TestResultRow[]> {
    await this.findForStaff(id, user, 'tests:read');
    await this.findScheduleForStaff(id, scheduleId, user, 'tests:read');
    const attempts = await this.prisma.testAttempt.findMany({
      where: { testId: id, scheduleId },
      orderBy: [{ score: 'desc' }],
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            members: { where: { isActive: true }, include: { batch: { select: { code: true } } } },
          },
        },
        answers: { select: { status: true } },
      },
    });
    return attempts.map((attempt) => ({
      attemptId: attempt.id,
      studentId: attempt.studentId,
      studentCode: attempt.student.studentCode,
      name: attempt.student.user.name,
      batchCode: attempt.student.members[0]?.batch.code ?? '',
      status: attempt.status as AttemptStatus,
      score: Number(attempt.score),
      totalMarks: attempt.totalMarks,
      percentage:
        attempt.totalMarks === 0
          ? 0
          : Math.round((Number(attempt.score) / attempt.totalMarks) * 100),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      tabSwitches: attempt.tabSwitches,
      pendingGrading: attempt.answers.filter((a) => a.status === 'awaiting_grading').length,
    }));
  }

  async release(id: string, scheduleId: string, user: AuthUser): Promise<{ notified: number }> {
    const test = await this.findForStaff(id, user, 'tests:release');
    if (!hasPermission(user, 'tests:release')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const schedule = await this.findScheduleForStaff(id, scheduleId, user, 'tests:release');
    if (schedule.releasedAt) {
      throw new ConflictError('Those results are already out', 'already_released');
    }
    const pending = await this.prisma.testAnswer.count({
      where: { attempt: { scheduleId }, status: 'awaiting_grading' },
    });
    if (pending > 0) {
      throw new DomainRuleError(
        `${pending} written answer(s) still need marking`,
        'grading_incomplete',
      );
    }

    await this.prisma.testSchedule.update({
      where: { id: scheduleId },
      data: { releasedAt: new Date(), releasedById: user.id },
    });
    const attempts = await this.prisma.testAttempt.findMany({
      where: { scheduleId, status: { in: ['submitted', 'graded'] } },
      include: { student: { select: { userId: true } } },
    });
    if (attempts.length > 0) {
      await this.notifications.deliver({
        category: 'assessment',
        type: 'test.released',
        title: `Results for ${test.title} are out`,
        body: 'Open the test to see how you did.',
        link: `/tests/${id}/result`,
        channels: ['in_app', 'email'],
        userIds: attempts.map((a) => a.student.userId),
      });
    }
    await this.audit.record({
      action: 'test.released',
      resourceType: 'test',
      resourceId: id,
      summary: `Results released to ${attempts.length} learner(s)`,
      after: { scheduleId },
    });
    this.events.emit('test.released', { testId: id, scheduleId });
    return { notified: attempts.length };
  }

  /** What the monitor shows while a test is running. */
  async monitor(id: string, scheduleId: string, user: AuthUser): Promise<TestMonitor> {
    await this.findForStaff(id, user, 'tests:monitor');
    if (!hasPermission(user, 'tests:monitor')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const schedule = await this.findScheduleForStaff(id, scheduleId, user, 'tests:monitor');

    const [learners, attempts] = await Promise.all([
      this.prisma.batchMember.count({ where: { batchId: schedule.batchId, isActive: true } }),
      this.prisma.testAttempt.findMany({
        where: { scheduleId },
        include: { student: { include: { user: { select: { name: true } } } } },
      }),
    ]);
    const inProgress = attempts.filter((a) => a.status === 'in_progress');
    const submitted = attempts.filter((a) => a.status !== 'in_progress');
    return {
      scheduleId,
      batchCode: schedule.batch.code,
      opensAt: schedule.opensAt.toISOString(),
      closesAt: schedule.closesAt.toISOString(),
      learners,
      notStarted: Math.max(0, learners - attempts.length),
      inProgress: inProgress.length,
      submitted: submitted.length,
      flagged: attempts
        .filter((a) => a.tabSwitches > 0)
        .sort((a, b) => b.tabSwitches - a.tabSwitches)
        .slice(0, 20)
        .map((a) => ({
          attemptId: a.id,
          name: a.student.user.name,
          tabSwitches: a.tabSwitches,
        })),
      asOf: new Date().toISOString(),
    };
  }

  // ───────────────────────── shared helpers ─────────────────────────

  settingsOf(test: { settings: unknown }): TestSettings {
    const parsed = testSettingsSchema.safeParse(test.settings ?? {});
    return parsed.success ? parsed.data : DEFAULT_TEST_SETTINGS;
  }

  /**
   * Test ids a staff caller may reach with `permission`; null when unrestricted. A batch-scoped
   * caller reaches the tests scheduled for their batches and the ones they wrote.
   */
  async visibleTestIds(user: AuthUser, permission = 'tests:manage'): Promise<string[] | null> {
    const batchIds = await this.scope.visibleBatchIds(user, permission);
    if (batchIds === null) return null;
    const scheduled = await this.prisma.testSchedule.findMany({
      where: { batchId: { in: batchIds } },
      select: { testId: true },
    });
    const own = await this.prisma.test.findMany({
      where: { createdById: user.id, deletedAt: null },
      select: { id: true },
    });
    return [...new Set([...scheduled.map((r) => r.testId), ...own.map((r) => r.id)])];
  }

  async findForStaff(id: string, user: AuthUser, permission = 'tests:manage') {
    const org = await this.tenant.getOrganization();
    const test = await this.prisma.test.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
      include: TEST_INCLUDE,
    });
    if (!test) throw new NotFoundError('Test');
    const visible = await this.visibleTestIds(user, permission);
    if (visible !== null && !visible.includes(id)) {
      throw new ForbiddenError('That test belongs to batches you do not teach');
    }
    return test;
  }

  /**
   * One window of a test, provided the caller may act on its batch with `permission`. Reaching the
   * test is not enough: a test opened to several batches has one window each, and a batch-scoped
   * trainer only answers for theirs.
   */
  async findScheduleForStaff(
    testId: string,
    scheduleId: string,
    user: AuthUser,
    permission: string,
  ) {
    const schedule = await this.prisma.testSchedule.findFirst({
      where: { id: scheduleId, testId },
      include: { batch: { select: { code: true } } },
    });
    if (!schedule) throw new NotFoundError('Schedule');
    await this.requireBatchVisible(schedule.batchId, user, permission);
    return schedule;
  }

  async requireBatchVisible(batchId: string, user: AuthUser, permission: string): Promise<void> {
    const visible = await this.scope.visibleBatchIds(user, permission);
    if (visible !== null && !visible.includes(batchId)) {
      throw new ForbiddenError('That batch is not one of yours');
    }
  }

  private async requireNoLiveAttempts(testId: string, what: string): Promise<void> {
    const live = await this.prisma.testAttempt.count({
      where: { testId, status: 'in_progress' },
    });
    if (live > 0) {
      throw new DomainRuleError(
        `${live} learner(s) are sitting this test; its ${what} cannot change now`,
        'test_in_progress',
      );
    }
  }

  private async requireBatchScope(batchId: string, user: AuthUser, permission: string) {
    if (!hasPermission(user, permission)) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, deletedAt: null } });
    if (!batch) throw new NotFoundError('Batch');
    const visible = await this.scope.visibleBatchIds(user, permission);
    if (visible !== null && !visible.includes(batchId)) {
      throw new ForbiddenError('That batch is not one of yours');
    }
  }

  private async toScheduleRecord(row: {
    id: string;
    batchId: string;
    opensAt: Date;
    closesAt: Date;
    maxAttempts: number | null;
    releasedAt: Date | null;
    batch: { code: string; name: string };
  }): Promise<TestScheduleRecord> {
    const [learners, started, submitted] = await Promise.all([
      this.prisma.batchMember.count({ where: { batchId: row.batchId, isActive: true } }),
      this.prisma.testAttempt.count({ where: { scheduleId: row.id } }),
      this.prisma.testAttempt.count({
        where: { scheduleId: row.id, status: { in: ['submitted', 'graded'] } },
      }),
    ]);
    return {
      id: row.id,
      batchId: row.batchId,
      batchCode: row.batch.code,
      batchName: row.batch.name,
      opensAt: row.opensAt.toISOString(),
      closesAt: row.closesAt.toISOString(),
      maxAttempts: row.maxAttempts,
      learners,
      started,
      submitted,
      releasedAt: row.releasedAt?.toISOString() ?? null,
    };
  }
}

const TEST_INCLUDE = {
  sections: { include: { questions: { select: { marks: true } } } },
  _count: { select: { schedules: true } },
} as const;

function toSummary(row: {
  id: string;
  title: string;
  description: string;
  kind: string;
  subject: string;
  status: string;
  settings: unknown;
  createdAt: Date;
  sections: { questions: { marks: number }[] }[];
  _count: { schedules: number };
}): TestSummary {
  const questions = row.sections.flatMap((s) => s.questions);
  const parsed = testSettingsSchema.safeParse(row.settings ?? {});
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind as TestKind,
    subject: row.subject,
    status: row.status as TestStatus,
    settings: parsed.success ? parsed.data : DEFAULT_TEST_SETTINGS,
    sectionCount: row.sections.length,
    questionCount: questions.length,
    totalMarks: questions.reduce((n, q) => n + q.marks, 0),
    scheduleCount: row._count.schedules,
    createdAt: row.createdAt.toISOString(),
  };
}
