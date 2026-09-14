/**
 * Phase 4 demo content: a question bank, four assignments, three tests at different points in
 * their life, and a practice catalogue.
 *
 * The coding problems carry reference solutions in JavaScript and Python whose outputs were
 * checked by hand when these fixtures were written; their `validation` record says exactly that,
 * rather than claiming a driver ran them. Nothing here executes code: the API never does, and
 * neither does the seed (ADR-0007).
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';

type QuestionType = 'mcq_single' | 'mcq_multi' | 'true_false' | 'descriptive' | 'coding';
type Difficulty = 'easy' | 'medium' | 'hard';

interface ObjectivePlan {
  title: string;
  body: string;
  type: Exclude<QuestionType, 'coding'>;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  marks: number;
  explanation: string;
  options?: [string, boolean][];
  rubric?: string;
}

interface CodingPlan {
  title: string;
  body: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  marks: number;
  points: number;
  starter: { javascript: string; python: string };
  solution: { javascript: string; python: string };
  cases: { input: string; expected: string; sample: boolean }[];
}

/** Four options with the given index correct, written once and reused. */
function mcq(
  title: string,
  body: string,
  subject: string,
  topic: string,
  difficulty: Difficulty,
  options: string[],
  correctIndex: number,
  explanation: string,
): ObjectivePlan {
  return {
    title,
    body,
    type: 'mcq_single',
    subject,
    topic,
    difficulty,
    marks: difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1,
    explanation,
    options: options.map((option, index) => [option, index === correctIndex]),
  };
}

function trueFalse(
  title: string,
  body: string,
  subject: string,
  topic: string,
  isTrue: boolean,
  explanation: string,
): ObjectivePlan {
  return {
    title,
    body,
    type: 'true_false',
    subject,
    topic,
    difficulty: 'easy',
    marks: 1,
    explanation,
    options: [
      ['True', isTrue],
      ['False', !isTrue],
    ],
  };
}

function written(
  title: string,
  body: string,
  subject: string,
  topic: string,
  marks: number,
  rubric: string,
): ObjectivePlan {
  return {
    title,
    body,
    type: 'descriptive',
    subject,
    topic,
    difficulty: 'medium',
    marks,
    explanation: '',
    rubric,
  };
}

