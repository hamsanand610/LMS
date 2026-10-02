/**
 * SI Academy's question bank and assignments as data. The seed reads this; the verification suite
 * (`pnpm --filter @lms/api verify:questions`) runs every coding and SQL answer in it in the sandbox.
 */
import {
  WEB_CHECK_PASS,
  encodeWebCheck,
  encodeWebFiles,
  type AssignmentKind,
  type AssignmentSettings,
  type CompareMode,
  type ExecutionLanguage,
} from '@lms/shared';
import { BACKEND } from './backend.js';
import { CAREER } from './career.js';
import { DSA } from './dsa.js';
import { JAVA } from './java.js';
import { LABS } from './labs.js';
import { PHP } from './php.js';
import { PROGRAMMING } from './programming.js';
import { PYTHON } from './python.js';
import { SQL } from './sql.js';
import { TOOLS } from './tools.js';
import type { BankQuestion, Case, RunnableQuestion } from './types.js';
import { WEB } from './web.js';

export type {
  BankQuestion,
  CodingQuestion,
  DebuggingQuestion,
  RunnableQuestion,
  SqlQuestion,
  WebLabQuestion,
} from './types.js';

/** Whether a question's answers run in the sandbox. */
export function isRunnable(question: BankQuestion): question is RunnableQuestion {
  return (
    question.type === 'coding' ||
    question.type === 'sql' ||
    question.type === 'debugging' ||
    question.type === 'web'
  );
}

/** A runnable question's cases; a web lab's are its checks, each expected to print `pass`. */
export function casesOf(question: RunnableQuestion): Case[] {
  if (question.type !== 'web') return question.cases;
  return question.checks.map((c) => ({
    input: encodeWebCheck(c.check),
    expected: WEB_CHECK_PASS,
    ...(c.sample !== undefined ? { sample: c.sample } : {}),
    ...(c.label !== undefined ? { label: c.label } : {}),
    ...(c.weight !== undefined ? { weight: c.weight } : {}),
  }));
}

/** The limits and comparison a runnable question has, the same for the seed and the check. */
export function runSettings(question: RunnableQuestion): {
  languages: ExecutionLanguage[];
  timeLimitMs: number;
  memoryLimitMb: number;
  compareMode: CompareMode;
  setupSql: string;
  sqlCheck: string;
  starterCode: Record<string, string>;
  referenceSolution: Record<string, string>;
} {
  if (question.type === 'sql') {
    return {
      languages: ['sql'],
      timeLimitMs: 3000,
      memoryLimitMb: 128,
      compareMode: question.compareMode,
      setupSql: question.setupSql,
      sqlCheck: question.sqlCheck ?? '',
      starterCode: question.starter ? { sql: question.starter } : {},
      referenceSolution: { sql: question.solution },
    };
  }
  if (question.type === 'web') {
    return {
      languages: ['web'],
      timeLimitMs: question.timeLimitMs ?? 2000,
      memoryLimitMb: 256,
      compareMode: 'trim',
      setupSql: '',
      sqlCheck: '',
      starterCode: { web: encodeWebFiles(question.starter) },
      referenceSolution: { web: encodeWebFiles(question.solution) },
    };
  }
  return {
    languages: question.languages,
    timeLimitMs: question.timeLimitMs ?? 5000,
    memoryLimitMb: 128,
    compareMode: question.compareMode ?? 'trim',
    setupSql: '',
    sqlCheck: '',
    starterCode: question.starter as Record<string, string>,
    referenceSolution: question.solution as Record<string, string>,
  };
}

export const BANK: BankQuestion[] = [
  ...PROGRAMMING,
  ...JAVA,
  ...DSA,
  ...SQL,
  ...PYTHON,
  ...WEB,
  ...BACKEND,
  ...TOOLS,
  ...CAREER,
  ...PHP,
  ...LABS,
];

