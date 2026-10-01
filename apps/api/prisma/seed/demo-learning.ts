/**
 * Phase 3 demo content: courses with a real outline, publications that derive the enrolments,
 * a fortnight of classes either side of today, and enough recorded progress for the learner pages
 * to show something true.
 *
 * The lessons are written articles rather than videos: no media ships in this repository, and a
 * player pointed at a file that does not exist would be a worse demo than one that reads well.
 * Uploading a video and attaching a class recording are exercised by the tests instead.
 */
import { zonedDateTimeToUtc } from '@lms/shared';
import { seedEmail } from './seed-identity.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

interface LessonPlan {
  title: string;
  body: string;
}

interface ModulePlan {
  title: string;
  /** Second and later modules open once the one before them is finished. */
  gated?: boolean;
  lessons: LessonPlan[];
}

interface CoursePlan {
  slug: string;
  title: string;
  description: string;
  level: string;
  subject: string;
  tags: string[];
  estimatedMinutes: number;
  publishTo: { scopeType: 'all' | 'program' | 'batch'; scope: string | null };
  modules: ModulePlan[];
}

/** Four modules of five lessons each, written from the module and subject. */
function outline(subject: string, units: [string, string[]][]): ModulePlan[] {
  return units.map(([title, lessons], index) => ({
    title,
    gated: index > 0,
    lessons: lessons.map((lessonTitle) => ({
      title: lessonTitle,
      body: paragraphs(subject, title, lessonTitle),
    })),
  }));
}

function paragraphs(subject: string, moduleTitle: string, lessonTitle: string): string {
  return [
    `<h2>${lessonTitle}</h2>`,
    `<p>This lesson belongs to <strong>${moduleTitle}</strong> in the ${subject} course. Work through it at your own pace and mark it complete when you are done.</p>`,
    '<h3>What you will do</h3>',
    '<ul><li>Read the explanation and follow the worked example.</li><li>Try the exercise on your own machine.</li><li>Note anything that did not work, and bring it to the next class.</li></ul>',
    '<h3>Before the next lesson</h3>',
    '<p>Revisit the previous lesson if any of this felt unfamiliar. The modules are ordered deliberately, and each one assumes the one before it.</p>',
  ].join('\n');
}

