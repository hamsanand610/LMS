import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DocumentStatus, DocumentType } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { StudentsService } from './students.service.js';

export interface DocumentRecord {
  id: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  reason: string;
  fileName: string;
  fileSize: number;
  mime: string;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * Documents a student submits (id proof, marksheets). Files live in the private bucket and are
 * only ever handed out as short-lived presigned links, which are audited.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async list(studentId: string, user: AuthUser): Promise<DocumentRecord[]> {
    const student = await this.students.find(studentId, user);
    const rows = await this.prisma.document.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    const files = await this.filesById(rows.map((r) => r.fileId));
    return rows.map((row) => toRecord(row, files.get(row.fileId)));
  }

  async add(
    studentId: string,
    input: { type: DocumentType; fileId: string; title: string },
    user: AuthUser,
  ): Promise<DocumentRecord> {
    const student = await this.students.find(studentId, user);
    const file = await this.prisma.file.findUnique({ where: { id: input.fileId } });
    if (!file || file.status !== 'ready') {
      throw new DomainRuleError('Upload the file before attaching it', 'file_not_ready');
    }
    const row = await this.prisma.document.create({
      data: {
        studentId: student.id,
        type: input.type,
        title: input.title,
        fileId: input.fileId,
        status: 'pending',
      },
    });
    await this.prisma.file.update({
      where: { id: input.fileId },
      data: { ownerId: row.id },
    });
    await this.refreshVerification(student.id);
    await this.audit.record({
      action: 'students.document_added',
      resourceType: 'document',
      resourceId: row.id,
      after: { studentId: student.id, type: input.type },
      summary: `Document ${input.type} added for ${student.studentCode}`,
    });
    return toRecord(row, file);
  }

  /**
   * The same two operations for a learner acting on their own record. The caller has already been
   * resolved to their own student id, so there is no staff scope check to make — and no way to
   * reach anybody else's documents through this path.
   */
  async listOwn(studentId: string): Promise<DocumentRecord[]> {
    const rows = await this.prisma.document.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    const files = await this.filesById(rows.map((r) => r.fileId));
    return rows.map((row) => toRecord(row, files.get(row.fileId)));
  }

  async addOwn(
    studentId: string,
    input: { type: DocumentType; fileId: string; title: string },
  ): Promise<DocumentRecord[]> {
    const file = await this.prisma.file.findUnique({ where: { id: input.fileId } });
    if (!file || file.status !== 'ready') {
      throw new DomainRuleError('Upload the file before attaching it', 'file_not_ready');
    }
    const row = await this.prisma.document.create({
      data: {
        studentId,
        type: input.type,
        title: input.title,
        fileId: input.fileId,
        status: 'pending',
      },
    });
    await this.prisma.file.update({ where: { id: input.fileId }, data: { ownerId: row.id } });
    await this.refreshVerification(studentId);
    await this.audit.record({
      action: 'profile.document_added',
      resourceType: 'document',
      resourceId: row.id,
      after: { type: input.type },
      summary: `${input.type} uploaded by the student`,
    });
    return this.listOwn(studentId);
  }

  async decide(
    studentId: string,
    documentId: string,
    decision: 'verified' | 'rejected',
    reason: string,
    user: AuthUser,
  ): Promise<DocumentRecord> {
    const student = await this.students.find(studentId, user);
    const before = await this.prisma.document.findFirst({
      where: { id: documentId, studentId: student.id },
    });
    if (!before) throw new NotFoundError('Document');
    const row = await this.prisma.document.update({
      where: { id: documentId },
      data: { status: decision, reason, reviewedById: user.id, reviewedAt: new Date() },
    });
    await this.refreshVerification(student.id);
    await this.audit.record({
      action: 'students.document_reviewed',
      resourceType: 'document',
      resourceId: documentId,
      before: { status: before.status, reason: before.reason },
      after: { status: decision, reason },
      summary: `Document ${row.type} of ${student.studentCode} ${decision}`,
    });
    this.events.emit('student.document_reviewed', {
      studentId: student.id,
      documentId,
      decision,
    });
    const file = await this.prisma.file.findUnique({ where: { id: row.fileId } });
    return toRecord(row, file ?? undefined);
  }

  /** Short-lived download link; each issue is audited because documents are personal data. */
  async downloadUrl(
    studentId: string,
    documentId: string,
    user: AuthUser,
  ): Promise<{ url: string; expiresAt: string }> {
    const student = await this.students.find(studentId, user);
    const row = await this.prisma.document.findFirst({
      where: { id: documentId, studentId: student.id },
    });
    if (!row) throw new NotFoundError('Document');
    const file = await this.prisma.file.findUnique({ where: { id: row.fileId } });
    if (!file || file.status !== 'ready') throw new NotFoundError('File');
    const url = await this.storage.presignDownload('private', file.key, 300, file.originalName);
    await this.audit.record({
      action: 'students.document_downloaded',
      resourceType: 'document',
      resourceId: documentId,
      summary: `Document ${row.type} of ${student.studentCode} downloaded`,
    });
    return { url, expiresAt: new Date(Date.now() + 300_000).toISOString() };
  }

  /** A student is `verified` when at least one document exists and none is pending or rejected. */
  private async refreshVerification(studentId: string): Promise<void> {
    const counts = await this.prisma.document.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { _all: true },
    });
    const byStatus = new Map(counts.map((c) => [c.status, c._count._all]));
    const total = [...byStatus.values()].reduce((a, b) => a + b, 0);
    const verificationStatus =
      total === 0
        ? 'unverified'
        : (byStatus.get('pending') ?? 0) > 0 || (byStatus.get('rejected') ?? 0) > 0
          ? 'pending'
          : 'verified';
    await this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { verificationStatus },
    });
  }

  private async filesById(ids: string[]) {
    if (ids.length === 0) return new Map<string, FileRow>();
    const files = await this.prisma.file.findMany({ where: { id: { in: ids } } });
    return new Map(files.map((f) => [f.id, f as FileRow]));
  }
}

interface FileRow {
  id: string;
  originalName: string;
  size: number;
  mime: string;
}

function toRecord(
  row: {
    id: string;
    type: string;
    title: string;
    status: string;
    reason: string;
    reviewedAt: Date | null;
    createdAt: Date;
  },
  file?: FileRow,
): DocumentRecord {
  return {
    id: row.id,
    type: row.type as DocumentType,
    title: row.title,
    status: row.status as DocumentStatus,
    reason: row.reason,
    fileName: file?.originalName ?? '',
    fileSize: file?.size ?? 0,
    mime: file?.mime ?? '',
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