const OBJECTIVE: ObjectivePlan[] = [
  // ── Core Java ──
  mcq(
    'Which keyword prevents a class from being extended in Java?',
    'Choose the modifier that stops any other class inheriting from this one.',
    'core-java',
    'oop',
    'easy',
    ['static', 'final', 'sealed', 'private'],
    1,
    '`final` on a class means no other class may extend it.',
  ),
  mcq(
    'What does the JVM do with an object nothing refers to?',
    'A program creates an object and then loses every reference to it. What happens next?',
    'core-java',
    'oop',
    'easy',
    [
      'It is freed immediately',
      'It becomes eligible for garbage collection',
      'It stays until the program exits',
      'It raises an error',
    ],
    1,
    'It becomes eligible; the collector decides when to run.',
  ),
  mcq(
    'Which collection keeps its entries in the order they were inserted?',
    'You need a map whose iteration order matches insertion order.',
    'core-java',
    'collections',
    'medium',
    ['HashMap', 'TreeMap', 'LinkedHashMap', 'Hashtable'],
    2,
    '`LinkedHashMap` maintains a doubly-linked list of its entries.',
  ),
  mcq(
    'What is the result of 7 / 2 in Java when both are ints?',
    'Both operands are of type int.',
    'core-java',
    'numbers',
    'easy',
    ['3.5', '3', '4', 'A compile error'],
    1,
    'Integer division truncates towards zero, so it is 3.',
  ),
  mcq(
    'Which exception is checked?',
    'Pick the one the compiler forces you to handle or declare.',
    'core-java',
    'exceptions',
    'medium',
    [
      'NullPointerException',
      'IllegalArgumentException',
      'IOException',
      'ArrayIndexOutOfBoundsException',
    ],
    2,
    '`IOException` extends Exception but not RuntimeException, so it is checked.',
  ),
  trueFalse(
    'A Java interface can declare a static method.',
    'Decide whether the statement is true of Java 8 and later.',
    'core-java',
    'oop',
    true,
    'Since Java 8 an interface may declare static and default methods.',
  ),
  trueFalse(
    'Strings in Java are mutable.',
    'Decide whether a String object can be changed after it is created.',
    'core-java',
    'strings',
    false,
    'String is immutable; every operation returns a new String.',
  ),
  written(
    'Explain the difference between an abstract class and an interface.',
    'Answer in your own words, and say when you would reach for each.',
    'core-java',
    'oop',
    5,
    'Full marks: state fields and constructors, single versus multiple inheritance, and give a sensible example of each. Three marks for the distinction without an example.',
  ),
  // ── Advanced Java ──
  mcq(
    'What does a thread pool avoid?',
    'Why use an ExecutorService rather than creating threads directly?',
    'advanced-java',
    'oop',
    'medium',
    [
      'Writing any concurrent code',
      'The cost of creating a thread per task',
      'The need for synchronisation',
      'Deadlock',
    ],
    1,
    'Pools reuse threads, so the creation cost is paid once.',
  ),
  mcq(
    'Which HTTP status says the request was understood but refused?',
    'The caller is authenticated, and still may not do this.',
    'advanced-java',
    'queries',
    'easy',
    ['400', '401', '403', '404'],
    2,
    '403 Forbidden: understood, authenticated, and refused.',
  ),
  trueFalse(
    'A database transaction that is never committed leaves its changes visible to others.',
    'Decide whether uncommitted changes are visible outside the transaction.',
    'advanced-java',
    'queries',
    false,
    'Uncommitted changes are invisible to other transactions at the usual isolation levels.',
  ),
  written(
    'Describe what a connection pool does and why it matters.',
    'Explain the problem it solves and one setting you would tune.',
    'advanced-java',
    'queries',
    5,
    'Full marks: reuse of expensive connections, a bound on concurrency, and one named setting such as the maximum pool size with a reason.',
  ),
  // ── SQL ──
  mcq(
    'Which join keeps rows from the left table with no match on the right?',
    'You want every customer, whether or not they have an order.',
    'sql',
    'joins',
    'easy',
    ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN'],
    1,
    'A LEFT JOIN keeps every row of the left table.',
  ),
  mcq(
    'What does GROUP BY do?',
    'Choose the best description.',
    'sql',
    'queries',
    'easy',
    [
      'Sorts the result',
      'Collapses rows that share a value so aggregates can be computed',
      'Removes duplicates',
      'Filters rows',
    ],
    1,
    'It groups rows so aggregate functions apply per group.',
  ),
  mcq(
    'Which clause filters on an aggregate?',
    'You want only the groups whose count is above ten.',
    'sql',
    'queries',
    'medium',
    ['WHERE', 'HAVING', 'FILTER', 'QUALIFY'],
    1,
    'WHERE filters rows before grouping; HAVING filters groups after.',
  ),
  trueFalse(
    'A primary key may contain NULL.',
    'Decide whether a primary key column can hold NULL.',
    'sql',
    'queries',
    false,
    'A primary key is unique and NOT NULL by definition.',
  ),
  written(
    'Explain the difference between a primary key and a unique constraint.',
    'Answer in your own words, with an example of each.',
    'sql',
    'queries',
    5,
    'Full marks: uniqueness in both, nullability and one-per-table for the primary key, plus an example. Three marks without the nullability point.',
  ),
  // ── JavaScript ──
  mcq(
    'Which keyword declares a binding you cannot reassign?',
    'Choose the declaration that refuses reassignment.',
    'javascript',
    'functions',
    'easy',
    ['var', 'let', 'const', 'static'],
    2,
    '`const` refuses reassignment, though the value may still be mutated.',
  ),
  mcq(
    'What does Array.prototype.map return?',
    'Choose what you get back.',
    'javascript',
    'arrays',
    'easy',
    ['The same array, changed', 'A new array of the same length', 'A single value', 'undefined'],
    1,
    'map returns a new array with one entry per input entry.',
  ),
  mcq(
    'What is the type of NaN?',
    'Think about what typeof reports.',
    'javascript',
    'numbers',
    'medium',
    ['"nan"', '"number"', '"undefined"', '"object"'],
    1,
    'NaN is a number value, so typeof NaN is "number".',
  ),
  mcq(
    'Which of these blocks the main thread?',
    'Pick the one that stops everything else running.',
    'javascript',
    'async',
    'medium',
    ['setTimeout', 'A long synchronous loop', 'fetch', 'requestAnimationFrame'],
    1,
    'JavaScript runs one thing at a time; a long loop blocks it all.',
  ),
  trueFalse(
    'let and const are scoped to the block they appear in.',
    'Decide whether block scoping applies to both.',
    'javascript',
    'functions',
    true,
    'Both are block scoped, unlike var, which is function scoped.',
  ),
  written(
    'Explain what the event loop does.',
    'Describe the call stack, the queue and when callbacks run.',
    'javascript',
    'async',
    5,
    'Full marks: a single call stack, tasks queued while it is busy, and callbacks running only once it empties.',
  ),
  // ── Programming foundations ──
  mcq(
    'What is the time complexity of a binary search?',
    'The list is already sorted.',
    'programming',
    'arrays',
    'medium',
    ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    1,
    'Halving the search space each step gives O(log n).',
  ),
  mcq(
    'Which data structure gives first-in, first-out order?',
    'The first thing added is the first thing removed.',
    'programming',
    'collections',
    'easy',
    ['Stack', 'Queue', 'Tree', 'Set'],
    1,
    'A queue is first in, first out; a stack is last in, first out.',
  ),
  trueFalse(
    'Recursion always uses less memory than a loop.',
    'Decide whether the statement holds in general.',
    'programming',
    'recursion',
    false,
    'Each recursive call keeps a stack frame, so it usually uses more.',
  ),
  // ── Aptitude ──
  mcq(
    'A price rises by 20% and then falls by 20%. What is the net change?',
    'Start from 100 and apply each change in turn.',
    'aptitude',
    'numbers',
    'medium',
    ['No change', 'A 4% fall', 'A 4% rise', 'A 2% fall'],
    1,
    '100 → 120 → 96, which is a 4% fall.',
  ),
  mcq(
    'If 5 workers build a wall in 12 days, how long do 10 take?',
    'Assume every worker works at the same rate.',
    'aptitude',
    'numbers',
    'easy',
    ['24 days', '12 days', '6 days', '3 days'],
    2,
    'Twice the workers, half the time: 6 days.',
  ),
  mcq(
    'What comes next: 2, 6, 12, 20, 30, ?',
    'Look at the gaps between the terms.',
    'aptitude',
    'reasoning',
    'medium',
    ['36', '40', '42', '46'],
    2,
    'The gaps are 4, 6, 8, 10, then 12, so the next term is 42.',
  ),
  trueFalse(
    'The average of 10 and 20 is 15.',
    'Decide whether the statement is true.',
    'aptitude',
    'numbers',
    true,
    '(10 + 20) ÷ 2 = 15.',
  ),
  // ── HTML and CSS ──
  mcq(
    'Which element marks the main content of a page?',
    'Choose the semantic element for the primary content.',
    'html-css',
    'dom',
    'easy',
    ['<div>', '<main>', '<section>', '<body>'],
    1,
    '<main> marks the dominant content of the document.',
  ),
  mcq(
    'What does flex-direction: column do?',
    'Choose what happens to the items.',
    'html-css',
    'dom',
    'easy',
    [
      'They sit side by side',
      'They stack from top to bottom',
      'They wrap onto new lines',
      'They are centred',
    ],
    1,
    'It makes the main axis vertical, so items stack.',
  ),
  trueFalse(
    'An id may be used on more than one element in a page.',
    'Decide whether the same id can appear twice.',
    'html-css',
    'dom',
    false,
    'An id must be unique within the document.',
  ),
  // ── Soft skills ──
  written(
    'Introduce yourself for an interview in under two minutes.',
    'Write what you would say. Cover who you are, what you have built, and what you want next.',
    'soft-skills',
    'reasoning',
    5,
    'Full marks: a clear opening, one concrete project with the candidate’s own part in it, and a forward-looking sentence. No marks for a list of technologies alone.',
  ),
  mcq(
    'What makes an email most likely to be read and acted on?',
    'Choose the single most effective habit.',
    'soft-skills',
    'reasoning',
    'easy',
    [
      'Writing at length so nothing is missed',
      'Saying what you need in the first sentence',
      'Copying everybody in',
      'Marking it urgent',
    ],
    1,
    'Leading with the ask respects the reader and gets an answer.',
  ),
];

