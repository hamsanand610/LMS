import type { AttendanceStatus } from '@lms/shared';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

/**
 * Phase 5 demo data: attendance for the classes that have already happened.
 *
 * The figures are deliberately varied rather than uniform, so the reports and charts show
 * something worth looking at. The bands below put the cohort at roughly 85% present and leave
 * about three learners under the 75% threshold, which is the distribution the plan asks for
 * (§21.1). A few classes at the end stay unmarked, so the "not marked" list, the trainer's nudge
 * and the attention band all have something real in them.
 *
 * It is idempotent: a class that already has marks is left exactly as it is, so re-running the
 * seed never overwrites a roll call somebody took during a demonstration.
 */

export interface AttendanceSeedResult {
  sessionsMarked: number;
  records: number;
  sessionsLeftUnmarked: number;
}

/** How many of the most recent past classes per batch are left for a trainer to mark. */
const LEAVE_UNMARKED_PER_BATCH = 2;

/**
 * Attendance profiles, as a share of the cohort. A learner keeps the same profile across the
 * programme, which is what makes the low-attendance list stable enough to demonstrate.
 */
const PROFILES = [
  { share: 0.45, present: 0.95, late: 0.03, excused: 0.0 }, // reliable
  { share: 0.3, present: 0.86, late: 0.05, excused: 0.02 }, // ordinary
  { share: 0.1, present: 0.72, late: 0.06, excused: 0.02 }, // wobbling
  { share: 0.15, present: 0.55, late: 0.05, excused: 0.02 }, // at risk
];

export async function seedAttendance(
  prisma: PrismaClient,
  lookup: { batchIdByCode: Map<string, string>; trainerUserIdByEmail: Map<string, string> },
): Promise<AttendanceSeedResult> {
  const result: AttendanceSeedResult = { sessionsMarked: 0, records: 0, sessionsLeftUnmarked: 0 };
  const markedBy = [...lookup.trainerUserIdByEmail.values()].find(Boolean) ?? null;
  const now = new Date();

  for (const batchId of lookup.batchIdByCode.values()) {
    const [sessions, members] = await Promise.all([
      prisma.liveSession.findMany({
        where: { batchId, startsAt: { lt: now }, status: { not: 'cancelled' } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, attendanceMarkedAt: true, status: true },
      }),
      prisma.batchMember.findMany({
        where: { batchId, isActive: true },
        orderBy: { student: { studentCode: 'asc' } },
        select: { studentId: true },
      }),
    ]);
    if (members.length === 0) continue;

    // The last few past classes stay unmarked, so the demo has real work waiting in it.
    const toMark = sessions.slice(0, Math.max(0, sessions.length - LEAVE_UNMARKED_PER_BATCH));
    result.sessionsLeftUnmarked += sessions.length - toMark.length;

    for (const session of toMark) {
      if (session.attendanceMarkedAt) continue;

      const rows = members.map((member, studentIndex) => {
        const profile = profileFor(studentIndex, members.length);
        // A deterministic pseudo-random draw: the same seed always produces the same demo.
        const draw = pseudoRandom(`${session.id}:${member.studentId}`);
        const status: AttendanceStatus =
          draw < profile.present
            ? 'present'
            : draw < profile.present + profile.late
              ? 'late'
              : draw < profile.present + profile.late + profile.excused
                ? 'excused'
                : 'absent';
        return {
          sessionId: session.id,
          studentId: member.studentId,
          batchId,
          status,
          note: status === 'excused' ? 'Informed in advance.' : '',
          markedById: markedBy,
          markedAt: new Date(session.startsAt.getTime() + 60 * 60_000),
        };
      });

      await prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
      await prisma.liveSession.update({
        where: { id: session.id },
        data: {
          attendanceMarkedAt: new Date(session.startsAt.getTime() + 60 * 60_000),
          attendanceMarkedById: markedBy,
          // A past class that was marked is a class that finished.
          status: session.status === 'scheduled' ? 'completed' : session.status,
        },
      });
      result.sessionsMarked += 1;
      result.records += rows.length;
    }

    // The classes left for the trainer are completed, which is what puts them in the roll-call list.
    const unmarked = sessions.slice(toMark.length);
    if (unmarked.length > 0) {
      await prisma.liveSession.updateMany({
        where: { id: { in: unmarked.map((s) => s.id) }, status: 'scheduled' },
        data: { status: 'completed' },
      });
    }
  }

  return result;
}

function profileFor(
  index: number,
  total: number,
): { present: number; late: number; excused: number } {
  const position = total === 0 ? 0 : index / total;
  let cumulative = 0;
  for (const profile of PROFILES) {
    cumulative += profile.share;
    if (position < cumulative) return profile;
  }
  const last = PROFILES[PROFILES.length - 1];
  return last ?? { present: 0.9, late: 0.05, excused: 0.02 };
}

/** A stable number in [0, 1) from a string, so the demo looks the same every time it is seeded. */
function pseudoRandom(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}
