import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type RecordingInput, toLocalDateKey } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { ProgressService } from '../progress/index.js';
import { CoursesService } from './courses.service.js';
import { VideoService } from './video.driver.js';

/**
 * What a trainer does after a class: the recording becomes a lesson in a course, which is how a
 * learner who missed the class catches up. One action, so nobody has to build a lesson by hand.
 */
@Injectable()
export class RecordingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly video: VideoService,
    private readonly notifications: NotificationsService,
    private readonly progress: ProgressService,
    private readonly courses: CoursesService,
  ) {}

  async attach(
    sessionId: string,
    input: RecordingInput,
    user: AuthUser,
  ): Promise<{ lessonId: string; courseId: string; moduleId: string }> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { batch: { select: { code: true } } },
    });
    if (!session) throw new NotFoundError('Session');
    // The batch first: someone else's class is not described, not even whether it has a recording.
    await this.requireRunScope(session.batchId, user);
    if (session.recordingLessonId) {
      throw new ConflictError('This class already has a recording', 'recording_exists');
    }

    const org = await this.tenant.getOrganization();
    const course = await this.prisma.course.findFirst({
      where: { id: input.courseId, organizationId: org.id, deletedAt: null },
    });
    if (!course) throw new NotFoundError('Course');
    // A recording becomes a lesson of the course for everyone the course was given to, so without
    // `courses:manage` it goes only under a course given to this class's batch and to no batch the
    // trainer does not teach (D2): not one given to a programme or to the whole institute.
    // The course's staff speak for it (ADR-0023); anyone else follows D2.
    const authors = await this.courses.mayAuthor(course.id, user);
    if (!authors) {
      const [publications, taught] = await Promise.all([
        this.prisma.coursePublication.findMany({
          where: { courseId: course.id, unpublishedAt: null },
          select: { scopeType: true, scopeId: true },
        }),
        this.scope.visibleBatchIds(user, 'sessions:run'),
      ]);
      const toThisBatch = publications.some(
        (p) => p.scopeType === 'batch' && p.scopeId === session.batchId,
      );
      const beyond = publications.some(
        (p) => p.scopeType !== 'batch' || (taught !== null && !taught.includes(p.scopeId ?? '')),
      );
      if (!toThisBatch) {
        throw new ForbiddenError('That course has not been given to this class’s batch');
      }
      if (beyond) {
        throw new ForbiddenError(
          'That course is shared beyond your batches; ask whoever manages it to add the recording',
        );
      }
    }

    const module = await this.findOrCreateModule(course.id, input.moduleTitle, authors);
    const position = await this.prisma.lesson.count({ where: { moduleId: module.id } });
    // Watching completes against the lesson's length, so an uploaded recording carries its own
    // measured length when the browser gave one, not the class's scheduled length.
    const scheduled = Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 1000);
    const durationSeconds =
      input.fileId && input.durationSeconds ? input.durationSeconds : scheduled;
    const video = input.fileId
      ? await this.video.register(input.fileId, { uploadedBy: user.id }, durationSeconds)
      : null;
    const dateKey = toLocalDateKey(session.startsAt, org.timezone);

    const lesson = await this.prisma.lesson.create({
      data: {
        moduleId: module.id,
        title: `${session.subject} — ${dateKey}`,
        type: video ? 'video' : 'resources',
        position,
        durationSeconds,
        content: asJson({ html: '', video, questionId: null }),
        completionRule: video ? 'watch' : 'manual',
        // A catch-up recording is never required to finish the course.
        isMandatory: false,
        ...(input.url
          ? { resources: { create: [{ title: 'Recording', url: input.url, position: 0 }] } }
          : {}),
      },
    });
    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { recordingLessonId: lesson.id },
    });

    await this.audit.record({
      action: 'session.recording_attached',
      resourceType: 'live_session',
      resourceId: sessionId,
      summary: `${session.subject} recording published to ${course.title}`,
      after: { courseId: course.id, lessonId: lesson.id },
      actorId: user.id,
    });
    this.events.emit('recording.attached', {
      sessionId,
      lessonId: lesson.id,
      courseId: course.id,
    });
    // Optional lessons do not count where a course has mandatory ones; where it has none, they do.
    await this.progress.recomputeCourseForEveryone(course.id);
    await this.notifyBatch(session.batchId, session.subject, course.id, lesson.id);
    return { lessonId: lesson.id, courseId: course.id, moduleId: module.id };
  }

  /**
   * Recordings gather in one module per course, created the first time one is attached. Someone
   * who may not edit the course files only into a module holding nothing but class recordings, so
   * typing the name of an authored module cannot add lessons to it.
   */
  private async findOrCreateModule(courseId: string, title: string, authors: boolean) {
    const existing = await this.prisma.courseModule.findFirst({
      where: { courseId, title },
      include: { lessons: { select: { id: true } } },
    });
    if (existing && !authors) {
      const recordings =
        existing.lessons.length === 0
          ? 0
          : await this.prisma.liveSession.count({
              where: { recordingLessonId: { in: existing.lessons.map((l) => l.id) } },
            });
      if (existing.lessons.length === 0 || recordings < existing.lessons.length) {
        throw new ValidationError([
          {
            path: 'moduleTitle',
            message: 'A module of that name holds the course’s own lessons; choose another name',
          },
        ]);
      }
    }
    if (existing) return existing;
    const position = await this.prisma.courseModule.count({ where: { courseId } });
    return this.prisma.courseModule.create({
      data: { courseId, title, position, unlockRule: asJson({ type: 'always' }) },
    });
  }

  private async requireRunScope(batchId: string, user: AuthUser): Promise<void> {
    if (!hasPermission(user, 'sessions:run')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const visible = await this.scope.visibleBatchIds(user, 'sessions:run');
    if (visible !== null && !visible.includes(batchId)) {
      throw new ForbiddenError('That batch is not one of yours');
    }
  }

  private async notifyBatch(
    batchId: string,
    subject: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    const members = await this.prisma.batchMember.findMany({
      where: { batchId, isActive: true },
      select: { student: { select: { userId: true } } },
    });
    if (members.length === 0) return;
    await this.notifications.deliver({
      category: 'content',
      type: 'session.recording',
      title: `Recording of ${subject} is up`,
      body: 'Catch up on the class whenever you like.',
      link: `/courses/${courseId}/lessons/${lessonId}`,
      channels: ['in_app'],
      userIds: members.map((m) => m.student.userId),
    });
  }
}
