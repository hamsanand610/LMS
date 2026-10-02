import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import type { CertificateDownload, CertificateRecord, CertificateVerification } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { newCertificateCode } from './certificate-code.js';
import { drawCertificate } from './certificate-pdf.js';

const ISSUE_JOB = 'certificates.issue';
const SWEEP_JOB = 'certificates.sweep';
/** How long a download link lasts. */
const LINK_SECONDS = 300;
/** Completed enrolments looked at per sweep; the next sweep carries on. */
const SWEEP_BATCH = 200;

type CertificateRow = {
  id: string;
  organizationId: string;
  code: string;
  courseId: string;
  courseTitle: string;
  learnerName: string;
  institute: string;
  completedAt: Date;
  issuedAt: Date;
  status: 'issued' | 'revoked';
  revokedAt: Date | null;
  objectKey: string;
};

/**
 * Certificates of course completion (ADR-0022). Issued automatically: the `course.completed` event
 * queues the issue, and a sweep every five minutes catches anything an event missed (AC-10.1).
 * Eligibility is the enrolment's completion, which the progress service records only when every
 * counted lesson is complete. A certificate, once issued, is a record: it is never recomputed or
 * withdrawn because the course changes later; only an administrator revokes one (Phase 4).
 */
@Injectable()
export class CertificatesService implements OnModuleInit {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly modules: ModuleStateService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.jobs.register<{ studentId: string; courseId: string }>(
      ISSUE_JOB,
      (payload) => this.issue(payload.studentId, payload.courseId),
      { concurrency: 1 },
    );
    this.jobs.register(
      SWEEP_JOB,
      async () => {
        await this.sweep();
      },
      { cron: '*/5 * * * *' },
    );
  }

  @OnEvent('course.completed')
  async onCourseCompleted(payload: { studentId: string; courseId: string }): Promise<void> {
    if (!(await this.modules.isEnabled('certificates'))) return;
    await this.jobs.enqueue(ISSUE_JOB, payload);
  }

  /**
   * Issues the certificate for a completed course, once. Running it again changes nothing, so the
   * event, the sweep and a retry can all call it safely.
   */
  async issue(studentId: string, courseId: string): Promise<void> {
    if (!(await this.modules.isEnabled('certificates'))) return;
    const enrolment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: {
        course: { select: { title: true, organizationId: true } },
        student: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    // Eligibility comes from real completion only: no completed enrolment, no certificate.
    if (!enrolment?.completedAt) return;

    let certificate = await this.prisma.certificate.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!certificate) {
      const org = await this.tenant.getOrganization();
      // Only the call that creates the record announces it; one that lost the race to another
      // (the event and the sweep together) finds it made and goes on to the PDF.
      let created = false;
      for (let tries = 0; !certificate; tries += 1) {
        try {
          certificate = await this.prisma.certificate.create({
            data: {
              organizationId: enrolment.course.organizationId,
              studentId,
              courseId,
              code: newCertificateCode(),
              learnerName: enrolment.student.user.name,
              courseTitle: enrolment.course.title,
              institute: org.name,
              completedAt: enrolment.completedAt,
            },
          });
          created = true;
        } catch (error) {
          if ((error as { code?: string }).code !== 'P2002' || tries >= 3) throw error;
          // Issued meanwhile by another caller, or (most unlikely) a code collision: look again.
          certificate = await this.prisma.certificate.findUnique({
            where: { studentId_courseId: { studentId, courseId } },
          });
        }
      }
      if (!created) return this.issueFound(certificate);
      await this.audit.record({
        action: 'certificate.issued',
        resourceType: 'certificate',
        resourceId: certificate.id,
        summary: `${certificate.learnerName}: ${certificate.courseTitle}`,
        after: { studentId, courseId, code: certificate.code },
      });
      this.events.emit('certificate.issued', {
        certificateId: certificate.id,
        studentId,
        courseId,
      });
      await this.notifications.deliver({
        category: 'content',
        type: 'certificate.issued',
        title: `Your certificate for ${certificate.courseTitle}`,
        body: 'You completed the course. Your certificate is ready to download and share.',
        link: '/certificates',
        channels: ['in_app', 'email'],
        userIds: [enrolment.student.userId],
      });
    }
    if (!certificate.objectKey) await this.drawPdf(certificate as CertificateRow);
  }

  /** A certificate another call has just issued: only its PDF may still be missing. */
  private async issueFound(certificate: { objectKey: string | null }): Promise<void> {
    if (!certificate.objectKey) await this.drawPdf(certificate as CertificateRow);
  }

  /** Issues what events missed, and draws any PDF a failure left undrawn. */
  async sweep(): Promise<number> {
    if (!(await this.modules.isEnabled('certificates'))) return 0;
    const org = await this.tenant.getOrganization();
    const completed = await this.prisma.enrollment.findMany({
      where: { completedAt: { not: null }, course: { organizationId: org.id } },
      select: { studentId: true, courseId: true },
    });
    const issued = await this.prisma.certificate.findMany({
      where: { organizationId: org.id },
      select: { studentId: true, courseId: true, objectKey: true },
    });
    const done = new Set(
      issued.filter((c) => c.objectKey).map((c) => `${c.studentId}:${c.courseId}`),
    );
    const pending = completed
      .filter((e) => !done.has(`${e.studentId}:${e.courseId}`))
      .slice(0, SWEEP_BATCH);
    for (const enrolment of pending) {
      try {
        await this.issue(enrolment.studentId, enrolment.courseId);
      } catch (error) {
        this.logger.error({ err: error, ...enrolment }, 'Could not issue a certificate');
      }
    }
    return pending.length;
  }

  /** The caller's own certificates, newest first. */
  async mine(user: AuthUser): Promise<CertificateRecord[]> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) return [];
    const rows = await this.prisma.certificate.findMany({
      where: { studentId: person.studentId },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map((row) => toRecord(row as CertificateRow));
  }

  /** A short-lived link to the caller's own certificate. Someone else's is simply not found. */
  async download(id: string, user: AuthUser): Promise<CertificateDownload> {
    const person = await this.scope.personFor(user.id);
    const row = person.studentId
      ? await this.prisma.certificate.findFirst({ where: { id, studentId: person.studentId } })
      : null;
    if (!row) throw new NotFoundError('Certificate');
    if (row.status === 'revoked') {
      throw new DomainRuleError('This certificate has been revoked', 'certificate_revoked');
    }
    if (!row.objectKey) {
      throw new DomainRuleError(
        'Your certificate is still being prepared. Try again in a minute.',
        'certificate_not_ready',
      );
    }
    // The PDF is drawn from the record alone, so one lost from storage is simply drawn again.
    if (!(await this.storage.head('private', row.objectKey)))
      await this.drawPdf(row as CertificateRow);
    const filename = `Certificate - ${row.courseTitle.replace(/[^\w .()-]+/g, ' ').trim()}.pdf`;
    const url = await this.storage.presignDownload(
      'private',
      row.objectKey,
      LINK_SECONDS,
      filename,
    );
    await this.audit.record({
      action: 'certificate.downloaded',
      resourceType: 'certificate',
      resourceId: row.id,
      summary: row.courseTitle,
    });
    return {
      url,
      filename,
      expiresAt: new Date(Date.now() + LINK_SECONDS * 1000).toISOString(),
    };
  }

  /**
   * The public check of a code (AC-10.2, AC-10.3): the name, the course, the dates and whether it
   * still stands. Nothing else about the learner, and "not found" for a code that does not exist.
   */
  async verify(code: string): Promise<CertificateVerification> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.certificate.findFirst({
      where: { code, organizationId: org.id },
    });
    if (!row) throw new NotFoundError('Certificate');
    return {
      code: row.code,
      learnerName: row.learnerName,
      courseTitle: row.courseTitle,
      institute: row.institute,
      completedAt: row.completedAt.toISOString(),
      issuedAt: row.issuedAt.toISOString(),
      status: row.status,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }

  private async drawPdf(certificate: CertificateRow): Promise<void> {
    const org = await this.tenant.getOrganization();
    const date = new Intl.DateTimeFormat('en-IN', {
      timeZone: org.timezone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const bytes = await drawCertificate({
      code: certificate.code,
      learnerName: certificate.learnerName,
      courseTitle: certificate.courseTitle,
      institute: certificate.institute,
      completedOn: date.format(certificate.completedAt),
      issuedOn: date.format(certificate.issuedAt),
      verifyUrl: `${this.config.WEB_BASE_URL.replace(/\/$/, '')}/verify/${certificate.code}`,
    });
    const key = `certificates/${certificate.organizationId}/${certificate.id}.pdf`;
    await this.storage.put('private', key, bytes, 'application/pdf');
    await this.prisma.certificate.update({
      where: { id: certificate.id },
      data: { objectKey: key },
    });
  }
}

function toRecord(row: CertificateRow): CertificateRecord {
  return {
    id: row.id,
    code: row.code,
    courseId: row.courseId,
    courseTitle: row.courseTitle,
    learnerName: row.learnerName,
    institute: row.institute,
    completedAt: row.completedAt.toISOString(),
    issuedAt: row.issuedAt.toISOString(),
    status: row.status,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    downloadable: row.status === 'issued' && Boolean(row.objectKey),
  };
}
