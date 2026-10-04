import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { ScopeService } from '../../../core/scope/scope.service.js';
import { CoursesService, LessonsService } from '../../courses/index.js';

/**
 * The data classes a retrieval may draw on in Phase 8: public and course material. Knowledge marked
 * `personal` is held back (ADR-0024, ADR-0033): Phase 8E's grounded answers draw on public and
 * course material only, each when approved for the provider (ADR-0037), and personal knowledge
 * stays a deferred item.
 */
export const RETRIEVABLE_DATA_CLASSES = ['public', 'course'] as const;

/** What a person may draw on now: the sources open to them, less any lesson they cannot open. */
export interface KnowledgeReach {
  organizationId: string;
  sourceIds: string[];
  /** Documents of an open source about a lesson the person cannot open now. */
  closedDocumentIds: string[];
}

/**
 * "Can this person retrieve this chunk?" — the knowledge base's one answer (Roadmap Phase 8A;
 * ADR-0033), for Phase 8D's retrieval to filter by. Nothing here retrieves: it decides. A chunk may
 * be drawn on for a person only when every one of these holds, now:
 *
 * 1. **The person's own institute.** The chunk's institute is the person's.
 * 2. **A published source.** Never a draft, never an archived one.
 * 3. **Material the provider may be given.** Public or course data; personal knowledge waits for 8E.
 * 4. **An audience that includes them**, decided by the services that already decide reach:
 *    - `institute`: anyone in the institute;
 *    - `staff`: staff alone — whoever is no learner (no student profile);
 *    - `course`: a course they reach (`CoursesService.reachableCourseIds`: a published course they
 *      are enrolled in and not withdrawn from, or one published to a batch they teach), and, for a
 *      document about one lesson, that lesson as the player would open it (`LessonsService.openLessonIds`,
 *      the player's own rule: its module open to a learner), asked about every such lesson at once.
 * 5. **The current version of an active document**, fully chunked — never an older version, one being
 *    ingested, or one that failed (and the database lets only a chunked version be current).
 *
 * Every condition is checked from the database at the time of asking: a grant lost since is gone.
 */
@Injectable()
export class KnowledgeReachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly courses: CoursesService,
    private readonly lessons: LessonsService,
  ) {}

  async reachOf(user: AuthUser): Promise<KnowledgeReach> {
    const person = await this.scope.personFor(user.id);
    const courseIds = await this.courses.reachableCourseIds(user);
    const sources = await this.prisma.knowledgeSource.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'published',
        dataClass: { in: [...RETRIEVABLE_DATA_CLASSES] },
        OR: [
          { audience: 'institute' },
          ...(person.studentId ? [] : [{ audience: 'staff' as const }]),
          { audience: 'course', courseId: { in: courseIds } },
        ],
      },
      select: { id: true, audience: true },
    });
    const courseSourceIds = sources.filter((s) => s.audience === 'course').map((s) => s.id);
    const lessonDocuments = courseSourceIds.length
      ? await this.prisma.knowledgeDocument.findMany({
          where: { sourceId: { in: courseSourceIds }, lessonId: { not: null } },
          select: { id: true, lessonId: true },
        })
      : [];
    const open = await this.lessons.openLessonIds(user, [
      ...new Set(lessonDocuments.map((document) => document.lessonId!)),
    ]);
    const closedDocumentIds = lessonDocuments
      .filter((document) => !open.has(document.lessonId!))
      .map((document) => document.id);
    return {
      organizationId: user.organizationId,
      sourceIds: sources.map((s) => s.id),
      closedDocumentIds,
    };
  }

  /** The chunks a reach allows, as a filter for retrieval to start from (Phase 8D). */
  whereRetrievable(reach: KnowledgeReach): Prisma.KnowledgeChunkWhereInput {
    return {
      organizationId: reach.organizationId,
      sourceId: { in: reach.sourceIds },
      ...(reach.closedDocumentIds.length > 0
        ? { documentId: { notIn: reach.closedDocumentIds } }
        : {}),
      version: {
        is: { isCurrent: true, status: 'chunked', document: { is: { status: 'active' } } },
      },
    };
  }

  /** Whether this chunk may be retrieved for this person now. */
  async mayRetrieve(user: AuthUser, chunkId: string): Promise<boolean> {
    const reach = await this.reachOf(user);
    const found = await this.prisma.knowledgeChunk.count({
      where: { AND: [{ id: chunkId }, this.whereRetrievable(reach)] },
    });
    return found === 1;
  }
}