const COURSES: CoursePlan[] = [
  {
    slug: 'programming-foundations',
    title: 'Programming Foundations',
    description:
      'Where every programme begins: how a computer runs a program, how to break a problem down, and the habits that make the rest of the course easier.',
    level: 'beginner',
    subject: 'programming',
    tags: ['foundations', 'logic'],
    estimatedMinutes: 900,
    publishTo: { scopeType: 'program', scope: 'JFS' },
    modules: outline('Programming Foundations', [
      [
        'How programs run',
        [
          'What a program actually is',
          'Compilers and interpreters',
          'Your first program',
          'Reading an error message',
          'Keeping your work in order',
        ],
      ],
      [
        'Data and decisions',
        [
          'Variables and types',
          'Arithmetic and precision',
          'Conditions',
          'Loops',
          'Putting it together',
        ],
      ],
      [
        'Breaking problems down',
        [
          'Functions',
          'Parameters and return values',
          'Scope',
          'Tracing by hand',
          'Reading other people’s code',
        ],
      ],
      [
        'Collections',
        ['Arrays', 'Lists', 'Maps', 'Choosing a structure', 'A small program end to end'],
      ],
    ]),
  },
  {
    slug: 'core-java',
    title: 'Core Java',
    description:
      'The Java language itself: objects, the type system, collections and the standard library you will use every day.',
    level: 'beginner',
    subject: 'core-java',
    tags: ['java'],
    estimatedMinutes: 1440,
    publishTo: { scopeType: 'batch', scope: 'JFS-2026-B1' },
    modules: outline('Core Java', [
      [
        'The language',
        [
          'Classes and objects',
          'Fields, methods and constructors',
          'Packages and imports',
          'The main method',
          'Compiling and running',
        ],
      ],
      [
        'Types and inheritance',
        ['Primitives and wrappers', 'Interfaces', 'Inheritance', 'Polymorphism', 'Records'],
      ],
      [
        'Collections',
        ['List, Set and Map', 'Iteration', 'Sorting and comparators', 'Streams', 'Optional'],
      ],
      [
        'Getting things done',
        [
          'Exceptions',
          'Files and streams',
          'Dates and times',
          'Testing with JUnit',
          'A small tool',
        ],
      ],
    ]),
  },
  {
    slug: 'advanced-java',
    title: 'Advanced Java',
    description:
      'Beyond the language: threads, the web tier, persistence and the patterns that hold a real application together.',
    level: 'intermediate',
    subject: 'advanced-java',
    tags: ['java', 'backend'],
    estimatedMinutes: 1560,
    publishTo: { scopeType: 'batch', scope: 'JFS-2026-B1' },
    modules: outline('Advanced Java', [
      [
        'Concurrency',
        ['Threads', 'Shared state', 'Executors', 'Futures', 'When not to use threads'],
      ],
      [
        'The web tier',
        ['HTTP in practice', 'Servlets', 'A REST endpoint', 'JSON', 'Errors and status codes'],
      ],
      [
        'Persistence',
        ['JDBC', 'Connection pools', 'Mapping rows to objects', 'Transactions', 'Migrations'],
      ],
      [
        'Structure',
        [
          'Layers',
          'Dependency injection',
          'Configuration',
          'Logging that helps',
          'Packaging and running',
        ],
      ],
    ]),
  },
  {
    slug: 'sql-and-databases',
    title: 'SQL and Databases',
    description:
      'Designing tables that survive contact with real data, and the queries that get answers out of them.',
    level: 'beginner',
    subject: 'sql',
    tags: ['sql', 'data'],
    estimatedMinutes: 780,
    publishTo: { scopeType: 'program', scope: 'JFS' },
    modules: outline('SQL and Databases', [
      [
        'Tables',
        [
          'Rows, columns and types',
          'Primary keys',
          'Inserting data',
          'Updating and deleting',
          'Constraints',
        ],
      ],
      ['Queries', ['SELECT', 'WHERE', 'ORDER BY and LIMIT', 'Aggregates', 'GROUP BY']],
      [
        'Relationships',
        ['Foreign keys', 'Inner joins', 'Outer joins', 'Subqueries', 'Normalisation'],
      ],
      [
        'In practice',
        ['Indexes', 'Reading a query plan', 'Transactions', 'Backups', 'A reporting query'],
      ],
    ]),
  },
  {
    slug: 'web-development',
    title: 'Web Development',
    description:
      'HTML, CSS and JavaScript from first principles, up to a page that talks to an API.',
    level: 'intermediate',
    subject: 'javascript',
    tags: ['frontend', 'web'],
    estimatedMinutes: 1200,
    publishTo: { scopeType: 'batch', scope: 'JFS-2026-B2' },
    modules: outline('Web Development', [
      [
        'HTML',
        [
          'Elements and structure',
          'Forms',
          'Semantics',
          'Accessibility basics',
          'Validating your markup',
        ],
      ],
      ['CSS', ['Selectors', 'The box model', 'Flexbox', 'Grid', 'Responsive layouts']],
      ['JavaScript', ['Values and functions', 'The DOM', 'Events', 'Fetching data', 'Modules']],
      [
        'Putting it together',
        [
          'State in a page',
          'Forms that validate',
          'Errors the user can act on',
          'Performance',
          'Publishing a page',
        ],
      ],
    ]),
  },
  {
    slug: 'aptitude-and-soft-skills',
    title: 'Aptitude and Soft Skills',
    description:
      'The other half of a placement: quantitative reasoning, clear writing and the interview itself.',
    level: 'beginner',
    subject: 'aptitude',
    tags: ['placement', 'aptitude'],
    estimatedMinutes: 600,
    publishTo: { scopeType: 'all', scope: null },
    modules: outline('Aptitude and Soft Skills', [
      ['Numbers', ['Ratios', 'Percentages', 'Averages', 'Time and work', 'Speed and distance']],
      [
        'Reasoning',
        ['Series', 'Syllogisms', 'Seating arrangements', 'Data interpretation', 'Practice set'],
      ],
      [
        'Communication',
        [
          'Writing clearly',
          'Email that gets read',
          'Presenting your work',
          'Listening',
          'Feedback',
        ],
      ],
      [
        'The interview',
        [
          'Your introduction',
          'Talking about a project',
          'Technical questions',
          'Questions to ask',
          'A mock interview',
        ],
      ],
    ]),
  },
];

/**
 * Topics and optional lessons for the Core Java course, so its outline shows how a long module
 * reads when the author groups it — and which lessons are extra reading rather than required.
 */
