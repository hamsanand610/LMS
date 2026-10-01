import { DomainRuleError } from '../../core/http/errors.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';

/** What makes an uploaded file acceptable where a record is about to point at it. */
export interface AttachRule {
  /** The upload contexts it may come from: a résumé is never somebody's identity document. */
  contexts: readonly string[];
  /** Only the person who uploaded it may attach it (a learner's own documents, say). */
  uploadedBy?: string;
  /** It must not be attached to anything yet, so one file cannot sit behind two records. */
  unattached?: boolean;
}

/**
 * A finished upload that satisfies the rule. Anything else — another person's file, a file from
 * another context, one still uploading or already in use — gets the same answer, so a file id
 * learnt somewhere else is worth nothing to the caller.
 */
export async function requireAttachableFile(
  prisma: PrismaService,
  fileId: string,
  rule: AttachRule,
) {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  const acceptable =
    file !== null &&
    file.status === 'ready' &&
    rule.contexts.includes(file.ownerType) &&
    (rule.uploadedBy === undefined || file.uploadedById === rule.uploadedBy) &&
    (!rule.unattached || file.ownerId === null);
  if (!acceptable) {
    throw new DomainRuleError('Upload the file before attaching it', 'file_not_ready');
  }
  return file;
}
