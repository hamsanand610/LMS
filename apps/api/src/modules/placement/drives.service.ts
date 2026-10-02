import { Inject, Injectable } from '@nestjs/common';
import {
  APPLICATION_STATUS_LABELS,
  driveEligibilitySchema,
  formatDateTime,
  toLocalDateKey,
  type ApplicationRow,
  type ApplicationStatusInput,
  type DriveApplicationSummary,
  type DriveCard,
  type DriveDetail,
  type DriveEligibility,
  type DriveListQuery,
  type DriveStatus,
  type DriveUpsertInput,
  type EmploymentType,
  type Paginated,
  type PlacementSummary,
} from '@lms/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, scopeFor } from '../../core/auth/auth-user.js';
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
import { ScopeService } from '../../core/scope/scope.service.js';
import { SheetsService } from '../../core/sheets/sheets.service.js';
import { signedDownload } from '../../core/storage/signed-download.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { AttendanceService } from '../attendance/index.js';
import { NotificationsService } from '../notifications/index.js';
import { CompaniesService } from './companies.service.js';

const DRIVE_INCLUDE = {
  company: { select: { id: true, slug: true, name: true, logoFileId: true } },
} as const;

type DriveRow = {
  id: string;
  code: string;
  companyId: string;
  role: string;
  employmentType: string;
  location: string;
  packageText: string;
  description: string;
  eligibility: unknown;
  applyBy: Date;
  status: DriveStatus;
  publishedAt: Date | null;
  company: { id: string; slug: string; name: string; logoFileId: string | null };
};

/** What eligibility is judged on: the learner's batches, their programmes and attendance. */
interface LearnerContext {
  studentId: string;
  userId: string;
  batchIds: string[];
  programIds: string[];
  attendancePct: number | null;
}

interface Labels {
  batches: Map<string, string>;
  programs: Map<string, string>;
}

/** What staff tell the learner when a stage changes and they wrote no note of their own. */
const STAGE_MESSAGES: Record<ApplicationStatusInput['status'], string> = {
  applied: 'Your application is back under review.',
  shortlisted: 'You have been shortlisted. The placement team will share the next steps.',
  selected: 'Congratulations — you have been selected.',
  rejected: 'The company has not taken your application further this time.',
};

/**
 * The drives board (ADR-0014): staff post a drive with its eligibility and closing time, eligible
 * learners apply with their default resume, and staff move each application through its stages.
 * There is no offer workflow and no company login — the institute runs the board.
 */