const CODING: CodingPlan[] = [
  {
    title: 'Add two numbers',
    body: 'Read two whole numbers separated by whitespace from standard input and print their sum.\n\nInput: `2 3`\nOutput: `5`',
    subject: 'programming',
    topic: 'numbers',
    difficulty: 'easy',
    marks: 5,
    points: 10,
    starter: {
      javascript: "const input = require('fs').readFileSync(0, 'utf8');\n// print the sum\n",
      python: 'import sys\ndata = sys.stdin.read()\n# print the sum\n',
    },
    solution: {
      javascript:
        "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
      python: 'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n',
    },
    cases: [
      { input: '2 3', expected: '5', sample: true },
      { input: '10 -4', expected: '6', sample: true },
      { input: '0 0', expected: '0', sample: false },
      { input: '-7 -8', expected: '-15', sample: false },
      { input: '1000000 2000000', expected: '3000000', sample: false },
    ],
  },
  {
    title: 'Reverse a string',
    body: 'Read one line from standard input and print it backwards.\n\nInput: `hello`\nOutput: `olleh`',
    subject: 'programming',
    topic: 'strings',
    difficulty: 'easy',
    marks: 5,
    points: 10,
    starter: {
      javascript:
        "const s = require('fs').readFileSync(0, 'utf8').trim();\n// print it backwards\n",
      python: 'import sys\ns = sys.stdin.read().strip()\n# print it backwards\n',
    },
    solution: {
      javascript:
        "const s = require('fs').readFileSync(0, 'utf8').trim();\nconsole.log([...s].reverse().join(''));\n",
      python: 'import sys\ns = sys.stdin.read().strip()\nprint(s[::-1])\n',
    },
    cases: [
      { input: 'hello', expected: 'olleh', sample: true },
      { input: 'a', expected: 'a', sample: true },
      { input: 'racecar', expected: 'racecar', sample: false },
      { input: 'Demo Institute', expected: 'etutitsnI omeD', sample: false },
    ],
  },
  {
    title: 'Count the vowels',
    body: 'Read one line and print how many vowels it contains. Treat upper and lower case alike.\n\nInput: `Programming`\nOutput: `3`',
    subject: 'programming',
    topic: 'strings',
    difficulty: 'easy',
    marks: 5,
    points: 10,
    starter: {
      javascript:
        "const s = require('fs').readFileSync(0, 'utf8').trim();\n// count a, e, i, o, u\n",
      python: 'import sys\ns = sys.stdin.read().strip()\n# count a, e, i, o, u\n',
    },
    solution: {
      javascript:
        "const s = require('fs').readFileSync(0, 'utf8').trim().toLowerCase();\nconsole.log([...s].filter((c) => 'aeiou'.includes(c)).length);\n",
      python:
        "import sys\ns = sys.stdin.read().strip().lower()\nprint(sum(1 for c in s if c in 'aeiou'))\n",
    },
    cases: [
      { input: 'Programming', expected: '3', sample: true },
      { input: 'xyz', expected: '0', sample: true },
      { input: 'AEIOU', expected: '5', sample: false },
      { input: 'Demo Institute', expected: '6', sample: false },
    ],
  },
  {
    title: 'FizzBuzz up to n',
    body: 'Read a whole number n and print the numbers 1 to n on one line, separated by single spaces. Replace multiples of three with `Fizz`, multiples of five with `Buzz`, and multiples of both with `FizzBuzz`.\n\nInput: `15`\nOutput: `1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz`',
    subject: 'programming',
    topic: 'loops',
    difficulty: 'medium',
    marks: 10,
    points: 20,
    starter: {
      javascript:
        "const n = Number(require('fs').readFileSync(0, 'utf8').trim());\n// print the sequence on one line\n",
      python: 'import sys\nn = int(sys.stdin.read().strip())\n# print the sequence on one line\n',
    },
    solution: {
      javascript:
        "const n = Number(require('fs').readFileSync(0, 'utf8').trim());\nconst out = [];\nfor (let i = 1; i <= n; i += 1) {\n  out.push(i % 15 === 0 ? 'FizzBuzz' : i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : String(i));\n}\nconsole.log(out.join(' '));\n",
      python:
        "import sys\nn = int(sys.stdin.read().strip())\nout = []\nfor i in range(1, n + 1):\n    out.append('FizzBuzz' if i % 15 == 0 else 'Fizz' if i % 3 == 0 else 'Buzz' if i % 5 == 0 else str(i))\nprint(' '.join(out))\n",
    },
    cases: [
      {
        input: '15',
        expected: '1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz',
        sample: true,
      },
      { input: '5', expected: '1 2 Fizz 4 Buzz', sample: true },
      { input: '1', expected: '1', sample: false },
      { input: '3', expected: '1 2 Fizz', sample: false },
    ],
  },
  {
    title: 'Largest in a list',
    body: 'The first line holds a count n. The second line holds n whole numbers separated by spaces. Print the largest of them.\n\nInput:\n```\n5\n3 9 2 7 4\n```\nOutput: `9`',
    subject: 'programming',
    topic: 'arrays',
    difficulty: 'medium',
    marks: 10,
    points: 20,
    starter: {
      javascript:
        "const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\n');\n// print the largest number on the second line\n",
      python:
        'import sys\nlines = sys.stdin.read().strip().split("\\n")\n# print the largest number on the second line\n',
    },
    solution: {
      javascript:
        "const nums = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(Math.max(...nums.slice(1)));\n",
      python: 'import sys\nnums = list(map(int, sys.stdin.read().split()))\nprint(max(nums[1:]))\n',
    },
    cases: [
      { input: '5\n3 9 2 7 4', expected: '9', sample: true },
      { input: '3\n-5 -2 -9', expected: '-2', sample: true },
      { input: '1\n42', expected: '42', sample: false },
      { input: '6\n1 1 1 1 1 2', expected: '2', sample: false },
    ],
  },
  {
    title: 'Is it a palindrome?',
    body: 'Read one line and print `YES` if it reads the same backwards, ignoring case, spaces and punctuation, and `NO` otherwise.\n\nInput: `Never odd or even`\nOutput: `YES`',
    subject: 'programming',
    topic: 'strings',
    difficulty: 'hard',
    marks: 10,
    points: 30,
    starter: {
      javascript: "const s = require('fs').readFileSync(0, 'utf8').trim();\n// print YES or NO\n",
      python: 'import sys\ns = sys.stdin.read().strip()\n# print YES or NO\n',
    },
    solution: {
      javascript:
        "const s = require('fs').readFileSync(0, 'utf8').trim().toLowerCase().replace(/[^a-z0-9]/g, '');\nconsole.log(s === [...s].reverse().join('') ? 'YES' : 'NO');\n",
      python:
        "import sys, re\ns = re.sub(r'[^a-z0-9]', '', sys.stdin.read().strip().lower())\nprint('YES' if s == s[::-1] else 'NO')\n",
    },
    cases: [
      { input: 'Never odd or even', expected: 'YES', sample: true },
      { input: 'hello', expected: 'NO', sample: true },
      { input: 'A man, a plan, a canal: Panama', expected: 'YES', sample: false },
      { input: 'ab', expected: 'NO', sample: false },
    ],
  },
];

