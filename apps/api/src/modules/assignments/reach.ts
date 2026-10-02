import {
  assignmentSettingsSchema,
  DEFAULT_ASSIGNMENT_SETTINGS,
  type AssignmentSettings,
} from '@lms/shared';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  effectivePublication,
  type StateAssignment,
  type StatePublication,
  type StateSubmission,
} from './learner-state.js';

/**
 * Who an assignment reaches, in one place. A publication reaches the active members of its batch,
 * or the one learner it names; nothing else decides whether a learner may see or answer it.
 */

export interface LearnerReach {
  studentId: string;
  /** The learner's active batches. */
  batchIds: string[];
}

/** Publications that reach one learner: live, of an assignment that is not archived or deleted. */
export function reachingPublicationsWhere(reach: LearnerReach) {
  return {
    withdrawnAt: null,
    assignment: { deletedAt: null, status: { not: 'archived' as const } },
    OR: [{ batchId: { in: reach.batchIds } }, { studentId: reach.studentId }],
  };
}

/**
 * The answers a member of staff limited to some batches may open, by the rule that opens one
 * (`requireReviewAccess`): the learner is in one of those batches and the assignment reached them
 * through it, or the assignment was given to that learner personally. Sharing a batch with the
 * learner is not enough on its own.
 */
export async function reviewableWhere(
  prisma: PrismaService,
  batchIds: string[],
): Promise<Prisma.SubmissionWhereInput> {
  const personal = await prisma.assignmentPublication.findMany({
    where: {
      studentId: { not: null },
      student: { members: { some: { batchId: { in: batchIds }, isActive: true } } },
    },
    select: { assignmentId: true, studentId: true },
  });
  return {
    OR: [
      ...batchIds.map((batchId) => ({
        student: { members: { some: { batchId, isActive: true } } },
        assignment: { publications: { some: { batchId } } },
      })),
      ...personal.flatMap((p) =>
        p.studentId ? [{ assignmentId: p.assignmentId, studentId: p.studentId }] : [],
      ),
    ],
  };
}

/** What the learner-state calculation needs of an assignment. */
export const STATE_INCLUDE = {
  course: { select: { title: true } },
  modules: {
    orderBy: { position: 'asc' as const },
    include: {
      questions: {
        orderBy: { position: 'asc' as const },
        include: { question: { select: { title: true, type: true, difficulty: true } } },
      },
    },
  },
} as const;

export function parseSettings(value: unknown): AssignmentSettings {
  const parsed = assignmentSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_ASSIGNMENT_SETTINGS;
}

type StateRow = {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  kind: string;
  courseId: string | null;
  course: { title: string } | null;
  estimatedMinutes: number;
  passPercent: number;
  settings: unknown;
  modules: {
    id: string;
    title: string;
    description: string;
    topic: string;
    position: number;
    unlockRule: unknown;
    dueAfterDays: number | null;
    questions: {
      id: string;
      questionId: string;
      marks: number;
      position: number;
      question: { title: string; type: string; difficulty: string };
    }[];
  }[];
};

export function toStateAssignment(row: StateRow): StateAssignment {
  return { ...row, settings: parseSettings(row.settings) };
}

export interface ReachedAssignment {
  assignment: StateAssignment;
  instructions: string;
  publication: StatePublication;
}

/** The assignments that reach one learner, each with the publication whose dates apply. */
export async function loadReachedAssignments(
  prisma: PrismaService,
  reach: LearnerReach,
  assignmentIds?: string[],
): Promise<ReachedAssignment[]> {
  const publications = await prisma.assignmentPublication.findMany({
    where: {
      ...reachingPublicationsWhere(reach),
      ...(assignmentIds ? { assignmentId: { in: assignmentIds } } : {}),
    },
    include: { assignment: { include: STATE_INCLUDE } },
  });
  const byAssignment = new Map<string, typeof publications>();
  for (const publication of publications) {
    const list = byAssignment.get(publication.assignmentId) ?? [];
    list.push(publication);
    byAssignment.set(publication.assignmentId, list);
  }
  const reached: ReachedAssignment[] = [];
  for (const list of byAssignment.values()) {
    const chosen = effectivePublication(list);
    if (!chosen) continue;
    reached.push({
      assignment: toStateAssignment(chosen.assignment),
      instructions: chosen.assignment.instructions,
      publication: chosen,
    });
  }
  return reached;
}

/** A learner's submissions to some assignments, with just what the state calculation reads. */
export async function loadLearnerSubmissions(
  prisma: PrismaService,
  studentId: string,
  assignmentIds: string[],
): Promise<(StateSubmission & { assignmentId: string })[]> {
  if (assignmentIds.length === 0) return [];
  return prisma.submission.findMany({
    where: { studentId, assignmentId: { in: assignmentIds } },
    select: {
      id: true,
      assignmentId: true,
      assignmentQuestionId: true,
      attempt: true,
      status: true,
      marks: true,
      reviewDecision: true,
      submittedAt: true,
    },
  });
}

/**
 * The learners a set of publications reaches, each with the publications that reach them: the
 * active members of the batches, and the learners named directly.
 */
export async function learnersReached(
  prisma: PrismaService,
  publications: { id: string; batchId: string | null; studentId: string | null }[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const add = (studentId: string, publicationId: string) => {
    const list = out.get(studentId) ?? [];
    list.push(publicationId);
    out.set(studentId, list);
  };
  const batchIds = [
    ...new Set(publications.map((p) => p.batchId).filter((id): id is string => !!id)),
  ];
  const members =
    batchIds.length === 0
      ? []
      : await prisma.batchMember.findMany({
          where: { batchId: { in: batchIds }, isActive: true },
          select: { batchId: true, studentId: true },
        });
  for (const publication of publications) {
    if (publication.studentId) add(publication.studentId, publication.id);
    if (publication.batchId) {
      for (const member of members) {
        if (member.batchId === publication.batchId) add(member.studentId, publication.id);
      }
    }
  }
  return out;
}
