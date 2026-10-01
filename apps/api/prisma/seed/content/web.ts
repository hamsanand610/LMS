/**
 * The web track: HTML, CSS and JavaScript, from semantics and layout to the event loop, plus the
 * hands-on pages learners build and hand in.
 */
import type { BankQuestion } from './types.js';

const code = String.raw;

const JS_LINE = code`const line = require('fs').readFileSync(0, 'utf8').trim();
// your code here
`;

export const WEB: BankQuestion[] = [
  // ───────────── JavaScript coding ─────────────
  {
    slug: 'js-title-case',
    type: 'coding',
    title: 'Title case a heading',
    body: 'Read one line of words separated by single spaces. Print it with the first letter of every word in upper case and the rest of each word in lower case.',
    technology: 'javascript',
    topic: 'strings',
    level: 'easy',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One line of words made of letters, separated by single spaces.',
    outputFormat: 'The same words in title case.',
    constraints: 'At most 1 000 characters.',
    explanation:
      "`line.split(' ').map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ')`.",
    languages: ['javascript'],
    starter: { javascript: JS_LINE },
    solution: {
      javascript: code`const line = require('fs').readFileSync(0, 'utf8').trim();
console.log(
  line
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' '),
);
`,
    },
    cases: [
      { input: 'welcome to the batch', expected: 'Welcome To The Batch', sample: true },
      { input: 'jAVA fULL sTACK', expected: 'Java Full Stack', sample: true, label: 'Mixed case' },
      { input: 'x', expected: 'X', label: 'One letter' },
    ],
  },
  {
    slug: 'js-chunk-array',
    type: 'coding',
    title: 'Split a list into groups',
    body: 'Read a group size k and a list of numbers. Print the numbers in groups of k, one group per line; the last group may be shorter.',
    technology: 'javascript',
    topic: 'arrays',
    level: 'medium',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'The first line holds k. The second line holds the numbers, separated by spaces.',
    outputFormat: 'One line per group, numbers separated by single spaces.',
    constraints: '1 ≤ k ≤ 1 000; at most 100 000 numbers.',
    explanation: 'Step through the list k at a time and print `slice(i, i + k)` each time.',
    languages: ['javascript'],
    starter: {
      javascript:
        "const [first, second] = require('fs').readFileSync(0, 'utf8').trim().split('\\n');\n// your code here\n",
    },
    solution: {
      javascript: code`const [first, second = ''] = require('fs').readFileSync(0, 'utf8').trim().split('\n');
const k = Number(first);
const items = second.trim() ? second.trim().split(/\s+/) : [];
for (let i = 0; i < items.length; i += k) console.log(items.slice(i, i + k).join(' '));
`,
    },
    cases: [
      { input: '3\n1 2 3 4 5 6 7', expected: '1 2 3\n4 5 6\n7', sample: true },
      { input: '2\n10 20', expected: '10 20', sample: true, label: 'Exactly one group' },
      { input: '5\n1 2', expected: '1 2', label: 'Group larger than the list' },
    ],
  },
  {
    slug: 'js-json-number-sum',
    type: 'coding',
    title: 'Add up every number in a JSON document',
    body: 'Read one JSON value. Add up every number in it, however deeply it sits inside arrays and objects. Strings, booleans and null do not count, even when they look like numbers.',
    technology: 'javascript',
    topic: 'recursion',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat: 'One line: a JSON value.',
    outputFormat: 'One number: the sum.',
    constraints: 'At most 10 000 numbers, each a whole number.',
    hints: [
      '`JSON.parse` turns the text into values; walk arrays and objects recursively.',
      '`typeof value === \'number\'` tells a number from the string "42".',
    ],
    explanation:
      'Parse once, then recurse: numbers add themselves, arrays and objects add up their members, everything else is 0.',
    languages: ['javascript'],
    starter: { javascript: JS_LINE },
    solution: {
      javascript: code`const value = JSON.parse(require('fs').readFileSync(0, 'utf8'));

function sum(v) {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.reduce((total, item) => total + sum(item), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((total, item) => total + sum(item), 0);
  return 0;
}

console.log(sum(value));
`,
    },
    cases: [
      { input: '[1,[2,[3,4]],5]', expected: '15', sample: true },
      {
        input: '{"fees":[1200,800],"extra":{"lab":300},"note":"paid"}',
        expected: '2300',
        sample: true,
      },
      { input: '{"a":"42","b":true,"c":null}', expected: '0', label: 'Nothing numeric' },
      { input: '-7', expected: '-7', label: 'A bare number' },
    ],
  },

  // ───────────── JavaScript concepts ─────────────
  {
    slug: 'js-let-block-scope',
    type: 'mcq_single',
    title: 'Where is a let variable visible?',
    body: '```\nif (true) {\n  let seats = 30;\n}\nconsole.log(seats);\n```\nWhat happens?',
    technology: 'javascript',
    topic: 'javascript-basics',
    level: 'foundation',
    marks: 1,
    options: [
      ['It prints 30', false, 'That is what `var` would do.'],
      ['A ReferenceError: seats is not defined', true],
      ['It prints undefined', false],
      ['It prints null', false],
    ],
    explanation:
      '`let` and `const` are block-scoped, so `seats` does not exist outside the braces.',
  },
  {
    slug: 'js-strict-equality',
    type: 'mcq_single',
    title: 'Double or triple equals?',
    body: "What does `'5' == 5` evaluate to, and what does `'5' === 5` evaluate to?",
    technology: 'javascript',
    topic: 'javascript-basics',
    level: 'easy',
    marks: 1,
    options: [
      ['true and true', false],
      ['true and false', true, '`==` converts types first; `===` does not.'],
      ['false and false', false],
      ['false and true', false],
    ],
    explanation:
      '`==` coerces the string to a number before comparing; `===` compares type and value. Prefer `===`.',
  },
  {
    slug: 'js-event-loop-order',
    type: 'mcq_single',
    title: 'In what order do these lines print?',
    body: "```\nconsole.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nconsole.log('D');\n```",
    technology: 'javascript',
    topic: 'async',
    level: 'interview',
    marks: 3,
    options: [
      ['A B C D', false],
      ['A D C B', true],
      ['A D B C', false, 'Promise callbacks (microtasks) run before timers.'],
      ['A C D B', false],
    ],
    explanation:
      'Synchronous code first (A, D). Then the microtask queue (the promise callback, C), and only then the timer callback (B).',
  },
  {
    slug: 'js-const-object',
    type: 'true_false',
    title: 'A property of a const object cannot be changed.',
    body: "Decide whether this throws: `const settings = { theme: 'light' }; settings.theme = 'dark';`",
    technology: 'javascript',
    topic: 'javascript-basics',
    level: 'easy',
    marks: 1,
    answer: false,
    explanation:
      '`const` stops the variable being reassigned; the object it refers to can still change. `Object.freeze` stops that.',
  },
  {
    slug: 'js-map-vs-foreach',
    type: 'mcq_single',
    title: 'What does forEach return?',
    body: 'You need a new array of fees with GST added. Why is `map` the right method and not `forEach`?',
    technology: 'javascript',
    topic: 'arrays',
    level: 'easy',
    marks: 1,
    options: [
      ['forEach is slower', false],
      ['map returns a new array of the results; forEach returns undefined', true],
      ['forEach cannot read the index', false],
      ['map changes the original array', false, 'It does not.'],
    ],
    explanation:
      '`map` collects each callback’s return value into a new array. `forEach` is for side effects and always returns undefined.',
  },
  {
    slug: 'js-closure-counter',
    type: 'mcq_single',
    title: 'What does this closure print?',
    body: '```\nfunction counter() {\n  let n = 0;\n  return () => ++n;\n}\nconst next = counter();\nnext();\nnext();\nconsole.log(next());\n```',
    technology: 'javascript',
    topic: 'functions',
    level: 'medium',
    marks: 2,
    options: [
      ['1', false],
      ['3', true, 'The inner function keeps `n` alive between calls.'],
      ['0', false],
      ['undefined', false],
    ],
    explanation:
      'The returned function closes over `n`; each call increments the same variable, so the third call returns 3.',
  },
  {
    slug: 'js-fetch-await',
    type: 'mcq_single',
    title: 'Reading JSON from an API',
    body: "Inside an async function you call `const response = await fetch('/api/batches');`. What do you do to get the data?",
    technology: 'javascript',
    topic: 'async',
    level: 'medium',
    marks: 2,
    options: [
      ['Use response.body directly', false],
      ['await response.json(), after checking response.ok', true],
      ['JSON.parse(response)', false],
      ['Nothing; response is already the data', false],
    ],
    explanation:
      '`fetch` resolves with a Response; `response.json()` reads and parses the body (also asynchronous). Check `response.ok`, because fetch does not reject on 404 or 500.',
  },

  // ───────────── HTML ─────────────
  {
    slug: 'html-main-element',
    type: 'mcq_single',
    title: 'The element for the main content',
    body: 'Which element marks the dominant content of a page, once per page?',
    technology: 'html',
    topic: 'html-semantics',
    level: 'beginner',
    marks: 1,
    options: [
      ['<div id="main">', false, 'A div carries no meaning.'],
      ['<main>', true],
      ['<section>', false],
      ['<body>', false],
    ],
    explanation:
      '`<main>` tells browsers and screen readers where the page’s own content starts, so users can skip straight to it.',
  },
  {
    slug: 'html-alt-text',
    type: 'mcq_single',
    title: 'What is alt text for?',
    body: 'An `<img>` shows a chart of placement results. What should its `alt` attribute contain?',
    technology: 'html',
    topic: 'accessibility',
    level: 'foundation',
    marks: 1,
    options: [
      ['The file name', false],
      ['What the chart says, for someone who cannot see it', true],
      ['Nothing; alt is optional', false, 'Only purely decorative images get an empty alt.'],
      ['Keywords for search engines', false],
    ],
    explanation:
      'Alt text replaces the image for screen reader users and when the image fails to load: describe what it communicates.',
  },
  {
    slug: 'html-label-for',
    type: 'mcq_single',
    title: 'Connecting a label to its input',
    body: 'How do you tie the text "Email" to the input with `id="email"` so clicking the text focuses the field?',
    technology: 'html',
    topic: 'forms',
    level: 'easy',
    marks: 1,
    options: [
      ['<label for="email">Email</label>', true],
      ['<span name="email">Email</span>', false],
      ['<label id="email">Email</label>', false],
      [
        'A placeholder="Email" on the input',
        false,
        'A placeholder disappears as you type and is not a label.',
      ],
    ],
    explanation:
      '`for` names the input’s id. Screen readers then announce "Email" for the field too.',
  },
  {
    slug: 'html-button-submits',
    type: 'true_false',
    title: 'A <button> inside a form submits it unless told otherwise.',
    body: 'Decide what a `<button>` with no `type` attribute does inside a `<form>`.',
    technology: 'html',
    topic: 'forms',
    level: 'easy',
    marks: 1,
    answer: true,
    explanation:
      'The default type is `submit`. Write `type="button"` for buttons that should not submit.',
  },
  {
    slug: 'html-heading-order',
    type: 'mcq_single',
    title: 'Choosing heading levels',
    body: 'A card title should look small. The section heading above it is an `<h2>`. Which element should the card title be?',
    technology: 'html',
    topic: 'html-semantics',
    level: 'medium',
    marks: 1,
    options: [
      ['<h6>, because it is small', false, 'Levels describe structure, not size.'],
      ['<h3>, styled small with CSS', true],
      ['<p><b>…</b></p>', false],
      ['<h1>', false],
    ],
    explanation:
      'Heading levels form the outline screen reader users navigate by. Pick the level from the structure and set the size in CSS.',
  },

  // ───────────── CSS ─────────────
  {
    slug: 'css-specificity',
    type: 'mcq_single',
    title: 'Which rule wins?',
    body: '```\n#enrol { color: green; }\n.cta { color: red; }\n```\n`<button id="enrol" class="cta">` — what colour is the text?',
    technology: 'css',
    topic: 'css-basics',
    level: 'easy',
    marks: 1,
    options: [
      ['Red, because it comes later', false, 'Order only decides between equal specificity.'],
      ['Green, because an id selector is more specific', true],
      ['Both, blended', false],
      ['The browser default', false],
    ],
    explanation: 'Specificity is compared before source order: one id beats any number of classes.',
  },
  {
    slug: 'css-box-sizing',
    type: 'mcq_single',
    title: 'What does box-sizing: border-box change?',
    body: 'A box has `width: 300px; padding: 20px; border: 2px solid`. How wide is it on screen with `box-sizing: border-box`?',
    technology: 'css',
    topic: 'css-basics',
    level: 'medium',
    marks: 2,
    options: [
      ['344px', false, 'That is content-box: 300 + 40 + 4.'],
      ['300px', true],
      ['340px', false],
      ['256px', false],
    ],
    explanation:
      'With border-box, width includes padding and border, so the box is exactly 300px and the content shrinks to 256px.',
  },
  {
    slug: 'css-flex-centre',
    type: 'mcq_single',
    title: 'Centring with flexbox',
    body: 'In a flex container with the default row direction, which pair centres a child both horizontally and vertically?',
    technology: 'css',
    topic: 'flexbox',
    level: 'easy',
    marks: 1,
    options: [
      ['justify-content: center; align-items: center;', true],
      ['text-align: center; vertical-align: middle;', false],
      ['align-content: center; justify-items: center;', false],
      ['margin: center;', false],
    ],
    explanation:
      '`justify-content` works along the main axis (horizontal in a row) and `align-items` across it.',
  },
  {
    slug: 'css-grid-columns',
    type: 'mcq_single',
    title: 'Three equal columns',
    body: 'Which declaration makes a grid of three equal-width columns that share the available space?',
    technology: 'css',
    topic: 'grid',
    level: 'easy',
    marks: 1,
    options: [
      ['grid-template-columns: repeat(3, 1fr);', true],
      ['grid-columns: 3;', false],
      ['columns: 3 equal;', false],
      ['grid-template-rows: 1fr 1fr 1fr;', false, 'That makes rows.'],
    ],
    explanation: '`1fr` is one share of the free space; `repeat(3, 1fr)` gives three equal shares.',
  },
  {
    slug: 'css-mobile-first',
    type: 'mcq_single',
    title: 'Writing mobile-first CSS',
    body: 'In mobile-first CSS, how do you add a two-column layout for wider screens?',
    technology: 'css',
    topic: 'responsive',
    level: 'medium',
    marks: 2,
    options: [
      ['@media (min-width: 768px) { … two columns … }', true],
      ['@media (max-width: 768px) { … two columns … }', false, 'That applies to narrow screens.'],
      ['A separate stylesheet for phones only', false],
      ['JavaScript that reads the width', false],
    ],
    explanation:
      'Base styles serve the smallest screen; `min-width` media queries add layout as space grows.',
  },

  // ───────────── hand-ins ─────────────
  {
    slug: 'html-practical-course-page',
    type: 'practical',
    title: 'Practical: a semantic course page',
    body: 'Write one HTML page for a course: its name, a short description, a table of modules with their durations, a trainer card with a photo, and an enquiry form (name, email, message). Use semantic elements, a proper heading outline and accessible form labels. Hand in a ZIP of the page and its images.',
    technology: 'html',
    topic: 'html-semantics',
    level: 'easy',
    marks: 10,
    rubric:
      'Semantics (4): header, main, section, table with a caption and th headers, figure for the trainer photo. Forms (3): every input has a label; email uses type="email"; required fields are marked. Accessibility (2): meaningful alt text; heading levels in order. Validity (1): passes the W3C validator without errors.',
    spec: {
      fileKinds: ['zip'],
      maxFiles: 1,
      linkRequired: false,
      linkLabel: '',
      checklist: [
        'The page passes the W3C HTML validator',
        'Every form field has a visible label',
        'Images have alt text that describes them',
      ],
    },
  },
  {
    slug: 'css-practical-responsive-cards',
    type: 'practical',
    title: 'Practical: responsive programme cards',
    body: 'Style a row of three programme cards (title, duration, fee, button). One column on phones, two from 640px, three from 1024px, using CSS Grid and no framework. Publish the page (GitHub Pages or similar) and give its address.',
    technology: 'css',
    topic: 'responsive',
    level: 'medium',
    marks: 10,
    rubric:
      'Layout (4): grid with the three breakpoints, mobile-first. Consistency (2): equal card heights, aligned buttons. Accessibility (2): visible focus state, text contrast at least 4.5:1. Code (2): no fixed widths that overflow at 360px; custom properties for colours.',
    spec: {
      fileKinds: [],
      maxFiles: 0,
      linkRequired: true,
      linkLabel: 'Published page address',
      checklist: [
        'It works at 360px wide without sideways scrolling',
        'The buttons show a focus outline when tabbed to',
      ],
    },
  },
  {
    slug: 'js-project-task-board',
    type: 'project',
    title: 'Project: a study task board',
    body: 'Build a small task board in plain JavaScript: add a task with a due date, move it between To do, Doing and Done, and keep everything in localStorage so it survives a reload. Show overdue tasks clearly. Push it to a repository and publish it.',
    technology: 'javascript',
    topic: 'dom',
    level: 'medium',
    marks: 20,
    rubric:
      'Behaviour (8): add, move, delete, persist, overdue highlighting. Code (6): state kept in one place and rendered from it; no inline event handlers; functions small and named. UX (4): keyboard usable, empty states, input validation. Delivery (2): README with a screenshot and the published link.',
    spec: {
      fileKinds: [],
      maxFiles: 0,
      linkRequired: true,
      linkLabel: 'Repository address',
      checklist: [
        'Tasks survive a page reload',
        'Everything works with the keyboard alone',
        'The README links to the published board',
      ],
    },
  },
];
