import type { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { BANK } from './content/index.js';
import { currentVerification, loadVerifiedRuns, type VerifiedOutcome } from './content/verified.js';
import { seedEmail } from './seed-identity.js';

/**
 * Task 2 sample data (ADR-0014): what makes the learner's week look lived in.
 *
 *  - A learning history: the lesson completions the learning seed recorded are spread over the
 *    past weeks, and learners solve practice problems on different days, so streaks, adherence
 *    and the leaderboard are counted from work that has dates — nothing is typed in as a total.
 *  - Practice history on the problems in the question bank (prisma/seed/content). A run is
 *    recorded only from the outcome the verification suite measured by running that exact code in
 *    the sandbox, so every accepted run the leaderboard counts is one that really passed.
 *  - Companies (fictional, on `.example` domains) with interview-prep kits built from the practice
 *    catalogue, and a drives board: open, closed and draft drives with applications at every stage.
 *  - Doubts from the running batch, answered, waiting and resolved.
 *
 * Every figure the pages show is derived from these rows by the same services as live data.
 * Idempotent: companies, drives and doubts are matched by name, code and title and left alone once
 * they exist; the learning history is re-dated relative to today on every run.
 */

export interface EngagementSeedResult {
  companies: number;
  kitItems: number;
  drives: number;
  applications: number;
  doubts: number;
  practiceRuns: number;
  lessonDaysSpread: number;
}

const DAY = 86_400_000;

/** Midday-ish IST on the day `daysAgo` before today, plus a few minutes so rows sort naturally. */
function at(daysAgo: number, minutes = 0): Date {
  const date = new Date();
  date.setUTCHours(5, 30, 0, 0); // 11:00 IST
  return new Date(date.getTime() - daysAgo * DAY + minutes * 60_000);
}

/** A closing time `daysAhead` from today at 18:00 IST (12:30 UTC). */
function closingAt(daysAhead: number): Date {
  const date = new Date();
  date.setUTCHours(12, 30, 0, 0);
  return new Date(date.getTime() + daysAhead * DAY);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * The days (counted back from today) on which each of the first five learners studied. Distinct on
 * purpose: one is on a long run, one stopped yesterday, one broke a streak, one has lapsed.
 */
const LESSON_DAYS: Record<string, number[]> = {
  student01: [...range(0, 11), 14, 15, 18, 20, 23, 27],
  student02: [...range(1, 5), 8, 9, 12, 16],
  student03: [0, 1, 3, 4, 5, 6, 9, 13],
  student04: [4, 5, 6, 8, 11, 15, 19],
  student05: [0, 1, 2, 6, 7, 10],
};

// ───────────────────────── companies and drives ─────────────────────────

interface CompanyPlan {
  name: string;
  slug: string;
  industry: string;
  technologies: string[];
  description: string;
  /** Practice problem titles with the topic they sit under in this company's kit. */
  kit: [title: string, topic: string][];
}

const COMPANIES: CompanyPlan[] = [
  {
    name: 'Vellora Systems',
    slug: 'vellora-systems',
    industry: 'IT services',
    technologies: ['core-java', 'sql', 'data-structures'],
    description:
      'Builds and runs back-office systems for banks and insurers. Freshers join a twelve-week Java track before moving to a client team. Rounds: online aptitude, a coding test with two problems, one technical and one HR interview.',
    kit: [
      ['Add two numbers', 'Warm-up'],
      ['Reverse a string', 'Strings'],
      ['Is it a palindrome?', 'Strings'],
      ['Second largest number', 'Arrays'],
      ['Remove the duplicates', 'Arrays'],
      ['Balanced brackets', 'Stacks'],
    ],
  },
  {
    name: 'Tamarind Labs',
    slug: 'tamarind-labs',
    industry: 'Fintech',
    technologies: ['core-java', 'javascript', 'problem-solving'],
    description:
      'A payments start-up with a small engineering team. Interviews lean on problem solving: expect to explain your approach aloud before you write code.',
    kit: [
      ['FizzBuzz up to n', 'Logic'],
      ['Largest in a list', 'Arrays'],
      ['Second largest number', 'Arrays'],
      ['Are they anagrams?', 'Strings'],
      ['Balanced brackets', 'Stacks'],
    ],
  },
  {
    name: 'Kovai Softworks',
    slug: 'kovai-softworks',
    industry: 'Product engineering',
    technologies: ['core-java', 'html-css', 'sql'],
    description:
      'Makes scheduling software for hospitals. The graduate programme mixes Java services with front-end work, so the coding round includes one string problem and one array problem.',
    kit: [
      ['Count the vowels', 'Strings'],
      ['Count the words', 'Strings'],
      ['Sum of the digits', 'Numbers'],
      ['Largest in a list', 'Arrays'],
    ],
  },
  {
    name: 'Harbourline Analytics',
    slug: 'harbourline-analytics',
    industry: 'Data and analytics',
    technologies: ['sql', 'problem-solving'],
    description:
      'Reporting and forecasting for logistics companies. The test is SQL-heavy, with a short programming section on arrays and numbers.',
    kit: [
      ['Sum of the digits', 'Numbers'],
      ['Add two numbers', 'Numbers'],
      ['Remove the duplicates', 'Arrays'],
      ['Largest in a list', 'Arrays'],
    ],
  },
  {
    name: 'Coralstone Retail Tech',
    slug: 'coralstone-retail-tech',
    industry: 'Retail technology',
    technologies: ['javascript', 'html-css'],
    description:
      'Runs online storefronts for regional retailers. Front-end focused; the kit is being put together with the company.',
    kit: [],
  },
];

interface DrivePlan {
  code: string;
  company: string;
  role: string;
  employmentType: 'full_time' | 'internship';
  location: string;
  packageText: string;
  description: string;
  status: 'draft' | 'open' | 'closed';
  /** Days from today; negative for a drive that has closed. */
  closesIn: number;
  openedDaysAgo: number | null;
  eligibility: { batchCodes: string[]; programCodes: string[]; minAttendancePct: number | null };
}

const DRIVES: DrivePlan[] = [
  {
    code: 'DRV-2026-001',
    company: 'Kovai Softworks',
    role: 'Graduate Engineer Trainee',
    employmentType: 'full_time',
    location: 'Coimbatore',
    packageText: '3.6 LPA',
    description:
      'Graduate programme starting with six weeks of training in Coimbatore.\n\nRounds: aptitude and coding test (online), technical interview, HR interview.',
    status: 'closed',
    closesIn: -24,
    openedDaysAgo: 38,
    eligibility: { batchCodes: ['JFS-2025-B4'], programCodes: [], minAttendancePct: null },
  },
  {
    code: 'DRV-2026-002',
    company: 'Vellora Systems',
    role: 'Associate Software Engineer',
    employmentType: 'full_time',
    location: 'Chennai',
    packageText: '4.2 – 5 LPA',
    description:
      'Java developers for client projects in banking. Training for twelve weeks, then a client team.\n\nRounds: online aptitude (40 minutes), coding test with two problems, technical interview, HR interview. Bring two copies of your resume to the interview.',
    status: 'open',
    closesIn: 6,
    openedDaysAgo: 3,
    eligibility: { batchCodes: [], programCodes: ['JFS'], minAttendancePct: 75 },
  },
  {
    code: 'DRV-2026-003',
    company: 'Tamarind Labs',
    role: 'Java Developer Intern',
    employmentType: 'internship',
    location: 'Bengaluru (hybrid)',
    packageText: '₹20,000 a month',
    description:
      'A six-month internship on the payments team, with a full-time offer for interns who do well.\n\nRounds: a problem-solving interview (you explain your approach before coding), then a conversation with the team lead.',
    status: 'open',
    closesIn: 2,
    openedDaysAgo: 5,
    eligibility: { batchCodes: ['JFS-2026-B1'], programCodes: [], minAttendancePct: 70 },
  },
  {
    code: 'DRV-2026-004',
    company: 'Harbourline Analytics',
    role: 'Data Analyst Trainee',
    employmentType: 'full_time',
    location: 'Chennai',
    packageText: '4 LPA',
    description:
      'Reporting and SQL work for logistics clients.\n\nRounds: SQL test, a short programming section, and an interview with the analytics lead.',
    status: 'open',
    closesIn: 12,
    openedDaysAgo: 1,
    eligibility: { batchCodes: [], programCodes: [], minAttendancePct: 85 },
  },
  {
    code: 'DRV-2026-005',
    company: 'Coralstone Retail Tech',
    role: 'Frontend Developer',
    employmentType: 'full_time',
    location: 'Remote',
    packageText: '5 – 6.5 LPA',
    description: 'Details are being confirmed with the company.',
    status: 'draft',
    closesIn: 20,
    openedDaysAgo: null,
    eligibility: { batchCodes: [], programCodes: ['JFS'], minAttendancePct: 75 },
  },
];

/** Who applied to what, and where each application stands. */
const APPLICATIONS: {
  drive: string;
  student: string;
  status: 'applied' | 'shortlisted' | 'selected' | 'rejected' | 'withdrawn';
  daysAgo: number;
  note?: string;
}[] = [
  // The closed drive: the batch that finished last year, with every decision made.
  {
    drive: 'DRV-2026-001',
    student: 'student41',
    status: 'selected',
    daysAgo: 30,
    note: 'Offer letter sent to your email. Joining date: the first Monday of next month.',
  },
  { drive: 'DRV-2026-001', student: 'student42', status: 'rejected', daysAgo: 30 },
  {
    drive: 'DRV-2026-001',
    student: 'student44',
    status: 'selected',
    daysAgo: 29,
    note: 'Offer letter sent to your email.',
  },
  { drive: 'DRV-2026-001', student: 'student45', status: 'rejected', daysAgo: 29 },
  { drive: 'DRV-2026-001', student: 'student47', status: 'withdrawn', daysAgo: 28 },
  { drive: 'DRV-2026-001', student: 'student48', status: 'rejected', daysAgo: 28 },
  {
    drive: 'DRV-2026-001',
    student: 'student50',
    status: 'selected',
    daysAgo: 27,
    note: 'Offer letter sent to your email.',
  },
  { drive: 'DRV-2026-001', student: 'student53', status: 'rejected', daysAgo: 26 },
  // Open drives: the running batch.
  {
    drive: 'DRV-2026-002',
    student: 'student01',
    status: 'shortlisted',
    daysAgo: 2,
    note: 'Aptitude and coding test on Monday at 10 am in Lab 2. Bring your college ID.',
  },
  { drive: 'DRV-2026-002', student: 'student02', status: 'applied', daysAgo: 2 },
  {
    drive: 'DRV-2026-002',
    student: 'student05',
    status: 'shortlisted',
    daysAgo: 1,
    note: 'Aptitude and coding test on Monday at 10 am in Lab 2. Bring your college ID.',
  },
  { drive: 'DRV-2026-002', student: 'student06', status: 'applied', daysAgo: 1 },
  { drive: 'DRV-2026-002', student: 'student09', status: 'applied', daysAgo: 0 },
  { drive: 'DRV-2026-003', student: 'student01', status: 'applied', daysAgo: 4 },
  { drive: 'DRV-2026-003', student: 'student03', status: 'applied', daysAgo: 3 },
  { drive: 'DRV-2026-003', student: 'student07', status: 'withdrawn', daysAgo: 3 },
];

// ───────────────────────── doubts ─────────────────────────

interface DoubtPlan {
  student: string;
  course: string;
  lesson?: string;
  title: string;
  body: string;
  daysAgo: number;
  status: 'open' | 'answered' | 'resolved';
  replies: { from: string; body: string; hoursLater: number }[];
}

const DOUBTS: DoubtPlan[] = [
  {
    student: 'student01',
    course: 'core-java',
    lesson: 'List, Set and Map',
    title: 'Why does my HashMap lose an entry after I change the key object?',
    body: 'I put a Student object in a HashMap as the key, then changed its roll number. After that map.get(student) returns null even though the entry is still there when I print the map. What is going on?',
    daysAgo: 3,
    status: 'answered',
    replies: [
      {
        from: 'trainer1',
        body: 'The map files each entry under the key’s hashCode at the moment you put it in. When you change a field that hashCode uses, the key now hashes somewhere else, so get() looks in the wrong place. Use keys that do not change — a String roll number, or make the fields that equals/hashCode read final. We will go over this on Wednesday.',
        hoursLater: 5,
      },
    ],
  },
  {
    student: 'student02',
    course: 'core-java',
    lesson: 'Primitives and wrappers',
    title: 'When should I use equals() instead of == for strings?',
    body: 'In the exercise, `name == "Ravi"` worked when I typed the value in the code but not when I read it from input. Why?',
    daysAgo: 8,
    status: 'resolved',
    replies: [
      {
        from: 'trainer1',
        body: '== compares whether two references point at the same object. String literals in your code are shared, so two identical literals happen to be the same object; a string read from input is a new object. Always compare text with equals() (or equalsIgnoreCase()).',
        hoursLater: 3,
      },
      { from: 'student02', body: 'That fixed it, thank you.', hoursLater: 20 },
    ],
  },
  {
    student: 'student03',
    course: 'sql-and-databases',
    title: 'LEFT JOIN or INNER JOIN for the orders report?',
    body: 'The assignment asks for every customer and their orders. With INNER JOIN, customers with no orders disappear. Is LEFT JOIN the right fix, and how do I show 0 instead of NULL for their total?',
    daysAgo: 1,
    status: 'open',
    replies: [],
  },
  {
    student: 'student04',
    course: 'core-java',
    title: 'Can I use var in the assignments?',
    body: 'Is it fine to write `var list = new ArrayList<String>();` in the assignment answers, or will it lose marks?',
    daysAgo: 0,
    status: 'open',
    replies: [],
  },
  {
    student: 'student05',
    course: 'web-development',
    title: 'Why is 0.1 + 0.2 not 0.3 in JavaScript?',
    body: 'console.log(0.1 + 0.2) prints 0.30000000000000004. Is my browser broken?',
    daysAgo: 2,
    status: 'answered',
    replies: [
      {
        from: 'trainer5',
        body: 'Your browser is fine — numbers are stored in binary floating point, and 0.1 has no exact binary form, just as 1/3 has no exact decimal form. For money, work in whole paise (integers) and format at the end; to compare, check that the difference is smaller than a tiny tolerance.',
        hoursLater: 4,
      },
    ],
  },
];

// ───────────────────────── the seed ─────────────────────────

export async function seedEngagement(
  prisma: PrismaClient,
  organization: { id: string; timezone: string },
): Promise<EngagementSeedResult> {
  const result: EngagementSeedResult = {
    companies: 0,
    kitItems: 0,
    drives: 0,
    applications: 0,
    doubts: 0,
    practiceRuns: 0,
    lessonDaysSpread: 0,
  };

  const users = await prisma.user.findMany({
    where: { organizationId: organization.id, email: { endsWith: seedEmail('') } },
    select: {
      id: true,
      email: true,
      name: true,
      studentProfile: { select: { id: true } },
    },
  });
  const userByLocal = new Map(users.map((u) => [u.email.split('@')[0]!, u]));
  const student = (local: string) => {
    const user = userByLocal.get(local);
    if (!user?.studentProfile) throw new Error(`Seed learner ${local} is missing`);
    return { userId: user.id, studentId: user.studentProfile.id, name: user.name };
  };
  const userId = (local: string) => {
    const user = userByLocal.get(local);
    if (!user) throw new Error(`Seed account ${local} is missing`);
    return user.id;
  };
  const adminId = userByLocal.get('admin')?.id ?? null;
  const placementId = userByLocal.get('placement')?.id ?? adminId;

  // ───────── the practice catalogue: the bank's problems and their verified outcomes ─────────
  const verified = loadVerifiedRuns();
  const practice = await prisma.question.findMany({
    where: {
      organizationId: organization.id,
      inPractice: true,
      type: { in: ['coding', 'sql'] },
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      coding: { select: { referenceSolution: true, starterCode: true, languages: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const problemByTitle = new Map(practice.map((p) => [p.title, p]));
  const bankBySlug = new Map(BANK.map((q) => [q.slug, q]));

  // ───────── the learning history ─────────
  for (const [local, days] of Object.entries(LESSON_DAYS)) {
    const learner = student(local);
    const done = await prisma.lessonProgress.findMany({
      where: { studentId: learner.studentId, status: 'completed' },
      select: {
        id: true,
        lessonId: true,
        lesson: {
          select: {
            title: true,
            position: true,
            module: {
              select: { position: true, courseId: true, course: { select: { slug: true } } },
            },
          },
        },
      },
    });
    done.sort(
      (a, b) =>
        a.lesson.module.course.slug.localeCompare(b.lesson.module.course.slug) ||
        a.lesson.module.position - b.lesson.module.position ||
        a.lesson.position - b.lesson.position,
    );
    const oldestFirst = [...days].sort((a, b) => b - a);
    // Interleave courses by day: lesson j goes to the day whose share of the list it falls in.
    for (const [index, row] of done.entries()) {
      const day =
        oldestFirst[
          Math.min(oldestFirst.length - 1, Math.floor((index * oldestFirst.length) / done.length))
        ]!;
      const when = at(day, (index % 4) * 23);
      await prisma.lessonProgress.update({
        where: { id: row.id },
        data: { completedAt: when, lastAccessedAt: when },
      });
      const idempotencyKey = `seed:lesson:${learner.studentId}:${row.lessonId}`;
      await prisma.activityEvent.upsert({
        where: { idempotencyKey },
        create: {
          userId: learner.userId,
          type: 'lesson.completed',
          entityType: 'lesson',
          entityId: row.lessonId,
          title: `Completed ${row.lesson.title}`,
          link: `/courses/${row.lesson.module.courseId}/lessons/${row.lessonId}`,
          occurredAt: when,
          idempotencyKey,
        },
        update: { occurredAt: when },
      });
      result.lessonDaysSpread += 1;
    }
    await recomputeEnrolments(prisma, learner.studentId);
  }

  // Practice: who solved what, on which day. A failed run first where a learner struggled.
  const practicePlan: {
    student: string;
    problem: string;
    daysAgo: number;
    failedFirst?: boolean;
  }[] = [
    { student: 'student01', problem: 'Add two numbers', daysAgo: 9 },
    { student: 'student01', problem: 'Reverse a string', daysAgo: 7 },
    { student: 'student01', problem: 'Is it a palindrome?', daysAgo: 5, failedFirst: true },
    { student: 'student01', problem: 'Second largest number', daysAgo: 3 },
    { student: 'student01', problem: 'Balanced brackets', daysAgo: 2, failedFirst: true },
    { student: 'student01', problem: 'Remove the duplicates', daysAgo: 0 },
    { student: 'student02', problem: 'Add two numbers', daysAgo: 6 },
    { student: 'student02', problem: 'FizzBuzz up to n', daysAgo: 4 },
    { student: 'student02', problem: 'Largest in a list', daysAgo: 2 },
    { student: 'student02', problem: 'Count the words', daysAgo: 1 },
    { student: 'student03', problem: 'Add two numbers', daysAgo: 5 },
    { student: 'student03', problem: 'Count the vowels', daysAgo: 1, failedFirst: true },
    { student: 'student03', problem: 'Sum of the digits', daysAgo: 0 },
    { student: 'student05', problem: 'Reverse a string', daysAgo: 2 },
    { student: 'student05', problem: 'Are they anagrams?', daysAgo: 1, failedFirst: true },
    { student: 'student06', problem: 'Add two numbers', daysAgo: 3 },
    { student: 'student06', problem: 'Sum of the digits', daysAgo: 1 },
    { student: 'student07', problem: 'FizzBuzz up to n', daysAgo: 4, failedFirst: true },
    { student: 'student08', problem: 'Add two numbers', daysAgo: 0 },
    { student: 'student09', problem: 'Reverse a string', daysAgo: 2 },
    { student: 'student09', problem: 'Count the words', daysAgo: 0 },
    { student: 'student11', problem: 'Largest in a list', daysAgo: 6 },
    { student: 'student12', problem: 'Add two numbers', daysAgo: 1 },
  ];
  for (const [index, entry] of practicePlan.entries()) {
    const learner = student(entry.student);
    const problem = problemByTitle.get(entry.problem);
    const plan = problem ? bankBySlug.get(problem.slug) : undefined;
    if (!problem?.coding || !plan || (plan.type !== 'coding' && plan.type !== 'sql')) continue;
    const verification = currentVerification(verified, plan);
    if (!verification) continue;
    const already = await prisma.executionRun.count({
      where: { userId: learner.userId, questionId: problem.id, context: 'practice' },
    });
    if (already > 0) continue;
    const offered = problem.coding.languages as string[];
    const language =
      index % 3 === 0 && offered.includes('python')
        ? 'python'
        : offered.includes('java')
          ? 'java'
          : offered[0]!;
    const outcomes = verification.languages[language];
    if (!outcomes) continue;
    const solution = (problem.coding.referenceSolution as Record<string, string>)[language] ?? '';
    const starter = (problem.coding.starterCode as Record<string, string>)[language] ?? '';
    const runs: Prisma.ExecutionRunCreateManyInput[] = [];
    const record = (code: string, outcome: VerifiedOutcome, minutes: number) =>
      runs.push({
        questionId: problem.id,
        userId: learner.userId,
        context: 'practice',
        language,
        code,
        driver: verified!.driver,
        trust: 'trusted',
        verdict: outcome.verdict as Prisma.ExecutionRunCreateManyInput['verdict'],
        passedCount: outcome.passed,
        totalCount: outcome.total,
        durationMs: outcome.durationMs ?? 0,
        detail: { cases: [] },
        createdAt: at(entry.daysAgo, minutes),
      });
    if (entry.failedFirst && starter && outcomes.starter) record(starter, outcomes.starter, 60);
    if (solution) record(solution, outcomes.solution, 75);
    if (runs.length === 0) continue;
    await prisma.executionRun.createMany({ data: runs });
    result.practiceRuns += runs.length;
  }

  // ───────── companies and their kits ─────────
  const companyIdByName = new Map<string, string>();
  for (const plan of COMPANIES) {
    const existing = await prisma.company.findUnique({
      where: { organizationId_slug: { organizationId: organization.id, slug: plan.slug } },
    });
    const company =
      existing ??
      (await prisma.company.create({
        data: {
          organizationId: organization.id,
          slug: plan.slug,
          name: plan.name,
          industry: plan.industry,
          website: `https://${plan.slug.replace(/-/g, '')}.example`,
          description: plan.description,
          technologies: plan.technologies,
          createdById: placementId,
        },
      }));
    companyIdByName.set(plan.name, company.id);
    result.companies += 1;
    if (existing) continue;
    const items = plan.kit
      .map(([title, topic]) => ({ question: problemByTitle.get(title), topic }))
      .filter((item): item is { question: NonNullable<typeof item.question>; topic: string } =>
        Boolean(item.question),
      );
    await prisma.companyKitItem.createMany({
      data: items.map((item, position) => ({
        companyId: company.id,
        questionId: item.question.id,
        topic: item.topic,
        position,
      })),
    });
    result.kitItems += items.length;
  }
  // Two learners keep favourites, so the "Starred" view has something in it.
  for (const [local, name] of [
    ['student01', 'Vellora Systems'],
    ['student01', 'Tamarind Labs'],
    ['student03', 'Harbourline Analytics'],
  ] as const) {
    await prisma.companyFavourite.upsert({
      where: {
        userId_companyId: { userId: student(local).userId, companyId: companyIdByName.get(name)! },
      },
      create: { userId: student(local).userId, companyId: companyIdByName.get(name)! },
      update: {},
    });
  }

  // ───────── drives, applications and what learners were told ─────────
  const [batches, programs] = await Promise.all([
    prisma.batch.findMany({
      where: { organizationId: organization.id },
      select: { id: true, code: true },
    }),
    prisma.program.findMany({
      where: { organizationId: organization.id },
      select: { id: true, code: true },
    }),
  ]);
  const batchId = new Map(batches.map((b) => [b.code, b.id]));
  const programId = new Map(programs.map((p) => [p.code, p.id]));
  const driveIdByCode = new Map<string, string>();
  for (const plan of DRIVES) {
    const existing = await prisma.placementDrive.findUnique({
      where: { organizationId_code: { organizationId: organization.id, code: plan.code } },
    });
    const drive =
      existing ??
      (await prisma.placementDrive.create({
        data: {
          organizationId: organization.id,
          companyId: companyIdByName.get(plan.company)!,
          code: plan.code,
          role: plan.role,
          employmentType: plan.employmentType,
          location: plan.location,
          packageText: plan.packageText,
          description: plan.description,
          eligibility: {
            batchIds: plan.eligibility.batchCodes
              .map((c) => batchId.get(c))
              .filter((id): id is string => Boolean(id)),
            programIds: plan.eligibility.programCodes
              .map((c) => programId.get(c))
              .filter((id): id is string => Boolean(id)),
            minAttendancePct: plan.eligibility.minAttendancePct,
          },
          applyBy: closingAt(plan.closesIn),
          status: plan.status,
          publishedAt: plan.openedDaysAgo === null ? null : at(plan.openedDaysAgo),
          createdById: placementId,
          createdAt: at(plan.openedDaysAgo ?? 1, -60),
        },
      }));
    driveIdByCode.set(plan.code, drive.id);
    result.drives += 1;
  }

  for (const entry of APPLICATIONS) {
    const driveId = driveIdByCode.get(entry.drive)!;
    const learner = student(entry.student);
    const existing = await prisma.driveApplication.findUnique({
      where: { driveId_studentId: { driveId, studentId: learner.studentId } },
    });
    if (existing) continue;
    await prisma.driveApplication.create({
      data: {
        driveId,
        studentId: learner.studentId,
        status: entry.status,
        note: entry.note ?? '',
        appliedAt: at(entry.daysAgo, 20),
        // A decision comes a few days after the application; an open one was last touched then.
        updatedAt:
          entry.status === 'applied'
            ? at(entry.daysAgo, 20)
            : at(Math.max(0, entry.daysAgo - 3), 240),
        updatedById:
          entry.status === 'applied' || entry.status === 'withdrawn' ? null : placementId,
      },
    });
    result.applications += 1;
    if (
      entry.status === 'shortlisted' ||
      entry.status === 'selected' ||
      entry.status === 'rejected'
    ) {
      const drive = DRIVES.find((d) => d.code === entry.drive)!;
      await prisma.notification.create({
        data: {
          userId: learner.userId,
          category: 'placement',
          type: 'drive.application_updated',
          title: `${drive.company} · ${drive.role}: ${
            entry.status === 'rejected'
              ? 'Not selected'
              : entry.status === 'selected'
                ? 'Selected'
                : 'Shortlisted'
          }`,
          body:
            entry.note ??
            (entry.status === 'rejected'
              ? 'The company has not taken your application further this time.'
              : 'Your application has moved on.'),
          link: `/placements/${driveId}`,
          createdAt: at(Math.max(0, entry.daysAgo - 1), 240),
          readAt: entry.daysAgo > 3 ? at(entry.daysAgo - 2) : null,
        },
      });
    }
  }

  // The running batch was told about the drives open to it (only the ones whose rules they meet).
  const running = await prisma.batchMember.findMany({
    where: { batchId: batchId.get('JFS-2026-B1'), isActive: true },
    select: { studentId: true, student: { select: { userId: true } } },
  });
  const attendance = await attendanceByStudent(
    prisma,
    running.map((m) => m.studentId),
  );
  for (const plan of DRIVES.filter((d) => d.status === 'open')) {
    const driveId = driveIdByCode.get(plan.code)!;
    const told = await prisma.notification.count({
      where: { type: 'drive.opened', link: `/placements/${driveId}` },
    });
    if (told > 0) continue;
    const eligible = running.filter((m) => {
      const pct = attendance.get(m.studentId) ?? null;
      return (
        plan.eligibility.minAttendancePct === null ||
        pct === null ||
        pct >= plan.eligibility.minAttendancePct
      );
    });
    await prisma.notification.createMany({
      data: eligible.map((m) => ({
        userId: m.student.userId,
        category: 'placement',
        type: 'drive.opened',
        title: `${plan.company} is hiring: ${plan.role}`,
        body: 'Check the eligibility and apply from Placements before the closing date.',
        link: `/placements/${driveId}`,
        createdAt: at(plan.openedDaysAgo ?? 0, -30),
      })),
    });
  }

  // ───────── doubts ─────────
  const courses = await prisma.course.findMany({
    where: { organizationId: organization.id },
    select: { id: true, slug: true },
  });
  const courseId = new Map(courses.map((c) => [c.slug, c.id]));
  for (const plan of DOUBTS) {
    const learner = student(plan.student);
    const existing = await prisma.doubt.findFirst({
      where: { studentId: learner.studentId, title: plan.title },
    });
    if (existing) continue;
    const course = courseId.get(plan.course) ?? null;
    const lesson =
      course && plan.lesson
        ? await prisma.lesson.findFirst({
            where: { title: plan.lesson, module: { courseId: course } },
            select: { id: true },
          })
        : null;
    const created = at(plan.daysAgo, 150);
    const lastReply = plan.replies.at(-1);
    const lastActivity = lastReply
      ? new Date(created.getTime() + lastReply.hoursLater * 3_600_000)
      : created;
    const doubt = await prisma.doubt.create({
      data: {
        organizationId: organization.id,
        studentId: learner.studentId,
        courseId: course,
        lessonId: lesson?.id ?? null,
        title: plan.title,
        body: plan.body,
        status: plan.status,
        createdAt: created,
        updatedAt: lastActivity,
        resolvedAt:
          plan.status === 'resolved' && lastReply
            ? new Date(created.getTime() + (lastReply.hoursLater + 1) * 3_600_000)
            : null,
      },
    });
    for (const reply of plan.replies) {
      const fromStaff = reply.from.startsWith('trainer');
      await prisma.doubtReply.create({
        data: {
          doubtId: doubt.id,
          authorId: userId(reply.from),
          body: reply.body,
          fromStaff,
          createdAt: new Date(created.getTime() + reply.hoursLater * 3_600_000),
        },
      });
      if (fromStaff) {
        await prisma.notification.create({
          data: {
            userId: learner.userId,
            category: 'support',
            type: 'doubt.answered',
            title: `${userByLocal.get(reply.from)?.name ?? 'Your trainer'} answered your doubt`,
            body: plan.title,
            link: `/doubts/${doubt.id}`,
            createdAt: new Date(created.getTime() + reply.hoursLater * 3_600_000),
            readAt:
              plan.status === 'resolved'
                ? new Date(created.getTime() + (reply.hoursLater + 2) * 3_600_000)
                : null,
          },
        });
      }
    }
    result.doubts += 1;
  }

  // ───────── a few profiles with projects ─────────
  const projects: Record<
    string,
    { title: string; description: string; link: string; technologies: string[] }[]
  > = {
    student01: [
      {
        title: 'Library desk',
        description:
          'A console application for a college library: members, loans and fines, stored in MySQL through JDBC. Built during the Core Java module and extended with a report of overdue books.',
        link: '',
        technologies: ['Java', 'JDBC', 'MySQL'],
      },
      {
        title: 'Expense splitter',
        description:
          'A small web page that splits a shared bill between friends and remembers who owes whom.',
        link: '',
        technologies: ['HTML', 'CSS', 'JavaScript'],
      },
    ],
    student02: [
      {
        title: 'Hostel mess feedback form',
        description: 'A form and a summary page the hostel committee used for a semester.',
        link: '',
        technologies: ['HTML', 'JavaScript'],
      },
    ],
    student05: [
      {
        title: 'Timetable clash checker',
        description: 'Reads a list of classes and reports overlapping slots for each student.',
        link: '',
        technologies: ['Java'],
      },
    ],
  };
  for (const [local, list] of Object.entries(projects)) {
    await prisma.studentProfile.update({
      where: { id: student(local).studentId },
      data: { projects: list },
    });
  }

  return result;
}

/** Each learner's attendance by the institute's default rule (present, late and excused count). */
async function attendanceByStudent(
  prisma: PrismaClient,
  studentIds: string[],
): Promise<Map<string, number | null>> {
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ['studentId', 'status'],
    where: { studentId: { in: studentIds } },
    _count: { _all: true },
  });
  const tally = new Map<string, { conducted: number; attended: number }>();
  for (const row of grouped) {
    const entry = tally.get(row.studentId) ?? { conducted: 0, attended: 0 };
    entry.conducted += row._count._all;
    if (row.status !== 'absent') entry.attended += row._count._all;
    tally.set(row.studentId, entry);
  }
  return new Map(
    studentIds.map((id) => {
      const entry = tally.get(id);
      return [
        id,
        entry && entry.conducted > 0 ? Math.round((entry.attended / entry.conducted) * 100) : null,
      ];
    }),
  );
}

/** The platform's rule for a course percentage: completed mandatory lessons ÷ mandatory lessons. */
async function recomputeEnrolments(prisma: PrismaClient, studentId: string): Promise<void> {
  const enrolments = await prisma.enrollment.findMany({ where: { studentId } });
  for (const enrolment of enrolments) {
    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: enrolment.courseId } },
      select: { id: true, isMandatory: true },
    });
    const counted = lessons.filter((l) => l.isMandatory);
    const pool = counted.length > 0 ? counted : lessons;
    if (pool.length === 0) continue;
    const completed = await prisma.lessonProgress.findMany({
      where: { studentId, status: 'completed', lessonId: { in: pool.map((l) => l.id) } },
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
    });
    const pct = Math.round((completed.length / pool.length) * 100);
    await prisma.enrollment.update({
      where: { id: enrolment.id },
      data: {
        progressPct: pct,
        status: pct >= 100 ? 'completed' : 'active',
        completedAt: pct >= 100 ? (completed[0]?.completedAt ?? new Date()) : null,
        lastAccessedAt: completed[0]?.completedAt ?? enrolment.lastAccessedAt,
      },
    });
  }
}
