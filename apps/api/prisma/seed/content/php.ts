/**
 * PHP, offered as an elective for learners heading to web agencies that still run on it.
 */
import type { BankQuestion } from './types.js';

const code = String.raw;

const PHP_START = code`<?php
$input = trim(stream_get_contents(STDIN));
// your code here
`;

export const PHP: BankQuestion[] = [
  {
    slug: 'php-reverse-each-word',
    type: 'coding',
    title: 'Reverse each word',
    body: 'Read one line of words separated by single spaces. Reverse the letters of every word but keep the words in their order.',
    technology: 'php',
    topic: 'strings',
    level: 'easy',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One line of words separated by single spaces.',
    outputFormat: 'The line with every word reversed.',
    constraints: 'At most 1 000 characters.',
    explanation:
      "`implode(' ', array_map('strrev', explode(' ', $line)))` reverses each word and puts the line back together.",
    languages: ['php'],
    starter: { php: PHP_START },
    solution: {
      php: code`<?php
$line = trim(stream_get_contents(STDIN));
echo implode(' ', array_map('strrev', explode(' ', $line))), "\n";
`,
    },
    cases: [
      { input: 'hello world', expected: 'olleh dlrow', sample: true },
      { input: 'php', expected: 'php', sample: true },
      { input: 'learn build ship', expected: 'nrael dliub pihs' },
    ],
  },
  {
    slug: 'php-invoice-total',
    type: 'coding',
    title: 'Invoice total with GST',
    body: 'Read invoice lines of `item quantity price` where the price is in rupees with up to two decimal places. Print the subtotal, the GST at 18%, and the total, each with two decimal places. Round the GST to the nearest paisa.',
    technology: 'php',
    topic: 'numbers',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat:
      'The first line holds n. Then n lines: an item name (one word), a whole-number quantity and a price.',
    outputFormat: 'Three lines: `Subtotal: x`, `GST: y`, `Total: z`, each with two decimal places.',
    constraints: '1 ≤ n ≤ 100; quantities up to 1 000; prices up to 100 000.00',
    hints: [
      'Work in whole paise (integers) to avoid floating-point surprises, and format at the end.',
    ],
    explanation:
      'Convert each price to paise with `round($price * 100)`, multiply by quantity, sum as integers, compute GST as `round($subtotal * 18 / 100)` paise, and print with `number_format($paise / 100, 2, ".", "")`.',
    languages: ['php'],
    starter: { php: PHP_START },
    solution: {
      php: code`<?php
$lines = explode("\n", trim(stream_get_contents(STDIN)));
$n = (int) $lines[0];
$subtotal = 0;
for ($i = 1; $i <= $n; $i++) {
    [$item, $qty, $price] = preg_split('/\s+/', trim($lines[$i]));
    $subtotal += (int) $qty * (int) round((float) $price * 100);
}
$gst = (int) round($subtotal * 18 / 100);
$format = fn (int $paise) => number_format($paise / 100, 2, '.', '');
echo 'Subtotal: ', $format($subtotal), "\n";
echo 'GST: ', $format($gst), "\n";
echo 'Total: ', $format($subtotal + $gst), "\n";
`,
    },
    cases: [
      {
        input: '2\nnotebook 3 45.50\npen 10 12',
        expected: 'Subtotal: 256.50\nGST: 46.17\nTotal: 302.67',
        sample: true,
      },
      {
        input: '1\ncourse 1 18000',
        expected: 'Subtotal: 18000.00\nGST: 3240.00\nTotal: 21240.00',
        sample: true,
      },
      {
        input: '1\nsticker 3 0.10',
        expected: 'Subtotal: 0.30\nGST: 0.05\nTotal: 0.35',
        label: 'Rounding GST',
      },
    ],
  },
  {
    slug: 'php-phone-book',
    type: 'coding',
    title: 'Look up an extension directory',
    body: 'Read the institute’s directory of `name extension` entries, then a list of names to look up. For each name print `name=extension`, or `Not found` when it is not in the directory. Names are compared exactly.',
    technology: 'php',
    topic: 'arrays',
    level: 'easy',
    marks: 5,
    practicePoints: 10,
    inputFormat:
      'The first line holds n. Then n lines of `name extension`. Then a line holding q, and q lines with one name each.',
    outputFormat: 'q lines, one answer per query.',
    constraints: '1 ≤ n, q ≤ 10 000',
    explanation:
      'An associative array keyed by name gives constant-time lookups; `isset($book[$name])` checks for a missing name.',
    languages: ['php'],
    starter: { php: PHP_START },
    solution: {
      php: code`<?php
$lines = explode("\n", trim(stream_get_contents(STDIN)));
$n = (int) $lines[0];
$book = [];
for ($i = 1; $i <= $n; $i++) {
    [$name, $number] = explode(' ', trim($lines[$i]));
    $book[$name] = $number;
}
$q = (int) $lines[$n + 1];
for ($i = 0; $i < $q; $i++) {
    $name = trim($lines[$n + 2 + $i]);
    echo isset($book[$name]) ? $name . '=' . $book[$name] : 'Not found', "\n";
}
`,
    },
    cases: [
      {
        input: '2\nasha 4101\nrahul 4217\n3\nasha\nimran\nrahul',
        expected: 'asha=4101\nNot found\nrahul=4217',
        sample: true,
      },
      {
        input: '1\ndivya 4302\n1\nDivya',
        expected: 'Not found',
        sample: true,
        label: 'Case matters',
      },
      {
        input: '3\nbala 4410\nchitra 4411\ndeepak 4412\n4\nchitra\nbala\nzara\nchitra',
        expected: 'chitra=4411\nbala=4410\nNot found\nchitra=4411',
        label: 'Repeated look-ups',
      },
    ],
  },
  {
    slug: 'php-superglobals',
    type: 'mcq_single',
    title: 'Reading a submitted form in PHP',
    body: 'A form posts a field named `email`. Where does PHP put its value?',
    technology: 'php',
    topic: 'php-basics',
    level: 'foundation',
    marks: 1,
    options: [
      ['$_GET["email"]', false, 'Only for fields sent in the query string.'],
      ['$_POST["email"]', true],
      [
        '$email, automatically',
        false,
        'register_globals was removed long ago, for security reasons.',
      ],
      ['$_SESSION["email"]', false],
    ],
    explanation: 'POSTed fields arrive in `$_POST`. Validate and escape them before using them.',
  },
  {
    slug: 'php-sql-injection',
    type: 'mcq_single',
    title: 'Stopping SQL injection in PHP',
    body: 'Which way of running a query with a user’s input is safe?',
    technology: 'php',
    topic: 'security',
    level: 'medium',
    marks: 2,
    options: [
      ['"SELECT * FROM users WHERE email = \'" . $_POST["email"] . "\'"', false],
      ['A PDO prepared statement with a bound parameter', true],
      [
        'Stripping quotes from the input first',
        false,
        'Filtering characters is easy to get wrong; parameters are not.',
      ],
      ['Checking that the input is not empty', false],
    ],
    explanation:
      'With a prepared statement the value is sent separately from the SQL, so it can never change the query’s structure.',
  },
  {
    slug: 'php-output-escaping',
    type: 'true_false',
    title: 'Echoing a user’s name straight into HTML is safe.',
    body: 'Decide whether `echo "Hello " . $_GET[\'name\'];` is safe in a page.',
    technology: 'php',
    topic: 'security',
    level: 'easy',
    marks: 1,
    answer: false,
    explanation:
      "It allows cross-site scripting. Escape output with `htmlspecialchars($name, ENT_QUOTES, 'UTF-8')`.",
  },
];
