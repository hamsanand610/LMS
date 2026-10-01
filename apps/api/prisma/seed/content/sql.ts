/**
 * The SQL track. Every query question runs against the same small institute database, in a fresh
 * in-memory SQLite database per case inside the sandbox. The questions use standard SQL that runs
 * the same way in MySQL, which is what learners meet at work.
 */
import type { BankQuestion } from './types.js';

const code = String.raw;

/** The tables and rows every case starts from. */
const INSTITUTE_DB = code`CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  batch TEXT NOT NULL
);
CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  fee INTEGER NOT NULL
);
CREATE TABLE enrolments (
  student_id INTEGER NOT NULL REFERENCES students(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  score INTEGER,
  PRIMARY KEY (student_id, course_id)
);
INSERT INTO students (id, name, city, batch) VALUES
  (1, 'Asha Krishnan', 'Chennai', 'B1'),
  (2, 'Rahul Varma', 'Coimbatore', 'B1'),
  (3, 'Divya Sundar', 'Chennai', 'B2'),
  (4, 'Imran Sheikh', 'Madurai', 'B1'),
  (5, 'Keerthana Raj', 'Coimbatore', 'B2'),
  (6, 'Vignesh Babu', 'Chennai', 'B1'),
  (7, 'Nandhini Ravi', 'Tiruchirappalli', 'B2');
INSERT INTO courses (id, title, fee) VALUES
  (1, 'Core Java', 18000),
  (2, 'SQL and Databases', 9000),
  (3, 'Web Development', 15000),
  (4, 'Spring Boot', 22000);
INSERT INTO enrolments (student_id, course_id, score) VALUES
  (1, 1, 88), (1, 2, 92), (2, 1, 64), (2, 3, 71), (3, 2, 55),
  (3, 3, 80), (4, 1, 91), (5, 4, NULL), (6, 1, 73), (6, 2, 68), (6, 4, 85);
`;

/** A result table as the sandbox prints it; only the values are compared, not the column names. */
function table(columns: string[], rows: (string | number | null)[][]): string {
  return JSON.stringify({ columns, rows });
}

const SQL_STARTER = '-- Write your query here\nSELECT\n';