const LESSON_META: Record<string, { topic?: string; optional?: boolean }> = {
  'Classes and objects': { topic: 'Objects' },
  'Fields, methods and constructors': { topic: 'Objects' },
  'Packages and imports': { topic: 'Organising code' },
  'The main method': { topic: 'Organising code' },
  'Compiling and running': { topic: 'Organising code' },
  'Primitives and wrappers': { topic: 'Types' },
  Interfaces: { topic: 'Inheritance' },
  Inheritance: { topic: 'Inheritance' },
  Polymorphism: { topic: 'Inheritance' },
  Records: { topic: 'Types', optional: true },
  'List, Set and Map': { topic: 'Collection basics' },
  Iteration: { topic: 'Collection basics' },
  'Sorting and comparators': { topic: 'Ordering' },
  Streams: { topic: 'Functional style' },
  Optional: { topic: 'Functional style' },
  Exceptions: { topic: 'Standard library' },
  'Files and streams': { topic: 'Standard library' },
  'Dates and times': { topic: 'Standard library', optional: true },
  'Testing with JUnit': { topic: 'Putting it to work' },
  'A small tool': { topic: 'Putting it to work' },
};

/** Classes that repeat, for the batch that is under way and the one about to start. */
const SERIES = [
  {
    batchCode: 'JFS-2026-B1',
    subject: 'Core Java',
    trainerEmail: seedEmail('trainer1'),
    weekdays: ['mon', 'wed'],
    startsTime: '09:30',
    endsTime: '11:00',
    fromOffset: -14,
    untilOffset: 14,
  },
  {
    batchCode: 'JFS-2026-B1',
    subject: 'Advanced Java',
    trainerEmail: seedEmail('trainer2'),
    weekdays: ['tue', 'thu'],
    startsTime: '09:30',
    endsTime: '11:00',
    fromOffset: -14,
    untilOffset: 14,
  },
  {
    batchCode: 'JFS-2026-B1',
    subject: 'SQL',
    trainerEmail: seedEmail('trainer3'),
    weekdays: ['fri'],
    startsTime: '11:30',
    endsTime: '13:00',
    fromOffset: -14,
    untilOffset: 14,
  },
  {
    batchCode: 'JFS-2026-B1',
    subject: 'Aptitude',
    trainerEmail: seedEmail('trainer7'),
    weekdays: ['sat'],
    startsTime: '10:00',
    endsTime: '11:30',
    fromOffset: -14,
    untilOffset: 14,
  },
  {
    batchCode: 'JFS-2026-B1',
    subject: 'JavaScript',
    trainerEmail: seedEmail('trainer5'),
    weekdays: ['wed', 'fri'],
    startsTime: '14:00',
    endsTime: '15:30',
    fromOffset: -14,
    untilOffset: 14,
  },
  {
    batchCode: 'JFS-2026-B2',
    subject: 'HTML/CSS',
    trainerEmail: seedEmail('trainer4'),
    weekdays: ['mon', 'thu'],
    startsTime: '14:00',
    endsTime: '15:30',
    fromOffset: 14,
    untilOffset: 28,
  },
];