/** Technologies (the `subject` taxonomy) the bank uses beyond the defaults every deployment has. */
export const TECHNOLOGY_TERMS: { key: string; label: string }[] = [
  { key: 'dsa', label: 'Data structures and algorithms' },
  { key: 'python', label: 'Python' },
  { key: 'html', label: 'HTML' },
  { key: 'css', label: 'CSS' },
  { key: 'spring-boot', label: 'Spring Boot' },
  { key: 'hibernate', label: 'Hibernate and JPA' },
  { key: 'rest-apis', label: 'REST APIs' },
  { key: 'git', label: 'Git' },
  { key: 'testing', label: 'Testing' },
  { key: 'deployment', label: 'Deployment' },
  { key: 'ai-assisted-development', label: 'AI-assisted development' },
  { key: 'career', label: 'Career and interviews' },
  { key: 'php', label: 'PHP' },
];

/** Topics the bank uses beyond the defaults. */
export const TOPIC_TERMS: { key: string; label: string }[] = [
  { key: 'java-basics', label: 'Java basics' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'inheritance', label: 'Inheritance' },
  { key: 'interfaces', label: 'Interfaces' },
  { key: 'generics', label: 'Generics' },
  { key: 'streams', label: 'Streams and lambdas' },
  { key: 'multithreading', label: 'Multithreading' },
  { key: 'hashing', label: 'Hashing and maps' },
  { key: 'stacks-queues', label: 'Stacks and queues' },
  { key: 'two-pointers', label: 'Two pointers and windows' },
  { key: 'searching', label: 'Searching' },
  { key: 'sorting', label: 'Sorting' },
  { key: 'dynamic-programming', label: 'Dynamic programming' },
  { key: 'graphs', label: 'Graphs' },
  { key: 'complexity', label: 'Complexity' },
  { key: 'python-basics', label: 'Python basics' },
  { key: 'lists', label: 'Lists and tuples' },
  { key: 'dictionaries', label: 'Dictionaries' },
  { key: 'tooling', label: 'Tooling' },
  { key: 'javascript-basics', label: 'JavaScript basics' },
  { key: 'html-semantics', label: 'Semantic HTML' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'forms', label: 'Forms' },
  { key: 'css-basics', label: 'CSS basics' },
  { key: 'flexbox', label: 'Flexbox' },
  { key: 'grid', label: 'CSS Grid' },
  { key: 'responsive', label: 'Responsive design' },
  { key: 'aggregation', label: 'Aggregation' },
  { key: 'subqueries', label: 'Subqueries' },
  { key: 'dml', label: 'Changing data' },
  { key: 'constraints', label: 'Keys and constraints' },
  { key: 'indexes', label: 'Indexes' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'spring-core', label: 'Spring core' },
  { key: 'spring-boot', label: 'Spring Boot' },
  { key: 'jpa', label: 'JPA and Hibernate' },
  { key: 'rest', label: 'REST design' },
  { key: 'version-control', label: 'Version control' },
  { key: 'branching', label: 'Branching and review' },
  { key: 'unit-testing', label: 'Unit testing' },
  { key: 'integration-testing', label: 'Integration testing' },
  { key: 'test-design', label: 'Test design' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'containers', label: 'Containers' },
  { key: 'ci-cd', label: 'CI and CD' },
  { key: 'hosting', label: 'Hosting' },
  { key: 'ai-tools', label: 'Working with AI tools' },
  { key: 'prompting', label: 'Prompting' },
  { key: 'code-review', label: 'Code review' },
  { key: 'interview', label: 'Interviews' },
  { key: 'communication', label: 'Communication' },
  { key: 'resume', label: 'Resume' },
  { key: 'php-basics', label: 'PHP basics' },
  { key: 'security', label: 'Security' },
];

export interface AudiencePlan {
  /** A batch code, or named learners by their seed account (student04 …). */
  batch?: string;
  students?: string[];
  /** Days from today; negative is in the past. */
  opensInDays: number;
  dueInDays: number | null;
  closesInDays?: number | null;
  note?: string;
}

export interface AssignmentModulePlan {
  title: string;
  description: string;
  topic: string;
  /** Opens only after the previous module reaches this percentage. */
  gatedAt?: number;
  /** Due this many days after the assignment opens. */
  dueAfterDays?: number;
  /** The course module (by title) this one practises. */
  courseModule?: string;
  questions: string[];
}

