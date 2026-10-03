import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ERASED_LEARNER_NAME,
  SYSTEM_ROLES,
  testSettingsSchema,
  type LearnerDataExport,
  type PrivacyEraseInput,
  type PrivacyErasureResult,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { AuthContextService } from '../../core/auth/auth-context.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { DomainRuleError, NotFoundError, ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { FilesService } from '../files/index.js';

/** Notifications are many; the export carries the most recent this many. */
const EXPORT_NOTIFICATIONS = 1000;
/** SI Academy AI calls are many too; the export carries the most recent this many. */
const EXPORT_AI_REQUESTS = 1000;
const REMOVED = '(removed when the learner’s data was erased)';

const iso = (date: Date | null) => date?.toISOString() ?? null;

/**
 * Privacy operations (Phases 3–4, ADM-11): a learner's data handed over on request, and erasure
 * by anonymisation (P-I08: "erasure anonymises personal fields but keeps aggregates"). Both are
 * the Super Admin's (`privacy:manage`) and both are audited.
 *
 * Erasure removes who the learner is: name, e-mail, mobile, password, photo, profile, documents,
 * résumés, notes, notifications, activity, sessions; withdraws their certificates (the record
 * stays, under the erased name, so a verifier is told it is withdrawn rather than unknown); ends
 * their batch places; and removes the text of what they wrote. Marks, attendance, progress and
 * counts stay, belonging to nobody, so the institute's figures do not change. The audit log is
 * left as it is: it is the security record, and its retention is set separately (ADM-12).
 *
 * SI Academy AI (Phase 7C): the export carries their conversations — deleted ones too, until they
 * are purged — the calls made for them and their daily usage, naming no provider or model. Erasure
 * removes the conversations and messages; the calls and daily totals stay, belonging to nobody, so
 * the institute's usage and budget figures do not change. Phase 7D adds each conversation's notes
 * to the export, and the answers the cache keeps for them alone; erasure removes those answers
 * with the conversations (the notes and titles go with them). Answers shared between learners hold
 * nothing of anyone, and stay.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly authContext: AuthContextService,
    private readonly scope: ScopeService,
    private readonly files: FilesService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly events: EventEmitter2,
  ) {}

  async exportLearner(userId: string): Promise<{ filename: string; data: LearnerDataExport }> {
    const org = await this.tenant.getOrganization();
    const { user, profile } = await this.findLearner(userId, org.id);
    const studentId = profile.id;
    const [
      members,
      enrolments,
      lessons,
      attendance,
      submissions,
      attempts,
      documents,
      resumes,
      applications,
      doubts,
      certificates,
      feedback,
      notifications,
      sessions,
      ownerFields,
      aiConversations,
      aiRequests,
      aiUsage,
      aiCachedAnswers,
    ] = await Promise.all([
      this.prisma.batchMember.findMany({
        where: { studentId },
        select: { joinedAt: true, leftAt: true, batch: { select: { code: true, name: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.enrollment.findMany({
        where: { studentId },
        select: {
          status: true,
          progressPct: true,
          enrolledAt: true,
          completedAt: true,
          course: { select: { title: true } },
        },
        orderBy: { enrolledAt: 'asc' },
      }),
      this.prisma.lessonProgress.findMany({
        where: { studentId },
        select: { status: true, completedAt: true, lesson: { select: { title: true } } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { studentId },
        select: {
          status: true,
          batch: { select: { code: true } },
          session: { select: { title: true, startsAt: true } },
        },
        orderBy: { session: { startsAt: 'asc' } },
      }),
      this.prisma.submission.findMany({
        where: { studentId },
        select: {
          attempt: true,
          status: true,
          marks: true,
          maxMarks: true,
          submittedAt: true,
          isLate: true,
          language: true,
          text: true,
          code: true,
          assignment: { select: { title: true } },
        },
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.testAttempt.findMany({
        where: { studentId },
        select: {
          attempt: true,
          status: true,
          score: true,
          totalMarks: true,
          startedAt: true,
          submittedAt: true,
          test: { select: { title: true, settings: true } },
          schedule: { select: { releasedAt: true } },
        },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.document.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.resume.findMany({ where: { studentId }, orderBy: { uploadedAt: 'asc' } }),
      this.prisma.driveApplication.findMany({
        where: { studentId },
        select: {
          status: true,
          note: true,
          appliedAt: true,
          drive: { select: { role: true, company: { select: { name: true } } } },
        },
        orderBy: { appliedAt: 'asc' },
      }),
      this.prisma.doubt.findMany({
        where: { studentId },
        select: {
          title: true,
          body: true,
          status: true,
          createdAt: true,
          replies: {
            select: { authorId: true, body: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.certificate.findMany({ where: { studentId }, orderBy: { issuedAt: 'asc' } }),
      this.prisma.feedbackResponse.findMany({
        where: { studentId },
        select: {
          period: true,
          answers: true,
          submittedOn: true,
          form: { select: { title: true } },
        },
        orderBy: { submittedOn: 'asc' },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: { title: true, body: true, createdAt: true, readAt: true },
        orderBy: { createdAt: 'desc' },
        take: EXPORT_NOTIFICATIONS,
      }),
      this.prisma.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { deviceLabel: true, ip: true, createdAt: true, lastUsedAt: true },
      }),
      this.prisma.customFieldDefinition.findMany({
        where: { organizationId: org.id, entityType: 'student', visibility: 'staff_and_owner' },
        select: { key: true },
      }),
      this.prisma.aiConversation.findMany({
        where: { userId },
        select: {
          purpose: true,
          title: true,
          summary: true,
          createdAt: true,
          deletedAt: true,
          messages: {
            select: { role: true, content: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.aiRequest.findMany({
        where: { userId },
        select: {
          createdAt: true,
          task: true,
          outcome: true,
          inputTokens: true,
          outputTokens: true,
        },
        orderBy: { createdAt: 'desc' },
        take: EXPORT_AI_REQUESTS,
      }),
      this.prisma.aiUsageDaily.findMany({
        where: { userId },
        select: { day: true, requests: true, inputTokens: true, outputTokens: true },
        orderBy: { day: 'asc' },
      }),
      this.prisma.aiCacheEntry.findMany({
        where: { userId, scope: 'user' },
        select: { normalizedQuestion: true, answer: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const fileNames = new Map(
      (
        await this.prisma.file.findMany({
          where: { id: { in: [...documents, ...resumes].map((row) => row.fileId) } },
          select: { id: true, originalName: true },
        })
      ).map((file) => [file.id, file.originalName]),
    );
    const custom = (profile.custom ?? {}) as Record<string, unknown>;

    const data: LearnerDataExport = {
      exportedAt: new Date().toISOString(),
      institute: org.name,
      account: {
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        status: user.status,
        roles: user.roles.map((r) => r.role.name),
        createdAt: user.createdAt.toISOString(),
        emailVerifiedAt: iso(user.emailVerifiedAt),
        lastLoginAt: iso(user.lastLoginAt),
      },
      profile: {
        studentCode: profile.studentCode,
        status: profile.status,
        verificationStatus: profile.verificationStatus,
        personal: profile.personal,
        education: profile.education,
        experience: profile.experience,
        links: profile.links,
        summary: profile.summary,
        skills: profile.skills,
        projects: profile.projects,
        certifications: profile.certifications,
        custom: Object.fromEntries(
          ownerFields.filter((f) => f.key in custom).map((f) => [f.key, custom[f.key]]),
        ),
      },
      batches: members.map((m) => ({
        code: m.batch.code,
        name: m.batch.name,
        joinedAt: m.joinedAt.toISOString(),
        leftAt: iso(m.leftAt),
      })),
      enrolments: enrolments.map((e) => ({
        course: e.course.title,
        status: e.status,
        progressPct: e.progressPct,
        enrolledAt: e.enrolledAt.toISOString(),
        completedAt: iso(e.completedAt),
      })),
      lessons: lessons.map((l) => ({
        lesson: l.lesson.title,
        status: l.status,
        completedAt: iso(l.completedAt),
      })),
      attendance: attendance.map((a) => ({
        batch: a.batch.code,
        session: a.session.title,
        startsAt: a.session.startsAt.toISOString(),
        status: a.status,
      })),
      submissions: submissions.map((s) => ({
        assignment: s.assignment.title,
        attempt: s.attempt,
        status: s.status,
        marks: Number(s.marks),
        maxMarks: s.maxMarks,
        submittedAt: s.submittedAt.toISOString(),
        isLate: s.isLate,
        language: s.language,
        text: s.text,
        code: s.code,
      })),
      tests: attempts.map((a) => {
        const released =
          Boolean(a.schedule.releasedAt) ||
          testSettingsSchema.safeParse(a.test.settings ?? {}).data?.resultPolicy === 'immediately';
        const finished = a.status !== 'in_progress';
        return {
          test: a.test.title,
          attempt: a.attempt,
          status: a.status,
          score: finished && released ? Number(a.score) : null,
          totalMarks: a.totalMarks,
          startedAt: a.startedAt.toISOString(),
          submittedAt: iso(a.submittedAt),
        };
      }),
      documents: documents.map((d) => ({
        type: d.type,
        title: d.title,
        status: d.status,
        fileName: fileNames.get(d.fileId) ?? '',
        uploadedAt: d.createdAt.toISOString(),
      })),
      resumes: resumes.map((r) => ({
        title: r.title,
        fileName: fileNames.get(r.fileId) ?? '',
        uploadedAt: r.uploadedAt.toISOString(),
      })),
      applications: applications.map((a) => ({
        company: a.drive.company.name,
        role: a.drive.role,
        status: a.status,
        note: a.note,
        appliedAt: a.appliedAt.toISOString(),
      })),
      doubts: doubts.map((d) => ({
        title: d.title,
        body: d.body,
        status: d.status,
        askedAt: d.createdAt.toISOString(),
        replies: d.replies.map((r) => ({
          from: r.authorId === userId ? ('you' as const) : ('staff' as const),
          body: r.body,
          at: r.createdAt.toISOString(),
        })),
      })),
      certificates: certificates.map((c) => ({
        code: c.code,
        course: c.courseTitle,
        status: c.status,
        completedAt: c.completedAt.toISOString(),
        issuedAt: c.issuedAt.toISOString(),
      })),
      feedback: feedback.map((f) => ({
        form: f.form.title,
        period: f.period,
        answers: f.answers,
        submittedOn: f.submittedOn.toISOString().slice(0, 10),
      })),
      notifications: notifications.map((n) => ({
        title: n.title,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        readAt: iso(n.readAt),
      })),
      sessions: sessions.map((s) => ({
        device: s.deviceLabel,
        ip: s.ip,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: iso(s.lastUsedAt),
      })),
      ai: {
        conversations: aiConversations.map((c) => ({
          purpose: c.purpose,
          title: c.title,
          summary: c.summary,
          createdAt: c.createdAt.toISOString(),
          deletedAt: iso(c.deletedAt),
          messages: c.messages.map((m) => ({
            role: m.role,
            content: m.content,
            status: m.status,
            createdAt: m.createdAt.toISOString(),
          })),
        })),
        cachedAnswers: aiCachedAnswers.map((entry) => ({
          question: entry.normalizedQuestion,
          answer: entry.answer,
          createdAt: entry.createdAt.toISOString(),
          expiresAt: entry.expiresAt.toISOString(),
        })),
        requests: aiRequests.map((r) => ({
          at: r.createdAt.toISOString(),
          task: r.task,
          outcome: r.outcome,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
        })),
        usage: aiUsage.map((u) => ({
          day: u.day.toISOString().slice(0, 10),
          requests: u.requests,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
        })),
      },
    };

    await this.audit.record({
      action: 'privacy.exported',
      resourceType: 'user',
      resourceId: userId,
      summary: 'A learner’s data was exported on request',
      after: { studentId },
    });
    return {
      filename: `learner-data-${profile.studentCode.toLowerCase()}-${data.exportedAt.slice(0, 10)}.json`,
      data,
    };
  }

  async eraseLearner(
    userId: string,
    input: PrivacyEraseInput,
    actor: AuthUser,
  ): Promise<PrivacyErasureResult> {
    if (userId === actor.id) {
      throw new DomainRuleError('You cannot erase your own account', 'self_action');
    }
    const org = await this.tenant.getOrganization();
    const { user, profile } = await this.findLearner(userId, org.id);
    // Staff accounts carry what others rely on (authored content, marks given); they are
    // deactivated, not erased. A learner who is also staff loses the staff roles first.
    const staffRoles = user.roles.filter((r) => r.role.key !== SYSTEM_ROLES.STUDENT);
    if (staffRoles.length > 0) {
      throw new DomainRuleError(
        `This account also holds ${staffRoles.map((r) => r.role.name).join(', ')}; remove those roles before erasing it`,
        'privacy_staff_account',
      );
    }
    if (input.confirmEmail !== user.email.toLowerCase()) {
      throw new ValidationError([
        { path: 'confirmEmail', message: 'Type the learner’s e-mail address to confirm' },
      ]);
    }
    const studentId = profile.id;
    const now = new Date();

    // Storage first: if it fails, nothing else has changed and the erasure can simply be repeated.
    const [documents, resumes, certificates] = await Promise.all([
      this.prisma.document.findMany({ where: { studentId }, select: { fileId: true } }),
      this.prisma.resume.findMany({ where: { studentId }, select: { fileId: true } }),
      this.prisma.certificate.findMany({ where: { studentId }, select: { objectKey: true } }),
    ]);
    const files = await this.files.purge({
      ids: [
        ...documents.map((d) => d.fileId),
        ...resumes.map((r) => r.fileId),
        ...(user.avatarFileId ? [user.avatarFileId] : []),
      ],
      uploadedById: userId,
    });
    for (const certificate of certificates) {
      if (certificate.objectKey) await this.storage.delete('private', certificate.objectKey);
    }

    const counts = await this.prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            name: ERASED_LEARNER_NAME,
            email: `erased-${userId}@erased.invalid`,
            mobile: null,
            passwordHash: null,
            avatarFileId: null,
            status: 'deactivated',
            emailVerifiedAt: null,
            lastLoginAt: null,
            failedLoginCount: 0,
            lockedUntil: null,
            tokenVersion: { increment: 1 },
            deletedAt: now,
          },
        });
        await tx.studentProfile.update({
          where: { id: studentId },
          data: {
            studentCode: `ERASED-${studentId.replace(/-/g, '').slice(-24)}`,
            verificationStatus: 'unverified',
            personal: {},
            education: [],
            experience: [],
            links: {},
            summary: '',
            skills: [],
            projects: [],
            certifications: [],
            custom: {},
            completeness: 0,
          },
        });
        const memberships = await tx.batchMember.updateMany({
          where: { studentId, isActive: true },
          data: { isActive: false, leftAt: now, reason: 'Erased at the learner’s request' },
        });
        await tx.driveApplication.updateMany({
          where: { studentId },
          data: { resumeId: null, note: '' },
        });
        const removedDocuments = await tx.document.deleteMany({ where: { studentId } });
        const removedResumes = await tx.resume.deleteMany({ where: { studentId } });
        await tx.certificate.updateMany({
          where: { studentId, status: 'issued' },
          data: {
            status: 'revoked',
            revokedAt: now,
            revokedReason: 'Withdrawn when the learner’s data was erased',
          },
        });
        const withdrawn = await tx.certificate.updateMany({
          where: { studentId },
          data: { learnerName: ERASED_LEARNER_NAME, objectKey: '' },
        });

        // One at a time: an interactive transaction runs its statements on one connection.
        const total = async (steps: (() => Promise<{ count: number }>)[]) => {
          let sum = 0;
          for (const step of steps) sum += (await step()).count;
          return sum;
        };
        const deleted = await total([
          () => tx.session.deleteMany({ where: { userId } }),
          () => tx.invitation.deleteMany({ where: { userId } }),
          () => tx.passwordReset.deleteMany({ where: { userId } }),
          () => tx.notification.deleteMany({ where: { userId } }),
          () => tx.notificationPreference.deleteMany({ where: { userId } }),
          () => tx.activityEvent.deleteMany({ where: { userId } }),
          () => tx.labDraft.deleteMany({ where: { userId } }),
          () => tx.companyFavourite.deleteMany({ where: { userId } }),
          () => tx.studentNote.deleteMany({ where: { studentId } }),
          // SI Academy AI: what they asked and were answered (Phase 7C), the answers kept for them
          // alone, and their conversations with their titles and notes (Phase 7D).
          () => tx.aiCacheEntry.deleteMany({ where: { userId } }),
          () => tx.aiMessage.deleteMany({ where: { userId } }),
          () => tx.aiConversation.deleteMany({ where: { userId } }),
        ]);
        // What they wrote loses its text; its marks, verdicts and counts stay.
        const redacted = await total([
          () =>
            tx.submission.updateMany({
              where: { studentId },
              data: {
                text: '',
                code: '',
                payload: {},
                fileIds: [],
                compileOutput: '',
                evaluationError: '',
                graderComment: '',
              },
            }),
          () =>
            tx.submissionResult.updateMany({
              where: { submission: { studentId } },
              data: { actualOutput: '', stderr: '' },
            }),
          () =>
            tx.submissionReview.updateMany({
              where: { submission: { studentId } },
              data: { comment: '' },
            }),
          () =>
            tx.testAnswer.updateMany({
              where: { attempt: { studentId } },
              data: { text: '', code: '', graderComment: '' },
            }),
          () => tx.testAttempt.updateMany({ where: { studentId }, data: { integrityLog: [] } }),
          () =>
            tx.doubt.updateMany({ where: { studentId }, data: { title: REMOVED, body: REMOVED } }),
          () => tx.doubtReply.updateMany({ where: { authorId: userId }, data: { body: REMOVED } }),
          () => tx.attendanceRecord.updateMany({ where: { studentId }, data: { note: '' } }),
          () => tx.feedbackResponse.updateMany({ where: { studentId }, data: { studentId: null } }),
          () =>
            tx.executionRun.updateMany({
              where: { userId },
              data: { userId: null, code: '', detail: [] },
            }),
          // SI Academy AI's calls and daily totals stay, belonging to nobody (Phase 7C).
          () =>
            tx.aiRequest.updateMany({
              where: { userId },
              data: { userId: null, conversationId: null, messageId: null, requestId: null },
            }),
          () => tx.aiUsageDaily.updateMany({ where: { userId }, data: { userId: null } }),
        ]);
        return {
          memberships: memberships.count,
          documents: removedDocuments.count,
          resumes: removedResumes.count,
          certificates: withdrawn.count,
          deleted,
          redacted,
        };
      },
      { timeout: 60_000 },
    );

    this.authContext.invalidate(userId);
    this.scope.invalidateAll();
    const result: PrivacyErasureResult = { userId, files, ...counts };
    await this.audit.record({
      action: 'privacy.erased',
      resourceType: 'user',
      resourceId: userId,
      summary: 'A learner’s data was erased by anonymisation',
      after: { ...result, reason: input.reason },
    });
    // An erased account is a deactivated one: its open courses are withdrawn, as any deactivated
    // account's are (Phase 5); completed ones stay, anonymised, as the institute's record.
    await this.events.emitAsync('user.deactivated', { userId, erased: true });
    return result;
  }

  /** A learner of this institute who has not been erased already. */
  private async findLearner(userId: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      include: { roles: { include: { role: true } }, studentProfile: true },
    });
    if (!user) throw new NotFoundError('User');
    if (!user.studentProfile) {
      throw new DomainRuleError(
        'Only a learner’s data is exported or erased here',
        'privacy_learner_only',
      );
    }
    return { user, profile: user.studentProfile };
  }
}