function dateKey(offsetDays: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface LearningSeedResult {
  courses: number;
  lessons: number;
  publications: number;
  enrolments: number;
  sessions: number;
  lessonsCompleted: number;
}

export async function seedLearning(
  prisma: PrismaClient,
  organization: { id: string; timezone: string },
  lookup: {
    programIdByCode: Map<string, string>;
    batchIdByCode: Map<string, string>;
    trainerIdByEmail: Map<string, string>;
    adminUserId: string | null;
  },
): Promise<LearningSeedResult> {
  const result: LearningSeedResult = {
    courses: 0,
    lessons: 0,
    publications: 0,
    enrolments: 0,
    sessions: 0,
    lessonsCompleted: 0,
  };

  // ───────────────── courses ─────────────────
  const courseIdBySlug = new Map<string, string>();
  for (const plan of COURSES) {
    const course = await prisma.course.upsert({
      where: { slug: plan.slug },
      create: {
        organizationId: organization.id,
        slug: plan.slug,
        title: plan.title,
        description: plan.description,
        level: plan.level,
        subject: plan.subject,
        tags: plan.tags,
        estimatedMinutes: plan.estimatedMinutes,
        status: 'published',
        createdById: lookup.adminUserId,
        ownerId: lookup.adminUserId,
      },
      update: { title: plan.title, description: plan.description, status: 'published' },
    });
    courseIdBySlug.set(plan.slug, course.id);
    result.courses += 1;

    // Each lesson's length is the course's stated time shared out, so the two always agree.
    const lessonTotal = plan.modules.reduce((n, m) => n + m.lessons.length, 0);
    const lessonSeconds = Math.max(5, Math.round(plan.estimatedMinutes / lessonTotal)) * 60;
    for (const [moduleIndex, modulePlan] of plan.modules.entries()) {
      const existingModule = await prisma.courseModule.findFirst({
        where: { courseId: course.id, position: moduleIndex },
      });
      const unlockRule = modulePlan.gated
        ? { type: 'after_previous', minPercent: 100 }
        : { type: 'always' };
      const module = existingModule
        ? await prisma.courseModule.update({
            where: { id: existingModule.id },
            data: { title: modulePlan.title, unlockRule },
          })
        : await prisma.courseModule.create({
            data: {
              courseId: course.id,
              title: modulePlan.title,
              position: moduleIndex,
              unlockRule,
            },
          });

      for (const [lessonIndex, lessonPlan] of modulePlan.lessons.entries()) {
        const existingLesson = await prisma.lesson.findFirst({
          where: { moduleId: module.id, position: lessonIndex },
        });
        const meta = plan.slug === 'core-java' ? LESSON_META[lessonPlan.title] : undefined;
        const data = {
          title: lessonPlan.title,
          type: 'article' as const,
          durationSeconds: lessonSeconds,
          content: { html: lessonPlan.body, video: null, questionId: null },
          completionRule: 'manual' as const,
          isMandatory: !meta?.optional,
          topic: meta?.topic ?? '',
        };
        if (existingLesson) {
          await prisma.lesson.update({ where: { id: existingLesson.id }, data });
        } else {
          await prisma.lesson.create({
            data: { ...data, moduleId: module.id, position: lessonIndex },
          });
        }
        result.lessons += 1;
      }
    }
  }

  // ───────────────── publications and the enrolments they derive ─────────────────
  for (const plan of COURSES) {
    const courseId = courseIdBySlug.get(plan.slug)!;
    const scopeId =
      plan.publishTo.scopeType === 'program'
        ? (lookup.programIdByCode.get(plan.publishTo.scope!) ?? null)
        : plan.publishTo.scopeType === 'batch'
          ? (lookup.batchIdByCode.get(plan.publishTo.scope!) ?? null)
          : null;
    const live = await prisma.coursePublication.findFirst({
      where: {
        courseId,
        scopeType: plan.publishTo.scopeType,
        scopeId,
        unpublishedAt: null,
      },
    });
    if (!live) {
      await prisma.coursePublication.create({
        data: {
          courseId,
          scopeType: plan.publishTo.scopeType,
          scopeId,
          // A note is something an administrator writes; the seed has nothing to say.
          note: '',
          publishedById: lookup.adminUserId,
        },
      });
    } else if (live.note === 'Seeded demo publication') {
      // Earlier seeds wrote this placeholder; it is visible in the publishing table.
      await prisma.coursePublication.update({ where: { id: live.id }, data: { note: '' } });
    }
    result.publications += 1;

    const studentIds = await studentsInScope(
      prisma,
      organization.id,
      plan.publishTo.scopeType,
      scopeId,
    );
    const existing = await prisma.enrollment.findMany({
      where: { courseId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const already = new Set(existing.map((e) => e.studentId));
    const toAdd = studentIds.filter((id) => !already.has(id));
    if (toAdd.length > 0) {
      await prisma.enrollment.createMany({
        data: toAdd.map((studentId) => ({
          studentId,
          courseId,
          source: plan.publishTo.scopeType,
        })),
        skipDuplicates: true,
      });
    }
    result.enrolments += toAdd.length;
  }

  // ───────────────── a fortnight of classes either side of today ─────────────────
  for (const plan of SERIES) {
    const batchId = lookup.batchIdByCode.get(plan.batchCode);
    const trainerId = lookup.trainerIdByEmail.get(plan.trainerEmail) ?? null;
    if (!batchId) continue;
    const existing = await prisma.sessionSeries.findFirst({
      where: { batchId, subject: plan.subject },
    });
    if (existing) {
      result.sessions += await prisma.liveSession.count({ where: { seriesId: existing.id } });
      continue;
    }
    const from = dateKey(plan.fromOffset);
    const until = dateKey(plan.untilOffset);
    const occurrences: { startsAt: Date; endsAt: Date }[] = [];
    for (let offset = plan.fromOffset; offset <= plan.untilOffset; offset += 1) {
      const key = dateKey(offset);
      const weekday = WEEKDAY_KEYS[new Date(`${key}T00:00:00Z`).getUTCDay()]!;
      if (!plan.weekdays.includes(weekday)) continue;
      occurrences.push({
        startsAt: zonedDateTimeToUtc(key, plan.startsTime, organization.timezone),
        endsAt: zonedDateTimeToUtc(key, plan.endsTime, organization.timezone),
      });
    }
    const now = Date.now();
    await prisma.sessionSeries.create({
      data: {
        batchId,
        subject: plan.subject,
        trainerId,
        weekdays: plan.weekdays,
        startsTime: plan.startsTime,
        endsTime: plan.endsTime,
        fromDate: new Date(`${from}T00:00:00Z`),
        untilDate: new Date(`${until}T00:00:00Z`),
        provider: 'none',
        createdById: lookup.adminUserId,
        sessions: {
          create: occurrences.map((occurrence) => ({
            batchId,
            trainerId,
            subject: plan.subject,
            startsAt: occurrence.startsAt,
            endsAt: occurrence.endsAt,
            // Classes that have already finished are recorded as such, so the demo has history.
            status:
              occurrence.endsAt.getTime() < now ? ('completed' as const) : ('scheduled' as const),
            ...(occurrence.endsAt.getTime() < now ? { reminderSentAt: occurrence.startsAt } : {}),
          })),
        },
      },
    });
    result.sessions += occurrences.length;
  }

  // ───────────────── progress for the first few learners ─────────────────
  // Enough for the dashboard, the progress page and the staff view to show real figures.
  const learners = await prisma.studentProfile.findMany({
    where: {
      user: {
        email: {
          in: [
            seedEmail('student01'),
            seedEmail('student02'),
            seedEmail('student03'),
            seedEmail('student04'),
            seedEmail('student05'),
          ],
        },
      },
    },
    select: { id: true, user: { select: { id: true, email: true } } },
    orderBy: { studentCode: 'asc' },
  });
  for (const [index, learner] of learners.entries()) {
    const enrolments = await prisma.enrollment.findMany({
      where: { studentId: learner.id },
      select: { id: true, courseId: true },
      orderBy: { courseId: 'asc' },
    });
    for (const [enrolmentIndex, enrolment] of enrolments.entries()) {
      // The first learner is furthest ahead; later ones have made a start.
      const share = Math.max(0, 0.7 - index * 0.15 - enrolmentIndex * 0.1);
      if (share <= 0) continue;
      const lessons = await prisma.lesson.findMany({
        where: { module: { courseId: enrolment.courseId } },
        orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
        select: { id: true },
      });
      const take = Math.floor(lessons.length * share);
      for (const lesson of lessons.slice(0, take)) {
        const existing = await prisma.lessonProgress.findUnique({
          where: { studentId_lessonId: { studentId: learner.id, lessonId: lesson.id } },
        });
        if (existing) continue;
        await prisma.lessonProgress.create({
          data: {
            studentId: learner.id,
            lessonId: lesson.id,
            status: 'completed',
            watchedPct: 100,
            completedAt: new Date(),
          },
        });
        result.lessonsCompleted += 1;
      }
      const pct = lessons.length === 0 ? 0 : Math.round((take / lessons.length) * 100);
      await prisma.enrollment.update({
        where: { id: enrolment.id },
        data: {
          progressPct: pct,
          status: pct >= 100 ? 'completed' : 'active',
          lastAccessedAt: new Date(),
        },
      });
    }
  }

  return result;
}

/** The same rule the platform applies when a publication derives its enrolments. */
async function studentsInScope(
  prisma: PrismaClient,
  organizationId: string,
  scopeType: string,
  scopeId: string | null,
): Promise<string[]> {
  if (scopeType === 'all') {
    const rows = await prisma.studentProfile.findMany({
      where: { user: { organizationId, deletedAt: null } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  const members = await prisma.batchMember.findMany({
    where:
      scopeType === 'batch'
        ? { batchId: scopeId ?? '', isActive: true }
        : { isActive: true, batch: { programId: scopeId ?? '' } },
    select: { studentId: true },
  });
  return [...new Set(members.map((m) => m.studentId))];
}