export interface AssignmentPlan {
  title: string;
  description: string;
  instructions: string;
  kind: AssignmentKind;
  technology: string;
  /** A key of the `course-level` taxonomy. */
  level: 'beginner' | 'intermediate' | 'advanced';
  /** A course slug. */
  course: string | null;
  estimatedMinutes: number;
  passPercent: number;
  settings: AssignmentSettings;
  /** The seed account that wrote it. */
  author: string;
  modules: AssignmentModulePlan[];
  resources: { title: string; url: string }[];
  /** Empty for a draft. */
  audiences: AudiencePlan[];
}

const DEFAULTS: AssignmentSettings = {
  attemptsPerQuestion: 3,
  explanationPolicy: 'after_solve',
  duePolicy: 'allow_late',
  gradingMethod: 'best',
};

const CODING_RULES =
  'Each coding question runs against the visible examples when you press Run; Submit checks it against hidden cases as well. You have three submissions per question and your best one counts. Read the input exactly as the question describes it and print nothing else.';

export const ASSIGNMENTS: AssignmentPlan[] = [
  {
    title: 'Java Foundations: First Programs',
    description:
      'Reading input, making decisions and working with text — your first Java programs, checked automatically.',
    instructions: `${CODING_RULES}\n\nWrite every answer in Java unless the question offers another language you prefer. Start the second module once you have solved at least 60% of the first.`,
    kind: 'coding',
    technology: 'core-java',
    level: 'beginner',
    course: 'core-java',
    estimatedMinutes: 120,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer1',
    modules: [
      {
        title: 'Input, output and decisions',
        description: 'Read numbers, decide, and print exactly what is asked.',
        topic: 'java-basics',
        courseModule: 'The language',
        questions: [
          'java-jdk-jre-jvm',
          'add-two-numbers',
          'java-grade-from-marks',
          'java-multiplication-table',
        ],
      },
      {
        title: 'Working with text',
        description: 'Strings are objects: compare them properly and build new ones.',
        topic: 'strings',
        gatedAt: 60,
        courseModule: 'Types and inheritance',
        questions: [
          'java-string-equals',
          'java-string-immutable',
          'reverse-a-string',
          'count-the-vowels',
        ],
      },
    ],
    resources: [
      {
        title: 'The Java Tutorials: Language Basics (Oracle)',
        url: 'https://docs.oracle.com/javase/tutorial/java/nutsandbolts/index.html',
      },
      {
        title: 'Scanner (Java SE 21 API)',
        url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Scanner.html',
      },
    ],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: -16, dueInDays: -4 }],
  },
  {
    title: 'Core Java: Objects and Collections',
    description:
      'Classes that protect their data, the collections you will use every day, and exceptions done properly.',
    instructions: `${CODING_RULES}\n\nThe written question is marked by your trainer against a mark scheme; aim for a clear explanation with a short code sketch rather than length.`,
    kind: 'mixed',
    technology: 'core-java',
    level: 'intermediate',
    course: 'core-java',
    estimatedMinutes: 240,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer1',
    modules: [
      {
        title: 'Objects and classes',
        description: 'Encapsulation, overriding and records.',
        topic: 'oop',
        courseModule: 'Types and inheritance',
        questions: [
          'java-overloading-vs-overriding',
          'java-record',
          'java-bank-ledger',
          'java-explain-polymorphism',
        ],
      },
      {
        title: 'Collections',
        description:
          'Choosing between List, Set and Map, and making your own classes work as keys.',
        topic: 'collections',
        gatedAt: 50,
        courseModule: 'Collections',
        questions: [
          'java-arraylist-vs-linkedlist',
          'java-hashmap-order',
          'java-equals-hashcode',
          'java-character-frequency',
          'remove-the-duplicates',
        ],
      },
      {
        title: 'Exceptions and streams',
        description: 'Failing clearly, cleaning up reliably, and processing data with streams.',
        topic: 'exceptions',
        dueAfterDays: 12,
        courseModule: 'Getting things done',
        questions: [
          'java-checked-exceptions',
          'java-finally',
          'java-stream-output',
          'java-optional',
          'java-interface-default',
        ],
      },
    ],
    resources: [
      {
        title: 'Collections Framework overview (Java SE 21)',
        url: 'https://docs.oracle.com/en/java/javase/21/core/java-collections-framework.html',
      },
    ],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: -7, dueInDays: 5 }],
  },
  {
    title: 'SQL Practice: Queries and Joins',
    description:
      'Real queries against a small institute database: filtering, grouping, joining and changing data.',
    instructions:
      'Every SQL question runs against the same small database of students, courses and enrolments, shown under each question. Run tries your query on the example; Submit checks it against hidden variations of the data too. Column names do not have to match; the values and, where the question asks for an order, the order do.',
    kind: 'sql',
    technology: 'sql',
    level: 'beginner',
    course: 'sql-and-databases',
    estimatedMinutes: 150,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer3',
    modules: [
      {
        title: 'Selecting and filtering',
        description: 'SELECT, WHERE, ORDER BY — and NULL.',
        topic: 'queries',
        courseModule: 'Queries',
        questions: [
          'sql-primary-key',
          'sql-null-comparison',
          'sql-students-in-chennai',
          'sql-courses-above-fee',
        ],
      },
      {
        title: 'Grouping',
        description: 'GROUP BY, aggregates and HAVING.',
        topic: 'aggregation',
        courseModule: 'Queries',
        questions: ['sql-where-vs-having', 'sql-students-per-city', 'sql-average-score-per-course'],
      },
      {
        title: 'Joins, subqueries and updates',
        description: 'Combining tables, finding what is missing, and changing data safely.',
        topic: 'joins',
        gatedAt: 50,
        courseModule: 'Relationships',
        questions: [
          'sql-left-join',
          'sql-not-enrolled',
          'sql-top-scorer-per-course',
          'sql-raise-fee',
          'sql-transaction',
        ],
      },
    ],
    resources: [
      { title: 'SQLite: the SELECT statement', url: 'https://www.sqlite.org/lang_select.html' },
    ],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: -3, dueInDays: 7 }],
  },
  {
    title: 'JavaScript Essentials',
    description:
      'Scope, equality, closures and the event loop, with three small programs to write.',
    instructions: `${CODING_RULES}\n\nThese problems are answered in JavaScript (Node.js). Use \`require('fs').readFileSync(0, 'utf8')\` to read the input.`,
    kind: 'coding',
    technology: 'javascript',
    level: 'intermediate',
    course: 'web-development',
    estimatedMinutes: 150,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer5',
    modules: [
      {
        title: 'The language',
        description: 'Values, scope and equality.',
        topic: 'javascript-basics',
        courseModule: 'JavaScript',
        questions: [
          'js-let-block-scope',
          'js-strict-equality',
          'js-const-object',
          'js-map-vs-foreach',
          'js-title-case',
        ],
      },
      {
        title: 'Functions and asynchronous code',
        description: 'Closures, promises and fetching data.',
        topic: 'async',
        courseModule: 'JavaScript',
        questions: [
          'js-closure-counter',
          'js-event-loop-order',
          'js-fetch-await',
          'js-chunk-array',
          'js-json-number-sum',
        ],
      },
    ],
    resources: [
      {
        title: 'MDN: JavaScript Guide',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
      },
    ],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: -24, dueInDays: -12, closesInDays: -3 }],
  },
  {
    title: 'Git and Collaboration',
    description: 'Commits, branches, merges and your first pull request.',
    instructions:
      'Answer the questions, then do the practical: open a pull request on the class practice repository and paste its address. Your trainer reviews the pull request itself, including how you answered review comments.',
    kind: 'practical',
    technology: 'git',
    level: 'beginner',
    course: null,
    estimatedMinutes: 90,
    passPercent: 60,
    settings: DEFAULTS,
    author: 'trainer1',
    modules: [
      {
        title: 'Everyday Git',
        description: 'Staging, committing, branching, merging and undoing.',
        topic: 'version-control',
        questions: [
          'git-staging-area',
          'git-branch-purpose',
          'git-commit-message',
          'git-merge-conflict',
          'git-revert-vs-reset',
          'git-practical-pull-request',
        ],
      },
    ],
    resources: [{ title: 'Pro Git (free book)', url: 'https://git-scm.com/book/en/v2' }],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: -10, dueInDays: -1 }],
  },
  {
    title: 'Spring Boot: Library REST API',
    description: 'Spring fundamentals, persistence with JPA, REST design — then build a real API.',
    instructions:
      'Work through the three modules in order; the project in the last module opens once you have 60% of the persistence module. The project is reviewed by your trainer: give the repository address, tick the checklist honestly, and make sure the README explains how to run it.',
    kind: 'project',
    technology: 'spring-boot',
    level: 'advanced',
    course: 'advanced-java',
    estimatedMinutes: 900,
    passPercent: 50,
    settings: { ...DEFAULTS, attemptsPerQuestion: 2 },
    author: 'trainer2',
    modules: [
      {
        title: 'Spring essentials',
        description: 'Beans, injection, starters and configuration.',
        topic: 'spring-core',
        courseModule: 'Structure',
        questions: [
          'spring-dependency-injection',
          'spring-constructor-injection',
          'spring-boot-starter',
          'spring-bean-scope',
          'spring-profiles',
        ],
      },
      {
        title: 'Persistence',
        description: 'Entities, repositories, lazy loading and transactions.',
        topic: 'jpa',
        courseModule: 'Persistence',
        questions: [
          'jpa-entity-id',
          'jpa-repository-method',
          'jpa-lazy-loading',
          'jpa-n-plus-one',
          'spring-transactional',
        ],
      },
      {
        title: 'REST design and the project',
        description: 'Designing resources and status codes, then the library API.',
        topic: 'rest',
        gatedAt: 60,
        courseModule: 'The web tier',
        questions: [
          'rest-resource-naming',
          'rest-status-created',
          'rest-400-vs-422',
          'rest-idempotent-methods',
          'rest-design-written',
          'spring-boot-project-library-api',
        ],
      },
    ],
    resources: [
      {
        title: 'Spring Boot reference documentation',
        url: 'https://docs.spring.io/spring-boot/index.html',
      },
      {
        title: 'Spring Data JPA reference',
        url: 'https://docs.spring.io/spring-data/jpa/reference/',
      },
    ],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: -2, dueInDays: 21 }],
  },
  {
    title: 'DSA Interview Drills',
    description:
      'Searching, sorting, hashing and dynamic programming — the patterns technical rounds are built on.',
    instructions: `${CODING_RULES}\n\nState the time and space cost of your approach to yourself before you submit: interviewers will ask.`,
    kind: 'coding',
    technology: 'dsa',
    level: 'advanced',
    course: null,
    estimatedMinutes: 300,
    passPercent: 60,
    settings: DEFAULTS,
    author: 'trainer1',
    modules: [
      {
        title: 'Searching and sorting',
        description: 'Binary search and merging, and what they cost.',
        topic: 'searching',
        questions: [
          'dsa-binary-search-cost',
          'dsa-binary-search-first',
          'dsa-kth-smallest',
          'dsa-merge-sorted',
        ],
      },
      {
        title: 'Patterns interviewers love',
        description: 'Maps, sliding windows and dynamic programming.',
        topic: 'hashing',
        questions: [
          'dsa-nested-loop-cost',
          'dsa-two-sum',
          'java-longest-unique-substring',
          'dsa-max-subarray',
          'dsa-climbing-stairs',
        ],
      },
    ],
    resources: [],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: 2, dueInDays: 16 }],
  },
  {
    title: 'Testing, Deployment and AI-Assisted Development',
    description:
      'Testing the right things, shipping safely, and using AI assistants without handing over your judgement.',
    instructions:
      'A mix of quick questions, two written answers marked by your trainer, and a short practical: publishing your portfolio.',
    kind: 'mixed',
    technology: 'testing',
    level: 'intermediate',
    course: null,
    estimatedMinutes: 180,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer2',
    modules: [
      {
        title: 'Testing',
        description: 'Unit and integration tests, boundaries and mocks.',
        topic: 'unit-testing',
        questions: [
          'testing-unit-vs-integration',
          'testing-assert',
          'testing-mock-purpose',
          'testing-login-cases',
        ],
      },
      {
        title: 'Shipping',
        description: 'Configuration, containers, CI and health checks.',
        topic: 'ci-cd',
        questions: [
          'deploy-env-vars',
          'deploy-docker-image',
          'deploy-ci-pipeline',
          'deploy-health-check',
          'deploy-practical-portfolio',
        ],
      },
      {
        title: 'Working with AI assistants',
        description: 'Verifying generated code and keeping secrets out of prompts.',
        topic: 'ai-tools',
        questions: [
          'ai-verify-generated-code',
          'ai-secrets-in-prompts',
          'ai-good-prompt',
          'ai-review-written',
        ],
      },
    ],
    resources: [],
    audiences: [{ batch: 'JFS-2026-B1', opensInDays: 5, dueInDays: 19 }],
  },
  {
    title: 'Placement Readiness',
    description:
      'Aptitude warm-ups and the interview itself: introducing yourself, talking about a project, and your resume.',
    instructions:
      'The aptitude questions are marked at once. The written answers and your resume are reviewed by the placement team, who will send comments you can act on before the drives open.',
    kind: 'mixed',
    technology: 'career',
    level: 'beginner',
    course: 'aptitude-and-soft-skills',
    estimatedMinutes: 120,
    passPercent: 40,
    settings: { ...DEFAULTS, attemptsPerQuestion: 2 },
    author: 'admin',
    modules: [
      {
        title: 'Aptitude warm-up',
        description: 'Percentages, work rates and series.',
        topic: 'numbers',
        courseModule: 'Numbers',
        questions: ['aptitude-percentage', 'aptitude-time-work', 'aptitude-series'],
      },
      {
        title: 'The interview',
        description: 'What to say, what to ask, and a resume that gets you there.',
        topic: 'interview',
        courseModule: 'The interview',
        questions: [
          'career-introduce-yourself',
          'career-project-star',
          'career-questions-to-ask',
          'career-email-first-sentence',
          'career-resume-upload',
        ],
      },
    ],
    resources: [],
    audiences: [
      { batch: 'JFS-2026-B1', opensInDays: -11, dueInDays: 3 },
      { batch: 'JFS-2025-B4', opensInDays: -170, dueInDays: -156, closesInDays: -150 },
    ],
  },
  {
    title: 'Programming Foundations: Problem Solving',
    description:
      'Twelve classic problems in the language of your choice, and the ideas behind them.',
    instructions: `${CODING_RULES}\n\nEach problem accepts Java, Python or JavaScript: pick one and stay with it for the module.`,
    kind: 'coding',
    technology: 'programming',
    level: 'beginner',
    course: 'programming-foundations',
    estimatedMinutes: 240,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer6',
    modules: [
      {
        title: 'Loops and numbers',
        description: 'Warm-ups that build the habit of reading input carefully.',
        topic: 'loops',
        courseModule: 'Data and decisions',
        questions: [
          'sum-of-the-digits',
          'count-the-words',
          'fizzbuzz-up-to-n',
          'largest-in-a-list',
        ],
      },
      {
        title: 'Strings, arrays and stacks',
        description: 'Problems that reward thinking about the data before the code.',
        topic: 'arrays',
        gatedAt: 50,
        courseModule: 'Collections',
        questions: [
          'second-largest-number',
          'is-it-a-palindrome',
          'are-they-anagrams',
          'balanced-brackets',
          'dsa-recursion-base-case',
          'dsa-hashmap-cost',
          'dsa-stack-queue',
          'dsa-sorting-stable',
        ],
      },
    ],
    resources: [],
    audiences: [
      { batch: 'JFS-2026-B2', opensInDays: 14, dueInDays: 30 },
      { batch: 'JFS-2025-B4', opensInDays: -250, dueInDays: -236, closesInDays: -230 },
    ],
  },
  {
    title: 'Web Foundations: HTML and CSS',
    description: 'Semantic, accessible pages and layouts that work from a phone to a desktop.',
    instructions:
      'Quick questions first, then two practicals your trainer reviews: a semantic course page (hand in a ZIP) and responsive programme cards (give the published address).',
    kind: 'mixed',
    technology: 'html',
    level: 'beginner',
    course: 'web-development',
    estimatedMinutes: 240,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer4',
    modules: [
      {
        title: 'Semantic HTML',
        description: 'Structure, forms and accessibility.',
        topic: 'html-semantics',
        courseModule: 'HTML',
        questions: [
          'html-main-element',
          'html-alt-text',
          'html-label-for',
          'html-button-submits',
          'html-heading-order',
          'html-practical-course-page',
        ],
      },
      {
        title: 'Layout with CSS',
        description: 'Specificity, the box model, flexbox, grid and media queries.',
        topic: 'css-basics',
        courseModule: 'CSS',
        questions: [
          'css-specificity',
          'css-box-sizing',
          'css-flex-centre',
          'css-grid-columns',
          'css-mobile-first',
          'css-practical-responsive-cards',
        ],
      },
    ],
    resources: [
      {
        title: 'MDN: Learn web development',
        url: 'https://developer.mozilla.org/en-US/docs/Learn',
      },
    ],
    audiences: [{ batch: 'JFS-2026-B2', opensInDays: 14, dueInDays: 35 }],
  },
  {
    title: 'Python Starter Pack',
    description:
      'An elective for learners who asked for Python: lists, dictionaries and the idioms that make Python readable.',
    instructions: `${CODING_RULES}\n\nAnswer in Python 3.`,
    kind: 'coding',
    technology: 'python',
    level: 'beginner',
    course: null,
    estimatedMinutes: 180,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer6',
    modules: [
      {
        title: 'Basics and lists',
        description: 'Slicing, comprehensions and formatting.',
        topic: 'lists',
        questions: [
          'python-slicing',
          'python-list-vs-tuple',
          'python-comprehension-output',
          'python-squares',
          'python-temperature-table',
        ],
      },
      {
        title: 'Dictionaries and functions',
        description: 'Counting, grouping and a classic pitfall.',
        topic: 'dictionaries',
        questions: [
          'python-dict-get',
          'python-is-vs-equals',
          'python-mutable-default',
          'python-venv',
          'python-count-each-word',
          'python-total-by-name',
          'python-flatten-list',
        ],
      },
    ],
    resources: [{ title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/' }],
    audiences: [
      {
        students: ['student04', 'student09', 'student13', 'student17'],
        opensInDays: -5,
        dueInDays: 9,
        note: 'Elective for the learners who asked to add Python.',
      },
    ],
  },
  {
    title: 'PHP Basics',
    description:
      'An elective for learners heading to web agencies: strings, arrays, money and security in PHP.',
    instructions: `${CODING_RULES}\n\nAnswer in PHP 8. Read the input with \`stream_get_contents(STDIN)\`.`,
    kind: 'coding',
    technology: 'php',
    level: 'beginner',
    course: null,
    estimatedMinutes: 120,
    passPercent: 50,
    settings: DEFAULTS,
    author: 'trainer5',
    modules: [
      {
        title: 'PHP essentials',
        description: 'Forms, strings, arrays and safe output.',
        topic: 'php-basics',
        questions: [
          'php-superglobals',
          'php-reverse-each-word',
          'php-phone-book',
          'php-output-escaping',
          'php-sql-injection',
          'php-invoice-total',
        ],
      },
    ],
    resources: [
      {
        title: 'PHP manual: getting started',
        url: 'https://www.php.net/manual/en/getting-started.php',
      },
    ],
    audiences: [
      {
        students: ['student02', 'student11'],
        opensInDays: -1,
        dueInDays: 13,
        note: 'Elective: PHP for agency roles.',
      },
    ],
  },
  {
    title: 'Company Round Practice: Java',
    description:
      'Problems in the style of product-company coding rounds, with the concepts behind them.',
    instructions: `${CODING_RULES}\n\nWork as you would in a real round: read the whole problem, state your approach, then write the code.`,
    kind: 'mixed',
    technology: 'core-java',
    level: 'advanced',
    course: 'core-java',
    estimatedMinutes: 360,
    passPercent: 60,
    settings: DEFAULTS,
    author: 'trainer1',
    modules: [
      {
        title: 'Coding round',
        description: 'Arrays, strings and maps under interview conditions.',
        topic: 'strings',
        questions: [
          'java-rotate-array',
          'java-matrix-transpose',
          'java-most-frequent-word',
          'java-run-length-encoding',
        ],
      },
      {
        title: 'Technical interview',
        description: 'The concepts interviewers probe after the coding round.',
        topic: 'collections',
        questions: [
          'java-generics-erasure',
          'java-thread-safety',
          'java-explain-hashmap',
          'java-project-library-cli',
        ],
      },
    ],
    resources: [],
    audiences: [],
  },
];