@Injectable()
export class DrivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
    private readonly notifications: NotificationsService,
    private readonly companies: CompaniesService,
    private readonly sheets: SheetsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  // ───────────────────────── reading ─────────────────────────

  async list(user: AuthUser, query: DriveListQuery): Promise<Paginated<DriveCard>> {
    const org = await this.tenant.getOrganization();
    const learner = await this.learnerFor(user);
    const now = new Date();
    const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;

    const where: Prisma.PlacementDriveWhereInput = {
      organizationId: org.id,
      deletedAt: null,
      AND: [
        query.companyId ? { companyId: query.companyId } : {},
        contains ? { OR: [{ role: contains }, { company: { name: contains } }] } : {},
        learner ? learnerView(query.view, learner.studentId, now) : staffView(query),
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.placementDrive.findMany({
        where,
        include: DRIVE_INCLUDE,
        orderBy: { applyBy: learner && query.view === 'open' ? 'asc' : 'desc' },
        ...skipTake(query),
      }),
      this.prisma.placementDrive.count({ where }),
    ]);
    const labels = await this.labelsFor(rows.map((r) => parseEligibility(r.eligibility)));
    return paginate(await this.toCards(rows, learner, labels), total, query);
  }

  async get(id: string, user: AuthUser): Promise<DriveDetail> {
    const learner = await this.learnerFor(user);
    const row = await this.findOrThrow(id);
    if (learner && row.status === 'draft') throw new NotFoundError('Drive');
    return this.detail(row, learner);
  }

  /** The learner's placement picture for the dashboard. */
  async summaryFor(user: AuthUser): Promise<PlacementSummary> {
    const learner = await this.learnerFor(user);
    const empty: PlacementSummary = {
      eligibleOpen: 0,
      applied: 0,
      shortlisted: 0,
      selected: 0,
      nextDeadline: null,
    };
    if (!learner) return empty;
    const org = await this.tenant.getOrganization();
    const [open, applications] = await Promise.all([
      this.prisma.placementDrive.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          status: 'open',
          applyBy: { gt: new Date() },
        },
        include: DRIVE_INCLUDE,
        orderBy: { applyBy: 'asc' },
      }),
      this.prisma.driveApplication.findMany({
        where: { studentId: learner.studentId, drive: { deletedAt: null } },
        select: { driveId: true, status: true },
      }),
    ]);
    const active = applications.filter((a) => a.status !== 'withdrawn');
    const appliedTo = new Set(active.map((a) => a.driveId));
    const labels = await this.labelsFor(open.map((d) => parseEligibility(d.eligibility)));
    const candidates = open.filter(
      (d) =>
        !appliedTo.has(d.id) &&
        ineligibleReasons(parseEligibility(d.eligibility), learner, labels).length === 0,
    );
    const next = candidates[0];
    return {
      eligibleOpen: candidates.length,
      applied: active.length,
      shortlisted: active.filter((a) => a.status === 'shortlisted').length,
      selected: active.filter((a) => a.status === 'selected').length,
      nextDeadline: next
        ? {
            driveId: next.id,
            role: next.role,
            company: next.company.name,
            applyBy: next.applyBy.toISOString(),
          }
        : null,
    };
  }

  /** Everybody who applied, with what staff need to shortlist: batch, attendance, resume. */
  async applicants(id: string): Promise<ApplicationRow[]> {
    await this.findOrThrow(id);
    const rows = await this.prisma.driveApplication.findMany({
      where: { driveId: id },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            user: { select: { name: true, email: true } },
            members: { where: { isActive: true }, select: { batch: { select: { code: true } } } },
          },
        },
      },
      orderBy: { appliedAt: 'asc' },
    });
    const resumeIds = rows.map((r) => r.resumeId).filter((v): v is string => Boolean(v));
    const [resumes, attendance] = await Promise.all([
      resumeIds.length > 0
        ? this.prisma.resume.findMany({
            where: { id: { in: resumeIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      this.attendance.overallPercentages(rows.map((r) => r.studentId)),
    ]);
    const resumeBy = new Map(resumes.map((r) => [r.id, r]));
    return rows.map((row) => {
      const resume = row.resumeId ? resumeBy.get(row.resumeId) : undefined;
      return {
        id: row.id,
        student: {
          id: row.student.id,
          name: row.student.user.name,
          studentCode: row.student.studentCode,
          email: row.student.user.email,
        },
        batchCodes: row.student.members.map((m) => m.batch.code),
        attendancePct: attendance.get(row.studentId) ?? null,
        status: row.status,
        note: row.note,
        appliedAt: row.appliedAt.toISOString(),
        resume: resume ? { id: resume.id, title: resume.title || 'Resume' } : null,
      };
    });
  }

  /**
   * A short link to the résumé an applicant applied with. A résumé is personal data, so every
   * link handed out is audited, as the documents pages audit theirs.
   */
  async applicantResume(
    driveId: string,
    applicationId: string,
  ): Promise<{ url: string; expiresAt: string }> {
    await this.findOrThrow(driveId);
    const application = await this.prisma.driveApplication.findFirst({
      where: { id: applicationId, driveId },
      select: { resumeId: true, student: { select: { studentCode: true } } },
    });
    if (!application) throw new NotFoundError('Application');
    const resume = application.resumeId
      ? await this.prisma.resume.findUnique({
          where: { id: application.resumeId },
          select: { id: true, fileId: true },
        })
      : null;
    const file = resume
      ? await this.prisma.file.findUnique({ where: { id: resume.fileId } })
      : null;
    if (!resume || !file || file.status !== 'ready') throw new NotFoundError('Resume');
    const url = await signedDownload(
      this.storage,
      'private',
      file.key,
      'Resume',
      300,
      file.originalName,
    );
    await this.audit.record({
      action: 'placement.resume_viewed',
      resourceType: 'resume',
      resourceId: resume.id,
      summary: `Resume of ${application.student.studentCode} opened for a drive`,
      after: { driveId, applicationId },
    });
    return { url, expiresAt: new Date(Date.now() + 300_000).toISOString() };
  }

  /** A drive's applicants as a CSV file, audited as every export is. */
  async exportApplicants(driveId: string): Promise<{ filename: string; csv: string }> {
    const drive = await this.findOrThrow(driveId);
    const rows = await this.applicants(driveId);
    const body = this.sheets.writeCsv(
      [
        { key: 'name', header: 'Name' },
        { key: 'studentCode', header: 'Student code' },
        { key: 'email', header: 'Email' },
        { key: 'batches', header: 'Batches' },
        { key: 'attendance', header: 'Attendance %' },
        { key: 'status', header: 'Stage' },
        { key: 'appliedAt', header: 'Applied' },
      ],
      rows.map((row) => ({
        name: row.student.name,
        studentCode: row.student.studentCode,
        email: row.student.email,
        batches: row.batchCodes.join(' '),
        attendance: row.attendancePct ?? '',
        status: row.status,
        appliedAt: row.appliedAt.slice(0, 10),
      })),
    );
    await this.audit.record({
      action: 'placement.applicants_exported',
      resourceType: 'placement_drive',
      resourceId: driveId,
      summary: `${rows.length} applicant(s) of ${drive.role} exported`,
      after: { rows: rows.length },
    });
    const slug =
      drive.role
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'drive';
    return { filename: `applicants-${slug}.csv`, csv: body.toString('utf8') };
  }

  // ───────────────────────── staff changes ─────────────────────────

  async create(input: DriveUpsertInput, user: AuthUser): Promise<DriveDetail> {
    const org = await this.tenant.getOrganization();
    await this.assertReferences(input);
    const code = await this.nextCode(org.id, org.timezone);
    const row = await this.prisma.placementDrive.create({
      data: {
        organizationId: org.id,
        companyId: input.companyId,
        code,
        role: input.role,
        employmentType: input.employmentType,
        location: input.location,
        packageText: input.packageText,
        description: input.description,
        eligibility: asJson(input.eligibility),
        applyBy: new Date(input.applyBy),
        createdById: user.id,
      },
      include: DRIVE_INCLUDE,
    });
    await this.audit.record({
      action: 'drive.created',
      resourceType: 'placement_drive',
      resourceId: row.id,
      summary: `${row.code} · ${row.company.name} · ${row.role}`,
      after: { role: row.role, companyId: row.companyId, applyBy: row.applyBy },
    });
    return this.detail(row, null);
  }

  async update(id: string, input: DriveUpsertInput): Promise<DriveDetail> {
    const before = await this.findOrThrow(id);
    await this.assertReferences(input);
    const applyBy = new Date(input.applyBy);
    if (before.status === 'open' && applyBy <= new Date()) {
      throw new DomainRuleError(
        'An open drive needs a closing time in the future. Close the drive instead.',
        'drive_closing_in_past',
      );
    }
    if (before.companyId !== input.companyId) {
      const applied = await this.prisma.driveApplication.count({ where: { driveId: id } });
      if (applied > 0) {
        throw new DomainRuleError(
          'Learners have applied to this drive, so its company cannot change.',
          'drive_has_applications',
        );
      }
    }
    const row = await this.prisma.placementDrive.update({
      where: { id },
      data: {
        companyId: input.companyId,
        role: input.role,
        employmentType: input.employmentType,
        location: input.location,
        packageText: input.packageText,
        description: input.description,
        eligibility: asJson(input.eligibility),
        applyBy,
      },
      include: DRIVE_INCLUDE,
    });
    await this.audit.record({
      action: 'drive.updated',
      resourceType: 'placement_drive',
      resourceId: id,
      summary: `${row.code} · ${row.role}`,
      before: { role: before.role, applyBy: before.applyBy, eligibility: before.eligibility },
      after: { role: row.role, applyBy: row.applyBy, eligibility: row.eligibility },
    });
    return this.detail(row, null);
  }

  async setStatus(id: string, status: DriveStatus): Promise<DriveDetail> {
    const before = await this.findOrThrow(id);
    if (before.status === status) return this.detail(before, null);
    const now = new Date();
    if (status === 'open' && before.applyBy <= now) {
      throw new DomainRuleError(
        'The closing time has passed. Move it into the future before opening the drive.',
        'drive_closing_in_past',
      );
    }
    if (status === 'draft') {
      const applied = await this.prisma.driveApplication.count({ where: { driveId: id } });
      if (applied > 0) {
        throw new DomainRuleError(
          'Learners have applied to this drive, so it cannot go back to draft. Close it instead.',
          'drive_has_applications',
        );
      }
    }
    const firstPublish = status === 'open' && before.publishedAt === null;
    const row = await this.prisma.placementDrive.update({
      where: { id },
      data: { status, ...(firstPublish ? { publishedAt: now } : {}) },
      include: DRIVE_INCLUDE,
    });
    await this.audit.record({
      action: 'drive.status_changed',
      resourceType: 'placement_drive',
      resourceId: id,
      summary: `${row.code}: ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status },
    });
    if (firstPublish) await this.announce(row);
    return this.detail(row, null);
  }

  /** Removes a drive nobody has applied to; one with applications is closed instead. */
  async remove(id: string): Promise<void> {
    const row = await this.findOrThrow(id);
    const applied = await this.prisma.driveApplication.count({ where: { driveId: id } });
    if (applied > 0) {
      throw new DomainRuleError(
        'Learners have applied to this drive. Close it instead of removing it.',
        'drive_has_applications',
      );
    }
    await this.prisma.placementDrive.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      action: 'drive.removed',
      resourceType: 'placement_drive',
      resourceId: id,
      summary: `${row.code} · ${row.role}`,
    });
  }

  async setApplicationStatus(
    driveId: string,
    applicationId: string,
    input: ApplicationStatusInput,
    user: AuthUser,
  ): Promise<ApplicationRow> {
    const drive = await this.findOrThrow(driveId);
    const application = await this.prisma.driveApplication.findFirst({
      where: { id: applicationId, driveId },
      include: { student: { select: { userId: true } } },
    });
    if (!application) throw new NotFoundError('Application');
    if (application.status === 'withdrawn') {
      throw new DomainRuleError('The learner withdrew this application.', 'application_withdrawn');
    }
    await this.prisma.driveApplication.update({
      where: { id: applicationId },
      data: { status: input.status, note: input.note, updatedById: user.id },
    });
    await this.audit.record({
      action: 'drive.application_updated',
      resourceType: 'drive_application',
      resourceId: applicationId,
      summary: `${drive.code}: ${application.status} → ${input.status}`,
      before: { status: application.status, note: application.note },
      after: { status: input.status, note: input.note },
    });
    if (application.status !== input.status || application.note !== input.note) {
      await this.notifications.notifyUser(application.student.userId, {
        category: 'placement',
        type: 'drive.application_updated',
        title: `${drive.company.name} · ${drive.role}: ${APPLICATION_STATUS_LABELS[input.status]}`,
        body: input.note || STAGE_MESSAGES[input.status],
        link: `/placements/${driveId}`,
        channels: ['in_app', 'email'],
      });
    }
    const rows = await this.applicants(driveId);
    const updated = rows.find((r) => r.id === applicationId);
    if (!updated) throw new NotFoundError('Application');
    return updated;
  }

  // ───────────────────────── learner actions ─────────────────────────

  async apply(id: string, user: AuthUser): Promise<DriveDetail> {
    const learner = await this.learnerFor(user);
    if (!learner) throw new ForbiddenError('Only learners apply to drives.');
    const drive = await this.findOrThrow(id);
    if (drive.status !== 'open' || drive.applyBy <= new Date()) {
      throw new DomainRuleError('Applications for this drive have closed.', 'drive_closed');
    }
    const eligibility = parseEligibility(drive.eligibility);
    const reasons = ineligibleReasons(eligibility, learner, await this.labelsFor([eligibility]));
    if (reasons.length > 0) throw new DomainRuleError(reasons.join(' '), 'drive_not_eligible');

    const existing = await this.prisma.driveApplication.findUnique({
      where: { driveId_studentId: { driveId: id, studentId: learner.studentId } },
    });
    if (existing && existing.status !== 'withdrawn') {
      throw new ConflictError('You have already applied to this drive.');
    }
    const resume = await this.prisma.resume.findFirst({
      where: { studentId: learner.studentId },
      orderBy: [{ isDefault: 'desc' }, { uploadedAt: 'desc' }],
      select: { id: true },
    });
    const data = {
      status: 'applied' as const,
      note: '',
      resumeId: resume?.id ?? null,
      appliedAt: new Date(),
      updatedById: user.id,
    };
    const application = existing
      ? await this.prisma.driveApplication.update({ where: { id: existing.id }, data })
      : await this.prisma.driveApplication.create({
          data: { ...data, driveId: id, studentId: learner.studentId },
        });
    await this.audit.record({
      action: 'drive.applied',
      resourceType: 'drive_application',
      resourceId: application.id,
      summary: `${drive.code} · ${drive.role}`,
      after: { status: 'applied', resumeAttached: Boolean(resume) },
    });
    return this.detail(drive, learner);
  }

  async withdraw(id: string, user: AuthUser): Promise<DriveDetail> {
    const learner = await this.learnerFor(user);
    if (!learner) throw new ForbiddenError('Only learners withdraw applications.');
    const drive = await this.findOrThrow(id);
    const application = await this.prisma.driveApplication.findUnique({
      where: { driveId_studentId: { driveId: id, studentId: learner.studentId } },
    });
    if (!application || application.status === 'withdrawn') {
      throw new NotFoundError('Application');
    }
    if (application.status === 'selected' || application.status === 'rejected') {
      throw new DomainRuleError(
        'This application has been decided, so it can no longer be withdrawn.',
        'application_decided',
      );
    }
    await this.prisma.driveApplication.update({
      where: { id: application.id },
      data: { status: 'withdrawn', updatedById: user.id },
    });
    await this.audit.record({
      action: 'drive.withdrawn',
      resourceType: 'drive_application',
      resourceId: application.id,
      summary: `${drive.code} · ${drive.role}`,
      before: { status: application.status },
      after: { status: 'withdrawn' },
    });
    return this.detail(drive, learner);
  }

  // ───────────────────────── internals ─────────────────────────

  /** The caller as a learner, or null for staff. Staff see every drive, learners the published. */
  private async learnerFor(user: AuthUser): Promise<LearnerContext | null> {
    if (scopeFor(user, 'placements:read') !== 'own') return null;
    const person = await this.scope.personFor(user.id);
    if (!person.studentId)
      throw new ForbiddenError('Placements are for learners of the institute.');
    const [batches, attendance] = await Promise.all([
      this.prisma.batch.findMany({
        where: { id: { in: person.memberBatchIds } },
        select: { programId: true },
      }),
      this.attendance.overallPercentages([person.studentId]),
    ]);
    return {
      studentId: person.studentId,
      userId: user.id,
      batchIds: person.memberBatchIds,
      programIds: [...new Set(batches.map((b) => b.programId))],
      attendancePct: attendance.get(person.studentId) ?? null,
    };
  }

  private async findOrThrow(id: string): Promise<DriveRow> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.placementDrive.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
      include: DRIVE_INCLUDE,
    });
    if (!row) throw new NotFoundError('Drive');
    return row;
  }

  private async detail(row: DriveRow, learner: LearnerContext | null): Promise<DriveDetail> {
    const eligibility = parseEligibility(row.eligibility);
    const labels = await this.labelsFor([eligibility]);
    const [card] = await this.toCards([row], learner, labels);
    return {
      ...card!,
      description: row.description,
      eligibility: {
        ...eligibility,
        batches: eligibility.batchIds.map((id) => ({ id, code: labels.batches.get(id) ?? '—' })),
        programs: eligibility.programIds.map((id) => ({
          id,
          name: labels.programs.get(id) ?? '—',
        })),
      },
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }

  private async toCards(
    rows: DriveRow[],
    learner: LearnerContext | null,
    labels: Labels,
  ): Promise<DriveCard[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [mine, counts] = await Promise.all([
      learner
        ? this.prisma.driveApplication.findMany({
            where: { studentId: learner.studentId, driveId: { in: ids } },
          })
        : Promise.resolve([]),
      learner
        ? Promise.resolve([])
        : this.prisma.driveApplication.groupBy({
            by: ['driveId', 'status'],
            where: { driveId: { in: ids } },
            _count: { _all: true },
          }),
    ]);
    const mineBy = new Map(mine.map((a) => [a.driveId, a]));
    const now = new Date();
    return Promise.all(
      rows.map(async (row) => {
        const own = mineBy.get(row.id);
        const application: DriveApplicationSummary | null = own
          ? {
              id: own.id,
              status: own.status,
              note: own.note,
              appliedAt: own.appliedAt.toISOString(),
              updatedAt: own.updatedAt.toISOString(),
            }
          : null;
        const reasons = learner
          ? ineligibleReasons(parseEligibility(row.eligibility), learner, labels)
          : [];
        const closed = row.status !== 'open' || row.applyBy <= now;
        const tally = counts.filter((c) => c.driveId === row.id);
        return {
          id: row.id,
          code: row.code,
          company: {
            id: row.company.id,
            slug: row.company.slug,
            name: row.company.name,
            logoUrl: await this.companies.logoUrl(row.company.logoFileId),
          },
          role: row.role,
          employmentType: row.employmentType as EmploymentType,
          location: row.location,
          packageText: row.packageText,
          applyBy: row.applyBy.toISOString(),
          status: row.status,
          eligible: Boolean(learner) && !closed && reasons.length === 0,
          ineligibleReasons: reasons,
          application,
          applicantCount: tally
            .filter((c) => c.status !== 'withdrawn')
            .reduce((sum, c) => sum + c._count._all, 0),
          selectedCount: tally
            .filter((c) => c.status === 'selected')
            .reduce((sum, c) => sum + c._count._all, 0),
        };
      }),
    );
  }

  private async labelsFor(eligibilities: DriveEligibility[]): Promise<Labels> {
    const batchIds = [...new Set(eligibilities.flatMap((e) => e.batchIds))];
    const programIds = [...new Set(eligibilities.flatMap((e) => e.programIds))];
    const [batches, programs] = await Promise.all([
      batchIds.length > 0
        ? this.prisma.batch.findMany({
            where: { id: { in: batchIds } },
            select: { id: true, code: true },
          })
        : Promise.resolve([]),
      programIds.length > 0
        ? this.prisma.program.findMany({
            where: { id: { in: programIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      batches: new Map(batches.map((b) => [b.id, b.code])),
      programs: new Map(programs.map((p) => [p.id, p.name])),
    };
  }

  /** The company, batches and programmes a drive names must all be this institute's. */
  private async assertReferences(input: DriveUpsertInput): Promise<void> {
    const org = await this.tenant.getOrganization();
    const issues: { path: string; message: string }[] = [];
    const company = await this.prisma.company.findFirst({
      where: { id: input.companyId, organizationId: org.id, deletedAt: null },
      select: { id: true },
    });
    if (!company) issues.push({ path: 'companyId', message: 'Choose a company' });
    const { batchIds, programIds } = input.eligibility;
    if (batchIds.length > 0) {
      const found = await this.prisma.batch.count({
        where: { id: { in: batchIds }, organizationId: org.id, deletedAt: null },
      });
      if (found !== new Set(batchIds).size) {
        issues.push({ path: 'eligibility.batchIds', message: 'One of the batches does not exist' });
      }
    }
    if (programIds.length > 0) {
      const found = await this.prisma.program.count({
        where: { id: { in: programIds }, organizationId: org.id, deletedAt: null },
      });
      if (found !== new Set(programIds).size) {
        issues.push({
          path: 'eligibility.programIds',
          message: 'One of the programmes does not exist',
        });
      }
    }
    if (issues.length > 0) throw new ValidationError(issues);
  }

  /** DRV-<year>-<sequence>, numbered per institute and year. */
  private async nextCode(organizationId: string, timezone: string): Promise<string> {
    const prefix = `DRV-${toLocalDateKey(new Date(), timezone).slice(0, 4)}-`;
    const last = await this.prisma.placementDrive.findFirst({
      where: { organizationId, code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const sequence = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(sequence) ? sequence : 1).padStart(3, '0')}`;
  }

  /** Tells every learner who may apply that the drive is open. */
  private async announce(row: DriveRow): Promise<void> {
    const org = await this.tenant.getOrganization();
    const eligibility = parseEligibility(row.eligibility);
    const members = await this.prisma.batchMember.findMany({
      where: {
        isActive: true,
        batch: { organizationId: org.id, deletedAt: null },
        student: { user: { deletedAt: null, status: 'active' } },
      },
      select: {
        studentId: true,
        batchId: true,
        batch: { select: { programId: true } },
        student: { select: { userId: true } },
      },
    });
    const byStudent = new Map<string, LearnerContext>();
    for (const member of members) {
      const current = byStudent.get(member.studentId) ?? {
        studentId: member.studentId,
        userId: member.student.userId,
        batchIds: [],
        programIds: [],
        attendancePct: null,
      };
      current.batchIds.push(member.batchId);
      if (!current.programIds.includes(member.batch.programId)) {
        current.programIds.push(member.batch.programId);
      }
      byStudent.set(member.studentId, current);
    }
    const attendance = await this.attendance.overallPercentages([...byStudent.keys()]);
    const labels = await this.labelsFor([eligibility]);
    const userIds = [...byStudent.values()]
      .map((learner) => ({ ...learner, attendancePct: attendance.get(learner.studentId) ?? null }))
      .filter((learner) => ineligibleReasons(eligibility, learner, labels).length === 0)
      .map((learner) => learner.userId);
    if (userIds.length === 0) return;
    await this.notifications.deliver({
      category: 'placement',
      type: 'drive.opened',
      title: `${row.company.name} is hiring: ${row.role}`,
      body: `Applications close ${formatDateTime(row.applyBy, { timeZone: org.timezone })}. Check the eligibility and apply from Placements.`,
      link: `/placements/${row.id}`,
      channels: ['in_app', 'email'],
      userIds,
    });
  }
}

/** Learners never see drafts: open to apply, applied to, or past. */
function learnerView(
  view: DriveListQuery['view'],
  studentId: string,
  now: Date,
): Prisma.PlacementDriveWhereInput {
  switch (view) {
    case 'open':
      return { status: 'open', applyBy: { gt: now } };
    case 'applied':
      return {
        status: { not: 'draft' },
        applications: { some: { studentId, status: { not: 'withdrawn' } } },
      };
    case 'closed':
      return { status: { not: 'draft' }, OR: [{ status: 'closed' }, { applyBy: { lte: now } }] };
    default:
      return { status: { not: 'draft' } };
  }
}

function staffView(query: DriveListQuery): Prisma.PlacementDriveWhereInput {
  if (query.status) return { status: query.status };
  if (query.view === 'open') return { status: 'open' };
  if (query.view === 'closed') return { status: 'closed' };
  return {};
}

function parseEligibility(value: unknown): DriveEligibility {
  const parsed = driveEligibilitySchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { batchIds: [], programIds: [], minAttendancePct: null };
}

/** Why a learner may not apply, in words they can act on; empty when they may. */
export function ineligibleReasons(
  eligibility: DriveEligibility,
  learner: Pick<LearnerContext, 'batchIds' | 'programIds' | 'attendancePct'>,
  labels: Labels,
): string[] {
  const reasons: string[] = [];
  if (
    eligibility.batchIds.length > 0 &&
    !eligibility.batchIds.some((id) => learner.batchIds.includes(id))
  ) {
    const codes = eligibility.batchIds.map((id) => labels.batches.get(id)).filter(Boolean);
    reasons.push(`Open to ${codes.length > 0 ? codes.join(', ') : 'selected batches'} only.`);
  }
  if (
    eligibility.programIds.length > 0 &&
    !eligibility.programIds.some((id) => learner.programIds.includes(id))
  ) {
    const names = eligibility.programIds.map((id) => labels.programs.get(id)).filter(Boolean);
    reasons.push(
      `Open to the ${names.length > 0 ? names.join(' or ') : 'selected'} programme${names.length > 1 ? 's' : ''} only.`,
    );
  }
  if (
    eligibility.minAttendancePct !== null &&
    learner.attendancePct !== null &&
    learner.attendancePct < eligibility.minAttendancePct
  ) {
    reasons.push(
      `Needs ${eligibility.minAttendancePct}% attendance; yours is ${learner.attendancePct}%.`,
    );
  }
  return reasons;
}
