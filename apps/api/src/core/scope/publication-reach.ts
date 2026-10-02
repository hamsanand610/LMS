import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/*
 * Which courses reach which batches. A live course publication reaches a batch when it is to the
 * whole institute, to that batch, or to that batch's programme (ADR-0010). The rule is written once,
 * in both directions, because a trainer's view of a learner is limited by it (Phases 3–4, D6).
 */

/** A filter for the live course publications that reach any of some batches. */
export async function publicationsReaching(
  prisma: PrismaService,
  batchIds: readonly string[],
): Promise<Prisma.CoursePublicationWhereInput> {
  const batches = await prisma.batch.findMany({
    where: { id: { in: [...batchIds] } },
    select: { programId: true },
  });
  return {
    unpublishedAt: null,
    OR: [
      { scopeType: 'all' },
      { scopeType: 'batch', scopeId: { in: [...batchIds] } },
      { scopeType: 'program', scopeId: { in: [...new Set(batches.map((b) => b.programId))] } },
    ],
  };
}

/** A filter for the batches a course's live publications reach. */
export async function batchesReachedBy(
  prisma: PrismaService,
  courseId: string,
): Promise<Prisma.BatchWhereInput> {
  const publications = await prisma.coursePublication.findMany({
    where: { courseId, unpublishedAt: null },
    select: { scopeType: true, scopeId: true },
  });
  if (publications.some((p) => p.scopeType === 'all')) return {};
  const scoped = (type: string): string[] =>
    publications.flatMap((p) => (p.scopeType === type && p.scopeId ? [p.scopeId] : []));
  return { OR: [{ id: { in: scoped('batch') } }, { programId: { in: scoped('program') } }] };
}
