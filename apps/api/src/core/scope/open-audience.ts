import { DomainRuleError } from '../http/errors.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Nothing new is given to an archived batch or programme (Phase 5): no course, assignment, test
 * window, class, feedback form or announcement, so an archived cohort never gains access by
 * accident. A completed batch still takes content — its learners go on after the timetable ends;
 * an archived one is history.
 */
export async function requireOpenAudience(
  prisma: PrismaService,
  audience: { batchIds?: readonly string[]; programIds?: readonly string[] },
): Promise<void> {
  const batchIds = [...(audience.batchIds ?? [])];
  const programIds = [...(audience.programIds ?? [])];
  const [batches, programs] = await Promise.all([
    batchIds.length > 0
      ? prisma.batch.count({ where: { id: { in: batchIds }, status: 'archived' } })
      : Promise.resolve(0),
    programIds.length > 0
      ? prisma.program.count({ where: { id: { in: programIds }, status: 'archived' } })
      : Promise.resolve(0),
  ]);
  if (batches + programs > 0) {
    throw new DomainRuleError(
      'That batch or programme is archived: nothing new can be given to it',
      'audience_archived',
    );
  }
}