/** Enough variations to fill a bank without writing a hundred near-duplicates by hand. */
function variations(): ObjectivePlan[] {
  const out: ObjectivePlan[] = [];
  const subjects: { subject: string; topic: string; term: string }[] = [
    { subject: 'core-java', topic: 'collections', term: 'a List' },
    { subject: 'sql', topic: 'queries', term: 'an index' },
    { subject: 'javascript', topic: 'arrays', term: 'a callback' },
    { subject: 'programming', topic: 'loops', term: 'a loop invariant' },
    { subject: 'aptitude', topic: 'reasoning', term: 'a syllogism' },
  ];
  for (const { subject, topic, term } of subjects) {
    for (let n = 1; n <= 17; n += 1) {
      const answer = (n * 7) % 4;
      out.push(
        mcq(
          `Practice ${n}: what best describes ${term}?`,
          `Question ${n} of the ${subject.replace('-', ' ')} practice set. Choose the statement that best describes ${term}.`,
          subject,
          topic,
          n % 3 === 0 ? 'medium' : 'easy',
          [
            `${term} is a way of storing one value`,
            `${term} is a way of organising several values or steps`,
            `${term} is a kind of error`,
            `${term} only exists in older versions`,
          ],
          answer === 1 ? 1 : 1,
          `${term} organises several values or steps; the other statements describe something else.`,
        ),
      );
    }
  }
  return out;
}

