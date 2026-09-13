import { Injectable } from '@nestjs/common';
import { type AuthUser, scopeFor } from '../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';

/**
 * Answers "may this caller see this learner's record". Kept apart from the progress figures so the
 * same rule serves the progress pages, the course pages and anything added later.
 */
@Injectable()
export class LearnerAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /** The caller's own student record, or a clear error when they are not a learner. */
  async requireOwnStudentId(user: AuthUser): Promise<string> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) {
      throw new ForbiddenError('Only a student has learning progress of their own');
    }
    return person.studentId;
  }

  /** A learner the caller is allowed to look at, honouring `all` versus `batch` scope. */
  async requireVisibleStudent(
    studentId: string,
    user: AuthUser,
  ): Promise<{ id: string; userId: string }> {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, user: { deletedAt: null } },
      select: { id: true, userId: true },
    });
    if (!student) throw new NotFoundError('Student');
    if (student.userId === user.id) return student;

    const scope = scopeFor(user, 'progress:read');
    if (scope === 'all') return student;
    if (scope === 'batch') {
      const visible = await this.scope.visibleBatchIds(user, 'progress:read');
      const shared = await this.prisma.batchMember.count({
        where: { studentId, isActive: true, batchId: { in: visible ?? [] } },
      });
      if (shared > 0) return student;
    }
    throw new ForbiddenError('That student is not in your batches');
  }
}
