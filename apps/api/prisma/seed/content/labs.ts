/**
 * SI Academy's debugging and web labs (Roadmap Phase 1, ADR-0018 and ADR-0019). Original writing for
 * this institute. Each one is proved in the sandbox before the seed publishes it: a debugging lab's
 * fix passes every case and its code with the bug fails at least one; a web lab's reference page
 * passes every check (`pnpm --filter @lms/api verify:questions`).
 */
import type { DebuggingQuestion, WebLabQuestion } from './types.js';

const PAGE_HEAD = (title: string) =>
  `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${title}</title>\n</head>\n`;

const AVERAGE_STARTER = `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int total = 0;
        for (int i = 0; i < n; i++) {
            total += in.nextInt();
        }
        double average = total / n;
        System.out.printf("%.2f%n", average);
    }
}
`;

const VOWELS_STARTER = `line = input()
count = 0
for ch in line:
    if ch in "aeiou":
        count += 1
print(count)
`;

const TOTALS_STARTER = `const numbers = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const totals = [];
for (let i = 0; i < numbers.length; i++) {
  let total = 0;
  total += numbers[i];
  totals.push(total);
}
console.log(totals.join(' '));
`;

export const DEBUGGING_LABS: DebuggingQuestion[] = [
  {
    slug: 'debug-java-average',
    type: 'debugging',
    title: 'Fix the average',
    body: 'This program reads some whole numbers and prints their average. Learners in the last batch noticed that the average of 1, 2 and 4 comes out as 2.00. Find out why and fix it.',
    technology: 'core-java',
    topic: 'numbers',
    level: 'beginner',
    marks: 5,
    languages: ['java'],
    starter: { java: AVERAGE_STARTER },
    solution: {
      java: AVERAGE_STARTER.replace(
        'double average = total / n;',
        'double average = (double) total / n;',
      ),
    },
    expectedBehaviour:
      'It reads n, then n whole numbers, and prints their average with exactly two digits after the decimal point: for 1, 2 and 4 it prints `2.33`.',
    inputFormat: 'The first line holds n. The second holds n whole numbers separated by spaces.',
    outputFormat: 'The average, with two digits after the decimal point.',
    constraints: '1 ≤ n ≤ 1000',
    hints: [
      'What type is `total / n` when both are `int`?',
      'Make one side of the division a `double` before dividing.',
    ],
    explanation:
      'Dividing one `int` by another throws away the fraction before the result is stored in the `double`. Casting `total` to `double` first keeps it: `(double) total / n`.',
    cases: [
      { input: '3\n1 2 4\n', expected: '2.33', sample: true, label: 'Not a whole number' },
      { input: '1\n7\n', expected: '7.00' },
      { input: '2\n5 6\n', expected: '5.50' },
      { input: '4\n-1 2 3 1\n', expected: '1.25' },
    ],
    practicePoints: 15,
  },
  {
    slug: 'debug-python-vowels',
    type: 'debugging',
    title: 'Fix the vowel counter',
    body: 'This program counts the vowels in a line of text. It gets "hello" right, but a line in capitals comes out wrong. Fix it.',
    technology: 'python',
    topic: 'strings',
    level: 'beginner',
    marks: 5,
    languages: ['python'],
    starter: { python: VOWELS_STARTER },
    solution: { python: VOWELS_STARTER.replace('if ch in "aeiou":', 'if ch.lower() in "aeiou":') },
    expectedBehaviour:
      'It prints how many of the letters a, e, i, o and u the line holds, in capitals or not: `AEIOU are vowels` holds 9.',
    inputFormat: 'One line of text.',
    outputFormat: 'The number of vowels in it.',
    constraints: 'The line holds at most 1000 characters.',
    hints: ['Is "A" in the string "aeiou"?'],
    explanation:
      'The check compared each character with lower-case vowels only. Comparing `ch.lower()` counts capitals too.',
    cases: [
      { input: 'AEIOU are vowels\n', expected: '9', sample: true, label: 'Capitals' },
      { input: 'Hello World\n', expected: '3' },
      { input: 'Programming In Python\n', expected: '5' },
      { input: 'rhythm\n', expected: '0' },
    ],
    practicePoints: 15,
  },
  {
    slug: 'debug-js-running-total',
    type: 'debugging',
    title: 'Fix the running total',
    body: 'This program should print the running total of a list of numbers — each number added to all the ones before it. It prints the numbers back instead. Fix it.',
    technology: 'javascript',
    topic: 'loops',
    level: 'beginner',
    marks: 5,
    languages: ['javascript'],
    starter: { javascript: TOTALS_STARTER },
    solution: {
      javascript: TOTALS_STARTER.replace(
        'for (let i = 0; i < numbers.length; i++) {\n  let total = 0;\n',
        'let total = 0;\nfor (let i = 0; i < numbers.length; i++) {\n',
      ),
    },
    expectedBehaviour:
      'For the numbers 1 2 3 it prints `1 3 6`: the first number, then the first two added, then all three.',
    inputFormat: 'One line of whole numbers separated by spaces.',
    outputFormat: 'The running totals, separated by single spaces.',
    constraints: 'At most 1000 numbers.',
    hints: ['Where does `total` start again from zero?'],
    explanation:
      '`total` was declared inside the loop, so it started from zero for every number. Declared once before the loop, it carries on adding.',
    cases: [
      { input: '1 2 3\n', expected: '1 3 6', sample: true, label: 'Three numbers' },
      { input: '5\n', expected: '5' },
      { input: '10 -2 4 0\n', expected: '10 8 12 12' },
      { input: '0 0 7\n', expected: '0 0 7' },
    ],
    practicePoints: 15,
  },
];

const AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%237f2331'/%3E%3C/svg%3E";

const TODO_HTML = `${PAGE_HEAD('To-do list')}<body>
  <h1>My tasks</h1>
  <form id="new-task">
    <label for="task">Task</label>
    <input id="task" name="task" autocomplete="off">
    <button id="add" type="submit">Add</button>
  </form>
  <ul id="tasks"></ul>
  <p id="count">0 tasks</p>
</body>
</html>
`;

const SIGNUP_HTML = `${PAGE_HEAD('Sign up')}<body>
  <h1>Join the next batch</h1>
  <form id="signup" novalidate>
    <label for="email">Email address</label>
    <input id="email" name="email" type="text">
    <button type="submit">Sign up</button>
  </form>
  <p id="error" role="alert"></p>
  <p id="done"></p>
</body>
</html>
`;

export const WEB_LABS: WebLabQuestion[] = [
  {
    slug: 'web-profile-card',
    type: 'web',
    title: 'Build a profile card',
    body: 'Build a profile card for Asha Raman, a Java trainee: an `article` with the class `card` holding her photo (`img`, with alternative text), her name in an `h2`, and her role in a paragraph with the class `role`. Give the role the colour #555555 and centre the text of the card.',
    technology: 'html',
    topic: 'html-semantics',
    level: 'beginner',
    marks: 5,
    starter: {
      html: `${PAGE_HEAD('Profile card')}<body>\n  <!-- Build the card here -->\n</body>\n</html>\n`,
      css: '/* Style the card here */\n',
      js: '',
    },
    solution: {
      html: `${PAGE_HEAD('Profile card')}<body>
  <article class="card">
    <img src="${AVATAR}" alt="Asha Raman smiling">
    <h2>Asha Raman</h2>
    <p class="role">Java trainee</p>
  </article>
</body>
</html>
`,
      css: `.card {
  max-width: 18rem;
  padding: 1rem;
  border: 1px solid #dddddd;
  border-radius: 8px;
  font-family: sans-serif;
  text-align: center;
}

.card .role {
  color: #555555;
}
`,
      js: '',
    },
    hints: [
      'Alternative text goes in the `alt` attribute of the image.',
      'A rule for `.card .role` styles only the role paragraph inside the card.',
    ],
    explanation:
      'An `article` groups the card; `alt` describes the photo for anyone who cannot see it; one rule centres the card and another colours the role.',
    checks: [
      {
        check: { kind: 'exists', selector: 'article.card', min: 1, max: 1 },
        sample: true,
        label: 'One card',
      },
      {
        check: { kind: 'text', selector: '.card h2', match: 'equals', value: 'Asha Raman' },
        sample: true,
        label: 'Her name is the heading',
      },
      {
        check: {
          kind: 'attribute',
          selector: '.card img',
          name: 'alt',
          match: 'present',
          value: '',
        },
        sample: true,
        label: 'The photo has alternative text',
      },
      {
        check: { kind: 'text', selector: '.card .role', match: 'equals', value: 'Java trainee' },
        label: 'Her role',
      },
      {
        check: { kind: 'style', selector: '.card .role', property: 'color', value: '#555555' },
        label: 'The role is grey',
      },
      {
        check: { kind: 'style', selector: '.card', property: 'text-align', value: 'center' },
        label: 'The card is centred',
      },
    ],
    practicePoints: 20,
  },
  {
    slug: 'web-todo-list',
    type: 'web',
    title: 'Finish the to-do list',
    body: 'Finish the to-do list. Typing a task into the box and pressing Add puts it at the end of the list as a list item, empties the box, and updates the count below the list: "1 task", "2 tasks". Pressing Add with an empty box adds nothing.',
    technology: 'javascript',
    topic: 'dom',
    level: 'medium',
    marks: 8,
    starter: {
      html: TODO_HTML,
      css: 'body {\n  font-family: sans-serif;\n  max-width: 30rem;\n  margin: 2rem auto;\n}\n',
      js: `const form = document.getElementById('new-task');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  // Add the task to the list, empty the box and update the count.
});
`,
    },
    solution: {
      html: TODO_HTML,
      css: 'body {\n  font-family: sans-serif;\n  max-width: 30rem;\n  margin: 2rem auto;\n}\n',
      js: `const form = document.getElementById('new-task');
const box = document.getElementById('task');
const list = document.getElementById('tasks');
const count = document.getElementById('count');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = box.value.trim();
  if (!text) return;
  const item = document.createElement('li');
  item.textContent = text;
  list.appendChild(item);
  box.value = '';
  const n = list.children.length;
  count.textContent = n + (n === 1 ? ' task' : ' tasks');
});
`,
    },
    hints: [
      '`document.createElement("li")` makes a list item; `appendChild` puts it at the end of the list.',
      '`box.value.trim()` is an empty string when the box holds only spaces.',
    ],
    explanation:
      'The form’s submit handler stops the page reloading, reads and trims the box, adds an item only when there is text, empties the box and counts the list’s children for the message.',
    checks: [
      {
        check: { kind: 'exists', selector: '#tasks', min: 1, max: 1 },
        sample: true,
        label: 'There is a list',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#task', value: 'Buy milk', key: '' },
            { action: 'click', selector: '#add', value: '', key: '' },
          ],
          then: { kind: 'text', selector: '#tasks li', match: 'equals', value: 'Buy milk' },
        },
        sample: true,
        label: 'Adding a task lists it',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#task', value: 'Buy milk', key: '' },
            { action: 'click', selector: '#add', value: '', key: '' },
            { action: 'input', selector: '#task', value: 'Call Ravi', key: '' },
            { action: 'click', selector: '#add', value: '', key: '' },
          ],
          then: { kind: 'exists', selector: '#tasks li', min: 2, max: 2 },
        },
        label: 'Two tasks, two items',
      },
      {
        check: {
          kind: 'interaction',
          steps: [{ action: 'click', selector: '#add', value: '', key: '' }],
          then: { kind: 'exists', selector: '#tasks li', min: 0, max: 0 },
        },
        label: 'An empty box adds nothing',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#task', value: 'Read chapter 3', key: '' },
            { action: 'click', selector: '#add', value: '', key: '' },
          ],
          then: { kind: 'text', selector: '#task', match: 'equals', value: '' },
        },
        label: 'The box is emptied',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#task', value: 'Read chapter 3', key: '' },
            { action: 'click', selector: '#add', value: '', key: '' },
          ],
          then: { kind: 'text', selector: '#count', match: 'equals', value: '1 task' },
        },
        label: 'One task',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#task', value: 'A', key: '' },
            { action: 'click', selector: '#add', value: '', key: '' },
            { action: 'input', selector: '#task', value: 'B', key: '' },
            { action: 'keydown', selector: '#task', value: '', key: 'Enter' },
          ],
          then: { kind: 'text', selector: '#count', match: 'equals', value: '2 tasks' },
        },
        label: 'Enter adds too, and the count says so',
      },
    ],
    practicePoints: 20,
  },
  {
    slug: 'web-signup-check',
    type: 'web',
    title: 'Check the sign-up email',
    body: 'When the sign-up form is sent with an email address that has no @ in it, show "Enter a valid email address" in the `#error` paragraph and do not thank the learner. With an address that has an @, empty `#error` and show "Thanks for signing up" in `#done`. The page must not reload.',
    technology: 'javascript',
    topic: 'forms',
    level: 'beginner',
    marks: 6,
    starter: {
      html: SIGNUP_HTML,
      css: 'body {\n  font-family: sans-serif;\n}\n\n#error {\n  color: #b42318;\n}\n',
      js: `const form = document.getElementById('signup');

form.addEventListener('submit', (event) => {
  // Check the address, and say what is wrong or thank the learner.
});
`,
    },
    solution: {
      html: SIGNUP_HTML,
      css: 'body {\n  font-family: sans-serif;\n}\n\n#error {\n  color: #b42318;\n}\n',
      js: `const form = document.getElementById('signup');
const email = document.getElementById('email');
const error = document.getElementById('error');
const done = document.getElementById('done');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!email.value.includes('@')) {
    error.textContent = 'Enter a valid email address';
    done.textContent = '';
    return;
  }
  error.textContent = '';
  done.textContent = 'Thanks for signing up';
});
`,
    },
    hints: [
      '`event.preventDefault()` stops the form reloading the page.',
      '`email.value.includes("@")` says whether the address has an @.',
    ],
    explanation:
      'The submit handler stops the reload, then either shows the error and clears the thanks, or the other way round, so the two messages never show together.',
    checks: [
      {
        check: { kind: 'exists', selector: 'form#signup', min: 1, max: 1 },
        sample: true,
        label: 'The form is there',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#email', value: 'asha.example.com', key: '' },
            { action: 'submit', selector: '#signup', value: '', key: '' },
          ],
          then: {
            kind: 'text',
            selector: '#error',
            match: 'equals',
            value: 'Enter a valid email address',
          },
        },
        sample: true,
        label: 'An address without @ is refused',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#email', value: 'asha@example.com', key: '' },
            { action: 'submit', selector: '#signup', value: '', key: '' },
          ],
          then: {
            kind: 'text',
            selector: '#done',
            match: 'equals',
            value: 'Thanks for signing up',
          },
        },
        label: 'A good address is thanked',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#email', value: 'asha@example.com', key: '' },
            { action: 'submit', selector: '#signup', value: '', key: '' },
          ],
          then: { kind: 'text', selector: '#error', match: 'equals', value: '' },
        },
        label: 'No error for a good address',
      },
      {
        check: {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#email', value: 'nope', key: '' },
            { action: 'submit', selector: '#signup', value: '', key: '' },
          ],
          then: { kind: 'text', selector: '#done', match: 'equals', value: '' },
        },
        label: 'No thanks for a bad address',
      },
      {
        check: { kind: 'exists', selector: 'label[for="email"]', min: 1, max: 1 },
        label: 'The box keeps its label',
      },
    ],
    practicePoints: 20,
  },
];

export const LABS = [...DEBUGGING_LABS, ...WEB_LABS];
