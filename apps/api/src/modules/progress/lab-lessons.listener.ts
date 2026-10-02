import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ProgressService } from './progress.service.js';

/** What the Labs publish once a submission has been judged in the sandbox (ADR-0018). */
interface ExecutionCompleted {
  runId: string;
  questionId: string;
  userId: string;
  context: string;
  verdict: string;
  trust: string;
}

/**
 * A lab lesson completes when its lab is passed, wherever the learner passed it: in the lesson or
 * in the Labs catalogue (ADR-0018). Every lab lesson that opens the lab, in a course the learner is
 * enrolled in, is completed — including one in a module not yet unlocked, since the work is done.
 */
@Injectable()
export class LabLessonsListener {
  private readonly logger = new Logger(LabLessonsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  @OnEvent('execution.completed')
  async onExecutionCompleted(event: ExecutionCompleted): Promise<void> {
    if (event.context !== 'practice' || event.verdict !== 'passed' || event.trust !== 'trusted') {
      return;
    }
    try {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: event.userId },
        select: { id: true },
      });
      if (!student) return;
      const lessons = await this.prisma.lesson.findMany({
        where: {
          type: 'lab',
          content: { path: ['questionId'], equals: event.questionId },
          module: {
            course: { deletedAt: null, enrollments: { some: { studentId: student.id } } },
          },
        },
        select: { id: true },
      });
      for (const lesson of lessons) await this.progress.completeLesson(student.id, lesson.id);
    } catch (error) {
      this.logger.error({ err: error, runId: event.runId }, 'Could not complete lab lessons');
    }
  }
}
