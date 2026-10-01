/**
 * The Python track: the language as working programmers use it — lists, dictionaries,
 * comprehensions and the standard library.
 */
import type { BankQuestion } from './types.js';

const code = String.raw;

export const PYTHON: BankQuestion[] = [
  {
    slug: 'python-squares',
    type: 'coding',
    title: 'Squares up to n',
    body: 'Read a whole number n and print the squares of 1 to n on one line, separated by spaces. Try it with a list comprehension.',
    technology: 'python',
    topic: 'lists',
    level: 'beginner',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One whole number n.',
    outputFormat: 'n numbers on one line: 1, 4, 9 … n².',
    constraints: '1 ≤ n ≤ 1 000',
    explanation:
      "`' '.join(str(i * i) for i in range(1, n + 1))` builds the whole line in one expression.",
    languages: ['python'],
    starter: { python: 'n = int(input())\n# print the squares of 1 to n\n' },
    solution: {
      python: code`n = int(input())
print(' '.join(str(i * i) for i in range(1, n + 1)))
`,
    },
    cases: [
      { input: '5', expected: '1 4 9 16 25', sample: true },
      { input: '1', expected: '1', sample: true },
      { input: '10', expected: '1 4 9 16 25 36 49 64 81 100' },
    ],
  },
  {
    slug: 'python-temperature-table',
    type: 'coding',
    title: 'Celsius to Fahrenheit table',
    body: 'Read a start, an end and a step in degrees Celsius. Print each temperature from the start up to the end (inclusive) in steps, with its Fahrenheit value to one decimal place.',
    technology: 'python',
    topic: 'python-basics',
    level: 'foundation',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'Three whole numbers: start, end and step (step > 0).',
    outputFormat:
      'One line per temperature: the Celsius value, a space, and the Fahrenheit value with one decimal place.',
    constraints: '-100 ≤ start ≤ end ≤ 1 000; 1 ≤ step ≤ 100',
    hints: ['F = C × 9 / 5 + 32.', "Format with an f-string: `f'{f:.1f}'`."],
    explanation:
      "`range(start, end + 1, step)` walks the values; `f'{c} {c * 9 / 5 + 32:.1f}'` prints each row.",
    languages: ['python'],
    starter: { python: 'start, end, step = map(int, input().split())\n# print the table\n' },
    solution: {
      python: code`start, end, step = map(int, input().split())
for c in range(start, end + 1, step):
    print(f'{c} {c * 9 / 5 + 32:.1f}')
`,
    },
    cases: [
      {
        input: '0 100 25',
        expected: '0 32.0\n25 77.0\n50 122.0\n75 167.0\n100 212.0',
        sample: true,
      },
      { input: '-40 -40 1', expected: '-40 -40.0', sample: true, label: 'Where the scales meet' },
      { input: '36 38 1', expected: '36 96.8\n37 98.6\n38 100.4', label: 'Body temperature' },
    ],
  },
  {
    slug: 'python-count-each-word',
    type: 'coding',
    title: 'Count each word, in order',
    body: 'Read one line of words and print each distinct word with the number of times it appears, in the order the words first appear.',
    technology: 'python',
    topic: 'dictionaries',
    level: 'easy',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'One line of words separated by spaces. Words are case-sensitive.',
    outputFormat: 'One line per distinct word: the word, a space, and its count.',
    constraints: 'At most 100 000 words.',
    hints: ['Dictionaries keep insertion order in Python 3.7 and later.'],
    explanation:
      'A plain dict (or `collections.Counter`) counts the words; since Python 3.7 it remembers the order keys were first added.',
    languages: ['python'],
    starter: { python: 'words = input().split()\n# print each word and its count\n' },
    solution: {
      python: code`counts = {}
for word in input().split():
    counts[word] = counts.get(word, 0) + 1
for word, count in counts.items():
    print(word, count)
`,
    },
    cases: [
      { input: 'to be or not to be', expected: 'to 2\nbe 2\nor 1\nnot 1', sample: true },
      { input: 'Java java', expected: 'Java 1\njava 1', sample: true, label: 'Case matters' },
      { input: 'one', expected: 'one 1' },
    ],
  },
  {
    slug: 'python-total-by-name',
    type: 'coding',
    title: 'Totals by learner',
    body: 'Read lines of `name score`. A name may appear more than once. Print each name with the total of its scores, highest total first; break ties alphabetically.',
    technology: 'python',
    topic: 'dictionaries',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat: 'The first line holds n. Then n lines, each a name and a whole-number score.',
    outputFormat: 'One line per name: the name, a space, and the total.',
    constraints: '1 ≤ n ≤ 100 000; names are single words.',
    hints: ['Sort with a key that is a tuple: `(-total, name)`.'],
    explanation:
      'Accumulate totals in a dict, then `sorted(totals.items(), key=lambda kv: (-kv[1], kv[0]))` orders by total descending and name ascending.',
    languages: ['python'],
    starter: {
      python: 'import sys\n\nlines = sys.stdin.read().splitlines()\n# print the totals\n',
    },
    solution: {
      python: code`import sys

lines = sys.stdin.read().splitlines()
n = int(lines[0])
totals = {}
for line in lines[1:1 + n]:
    name, score = line.split()
    totals[name] = totals.get(name, 0) + int(score)
for name, total in sorted(totals.items(), key=lambda kv: (-kv[1], kv[0])):
    print(name, total)
`,
    },
    cases: [
      {
        input: '4\nAsha 40\nRahul 35\nAsha 20\nDivya 60',
        expected: 'Asha 60\nDivya 60\nRahul 35',
        sample: true,
      },
      { input: '1\nImran 0', expected: 'Imran 0', sample: true },
      { input: '3\nzoe 5\namy 5\nzoe -2', expected: 'amy 5\nzoe 3', label: 'A negative score' },
    ],
  },
  {
    slug: 'python-flatten-list',
    type: 'coding',
    title: 'Flatten a nested list',
    body: 'Read a nested list of whole numbers written as a Python literal, for example `[1, [2, 3], [[4]], 5]`, and print all the numbers in order, separated by spaces.',
    technology: 'python',
    topic: 'recursion',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat: 'One line: a nested list literal.',
    outputFormat:
      'The numbers in reading order, separated by single spaces; an empty line if there are none.',
    constraints: 'At most 10 000 numbers; nesting at most 50 deep.',
    hints: [
      '`ast.literal_eval` reads the literal safely; never use `eval` on input.',
      'A number is printed; a list is flattened recursively.',
    ],
    explanation:
      'Parse with `ast.literal_eval` (safe for literals), then a recursive generator yields numbers and descends into lists.',
    languages: ['python'],
    starter: {
      python: 'import ast\n\nvalue = ast.literal_eval(input())\n# print the numbers in order\n',
    },
    solution: {
      python: code`import ast


def flatten(value):
    if isinstance(value, list):
        for item in value:
            yield from flatten(item)
    else:
        yield value


print(' '.join(str(x) for x in flatten(ast.literal_eval(input()))))
`,
    },
    cases: [
      { input: '[1, [2, 3], [[4]], 5]', expected: '1 2 3 4 5', sample: true },
      { input: '[[], [[]]]', expected: '', sample: true, label: 'Nothing inside' },
      { input: '[-1, [0, [1, [2, [3]]]]]', expected: '-1 0 1 2 3' },
    ],
  },

  // ───────────── concepts ─────────────
  {
    slug: 'python-mutable-default',
    type: 'mcq_single',
    title: 'A list as a default argument',
    body: '```\ndef add(item, items=[]):\n    items.append(item)\n    return items\n\nadd(1)\nprint(add(2))\n```\nWhat is printed?',
    technology: 'python',
    topic: 'functions',
    level: 'interview',
    marks: 2,
    options: [
      ['[2]', false],
      ['[1, 2]', true, 'The same default list is reused between calls.'],
      ['[2, 1]', false],
      ['An error', false],
    ],
    explanation:
      'Default values are evaluated once, when the function is defined, so every call without `items` shares one list. Use `items=None` and create the list inside.',
  },
  {
    slug: 'python-list-vs-tuple',
    type: 'mcq_single',
    title: 'Lists and tuples',
    body: 'Which statement about lists and tuples is true?',
    technology: 'python',
    topic: 'lists',
    level: 'foundation',
    marks: 1,
    options: [
      ['Tuples cannot hold different types', false],
      ['A tuple cannot be changed after it is made, so it can be a dict key', true],
      ['Lists are faster for everything', false],
      ['Tuples cannot be indexed', false],
    ],
    explanation:
      'Tuples are immutable and hashable (if their items are), so they work as dictionary keys; lists do not.',
  },
  {
    slug: 'python-slicing',
    type: 'mcq_single',
    title: 'What does this slice return?',
    body: "`'placement'[2:6]`",
    technology: 'python',
    topic: 'python-basics',
    level: 'easy',
    marks: 1,
    options: [
      ["'ace'", false],
      ["'acem'", true, 'Characters at positions 2, 3, 4 and 5.'],
      ["'lacem'", false],
      ["'acemen'", false],
    ],
    explanation:
      'A slice includes the start index and stops before the end index: positions 2 to 5 of "placement" are a, c, e, m.',
  },
  {
    slug: 'python-is-vs-equals',
    type: 'mcq_single',
    title: '`is` or `==`?',
    body: 'When should you use `is` rather than `==`?',
    technology: 'python',
    topic: 'python-basics',
    level: 'medium',
    marks: 2,
    options: [
      ['To compare two strings', false, 'Use == for values.'],
      ['To check whether something is None', true],
      ['To compare two numbers', false],
      ['Always; it is faster', false],
    ],
    explanation:
      '`is` checks identity (the same object). `x is None` is the idiom because there is only one None; for values use `==`.',
  },
  {
    slug: 'python-comprehension-output',
    type: 'mcq_single',
    title: 'Reading a comprehension',
    body: '`[x * 2 for x in range(6) if x % 2 == 1]`',
    technology: 'python',
    topic: 'lists',
    level: 'easy',
    marks: 2,
    options: [
      ['[2, 6, 10]', true],
      ['[0, 4, 8]', false],
      ['[1, 3, 5]', false],
      ['[2, 4, 6, 8, 10]', false],
    ],
    explanation: 'The odd numbers below 6 are 1, 3 and 5; doubled they are 2, 6 and 10.',
  },
  {
    slug: 'python-dict-get',
    type: 'true_false',
    title: '`scores.get("asha", 0)` raises KeyError when "asha" is missing.',
    body: 'Decide whether `dict.get` with a default raises an error for a missing key.',
    technology: 'python',
    topic: 'dictionaries',
    level: 'foundation',
    marks: 1,
    answer: false,
    explanation:
      '`get` returns the default (here 0) for a missing key; only `scores["asha"]` raises `KeyError`.',
  },
  {
    slug: 'python-venv',
    type: 'mcq_single',
    title: 'Why use a virtual environment?',
    body: 'Two of your projects need different versions of the same library. What does `python -m venv .venv` solve?',
    technology: 'python',
    topic: 'tooling',
    level: 'easy',
    marks: 1,
    options: [
      ['It makes Python run faster', false],
      ['Each project gets its own installed packages', true],
      ['It compiles the project', false],
      ['It is required to run any script', false],
    ],
    explanation:
      'A virtual environment is a per-project folder of packages, so upgrading one project’s library never breaks another.',
  },
];
