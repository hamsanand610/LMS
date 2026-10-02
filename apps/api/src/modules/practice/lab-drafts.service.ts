import { Injectable } from '@nestjs/common';
import type { ExecutionLanguage, LabDraftInput, LabDraftRecord } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { LIVE_LAB } from './practice.service.js';

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
    private readonly tenant: TenantService,
  ) {}

  async list(
    scope: string,
    language: ExecutionLanguage | undefined,
    user: AuthUser,
  ): Promise<LabDraftRecord[]> {
    if (scope !== 'playground') await this.requireReachable(scope, user);
    const rows = await this.prisma.labDraft.findMany({
      where: { userId: user.id, scope, ...(language ? { language } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async save(input: LabDraftInput, user: AuthUser): Promise<LabDraftRecord> {
    const questionId = input.scope === 'playground' ? null : input.scope;
    if (questionId) await this.requireReachable(questionId, user);
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

  /**
   * A lab the learner may work on: in the catalogue, or opened by a lab lesson of a course they are
   * enrolled in. Anything else is not found.
   */
  private async requireReachable(questionId: string, user: AuthUser): Promise<void> {
    const org = await this.tenant.getOrganization();
    const lab = await this.prisma.question.findFirst({
      where: { id: questionId, organizationId: org.id, ...LIVE_LAB },
      select: { id: true, inPractice: true },
    });
    if (!lab) throw new NotFoundError('Lab');
    if (lab.inPractice) return;
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        type: 'lab',
        content: { path: ['questionId'], equals: questionId },
        module: { course: { enrollments: { some: { student: { userId: user.id } } } } },
      },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundError('Lab');
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