export interface AssessmentSeedResult {
  questions: number;
  coding: number;
  assignments: number;
  publications: number;
  tests: number;
  schedules: number;
  attempts: number;
  submissions: number;
}

export async function seedAssessment(
  prisma: PrismaClient,
  organization: { id: string },
  lookup: {
    batchIdByCode: Map<string, string>;
    adminUserId: string | null;
    trainerUserIdByEmail: Map<string, string>;
  },
): Promise<AssessmentSeedResult> {
  const result: AssessmentSeedResult = {
    questions: 0,
    coding: 0,
    assignments: 0,
    publications: 0,
    tests: 0,
    schedules: 0,
    attempts: 0,
    submissions: 0,
  };

  const slugOf = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);

  // ───────────────── objective and written questions ─────────────────
  const questionIdBySlug = new Map<string, string>();
  const plans = [...OBJECTIVE, ...variations()];
  for (const [index, plan] of plans.entries()) {
    const slug = `${slugOf(plan.title)}-${index + 1}`;
    const existing = await prisma.question.findUnique({ where: { slug } });
    if (existing) {
      questionIdBySlug.set(slug, existing.id);
      result.questions += 1;
      continue;
    }
    const question = await prisma.question.create({
      data: {
        organizationId: organization.id,
        slug,
        title: plan.title,
        body: plan.body,
        type: plan.type,
        subject: plan.subject,
        topic: plan.topic,
        difficulty: plan.difficulty,
        marks: plan.marks,
        explanation: plan.explanation,
        rubric: plan.rubric ?? '',
        status: 'published',
        authorId: lookup.adminUserId,
        options: {
          create: (plan.options ?? []).map(([body, isCorrect], position) => ({
            body,
            isCorrect,
            position,
          })),
        },
      },
    });
    questionIdBySlug.set(slug, question.id);
    result.questions += 1;
  }

  // ───────────────── coding problems ─────────────────
  const codingIdByTitle = new Map<string, string>();
  for (const plan of CODING) {
    const slug = slugOf(plan.title);
    const existing = await prisma.question.findUnique({ where: { slug } });
    if (existing) {
      codingIdByTitle.set(plan.title, existing.id);
      result.coding += 1;
      continue;
    }
    const question = await prisma.question.create({
      data: {
        organizationId: organization.id,
        slug,
        title: plan.title,
        body: plan.body,
        type: 'coding',
        subject: plan.subject,
        topic: plan.topic,
        difficulty: plan.difficulty,
        marks: plan.marks,
        explanation: '',
        status: 'published',
        inPractice: true,
        practicePoints: plan.points,
        authorId: lookup.adminUserId,
        // Said plainly: these outputs were checked by hand, not produced by a driver.
        validation: {
          ok: true,
          driver: 'seed',
          trust: 'untrusted',
          languages: [
            {
              language: 'javascript',
              ok: true,
              passed: plan.cases.length,
              total: plan.cases.length,
              message: 'Reference solution checked by hand when the fixtures were written',
            },
            {
              language: 'python',
              ok: true,
              passed: plan.cases.length,
              total: plan.cases.length,
              message: 'Reference solution checked by hand when the fixtures were written',
            },
          ],
          validatedAt: new Date().toISOString(),
        },
        coding: {
          create: {
            languages: ['javascript', 'python'],
            starterCode: plan.starter,
            referenceSolution: plan.solution,
            timeLimitMs: 5000,
            memoryLimitMb: 128,
            testCases: {
              create: plan.cases.map((testCase, position) => ({
                input: testCase.input,
                expectedOutput: testCase.expected,
                isSample: testCase.sample,
                weight: 1,
                position,
              })),
            },
          },
        },
      },
    });
    codingIdByTitle.set(plan.title, question.id);
    result.coding += 1;
  }

  // ───────────────── assignments ─────────────────
  const questionsBySubject = async (subject: string, take: number, type?: QuestionType) =>
    prisma.question.findMany({
      where: {
        organizationId: organization.id,
        subject,
        status: 'published',
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take,
      select: { id: true, marks: true },
    });

  interface ModulePlan {
    title: string;
    gated: boolean;
    subject: string;
    count: number;
    coding?: number;
  }
  interface AssignmentPlan {
    title: string;
    subject: string;
    difficulty: string;
    batchCode: string;
    dueOffsetDays: number;
    modules: ModulePlan[];
  }
  const assignmentPlans: AssignmentPlan[] = [
    {
      title: 'Core Java foundations',
      subject: 'core-java',
      difficulty: 'beginner',
      batchCode: 'JFS-2026-B1',
      dueOffsetDays: 7,
      modules: [
        { title: 'Language basics', gated: false, subject: 'core-java', count: 4 },
        { title: 'Collections and exceptions', gated: true, subject: 'core-java', count: 4 },
      ],
    },
    {
      title: 'SQL practice set',
      subject: 'sql',
      difficulty: 'beginner',
      batchCode: 'JFS-2026-B1',
      dueOffsetDays: 14,
      modules: [
        { title: 'Queries', gated: false, subject: 'sql', count: 3 },
        { title: 'Joins and keys', gated: true, subject: 'sql', count: 3 },
      ],
    },
    {
      title: 'JavaScript fundamentals',
      subject: 'javascript',
      difficulty: 'intermediate',
      batchCode: 'JFS-2026-B2',
      dueOffsetDays: 21,
      modules: [
        { title: 'Values and functions', gated: false, subject: 'javascript', count: 4 },
        { title: 'Asynchronous code', gated: true, subject: 'javascript', count: 2 },
      ],
    },
    {
      title: 'Coding warm-up',
      subject: 'programming',
      difficulty: 'beginner',
      batchCode: 'JFS-2026-B1',
      dueOffsetDays: 10,
      modules: [
        { title: 'First problems', gated: false, subject: 'programming', count: 0, coding: 3 },
      ],
    },
  ];

  for (const plan of assignmentPlans) {
    const existing = await prisma.assignment.findFirst({
      where: { organizationId: organization.id, title: plan.title },
    });
    let assignmentId = existing?.id;
    if (!assignmentId) {
      const created = await prisma.assignment.create({
        data: {
          organizationId: organization.id,
          title: plan.title,
          description: `Seeded practice set for ${plan.subject.replace('-', ' ')}.`,
          subject: plan.subject,
          difficulty: plan.difficulty,
          status: 'published',
          settings: {
            attemptsPerQuestion: 3,
            explanationPolicy: 'after_solve',
            duePolicy: 'allow_late',
          },
          createdById: lookup.adminUserId,
        },
      });
      assignmentId = created.id;

      for (const [moduleIndex, modulePlan] of plan.modules.entries()) {
        const module = await prisma.assignmentModule.create({
          data: {
            assignmentId,
            title: modulePlan.title,
            position: moduleIndex,
            unlockRule: modulePlan.gated
              ? { type: 'after_previous', minPercent: 60 }
              : { type: 'always' },
          },
        });
        const picked = modulePlan.coding
          ? [...codingIdByTitle.values()]
              .slice(0, modulePlan.coding)
              .map((id) => ({ id, marks: 5 }))
          : (await questionsBySubject(modulePlan.subject, modulePlan.count)).map((q) => ({
              id: q.id,
              marks: q.marks,
            }));
        for (const [index, question] of picked.entries()) {
          await prisma.assignmentQuestion.create({
            data: {
              moduleId: module.id,
              questionId: question.id,
              marks: question.marks,
              position: index,
            },
          });
        }
      }
    }
    result.assignments += 1;

    const batchId = lookup.batchIdByCode.get(plan.batchCode);
    if (!batchId) continue;
    const live = await prisma.assignmentPublication.findFirst({
      where: { assignmentId, batchId, withdrawnAt: null },
    });
    if (!live) {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + plan.dueOffsetDays);
      await prisma.assignmentPublication.create({
        data: {
          assignmentId,
          batchId,
          dueAt,
          note: 'Seeded demo publication',
          publishedById: lookup.adminUserId,
        },
      });
    }
    result.publications += 1;
  }

  // ───────────────── tests ─────────────────
  const batchB1 = lookup.batchIdByCode.get('JFS-2026-B1');
  interface SectionPlan {
    title: string;
    subject: string;
    count: number;
    type?: QuestionType;
  }
  interface TestPlan {
    title: string;
    kind: 'weekly' | 'practice' | 'mock' | 'final';
    subject: string;
    opensOffsetHours: number;
    closesOffsetHours: number;
    release: boolean;
    sections: SectionPlan[];
  }
  const testPlans: TestPlan[] = [
    {
      title: 'Core Java weekly test 3',
      kind: 'weekly',
      subject: 'core-java',
      opensOffsetHours: -24 * 7,
      closesOffsetHours: -24 * 7 + 3,
      release: true,
      sections: [
        { title: 'Objective', subject: 'core-java', count: 5 },
        { title: 'Written', subject: 'core-java', count: 1, type: 'descriptive' },
      ],
    },
    {
      title: 'SQL check, open today',
      kind: 'practice',
      subject: 'sql',
      opensOffsetHours: -2,
      closesOffsetHours: 10,
      release: false,
      sections: [{ title: 'Queries and joins', subject: 'sql', count: 5 }],
    },
    {
      title: 'Java Full-Stack mock test',
      kind: 'mock',
      subject: 'programming',
      opensOffsetHours: 24 * 5,
      closesOffsetHours: 24 * 5 + 4,
      release: false,
      sections: [
        { title: 'Core Java', subject: 'core-java', count: 4 },
        { title: 'SQL', subject: 'sql', count: 3 },
        { title: 'JavaScript', subject: 'javascript', count: 3 },
      ],
    },
  ];

  for (const plan of testPlans) {
    const existing = await prisma.test.findFirst({
      where: { organizationId: organization.id, title: plan.title },
    });
    let testId = existing?.id;
    if (!testId) {
      const created = await prisma.test.create({
        data: {
          organizationId: organization.id,
          title: plan.title,
          description: `Seeded ${plan.kind} test.`,
          kind: plan.kind,
          subject: plan.subject,
          instructions:
            'Answer every question. The timer is the server’s: it keeps running if you close the tab, and the paper is submitted for you when it reaches zero.',
          status: 'published',
          settings: {
            durationMinutes: 45,
            maxAttempts: 1,
            shuffleQuestions: false,
            shuffleOptions: false,
            resultPolicy: 'on_release',
            reviewPolicy: 'full',
            trackTabSwitches: true,
            requireFullScreen: false,
            showRank: true,
          },
          createdById: lookup.adminUserId,
        },
      });
      testId = created.id;

      for (const [sectionIndex, sectionPlan] of plan.sections.entries()) {
        const section = await prisma.testSection.create({
          data: {
            testId,
            title: sectionPlan.title,
            instructions: '',
            position: sectionIndex,
          },
        });
        const picked = await questionsBySubject(
          sectionPlan.subject,
          sectionPlan.count,
          sectionPlan.type,
        );
        for (const [index, question] of picked.entries()) {
          await prisma.testQuestion.create({
            data: {
              sectionId: section.id,
              questionId: question.id,
              marks: question.marks,
              negativeMarks: 0,
              position: index,
            },
          });
        }
      }
    }
    result.tests += 1;

    if (!batchB1) continue;
    let schedule = await prisma.testSchedule.findFirst({ where: { testId, batchId: batchB1 } });
    if (!schedule) {
      const opensAt = new Date(Date.now() + plan.opensOffsetHours * 3_600_000);
      const closesAt = new Date(Date.now() + plan.closesOffsetHours * 3_600_000);
      schedule = await prisma.testSchedule.create({
        data: {
          testId,
          batchId: batchB1,
          opensAt,
          closesAt,
          createdById: lookup.adminUserId,
        },
      });
    }
    result.schedules += 1;

    // The test that has already happened gets sittings, so results and review have something real.
    if (plan.release) {
      const attemptsMade = await prisma.testAttempt.count({ where: { scheduleId: schedule.id } });
      if (attemptsMade === 0) {
        const placements = await prisma.testQuestion.findMany({
          where: { section: { testId } },
          orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
          include: { question: { include: { options: true } } },
        });
        const totalMarks = placements.reduce((n, p) => n + p.marks, 0);
        const members = await prisma.batchMember.findMany({
          where: { batchId: batchB1, isActive: true },
          take: 12,
          select: { studentId: true },
        });

        for (const [index, member] of members.entries()) {
          // A spread of results rather than everybody scoring the same.
          const share = 0.45 + ((index * 7) % 6) * 0.1;
          const submittedAt = new Date(schedule.opensAt.getTime() + 40 * 60_000);
          const attempt = await prisma.testAttempt.create({
            data: {
              testId,
              scheduleId: schedule.id,
              studentId: member.studentId,
              attempt: 1,
              status: 'graded',
              startedAt: schedule.opensAt,
              expiresAt: new Date(schedule.opensAt.getTime() + 45 * 60_000),
              submittedAt,
              totalMarks,
              tabSwitches: index % 5 === 0 ? 2 : 0,
              questionOrder: placements.map((p) => p.id),
            },
          });
          let score = 0;
          for (const [placementIndex, placement] of placements.entries()) {
            const correct = placement.question.options.filter((o) => o.isCorrect);
            const gotItRight = placementIndex / placements.length < share;
            const marks = gotItRight ? placement.marks : 0;
            score += marks;
            await prisma.testAnswer.create({
              data: {
                attemptId: attempt.id,
                testQuestionId: placement.id,
                optionIds:
                  placement.question.type === 'descriptive'
                    ? []
                    : gotItRight
                      ? correct.map((o) => o.id)
                      : placement.question.options
                          .filter((o) => !o.isCorrect)
                          .slice(0, 1)
                          .map((o) => o.id),
                text:
                  placement.question.type === 'descriptive'
                    ? 'A primary key identifies the row and cannot be null; a unique constraint only forbids duplicates and may allow one null.'
                    : '',
                status: gotItRight ? 'correct' : 'incorrect',
                marks,
                graderComment:
                  placement.question.type === 'descriptive' ? 'Clear and correct.' : '',
                gradedAt: submittedAt,
                timeSpentSeconds: 120 + placementIndex * 30,
              },
            });
          }
          await prisma.testAttempt.update({ where: { id: attempt.id }, data: { score } });
          result.attempts += 1;
        }
      }
      if (!schedule.releasedAt) {
        await prisma.testSchedule.update({
          where: { id: schedule.id },
          data: { releasedAt: new Date(), releasedById: lookup.adminUserId },
        });
      }
    }
  }

  // ───────────────── a few assignment submissions ─────────────────
  const firstAssignment = await prisma.assignment.findFirst({
    where: { organizationId: organization.id, title: 'Core Java foundations' },
    include: {
      modules: {
        include: { questions: { include: { question: { include: { options: true } } } } },
      },
    },
  });
  if (firstAssignment) {
    const learners = await prisma.studentProfile.findMany({
      where: {
        user: {
          email: {
            in: ['student01@demo.local', 'student02@demo.local', 'student03@demo.local'],
          },
        },
      },
      select: { id: true },
    });
    const placements = firstAssignment.modules[0]?.questions ?? [];
    for (const [learnerIndex, learner] of learners.entries()) {
      for (const [index, placement] of placements.entries()) {
        if (index > 2 - learnerIndex) continue;
        const existingSubmission = await prisma.submission.findFirst({
          where: { assignmentQuestionId: placement.id, studentId: learner.id },
        });
        if (existingSubmission) continue;
        const correct = placement.question.options.filter((o) => o.isCorrect);
        if (correct.length === 0) continue;
        await prisma.submission.create({
          data: {
            assignmentId: firstAssignment.id,
            assignmentQuestionId: placement.id,
            questionId: placement.questionId,
            studentId: learner.id,
            attempt: 1,
            status: 'correct',
            marks: placement.marks,
            maxMarks: placement.marks,
            optionIds: correct.map((o) => o.id),
            timeSpentSeconds: 60 + index * 20,
          },
        });
        result.submissions += 1;
      }
    }
  }

  return result;
}