export const SQL: BankQuestion[] = [
  {
    slug: 'sql-students-in-chennai',
    type: 'sql',
    title: 'Students from Chennai',
    body: 'List the names of the students who live in Chennai, in alphabetical order.',
    technology: 'sql',
    topic: 'queries',
    level: 'beginner',
    marks: 5,
    practicePoints: 10,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution: "SELECT name FROM students WHERE city = 'Chennai' ORDER BY name;",
    compareMode: 'rows',
    hints: ['Filter with WHERE, then sort with ORDER BY.'],
    explanation:
      "`WHERE city = 'Chennai'` keeps the right rows; `ORDER BY name` sorts them. Text comparison in WHERE is exact, so the capital C matters.",
    cases: [
      {
        input: '',
        expected: table(['name'], [['Asha Krishnan'], ['Divya Sundar'], ['Vignesh Babu']]),
        sample: true,
        label: 'The institute’s rows',
      },
      {
        input:
          "INSERT INTO students (id, name, city, batch) VALUES (8, 'Arjun Mehta', 'Chennai', 'B2');",
        expected: table(
          ['name'],
          [['Arjun Mehta'], ['Asha Krishnan'], ['Divya Sundar'], ['Vignesh Babu']],
        ),
        label: 'A new Chennai student',
      },
    ],
  },
  {
    slug: 'sql-courses-above-fee',
    type: 'sql',
    title: 'Courses above ten thousand',
    body: 'Show the title and fee of every course that costs more than 10 000, most expensive first.',
    technology: 'sql',
    topic: 'queries',
    level: 'foundation',
    marks: 5,
    practicePoints: 10,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution: 'SELECT title, fee FROM courses WHERE fee > 10000 ORDER BY fee DESC;',
    compareMode: 'rows',
    explanation:
      '`fee > 10000` excludes exactly 10 000; `ORDER BY fee DESC` puts the most expensive first.',
    cases: [
      {
        input: '',
        expected: table(
          ['title', 'fee'],
          [
            ['Spring Boot', 22000],
            ['Core Java', 18000],
            ['Web Development', 15000],
          ],
        ),
        sample: true,
      },
      {
        input: "INSERT INTO courses (id, title, fee) VALUES (5, 'Aptitude', 10000);",
        expected: table(
          ['title', 'fee'],
          [
            ['Spring Boot', 22000],
            ['Core Java', 18000],
            ['Web Development', 15000],
          ],
        ),
        label: 'Exactly ten thousand is not more',
      },
    ],
  },
  {
    slug: 'sql-students-per-city',
    type: 'sql',
    title: 'Students in each city',
    body: 'For each city, show the city and how many students live there, ordered by city name.',
    technology: 'sql',
    topic: 'aggregation',
    level: 'easy',
    marks: 5,
    practicePoints: 15,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution: 'SELECT city, COUNT(*) AS students FROM students GROUP BY city ORDER BY city;',
    compareMode: 'rows',
    hints: ['GROUP BY makes one row per city; COUNT(*) counts the rows in each group.'],
    explanation: '`GROUP BY city` collapses the rows per city and `COUNT(*)` counts each group.',
    cases: [
      {
        input: '',
        expected: table(
          ['city', 'students'],
          [
            ['Chennai', 3],
            ['Coimbatore', 2],
            ['Madurai', 1],
            ['Tiruchirappalli', 1],
          ],
        ),
        sample: true,
      },
      {
        input:
          "INSERT INTO students (id, name, city, batch) VALUES (8, 'Farhan Ali', 'Salem', 'B2'), (9, 'Latha Mohan', 'Madurai', 'B1');",
        expected: table(
          ['city', 'students'],
          [
            ['Chennai', 3],
            ['Coimbatore', 2],
            ['Madurai', 2],
            ['Salem', 1],
            ['Tiruchirappalli', 1],
          ],
        ),
        label: 'Two more students',
      },
    ],
  },
  {
    slug: 'sql-average-score-per-course',
    type: 'sql',
    title: 'Average score in each course',
    body: 'For each course that has at least one score, show the course title and the average score rounded to one decimal place, highest average first. A missing score is not a zero.',
    technology: 'sql',
    topic: 'joins',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution: code`SELECT c.title, ROUND(AVG(e.score), 1) AS average_score
FROM courses c
JOIN enrolments e ON e.course_id = c.id
WHERE e.score IS NOT NULL
GROUP BY c.id, c.title
ORDER BY average_score DESC;`,
    compareMode: 'rows',
    hints: [
      'Join enrolments to courses, then group by course.',
      'AVG already ignores NULL scores; filtering them out makes that explicit.',
    ],
    explanation:
      'Join to get titles, group by course, and let `AVG` ignore NULLs. Replacing NULL with 0 (`COALESCE`) would drag Spring Boot’s average down wrongly.',
    cases: [
      {
        input: '',
        expected: table(
          ['title', 'average_score'],
          [
            ['Spring Boot', 85],
            ['Core Java', 79],
            ['Web Development', 75.5],
            ['SQL and Databases', 71.7],
          ],
        ),
        sample: true,
      },
    ],
  },
  {
    slug: 'sql-not-enrolled',
    type: 'sql',
    title: 'Students with no course',
    body: 'List the names of students who are not enrolled in any course, in alphabetical order.',
    technology: 'sql',
    topic: 'joins',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution: code`SELECT s.name
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.id
WHERE e.student_id IS NULL
ORDER BY s.name;`,
    compareMode: 'rows',
    hints: ['A LEFT JOIN keeps students with no match; the enrolment columns are then NULL.'],
    explanation:
      '`LEFT JOIN … WHERE e.student_id IS NULL` is the classic anti-join; `NOT EXISTS` with a correlated subquery works too.',
    cases: [
      { input: '', expected: table(['name'], [['Nandhini Ravi']]), sample: true },
      {
        input:
          "INSERT INTO students (id, name, city, batch) VALUES (8, 'Bala Murugan', 'Salem', 'B2');",
        expected: table(['name'], [['Bala Murugan'], ['Nandhini Ravi']]),
        label: 'Another new student',
      },
    ],
  },
  {
    slug: 'sql-top-scorer-per-course',
    type: 'sql',
    title: 'Top scorer in each course',
    body: 'For each course, show the course title, the name of the student with the highest score, and that score, ordered by course title. Ignore missing scores; if two students tie, show both.',
    technology: 'sql',
    topic: 'subqueries',
    level: 'hard',
    marks: 15,
    practicePoints: 30,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution: code`SELECT c.title, s.name, e.score
FROM enrolments e
JOIN courses c ON c.id = e.course_id
JOIN students s ON s.id = e.student_id
WHERE e.score = (SELECT MAX(score) FROM enrolments WHERE course_id = e.course_id)
ORDER BY c.title, s.name;`,
    compareMode: 'rows',
    hints: [
      'Compare each score with the highest score of its own course.',
      'A correlated subquery can read the outer row’s course_id.',
    ],
    explanation:
      'The subquery finds each course’s maximum; keeping rows whose score equals it returns every top scorer, ties included.',
    cases: [
      {
        input: '',
        expected: table(
          ['title', 'name', 'score'],
          [
            ['Core Java', 'Imran Sheikh', 91],
            ['SQL and Databases', 'Asha Krishnan', 92],
            ['Spring Boot', 'Vignesh Babu', 85],
            ['Web Development', 'Divya Sundar', 80],
          ],
        ),
        sample: true,
      },
      {
        input: 'INSERT INTO enrolments (student_id, course_id, score) VALUES (7, 1, 91);',
        expected: table(
          ['title', 'name', 'score'],
          [
            ['Core Java', 'Imran Sheikh', 91],
            ['Core Java', 'Nandhini Ravi', 91],
            ['SQL and Databases', 'Asha Krishnan', 92],
            ['Spring Boot', 'Vignesh Babu', 85],
            ['Web Development', 'Divya Sundar', 80],
          ],
        ),
        label: 'A tie',
      },
    ],
  },
  {
    slug: 'sql-raise-fee',
    type: 'sql',
    title: 'Raise the smaller fees',
    body: 'Raise the fee of every course that costs less than 16 000 by ten per cent. Fees are whole rupees. Your statement changes the data; the check lists every course afterwards.',
    technology: 'sql',
    topic: 'dml',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    setupSql: INSTITUTE_DB,
    sqlCheck: 'SELECT title, fee FROM courses ORDER BY id;',
    starter: '-- Write your UPDATE here\n',
    solution: 'UPDATE courses SET fee = fee * 110 / 100 WHERE fee < 16000;',
    compareMode: 'rows',
    hints: ['UPDATE … SET … WHERE: without the WHERE every course changes.'],
    explanation:
      '`UPDATE courses SET fee = fee * 110 / 100 WHERE fee < 16000` touches only the two cheaper courses; multiplying before dividing keeps whole rupees exact.',
    cases: [
      {
        input: '',
        expected: table(
          ['title', 'fee'],
          [
            ['Core Java', 18000],
            ['SQL and Databases', 9900],
            ['Web Development', 16500],
            ['Spring Boot', 22000],
          ],
        ),
        sample: true,
      },
    ],
  },
  {
    slug: 'sql-second-highest-fee',
    type: 'sql',
    title: 'The second highest fee',
    body: 'Show the second highest distinct course fee as a single value.',
    technology: 'sql',
    topic: 'subqueries',
    level: 'interview',
    marks: 10,
    practicePoints: 25,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution:
      'SELECT MAX(fee) AS second_highest FROM courses WHERE fee < (SELECT MAX(fee) FROM courses);',
    compareMode: 'rows',
    hints: ['The highest fee below the highest fee is the second highest.'],
    explanation:
      'Take the maximum of the fees below the overall maximum. Unlike `ORDER BY fee DESC LIMIT 1 OFFSET 1`, it copes with two courses sharing the top fee.',
    cases: [
      { input: '', expected: table(['second_highest'], [[18000]]), sample: true },
      {
        input: "INSERT INTO courses (id, title, fee) VALUES (5, 'Microservices', 22000);",
        expected: table(['second_highest'], [[18000]]),
        label: 'Two share the top fee',
      },
      {
        input: "INSERT INTO courses (id, title, fee) VALUES (5, 'Data Structures', 20000);",
        expected: table(['second_highest'], [[20000]]),
        label: 'A new second',
      },
    ],
  },
  {
    slug: 'sql-batch-average-above',
    type: 'sql',
    title: 'Batches averaging above 75',
    body: 'Show each batch whose average score is above 75, with that average rounded to one decimal place. Missing scores do not count.',
    technology: 'sql',
    topic: 'aggregation',
    level: 'company',
    marks: 10,
    practicePoints: 25,
    setupSql: INSTITUTE_DB,
    starter: SQL_STARTER,
    solution: code`SELECT s.batch, ROUND(AVG(e.score), 1) AS average_score
FROM students s
JOIN enrolments e ON e.student_id = s.id
WHERE e.score IS NOT NULL
GROUP BY s.batch
HAVING AVG(e.score) > 75
ORDER BY s.batch;`,
    compareMode: 'rows',
    hints: ['WHERE filters rows before grouping; HAVING filters the groups.'],
    explanation:
      'Group enrolments by the student’s batch and keep the groups with `HAVING AVG(score) > 75`; a condition on an aggregate cannot go in WHERE.',
    cases: [
      { input: '', expected: table(['batch', 'average_score'], [['B1', 79]]), sample: true },
      {
        input: 'UPDATE enrolments SET score = 93 WHERE student_id = 5 AND course_id = 4;',
        expected: table(
          ['batch', 'average_score'],
          [
            ['B1', 79],
            ['B2', 76],
          ],
        ),
        label: 'A score filled in',
      },
      {
        input: 'UPDATE enrolments SET score = 90 WHERE student_id = 5 AND course_id = 4;',
        expected: table(['batch', 'average_score'], [['B1', 79]]),
        label: 'Exactly 75 is not above',
      },
    ],
  },

  // ───────────── concepts ─────────────
  {
    slug: 'sql-where-vs-having',
    type: 'mcq_single',
    title: 'WHERE or HAVING?',
    body: 'You want courses whose average score is below 60. Where does `AVG(score) < 60` go?',
    technology: 'sql',
    topic: 'aggregation',
    level: 'easy',
    marks: 2,
    options: [
      ['In WHERE', false, 'WHERE runs before grouping, when there is no average yet.'],
      ['In HAVING, after GROUP BY', true],
      ['In ORDER BY', false],
      ['In SELECT', false],
    ],
    explanation:
      'WHERE filters rows, HAVING filters groups. Conditions on aggregates belong in HAVING.',
  },
  {
    slug: 'sql-primary-key',
    type: 'mcq_multi',
    title: 'What does a primary key guarantee?',
    body: 'Select everything a primary key guarantees about its column(s).',
    technology: 'sql',
    topic: 'constraints',
    level: 'foundation',
    marks: 2,
    options: [
      ['No two rows share the value', true],
      ['The value is never NULL', true],
      [
        'The value never changes',
        false,
        'Nothing stops an UPDATE; you should avoid it, but it is not guaranteed.',
      ],
      ['Rows are stored in key order', false, 'Physical order is up to the engine.'],
    ],
    explanation:
      'A primary key is unique and not null. Keeping keys stable is good practice, not a rule the database enforces.',
  },
  {
    slug: 'sql-left-join',
    type: 'mcq_single',
    title: 'What does a LEFT JOIN return?',
    body: '`students LEFT JOIN enrolments ON …` — what happens to a student with no enrolments?',
    technology: 'sql',
    topic: 'joins',
    level: 'easy',
    marks: 2,
    options: [
      ['The student is left out', false, 'That is an INNER JOIN.'],
      ['The student appears once, with NULLs in the enrolment columns', true],
      ['The query fails', false],
      ['The student appears with zeros', false],
    ],
    explanation:
      'A LEFT JOIN keeps every row from the left table; where nothing matches, the right side’s columns are NULL.',
  },
  {
    slug: 'sql-null-comparison',
    type: 'true_false',
    title: '`score = NULL` finds the rows with no score.',
    body: 'Decide whether `WHERE score = NULL` returns the rows whose score is missing.',
    technology: 'sql',
    topic: 'queries',
    level: 'easy',
    marks: 1,
    answer: false,
    explanation: 'Any comparison with NULL is unknown, never true. Use `score IS NULL`.',
  },
  {
    slug: 'sql-index-purpose',
    type: 'mcq_single',
    title: 'When does an index help?',
    body: 'A table of two million payments is often searched by `student_id`. What does an index on `student_id` do?',
    technology: 'sql',
    topic: 'indexes',
    level: 'medium',
    marks: 2,
    options: [
      [
        'Makes every insert faster',
        false,
        'Inserts get slightly slower: the index must be kept up to date.',
      ],
      ['Lets the database find matching rows without scanning the whole table', true],
      ['Stops duplicate student_id values', false, 'Only a unique index does that.'],
      ['Sorts the table permanently', false],
    ],
    explanation:
      'An index is a sorted structure the engine can search in logarithmic time. The cost is extra space and slower writes.',
  },
  {
    slug: 'sql-transaction',
    type: 'mcq_single',
    title: 'Moving a fee payment between accounts',
    body: 'A transfer debits one account and credits another. Why run both statements in one transaction?',
    technology: 'sql',
    topic: 'transactions',
    level: 'interview',
    marks: 2,
    options: [
      ['It is faster', false],
      ['Either both happen or neither does', true],
      ['It locks the whole database', false],
      ['It is required for UPDATE', false],
    ],
    explanation:
      'Atomicity: if the credit fails after the debit, a rollback undoes the debit, so money never disappears.',
  },
];
