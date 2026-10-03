import { Injectable } from '@nestjs/common';
import type { ExecutionLanguage, LabDraftInput, LabDraftRecord } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PracticeService } from './practice.service.js';

/**
 * A learner's unfinished work, kept on the server so it follows them between devices (ADR-0018):
 * one draft per lab and language, or per playground language. A draft is its owner's alone; one
 * for a lab the learner cannot reach is refused as not found, so the store says nothing about labs
 * they cannot see.
 */
@Injectable()
export class LabDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practice: PracticeService,
  ) {}

  async list(
    scope: string,
    language: ExecutionLanguage | undefined,
    user: AuthUser,
  ): Promise<LabDraftRecord[]> {
    if (scope !== 'playground') await this.practice.requireReachableLab(scope, user);
    const rows = await this.prisma.labDraft.findMany({
      where: { userId: user.id, scope, ...(language ? { language } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async save(input: LabDraftInput, user: AuthUser): Promise<LabDraftRecord> {
    const questionId = input.scope === 'playground' ? null : input.scope;
    if (questionId) await this.practice.requireReachableLab(questionId, user);
    const row = await this.prisma.labDraft.upsert({
      where: {
        userId_scope_language: { userId: user.id, scope: input.scope, language: input.language },
      },
      create: {
        userId: user.id,
        questionId,
        scope: input.scope,
        language: input.language,
        code: input.code,
        stdin: input.stdin,
      },
      update: { code: input.code, stdin: input.stdin },
    });
    return toRecord(row);
  }

  /** "Reset": the draft goes and the editor returns to the starting code. */
  async remove(scope: string, language: ExecutionLanguage | undefined, user: AuthUser) {
    await this.prisma.labDraft.deleteMany({
      where: { userId: user.id, scope, ...(language ? { language } : {}) },
    });
  }
}

function toRecord(row: {
  scope: string;
  language: string;
  code: string;
  stdin: string;
  updatedAt: Date;
}): LabDraftRecord {
  return {
    scope: row.scope,
    language: row.language as ExecutionLanguage,
    code: row.code,
    stdin: row.stdin,
    updatedAt: row.updatedAt.toISOString(),
  };
}
