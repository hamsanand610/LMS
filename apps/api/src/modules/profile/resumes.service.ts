import { Injectable } from '@nestjs/common';
import { MAX_RESUMES, type ResumeRecord } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Inject } from '@nestjs/common';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { ProfileService } from './profile.service.js';

/**
 * The learner's CVs (plan DP-S19, AC-12.1). The size and the file type are enforced by the
 * `resume` upload context — a file that is not a PDF, or is over the limit, never becomes a file
 * this service can be handed. What is enforced here is how many are kept and which one is offered
 * by default.
 */
@Injectable()
export class ResumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profile: ProfileService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async list(user: AuthUser): Promise<ResumeRecord[]> {
    const studentId = await this.profile.requireOwnStudentId(user);
    const rows = await this.prisma.resume.findMany({
      where: { studentId },
      orderBy: { uploadedAt: 'desc' },
    });
    const files = await this.filesById(rows.map((row) => row.fileId));
    return rows.map((row) => {
      const file = files.get(row.fileId);
      return {
        id: row.id,
        title: row.title || file?.originalName || 'Resume',
        filename: file?.originalName ?? '',
        sizeBytes: file?.size ?? 0,
        isDefault: row.isDefault,
        uploadedAt: row.uploadedAt.toISOString(),
      };
    });
  }

  async add(input: { fileId: string; title: string }, user: AuthUser): Promise<ResumeRecord[]> {
    const studentId = await this.profile.requireOwnStudentId(user);
    const file = await this.prisma.file.findUnique({ where: { id: input.fileId } });
    if (!file || file.status !== 'ready') {
      throw new DomainRuleError('Upload the file before attaching it', 'file_not_ready');
    }
    if (file.mime !== 'application/pdf') {
      throw new DomainRuleError('A resume has to be a PDF', 'resume_not_pdf');
    }

    const existing = await this.prisma.resume.count({ where: { studentId } });
    if (existing >= MAX_RESUMES) {
      throw new DomainRuleError(
        `You can keep ${MAX_RESUMES} resumes. Remove one before adding another.`,
        'too_many_resumes',
      );
    }

    const row = await this.prisma.resume.create({
      data: {
        studentId,
        fileId: input.fileId,
        title: input.title,
        // The first one uploaded is the one offered, until the learner says otherwise.
        isDefault: existing === 0,
      },
    });
    await this.prisma.file.update({ where: { id: input.fileId }, data: { ownerId: row.id } });
    await this.audit.record({
      action: 'profile.resume_added',
      resourceType: 'resume',
      resourceId: row.id,
      summary: input.title || file.originalName,
    });
    return this.list(user);
  }

  async setDefault(id: string, user: AuthUser): Promise<ResumeRecord[]> {
    const studentId = await this.profile.requireOwnStudentId(user);
    const row = await this.prisma.resume.findFirst({ where: { id, studentId } });
    if (!row) throw new NotFoundError('Resume');

    // Exactly one default, always: clear the rest in the same transaction as the new one.
    await this.prisma.$transaction([
      this.prisma.resume.updateMany({ where: { studentId }, data: { isDefault: false } }),
      this.prisma.resume.update({ where: { id }, data: { isDefault: true } }),
    ]);
    await this.audit.record({
      action: 'profile.resume_default',
      resourceType: 'resume',
      resourceId: id,
      summary: row.title,
    });
    return this.list(user);
  }

  async remove(id: string, user: AuthUser): Promise<ResumeRecord[]> {
    const studentId = await this.profile.requireOwnStudentId(user);
    const row = await this.prisma.resume.findFirst({ where: { id, studentId } });
    if (!row) throw new NotFoundError('Resume');

    await this.prisma.resume.delete({ where: { id } });
    if (row.isDefault) {
      // Removing the default promotes the next most recent, so there is never none.
      const next = await this.prisma.resume.findFirst({
        where: { studentId },
        orderBy: { uploadedAt: 'desc' },
      });
      if (next) {
        await this.prisma.resume.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    await this.audit.record({
      action: 'profile.resume_removed',
      resourceType: 'resume',
      resourceId: id,
      summary: row.title,
    });
    return this.list(user);
  }

  /** A short-lived link to the learner's own file. */
  async downloadUrl(id: string, user: AuthUser): Promise<{ url: string; filename: string }> {
    const studentId = await this.profile.requireOwnStudentId(user);
    const row = await this.prisma.resume.findFirst({ where: { id, studentId } });
    if (!row) throw new NotFoundError('Resume');
    const file = await this.prisma.file.findUnique({ where: { id: row.fileId } });
    if (!file) throw new NotFoundError('File');
    const url = await this.storage.presignDownload('private', file.key, 300, file.originalName);
    return { url, filename: file.originalName };
  }

  private async filesById(ids: string[]) {
    if (ids.length === 0) return new Map<string, { originalName: string; size: number }>();
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids } },
      select: { id: true, originalName: true, size: true },
    });
    return new Map(files.map((file) => [file.id, file]));
  }
}
