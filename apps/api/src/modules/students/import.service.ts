import { Injectable, Logger } from '@nestjs/common';
import {
  type ImportJobResult,
  type ImportRowError,
  STUDENT_IMPORT_COLUMNS,
  STUDENT_STATUSES,
  type StudentEducation,
  type StudentImportInput,
  type StudentStatus,
  emailSchema,
  mobileSchema,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { parseDelimited, rowToObject } from './csv.js';
import { StudentsService } from './students.service.js';

export const STUDENT_IMPORT_JOB = 'students.import';
const MAX_ROWS = 5000;
const MAX_ERRORS = 200;
/** A queued or running job older than this is treated as abandoned. */
const STALE_JOB_MINUTES = 15;

interface ImportJobPayload {
  jobId: string;
  actorId: string;
}

/**
 * Bulk student onboarding from a delimited sheet. The request only stores the file and queues the
 * work; the job creates accounts one row at a time so a single bad row never fails the batch.
 * A dry run validates and reports without writing anything.
 */
@Injectable()
export class StudentImportService {
  private readonly logger = new Logger(StudentImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly students: StudentsService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
  ) {
    this.jobs.register<ImportJobPayload>(STUDENT_IMPORT_JOB, async (payload) => {
      await this.run(payload.jobId, payload.actorId);
    });
  }

  /**
   * Template offered on the import page so a client starts from a valid sheet. The batch column is
   * left empty in the example row: the batch is normally chosen in the wizard, and a code that does
   * not exist in this deployment would make the very first import report an error.
   */
  static template(): string {
    const header = STUDENT_IMPORT_COLUMNS.join(',');
    const example = [
      'Aarav Sharma',
      'aarav.sharma@example.com',
      '+919876543210',
      '',
      'enrolled',
      '2004-06-15',
      'male',
      'Rahul Sharma',
      '+919876543200',
      'Chennai',
      'Tamil Nadu',
      'B.E. Computer Science',
      'Anna University',
      '2026',
    ].join(',');
    return `${header}\n${example}\n`;
  }

  async start(input: StudentImportInput, actor: AuthUser): Promise<ImportJobResult> {
    const org = await this.tenant.getOrganization();
    // Validate the sheet before anything else: a caller with a broken file should be told what is
    // wrong with it, not that somebody else is importing.
    const sheet = parseDelimited(input.content, MAX_ROWS + 1);
    if (sheet.headers.length === 0) {
      throw new ValidationError([{ path: 'content', message: 'The file has no header row' }]);
    }
    for (const required of ['name', 'email']) {
      if (!sheet.headers.includes(required)) {
        const message = `The header row must contain "${required}". Found: ${sheet.headers.join(', ')}`;
        throw new ValidationError([{ path: 'content', message }], message);
      }
    }
    if (sheet.rows.length > MAX_ROWS) {
      throw new ValidationError([
        { path: 'content', message: `At most ${MAX_ROWS} rows can be imported at once` },
      ]);
    }

    // One import at a time, so two runs cannot create the same person twice. A job whose process
    // died is marked failed after the stale window instead of blocking imports for ever.
    const staleBefore = new Date(Date.now() - STALE_JOB_MINUTES * 60_000);
    await this.prisma.importJob.updateMany({
      where: {
        organizationId: org.id,
        type: 'students',
        status: { in: ['queued', 'running'] },
        createdAt: { lt: staleBefore },
      },
      data: { status: 'failed', finishedAt: new Date() },
    });
    const running = await this.prisma.importJob.findFirst({
      where: { organizationId: org.id, type: 'students', status: { in: ['queued', 'running'] } },
    });
    if (running) {
      throw new ConflictError(
        'An import is already running; wait for it to finish',
        'import_running',
      );
    }

    const job = await this.prisma.importJob.create({
      data: {
        organizationId: org.id,
        type: 'students',
        status: 'queued',
        filename: input.filename,
        dryRun: input.dryRun,
        total: sheet.rows.length,
        params: {
          content: input.content,
          batchId: input.batchId,
          sendInvitations: input.sendInvitations,
        },
        requestedById: actor.id,
      },
    });
    await this.audit.record({
      action: 'students.import_started',
      resourceType: 'import_job',
      resourceId: job.id,
      after: { filename: input.filename, rows: sheet.rows.length, dryRun: input.dryRun },
      summary: `Student import started (${sheet.rows.length} rows${input.dryRun ? ', dry run' : ''})`,
    });
    await this.jobs.enqueue<ImportJobPayload>(STUDENT_IMPORT_JOB, {
      jobId: job.id,
      actorId: actor.id,
    });
    return this.status(job.id);
  }

  async status(jobId: string): Promise<ImportJobResult> {
    const org = await this.tenant.getOrganization();
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, organizationId: org.id },
    });
    if (!job) throw new NotFoundError('Import job');
    return {
      id: job.id,
      status: job.status,
      filename: job.filename,
      dryRun: job.dryRun,
      total: job.total,
      created: job.created,
      skipped: job.skipped,
      failed: job.failed,
      errors: (job.errors as unknown as ImportRowError[]) ?? [],
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
  }

  async recent(limit = 10): Promise<ImportJobResult[]> {
    const org = await this.tenant.getOrganization();
    const jobs = await this.prisma.importJob.findMany({
      where: { organizationId: org.id, type: 'students' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return Promise.all(jobs.map((j) => this.status(j.id)));
  }

  /** Executes one import job. Safe to re-run: rows whose email already exists are skipped. */
  async run(jobId: string, actorId: string): Promise<void> {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'done' || job.status === 'running') return;
    const params = job.params as {
      content: string;
      batchId: string | null;
      sendInvitations: boolean;
    };
    const actor = await this.actorFor(actorId);
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });

    const sheet = parseDelimited(params.content, MAX_ROWS);
    const errors: ImportRowError[] = [];
    const seenEmails = new Set<string>();
    let created = 0;
    // skipped = the person already exists; failed = the row could not be used at all.
    let skipped = 0;
    let failed = 0;

    const batchCodes = new Map<string, string>();
    for (const { line, cells } of sheet.rows) {
      const raw = rowToObject(sheet.headers, cells);
      const parsed = this.validateRow(raw, line, errors);
      if (!parsed) {
        failed += 1;
        continue;
      }
      if (seenEmails.has(parsed.email)) {
        skipped += 1;
        errors.push({
          row: line,
          column: 'email',
          value: parsed.email,
          message: 'The same email appears more than once in this file',
        });
        continue;
      }
      seenEmails.add(parsed.email);

      const existing = await this.prisma.user.findFirst({ where: { email: parsed.email } });
      if (existing) {
        skipped += 1;
        errors.push({
          row: line,
          column: 'email',
          value: parsed.email,
          message: 'An account with this email already exists',
        });
        continue;
      }

      let batchId = params.batchId;
      if (raw['batchCode']) {
        const code = raw['batchCode'].trim().toUpperCase();
        if (!batchCodes.has(code)) {
          const batch = await this.prisma.batch.findFirst({
            where: { code, deletedAt: null },
            select: { id: true },
          });
          batchCodes.set(code, batch?.id ?? '');
        }
        const resolved = batchCodes.get(code) ?? '';
        if (!resolved) {
          errors.push({
            row: line,
            column: 'batchCode',
            value: code,
            message: 'No batch with this code',
          });
          failed += 1;
          continue;
        }
        batchId = resolved;
      }

      if (job.dryRun) {
        created += 1;
        continue;
      }
      try {
        const student = await this.students.create(
          {
            name: parsed.name,
            email: parsed.email,
            mobile: parsed.mobile,
            batchId,
            status: parsed.status,
            sendInvitation: params.sendInvitations,
            custom: {},
          },
          actor,
        );
        if (parsed.hasProfile) {
          await this.students.update(
            student.id,
            { personal: parsed.personal, education: parsed.education },
            actor,
          );
        }
        created += 1;
      } catch (error) {
        failed += 1;
        errors.push({
          row: line,
          column: null,
          value: parsed.email,
          message: error instanceof Error ? error.message : 'Could not create this student',
        });
      }
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        created,
        skipped,
        failed,
        errors: asJson(errors.slice(0, MAX_ERRORS)),
        finishedAt: new Date(),
      },
    });
    await this.audit.record({
      action: 'students.import_finished',
      resourceType: 'import_job',
      resourceId: jobId,
      after: { created, skipped, errors: errors.length, dryRun: job.dryRun },
      summary: `Student import finished: ${created} created, ${skipped} skipped`,
      actorId,
    });
    this.logger.log(
      { jobId, created, skipped, errors: errors.length, dryRun: job.dryRun },
      'Student import finished',
    );
  }

  /** Validates one sheet row; pushes messages into `errors` and returns null when unusable. */
  private validateRow(
    raw: Record<string, string>,
    line: number,
    errors: ImportRowError[],
  ): {
    name: string;
    email: string;
    mobile: string;
    status: StudentStatus;
    personal: Record<string, string>;
    education: StudentEducation[];
    hasProfile: boolean;
  } | null {
    const before = errors.length;
    const name = (raw['name'] ?? '').trim();
    if (name.length < 2) {
      errors.push({ row: line, column: 'name', value: name, message: 'Enter the full name' });
    }
    const emailResult = emailSchema.safeParse(raw['email'] ?? '');
    if (!emailResult.success) {
      errors.push({
        row: line,
        column: 'email',
        value: raw['email'] ?? '',
        message: 'Enter a valid email address',
      });
    }
    const mobileRaw = (raw['mobile'] ?? '').replace(/[\s-]/g, '');
    if (mobileRaw && !mobileSchema.safeParse(mobileRaw).success) {
      errors.push({
        row: line,
        column: 'mobile',
        value: mobileRaw,
        message: 'Enter the mobile number with a country code, e.g. +919876543210',
      });
    }
    const statusRaw = (raw['status'] ?? 'enrolled').trim().toLowerCase();
    const status = (STUDENT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as StudentStatus)
      : null;
    if (status === null) {
      errors.push({
        row: line,
        column: 'status',
        value: statusRaw,
        message: `Use one of: ${STUDENT_STATUSES.join(', ')}`,
      });
    }
    if (errors.length > before) return null;

    const personal: Record<string, string> = {};
    for (const key of [
      'dateOfBirth',
      'gender',
      'guardianName',
      'guardianMobile',
      'city',
      'state',
    ]) {
      const value = (raw[key] ?? '').trim();
      if (value) personal[key] = value;
    }
    const education = raw['qualification']?.trim()
      ? [
          {
            qualification: raw['qualification'].trim(),
            institution: (raw['institution'] ?? '').trim(),
            specialisation: '',
            yearOfPassing: Number(raw['yearOfPassing']) || null,
            scorePercentage: null,
          },
        ]
      : [];
    return {
      name,
      email: emailResult.data!,
      mobile: mobileRaw,
      status: status!,
      personal,
      education,
      hasProfile: Object.keys(personal).length > 0 || education.length > 0,
    };
  }

  /** The import runs with the requester's permissions, rebuilt inside the job. */
  private async actorFor(actorId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actorId },
      include: {
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    const permissions = new Map<string, { key: string; scope: 'all' | 'batch' | 'own' }>();
    for (const userRole of user.roles) {
      for (const rp of userRole.role.permissions) {
        permissions.set(rp.permission.key, { key: rp.permission.key, scope: rp.scope });
      }
    }
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      status: user.status,
      roleKeys: user.roles.map((r) => r.role.key),
      permissions: [...permissions.values()],
      tokenVersion: user.tokenVersion,
      sessionId: null,
    };
  }
}
