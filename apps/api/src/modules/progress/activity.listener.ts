import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ACCEPTED_PRACTICE_RUN } from '../execution/index.js';
import { ProgressService } from './progress.service.js';

/**
 * The learner's activity feed records what they did, not only lessons (Phase 2, LRN-10): handing
 * in an assignment answer, sitting a test, solving a lab. It listens to the events those modules
 * already publish, so none of them has to know about the feed, and it never fails their request.
 */
@Injectable()
export class ActivityListener {
  private readonly logger = new Logger(ActivityListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  /** One entry per assignment per day, however many of its questions were handed in that day. */
  @OnEvent('submission.created')
  async onSubmission(payload: { assignmentId: string; studentId: string }): Promise<void> {
    try {
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: payload.studentId },
        select: { userId: true },
      });
      if (!student) return;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await this.prisma.activityEvent.count({
        where: {
          userId: student.userId,
          type: 'assignment.answered',
          entityId: payload.assignmentId,
          occurredAt: { gte: since },
        },
      });
      if (recent > 0) return;
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: payload.assignmentId },
        select: { title: true },
      });
      await this.progress.addActivity(payload.studentId, {
        type: 'assignment.answered',
        entityType: 'assignment',
        entityId: payload.assignmentId,
        title: `Handed in work for ${assignment?.title ?? 'an assignment'}`,
        link: `/assignments/${payload.assignmentId}`,
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not record assignment activity');
    }
  }

  /** A test the learner submitted; a paper the deadline submitted is not something they did. */
  @OnEvent('attempt.submitted')
  async onAttempt(payload: { attemptId: string; testId: string; auto: boolean }): Promise<void> {
    if (payload.auto) return;
    try {
      const attempt = await this.prisma.testAttempt.findUnique({
        where: { id: payload.attemptId },
        select: { studentId: true, test: { select: { title: true } } },
      });
      if (!attempt) return;
      await this.progress.addActivity(attempt.studentId, {
        type: 'test.submitted',
        entityType: 'test',
        entityId: payload.testId,
        title: `Sat ${attempt.test.title}`,
        link: `/tests/${payload.testId}/result?attempt=${payload.attemptId}`,
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not record test activity');
    }
  }

  /** The first time a lab is passed in the sandbox; passing it again adds nothing. */
  @OnEvent('execution.completed')
  async onExecution(payload: {
    userId: string;
    questionId: string;
    context: string;
    verdict: string;
    trust: string;
  }): Promise<void> {
    if (
      payload.context !== ACCEPTED_PRACTICE_RUN.context ||
      payload.verdict !== ACCEPTED_PRACTICE_RUN.verdict ||
      payload.trust !== ACCEPTED_PRACTICE_RUN.trust
    ) {
      return;
    }
    try {
      const already = await this.prisma.activityEvent.count({
        where: { userId: payload.userId, type: 'lab.solved', entityId: payload.questionId },
      });
      if (already > 0) return;
      const [student, question] = await Promise.all([
        this.prisma.studentProfile.findUnique({
          where: { userId: payload.userId },
          select: { id: true },
        }),
        this.prisma.question.findUnique({
          where: { id: payload.questionId },
          select: { title: true, slug: true },
        }),
      ]);
      if (!student || !question) return;
      await this.progress.addActivity(student.id, {
        type: 'lab.solved',
        entityType: 'question',
        entityId: payload.questionId,
        title: `Solved the lab ${question.title}`,
        link: `/labs/${question.slug}`,
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not record lab activity');
    }
  }
}
