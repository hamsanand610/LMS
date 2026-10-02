import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { signedDownload } from '../../core/storage/signed-download.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { EXTENSION_BY_MIME, FILE_CONTEXTS } from './contexts.js';
import { canonicalMime, contentMatches, sniffMime } from './sniff.js';

export interface FileRecord {
  id: string;
  context: string;
  originalName: string;
  mime: string;
  size: number;
  visibility: 'private' | 'public';
  status: 'pending' | 'ready' | 'failed';
  url: string | null;
  createdAt: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async createUpload(
    user: AuthUser,
    input: { context: string; filename: string; mime: string; size: number },
  ) {
    const context = FILE_CONTEXTS[input.context];
    if (!context)
      throw new ValidationError([
        { path: 'context', message: `Unknown upload context "${input.context}"` },
      ]);
    if (!hasPermission(user, context.permission))
      throw new ForbiddenError('You cannot upload files in this context');
    const mime = canonicalMime(input.mime, input.filename);
    if (!context.mimes.includes(mime)) {
      throw new ValidationError([
        { path: 'mime', message: `Allowed types: ${context.mimes.join(', ')}` },
      ]);
    }
    if (input.size <= 0 || input.size > context.maxSize) {
      throw new ValidationError([
        {
          path: 'size',
          message: `File must be between 1 byte and ${Math.round(context.maxSize / 1024)} KB`,
        },
      ]);
    }
    const org = await this.tenant.getOrganization();
    const ext = EXTENSION_BY_MIME[mime] ?? 'bin';
    const key = `${org.key}/${input.context}/${randomUUID()}.${ext}`;
    const file = await this.prisma.file.create({
      data: {
        organizationId: org.id,
        ownerType: input.context,
        driver: this.storage.name,
        bucket: this.storage.bucketName(context.bucket),
        key,
        originalName: sanitizeFilename(input.filename),
        mime,
        size: input.size,
        visibility: context.bucket === 'public' ? 'public' : 'private',
        status: 'pending',
        uploadedById: user.id,
      },
    });
    // Signed for exactly the declared size, so the store refuses anything bigger outright.
    const upload = await this.storage.presignUpload(context.bucket, key, mime, input.size);
    return { fileId: file.id, upload };
  }

  /** Verifies the object exists, has an acceptable size and a matching real type, then marks it ready. */
  async completeUpload(user: AuthUser, fileId: string): Promise<FileRecord> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.uploadedById !== user.id) throw new NotFoundError('Upload');
    if (file.status === 'ready') return this.toRecord(file);
    if (file.status === 'failed')
      throw new ConflictError('This upload failed; start a new upload', 'upload_failed');
    const context = FILE_CONTEXTS[file.ownerType];
    const bucket = file.visibility === 'public' ? 'public' : 'private';
    const head = await this.storage.head(bucket, file.key);
    if (!head) throw new DomainRuleError('The file has not been uploaded yet', 'upload_missing');
    const maxSize = context?.maxSize ?? file.size;
    if (head.size <= 0 || head.size > maxSize) {
      await this.fail(file.id, bucket, file.key);
      throw new DomainRuleError('The uploaded file exceeds the allowed size', 'upload_too_large');
    }
    const bytes = await this.storage.readHead(bucket, file.key, 512);
    const sniffed = bytes ? sniffMime(bytes) : null;
    if (!contentMatches(file.mime, sniffed)) {
      await this.fail(file.id, bucket, file.key);
      throw new DomainRuleError(
        'The file content does not match its declared type',
        'upload_type_mismatch',
      );
    }
    const updated = await this.prisma.file.update({
      where: { id: file.id },
      // The declared type, now proven; an icon takes the spelling its bytes gave.
      data: {
        status: 'ready',
        size: head.size,
        mime: sniffed === 'image/x-icon' ? sniffed : file.mime,
      },
    });
    this.events.emit('file.uploaded', { fileId: file.id, context: file.ownerType });
    return this.toRecord(updated);
  }

  async get(user: AuthUser, fileId: string): Promise<FileRecord> {
    const file = await this.find(user, fileId);
    return this.toRecord(file);
  }

  async getUrl(user: AuthUser, fileId: string): Promise<{ url: string; expiresAt: string | null }> {
    const file = await this.find(user, fileId);
    if (file.status !== 'ready') throw new ConflictError('File is not ready', 'file_not_ready');
    // Someone else's personal file is a read of personal data: audited, as the documents pages do.
    if (file.uploadedById !== user.id && FILE_CONTEXTS[file.ownerType]?.readPermission) {
      await this.audit.record({
        action: 'files.personal_link_issued',
        resourceType: 'file',
        resourceId: file.id,
        summary: `Link issued to a ${file.ownerType} file`,
      });
    }
    if (file.visibility === 'public')
      return { url: this.storage.publicUrl(file.key), expiresAt: null };
    const url = await signedDownload(
      this.storage,
      'private',
      file.key,
      'File',
      900,
      file.originalName,
    );
    return { url, expiresAt: new Date(Date.now() + 900_000).toISOString() };
  }

  async delete(user: AuthUser, fileId: string): Promise<void> {
    const file = await this.find(user, fileId);
    // Once attached to a record (an identity proof, a résumé, a handed-in answer) the file belongs
    // to that record: deleting it here would leave the record pointing at nothing.
    if (file.ownerId) {
      throw new DomainRuleError(
        'That file is part of a record now and is removed together with it',
        'file_attached',
      );
    }
    const bucket = file.visibility === 'public' ? 'public' : 'private';
    await this.storage.delete(bucket, file.key);
    await this.prisma.file.delete({ where: { id: file.id } });
    await this.audit.record({
      action: 'files.deleted',
      resourceType: 'file',
      resourceId: file.id,
      before: { key: file.key, context: file.ownerType },
      summary: `File ${file.originalName} deleted`,
    });
  }

  private async find(user: AuthUser, fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundError('File');
    if (file.uploadedById === user.id) return file;
    if (scopeFor(user, 'files:read') !== 'all') throw new NotFoundError('File');
    // Personal files need the permission that guards them, not just the general one.
    const guard = FILE_CONTEXTS[file.ownerType]?.readPermission;
    if (guard && scopeFor(user, guard) !== 'all') throw new NotFoundError('File');
    return file;
  }

  private async fail(fileId: string, bucket: 'public' | 'private', key: string): Promise<void> {
    await this.prisma.file.update({ where: { id: fileId }, data: { status: 'failed' } });
    try {
      await this.storage.delete(bucket, key);
    } catch {
      // best effort cleanup
    }
  }

  private toRecord(file: {
    id: string;
    ownerType: string;
    originalName: string;
    mime: string;
    size: number;
    visibility: 'private' | 'public';
    status: 'pending' | 'ready' | 'failed';
    key: string;
    createdAt: Date;
  }): FileRecord {
    return {
      id: file.id,
      context: file.ownerType,
      originalName: file.originalName,
      mime: file.mime,
      size: file.size,
      visibility: file.visibility,
      status: file.status,
      url:
        file.status === 'ready' && file.visibility === 'public'
          ? this.storage.publicUrl(file.key)
          : null,
      createdAt: file.createdAt.toISOString(),
    };
  }
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\w.\- ()]/g, '_').slice(0, 200) || 'file';
}
