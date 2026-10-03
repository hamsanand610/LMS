import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { formatDateTime, type LearnerAssignmentStatus } from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { effectivePublication, learnerState } from './learner-state.js';
import { learnersReached, STATE_INCLUDE, toStateAssignment } from './reach.js';

const DUE_SOON_JOB = 'assignments.due_soon';
const OVERDUE_JOB = 'assignments.overdue';
const DAY_MS = 86_400_000;

/** A learner an assignment asks something of, with the dates and status their own page shows. */
interface Owing {
  userId: string;
  dueAt: Date;
  status: LearnerAssignmentStatus;
}

/**
 * Deadline notices, worked out per learner from the same state their assignment page shows
 * (`learnerState`): the publication that applies to them (their own extension first), its due
 * date or the last module's, and whether their work is in.
 *
 * - "Due soon" (Phase 2, LRN-16): a day before that due date, to learners who have work to do.
 * - "Overdue" (Phase 5): once the due date has passed, to learners whose status is `overdue` —
 *   work missing and late work still accepted. A learner who has handed everything in, whose
 *   assignment has closed (or refuses late work), who has left the batch or whose account is
 *   deactivated hears nothing.
 *
 * Each notice reaches a learner once per assignment and due date, however often the job runs
 * (the notice's dedupe key); a new due date, an extension say, is a new deadline.
 */
@Injectable()
export class DueRemindersService implements OnModuleInit {
  private readonly logger = new Logger(DueRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly tenant: TenantService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      DUE_SOON_JOB,
      async () => {
        await this.remind();
      },
      { cron: '15 * * * *' },
    );
    this.jobs.register(
      OVERDUE_JOB,
      async () => {
        await this.overdue();
      },
      { cron: '45 * * * *' },
    );
  }

  /** Reminds learners whose due date falls in the next day. Returns how many learners it told. */
  async remind(now = new Date()): Promise<number> {
    const timezone = (await this.tenant.getOrganization()).timezone;
    let told = 0;
    for (const assignment of await this.liveAssignments(now)) {
      const owing = (await this.owing(assignment.id, now)).filter(
        (o) =>
          o.dueAt > now &&
          o.dueAt.getTime() <= now.getTime() + DAY_MS &&
          (o.status === 'not_started' || o.status === 'in_progress'),
      );
      told += await this.notify(owing, (dueAt) => ({
        type: 'assignment.due_soon',
        title: `Due soon: ${assignment.title}`,
        body: `Due by ${formatDateTime(dueAt, { timeZone: timezone })}. Hand in what you have before then.`,
        assignmentId: assignment.id,
      }));
    }
    if (told > 0) this.logger.log(`Reminded ${told} learner(s) of assignments due soon`);
    return told;
  }

  /** Tells learners an assignment is overdue. Returns how many learners it told. */
  async overdue(now = new Date()): Promise<number> {
    const timezone = (await this.tenant.getOrganization()).timezone;
    let told = 0;
    for (const assignment of await this.liveAssignments(now)) {
      const owing = (await this.owing(assignment.id, now)).filter((o) => o.status === 'overdue');
      told += await this.notify(owing, (dueAt) => ({
        type: 'assignment.overdue',
        title: `Overdue: ${assignment.title}`,
        body: `It was due ${formatDateTime(dueAt, { timeZone: timezone })}. Late work is still accepted: hand in what you have.`,
        assignmentId: assignment.id,
      }));
    }
    if (told > 0) this.logger.log(`Told ${told} learner(s) of overdue assignments`);
    return told;
  }

  /** Published assignments with a live publication that is open and not yet closed. */
  private async liveAssignments(now: Date): Promise<{ id: string; title: string }[]> {
    return this.prisma.assignment.findMany({
      where: {
        status: 'published',
        deletedAt: null,
        publications: {
          some: {
            withdrawnAt: null,
            OR: [{ opensAt: null }, { opensAt: { lte: now } }],
            AND: [{ OR: [{ closesAt: null }, { closesAt: { gt: now } }] }],
          },
        },
      },
      select: { id: true, title: true },
    });
  }

  /** Every learner the assignment still reaches, with the due date and status they see. */
  private async owing(assignmentId: string, now: Date): Promise<Owing[]> {
    const publications = await this.prisma.assignmentPublication.findMany({
      where: { assignmentId, withdrawnAt: null },
    });
    const reached = await learnersReached(this.prisma, publications);
    const studentIds = [...reached.keys()];
    if (studentIds.length === 0) return [];
    const [row, students, submissions] = await Promise.all([
      this.prisma.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
        include: STATE_INCLUDE,
      }),
      this.prisma.studentProfile.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, userId: true },
      }),
      this.prisma.submission.findMany({
        where: { assignmentId, studentId: { in: studentIds } },
        select: {
          id: true,
          studentId: true,
          assignmentQuestionId: true,
          attempt: true,
          status: true,
          marks: true,
          reviewDecision: true,
          submittedAt: true,
        },
      }),
    ]);
    const assignment = toStateAssignment(row);
    const byId = new Map(publications.map((p) => [p.id, p]));
    const owing: Owing[] = [];
    for (const student of students) {
      const reaching = (reached.get(student.id) ?? []).map((id) => byId.get(id)!).filter(Boolean);
      const publication = effectivePublication(reaching);
      if (!publication) continue;
      const mine = submissions.filter((s) => s.studentId === student.id);
      const state = learnerState(assignment, publication, mine, now);
      if (!state.dueAt) continue;
      owing.push({ userId: student.userId, dueAt: state.dueAt, status: state.row.status });
    }
    return owing;
  }

  /** One notice per due date, keyed so that each learner has it once. */
  private async notify(
    owing: Owing[],
    notice: (dueAt: Date) => { type: string; title: string; body: string; assignmentId: string },
  ): Promise<number> {
    const byDue = new Map<number, Owing[]>();
    for (const learner of owing) {
      const list = byDue.get(learner.dueAt.getTime()) ?? [];
      list.push(learner);
      byDue.set(learner.dueAt.getTime(), list);
    }
    let told = 0;
    for (const [due, learners] of byDue) {
      const dueAt = new Date(due);
      const { type, title, body, assignmentId } = notice(dueAt);
      await this.notifications.deliver({
        category: 'assessment',
        type,
        title,
        body,
        link: `/assignments/${assignmentId}`,
        data: { assignmentId, dueAt: dueAt.toISOString() },
        channels: ['in_app'],
        userIds: learners.map((l) => l.userId),
        dedupeKey: `${type}:${assignmentId}:${dueAt.toISOString()}`,
      });
      told += learners.length;
    }
    return told;
  }
}
