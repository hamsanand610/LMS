/**
 * Moves the demo's dates forward so "today" always has something in it (architecture plan §21.3).
 *
 * The seed writes a fortnight of classes either side of the day it ran, one test window that is
 * open and one still to come. Left alone, a demo prepared last week opens on an empty schedule and
 * a test that closed. This shifts every dated record by the same number of days, so the story the
 * demo tells stays the same while the dates catch up.
 *
 * It shifts, rather than re-seeds: attendance already taken, submissions already made and results
 * already released all keep their place relative to everything else.
 *
 *   pnpm --filter @lms/api demo:advance            # move to today
 *   pnpm --filter @lms/api demo:advance -- --days 7 # move on by exactly a week
 *
 * Refuses to run in production (operating rule 23).
 */
import { createStandaloneContext } from '../src/core/prisma/standalone.js';

/** Midnight UTC, so a shift is a whole number of days rather than a fraction. */
function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDays(argv: string[]): number | null {
  const index = argv.indexOf('--days');
  if (index === -1) return null;
  const value = Number(argv[index + 1]);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('--days takes a whole number of days');
  }
  return value;
}

async function main(): Promise<void> {
  const { config, prisma } = createStandaloneContext();
  if (config.APP_ENV === 'production') {
    console.error('demo:advance is disabled in production (operating rule 23).');
    process.exit(1);
  }

  const explicit = parseDays(process.argv.slice(2));

  /*
   * Without an explicit number, the shift is whatever lands the middle class of the timetable on
   * today. The middle *class* rather than the middle *date*: a mean falls between teaching days
   * and would leave today empty, which is the one thing this command exists to prevent.
   */
  let days = explicit;
  if (days === null) {
    const sessions = await prisma.liveSession.findMany({
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true },
    });
    if (sessions.length === 0) {
      console.log('There is no timetable to move. Run the demo seed first.');
      await prisma.$disconnect();
      return;
    }
    const median = sessions[Math.floor(sessions.length / 2)];
    if (!median) {
      console.log('There is no timetable to move. Run the demo seed first.');
      await prisma.$disconnect();
      return;
    }
    days = Math.round(
      (startOfDay(new Date()).getTime() - startOfDay(median.startsAt).getTime()) / 86_400_000,
    );
  }

  if (days === 0) {
    console.log('The demo is already centred on today; nothing to move.');
  } else {
    console.log(`Moving the demo ${days > 0 ? 'forward' : 'back'} by ${Math.abs(days)} days…`);
    await shiftDates(prisma, days);
  }

  const settled = await settleSessionStatuses(prisma);
  await ensureAnOpenTestWindow(prisma);

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const [today, openWindow] = await Promise.all([
    prisma.liveSession.count({ where: { startsAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.testSchedule.findFirst({
      where: { opensAt: { lte: now }, closesAt: { gte: now } },
      include: { test: { select: { title: true } } },
    }),
  ]);

  console.log(
    today > 0
      ? `- ${today} ${today === 1 ? 'class' : 'classes'} today`
      : '- nothing on the timetable today; the seed may need re-running',
  );
  console.log(
    openWindow
      ? `- open test window: ${openWindow.test.title}`
      : '- no test window is open; the seed may need re-running',
  );
  if (settled > 0) {
    console.log(`- ${settled} ${settled === 1 ? 'class' : 'classes'} caught up with the clock`);
  }
  await prisma.$disconnect();
  console.log('Demo advanced.');
}

/**
 * A class carries its status as a column rather than working it out from the clock, so moving the
 * timetable — or simply letting the day pass — leaves this morning's class still marked
 * "scheduled". That is not only untidy: a class is only nudged about, counted in the admin's
 * "waiting for a roll call" tile, or offered its recording once it is finished, so a class left
 * behind by the clock quietly disappears from all three.
 *
 * The clock decides. A cancelled class stays cancelled: somebody decided that, and no amount of
 * time passing changes it.
 */
async function settleSessionStatuses(
  prisma: ReturnType<typeof createStandaloneContext>['prisma'],
): Promise<number> {
  const now = new Date();
  const changed = await prisma.$transaction([
    prisma.liveSession.updateMany({
      where: { status: { in: ['scheduled', 'live'] }, endsAt: { lt: now } },
      data: { status: 'completed' },
    }),
    prisma.liveSession.updateMany({
      where: {
        status: { in: ['scheduled', 'completed'] },
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      data: { status: 'live' },
    }),
    prisma.liveSession.updateMany({
      where: { status: { in: ['live', 'completed'] }, startsAt: { gt: now } },
      data: { status: 'scheduled' },
    }),
  ]);
  return changed.reduce((total, result) => total + result.count, 0);
}

/**
 * The uniform shift keeps the story intact but cannot guarantee that a window happens to cover
 * today. If none is open, the nearest one is moved so that it is, keeping its length — a
 * demonstration needs a test somebody can actually start.
 *
 * "Open" means open now, not "opening at a fixed hour today". This used to place the window at
 * 06:00 UTC, which is 11:30 in the institute's own time zone (Asia/Kolkata), so a morning demo had
 * nothing to sit and running this again changed nothing. Opening it an hour ago makes it open at
 * whatever time of day the command is run.
 */
async function ensureAnOpenTestWindow(
  prisma: ReturnType<typeof createStandaloneContext>['prisma'],
): Promise<void> {
  const now = new Date();
  const open = await prisma.testSchedule.count({
    where: { opensAt: { lte: now }, closesAt: { gte: now } },
  });
  if (open > 0) return;

  const nearest = await prisma.testSchedule.findFirst({
    where: { releasedAt: null },
    orderBy: { opensAt: 'asc' },
  });
  if (!nearest) return;

  const length = nearest.closesAt.getTime() - nearest.opensAt.getTime();
  const opensAt = new Date(now.getTime() - 3_600_000);
  await prisma.testSchedule.update({
    where: { id: nearest.id },
    data: { opensAt, closesAt: new Date(opensAt.getTime() + Math.max(length, 6 * 3_600_000)) },
  });
}

/**
 * Every dated column that carries the story, moved by the same number of days. One statement per
 * table so a failure names the table it failed on, and one transaction so the demo is never left
 * half-moved.
 */
async function shiftDates(
  prisma: ReturnType<typeof createStandaloneContext>['prisma'],
  days: number,
): Promise<void> {
  const interval = `${days} days`;
  const shifts: [string, string[]][] = [
    ['session_series', ['from_date', 'until_date']],
    [
      'live_sessions',
      [
        'starts_at',
        'ends_at',
        'reminder_sent_at',
        'attendance_marked_at',
        'attendance_reminder_sent_at',
      ],
    ],
    ['attendance_records', ['marked_at', 'corrected_at', 'created_at', 'updated_at']],
    ['test_schedules', ['opens_at', 'closes_at', 'released_at', 'created_at']],
    ['test_attempts', ['started_at', 'expires_at', 'submitted_at', 'last_saved_at']],
    ['assignment_publications', ['opens_at', 'due_at', 'closes_at', 'published_at']],
    ['submissions', ['submitted_at', 'graded_at', 'evaluated_at', 'reviewed_at']],
    ['submission_reviews', ['created_at']],
    ['execution_runs', ['created_at']],
    ['lesson_progress', ['completed_at', 'last_accessed_at']],
    ['enrollments', ['enrolled_at', 'completed_at', 'last_accessed_at']],
    ['activity_events', ['occurred_at']],
    ['announcements', ['starts_at', 'ends_at']],
    ['notifications', ['created_at', 'read_at']],
    ['batches', ['start_date', 'end_date']],
  ];

  await prisma.$transaction(async (tx) => {
    for (const [table, columns] of shifts) {
      const assignments = columns
        .map((column) => `"${column}" = "${column}" + INTERVAL '${interval}'`)
        .join(', ');
      const where = columns.map((column) => `"${column}" IS NOT NULL`).join(' OR ');
      await tx.$executeRawUnsafe(`UPDATE "${table}" SET ${assignments} WHERE ${where}`);
    }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
