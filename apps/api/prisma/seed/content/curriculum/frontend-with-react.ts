import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'frontend-with-react',
  title: 'Frontend Development with React',
  subject: 'javascript',
  level: 'intermediate',
  description:
    'Build modern single-page interfaces with React 19 function components and hooks: the JavaScript React relies on, components and JSX, props, state and events, forms, lists, effects and data fetching, routing, calling a REST API such as your own Spring Boot service, and building and deploying the app.',
  tags: ['react', 'javascript', 'jsx', 'hooks', 'frontend', 'rest-apis', 'spa'],
  modules: [
    {
      title: 'Modern JavaScript for React',
      summary:
        'The JavaScript features React code uses on every line: modules, destructuring, spread and rest, non-mutating array methods, optional chaining and promises.',
      lessons: [
        {
          kind: 'article',
          title: 'Modules: import and export',
          minutes: 12,
          topic: 'The language',
          html: `<p>A React app is not one big file. It is dozens or hundreds of small files — one per component, plus helpers, API calls and styles — that use one another. <strong>JavaScript modules</strong> are how those files share code. Almost every React file starts with <code>import</code> lines and ends with an <code>export</code>, so it pays to be fluent with both.</p>

<h2>Named exports</h2>
<pre><code class="language-javascript">// money.js
export const GST_RATE = 0.18;

export function withGst(amount) {
  return Math.round(amount * (1 + GST_RATE));
}

export function formatRupees(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}</code></pre>
<pre><code class="language-javascript">// checkout.js
import { withGst, formatRupees } from './money.js';

console.log(formatRupees(withGst(40000))); // ₹47,200.00</code></pre>
<p>A file can have any number of named exports. When importing, the names inside the braces must match the exported names exactly, and you can rename on the way in with <code>as</code>: <code>import { formatRupees as rupees } from './money.js';</code></p>

<h2>Default exports</h2>
<pre><code class="language-jsx">// CourseCard.jsx
export default function CourseCard({ course }) {
  return &lt;article className="course-card"&gt;{course.title}&lt;/article&gt;;
}</code></pre>
<pre><code class="language-jsx">// CourseList.jsx
import CourseCard from './CourseCard.jsx';</code></pre>
<p>A file has at most one default export, and the importing file chooses its name, without braces. React projects often use a default export for a file's main component. Some teams prefer named exports everywhere, because a component then has the same name in every file that uses it and editors can rename it safely. Either is fine; be consistent within a project.</p>

<h2>Where imports come from</h2>
<ul>
<li><code>'./money.js'</code> or <code>'../api/client.js'</code>: a relative path to one of your own files.</li>
<li><code>'react'</code> or <code>'react-dom/client'</code>: a package installed with npm into <code>node_modules</code>. The build tool knows where to find it.</li>
</ul>
<pre><code class="language-javascript">import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';</code></pre>
<p>With a build tool such as Vite you can usually leave out the extension of your own files (<code>'./CourseCard'</code>), and you can import CSS files and images too. In the browser without a build tool, paths must be complete and the entry file is loaded with <code>&lt;script type="module" src="main.js"&gt;&lt;/script&gt;</code>.</p>

<h2>What modules give you</h2>
<ul>
<li><strong>Private by default.</strong> Top-level variables in a module are not global. Only what you export is visible elsewhere, so two files can each have a helper called <code>format</code> without clashing.</li>
<li><strong>Run once.</strong> A module's top-level code runs the first time it is imported, and every importer shares that one instance. That is why an API client configured in <code>api.js</code> can be imported anywhere.</li>
<li><strong>Strict mode</strong> is always on, which turns several silent mistakes into errors.</li>
<li><strong>A static structure.</strong> Because imports are declared up front, build tools can see which code is never used and leave it out of the final bundle. This is called tree shaking.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Mixing up the two styles. <code>import CourseCard from ...</code> when the file has only a named export gives <code>undefined</code> or a build error, and React then complains that the element type is invalid.</li>
<li>Circular imports, where <code>a.js</code> imports <code>b.js</code> and <code>b.js</code> imports <code>a.js</code>. Move the shared code into a third file.</li>
<li>A path with the wrong letter case, such as <code>'./coursecard'</code>. It may work on Windows and fail on the Linux build server.</li>
</ul>

<details><summary>Check yourself: <code>App.jsx</code> contains <code>export default function App() {}</code>. Write the import for <code>main.jsx</code>.</summary><p><code>import App from './App.jsx';</code> — no braces, because it is the default export. You could give it a different name, but keeping the same name avoids confusion.</p></details>`,
          resources: [
            {
              title: 'MDN: JavaScript modules',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Destructuring, spread and rest',
          minutes: 14,
          topic: 'The language',
          html: `<p>Three short pieces of syntax appear in almost every React component: <strong>destructuring</strong> to unpack values, <strong>spread</strong> to copy them, and <strong>rest</strong> to gather whatever is left. Spread and rest even use the same three dots, so it is worth learning them properly once.</p>

<h2>Object destructuring</h2>
<pre><code class="language-javascript">const learner = { name: 'Divya', batch: 'JFS-2026-B1', city: 'Chennai', score: 88 };

const { name, batch } = learner;             // name = 'Divya', batch = 'JFS-2026-B1'
const { city: hometown } = learner;          // renamed: hometown = 'Chennai'
const { mentor = 'Not assigned' } = learner; // default for a missing property</code></pre>
<p>Destructuring in a function's parameter list is how React components read their props:</p>
<pre><code class="language-jsx">function ProfileCard({ name, batch, photoUrl = '/images/avatar.png' }) {
  return (
    &lt;article className="profile-card"&gt;
      &lt;img src={photoUrl} alt="" /&gt;
      &lt;h3&gt;{name}&lt;/h3&gt;
      &lt;p&gt;{batch}&lt;/p&gt;
    &lt;/article&gt;
  );
}</code></pre>
<p>(The photo has an empty <code>alt</code> because the name is printed right next to it; repeating it would only make a screen reader say it twice.)</p>

<h2>Array destructuring</h2>
<p>Arrays are unpacked by position, and you choose the variable names:</p>
<pre><code class="language-javascript">const [first, second] = ['Asha', 'Ravi', 'Meena']; // first = 'Asha', second = 'Ravi'
const [, , third] = ['Asha', 'Ravi', 'Meena'];     // skip with commas: third = 'Meena'

let a = 1;
let b = 2;
[a, b] = [b, a];                                   // swap: a = 2, b = 1</code></pre>
<p>This is exactly what <code>const [count, setCount] = useState(0)</code> does: <code>useState</code> returns a two-item array, and you name the two items.</p>

<h2>Spread: copying and combining</h2>
<pre><code class="language-javascript">const base = ['HTML', 'CSS'];
const frontEnd = [...base, 'JavaScript', 'React'];  // a new array

const course = { title: 'React', weeks: 6, fee: 18000 };
const discounted = { ...course, fee: 15000 };       // a copy with one field changed
// course is unchanged; discounted = { title: 'React', weeks: 6, fee: 15000 }

const highest = Math.max(...[72, 91, 64]);          // 91: spread into arguments</code></pre>
<p>Order matters in object spread: later properties win. <code>{ ...course, fee: 15000 }</code> overrides the fee; <code>{ fee: 15000, ...course }</code> does not.</p>
<p>This matters enormously in React. React decides whether something changed by checking whether state is a <em>new</em> object, so you never modify state in place — you make a changed copy with spread.</p>

<h2>Spread copies are shallow</h2>
<p>Spread copies only one level. Nested objects and arrays are shared between the original and the copy:</p>
<pre><code class="language-javascript">const profile = { name: 'Divya', skills: ['Java'] };
const copy = { ...profile };
copy.skills.push('React');
console.log(profile.skills); // ['Java', 'React'] — the same array!

const safe = { ...profile, skills: [...profile.skills, 'SQL'] }; // copy the nested array too</code></pre>

<h2>Rest: gathering what is left</h2>
<pre><code class="language-javascript">const { score, ...details } = learner;  // details = { name, batch, city }

function logScores(subject, ...scores) {
  console.log(subject, scores);          // scores is a real array
}
logScores('SQL', 70, 82, 91);            // SQL [70, 82, 91]</code></pre>
<p>Same three dots, opposite jobs: spread <em>expands</em> a value where several values are expected; rest <em>collects</em> several values into one variable where a variable is being declared.</p>

<h2>Common mistakes</h2>
<ul>
<li>Destructuring from <code>undefined</code>. <code>const { name } = undefined</code> throws a TypeError, so give a default — <code>function Card({ course } = {})</code> — or check first.</li>
<li>Assuming spread makes a deep copy, then changing a nested array and wondering why the original changed too.</li>
<li>Putting a rest element anywhere but last. <code>const [...others, last] = list</code> is a syntax error.</li>
</ul>`,
        },
        {
          kind: 'article',
          title: 'Array methods you will use in every component',
          minutes: 15,
          topic: 'The language',
          html: `<p>React components turn data into UI, and most data arrives as arrays: courses, learners, messages, notifications. Five array methods do most of the work, and React adds one strict rule — never change a state array in place. This lesson covers both.</p>

<h2>The workhorses</h2>
<pre><code class="language-javascript">const batches = [
  { id: 'b1', name: 'JFS Morning', seats: 30, enrolled: 30, mode: 'classroom' },
  { id: 'b2', name: 'JFS Evening', seats: 30, enrolled: 21, mode: 'online' },
  { id: 'b3', name: 'Python Weekend', seats: 25, enrolled: 12, mode: 'online' },
];

batches.map((b) =&gt; b.name);                     // ['JFS Morning', 'JFS Evening', 'Python Weekend']
batches.filter((b) =&gt; b.enrolled &lt; b.seats);     // the two batches with seats left
batches.find((b) =&gt; b.id === 'b2');              // the JFS Evening object
batches.some((b) =&gt; b.mode === 'online');        // true
batches.reduce((sum, b) =&gt; sum + b.enrolled, 0); // 63</code></pre>
<p>In React, <code>map</code> is how you render lists — each item becomes an element — and <code>filter</code> is how you show a subset, such as search results. You will write <code>items.map((item) =&gt; &lt;Row key={item.id} item={item} /&gt;)</code> hundreds of times.</p>

<h2>Mutating and non-mutating methods</h2>
<p>Some array methods change the array you call them on (they <strong>mutate</strong> it); others return a new array. For React state, you must use the second kind.</p>
<table>
<thead><tr><th scope="col">Instead of (mutates)</th><th scope="col">Use (returns a new array)</th></tr></thead>
<tbody>
<tr><td><code>list.push(item)</code></td><td><code>[...list, item]</code></td></tr>
<tr><td><code>list.splice(i, 1)</code></td><td><code>list.filter((x) =&gt; x.id !== id)</code> or <code>list.toSpliced(i, 1)</code></td></tr>
<tr><td><code>list[i] = newItem</code></td><td><code>list.with(i, newItem)</code> or <code>list.map(...)</code></td></tr>
<tr><td><code>list.sort(compare)</code></td><td><code>list.toSorted(compare)</code></td></tr>
<tr><td><code>list.reverse()</code></td><td><code>list.toReversed()</code></td></tr>
</tbody>
</table>
<p><code>toSorted</code>, <code>toReversed</code>, <code>toSpliced</code> and <code>with</code> arrived in ES2023 and work in all current browsers. Updating one item by its id is a <code>map</code>:</p>
<pre><code class="language-javascript">const afterEnrolment = batches.map((b) =&gt;
  b.id === 'b2' ? { ...b, enrolled: b.enrolled + 1 } : b,
);</code></pre>
<p>Every batch except b2 is the very same object as before; b2 is a fresh copy with one field changed. That is precisely the kind of update React expects.</p>

<h2>Optional chaining and nullish coalescing</h2>
<p>Data from an API is often incomplete. Two operators keep your rendering code from crashing on it:</p>
<pre><code class="language-javascript">const trainerName = course.trainer?.name ?? 'To be announced';
const firstTag = course.tags?.[0];
const count = response.items?.length ?? 0;</code></pre>
<p><code>?.</code> stops and gives <code>undefined</code> when the value on its left is <code>null</code> or <code>undefined</code>. <code>??</code> supplies a fallback only for <code>null</code> or <code>undefined</code>, so a genuine <code>0</code> or empty string is kept — unlike <code>||</code>.</p>

<h2>Grouping</h2>
<p><code>Object.groupBy</code> (added in ES2024, and available in all current major browsers and Node.js) groups items by a key that you compute:</p>
<pre><code class="language-javascript">const byMode = Object.groupBy(batches, (b) =&gt; b.mode);
// { classroom: [JFS Morning], online: [JFS Evening, Python Weekend] }</code></pre>
<p>Where it is not available, the same result takes a few lines of <code>reduce</code>.</p>

<h2>Common mistakes</h2>
<ul>
<li>Calling <code>sort()</code> on an array held in state. It changes the array in place, so React may not notice. Use <code>toSorted()</code>, or copy first: <code>[...list].sort(compare)</code>.</li>
<li>Using <code>forEach</code> when you need a result. It always returns <code>undefined</code>, so <code>{items.forEach(...)}</code> inside JSX renders nothing.</li>
<li>Leaving out the initial value of <code>reduce</code>. On an empty array, <code>reduce</code> without one throws a TypeError.</li>
</ul>`,
          resources: [
            {
              title: 'React: Updating arrays in state',
              url: 'https://react.dev/learn/updating-arrays-in-state',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Promises and async/await, revisited',
          minutes: 14,
          topic: 'Asynchronous code',
          html: `<p>You met <code>async</code> and <code>await</code> in the web development course. React apps lean on them for every API call, and they bring a few situations of their own: requests that finish after the user has left the screen, several requests at once, and errors that must reach the screen rather than the Console. This lesson revisits promises with those situations in mind.</p>

<h2>A quick recap</h2>
<p>A promise stands for a value that will be ready later. It is <em>pending</em>, then either <em>fulfilled</em> or <em>rejected</em>. Inside an <code>async</code> function, <code>await</code> waits for a promise and either gives you its value or throws its error:</p>
<pre><code class="language-javascript">export async function getCourses() {
  const response = await fetch('/api/courses');
  if (!response.ok) {
    throw new Error(\`Could not load courses (HTTP \${response.status})\`);
  }
  return response.json();
}</code></pre>
<p>Remember that an <code>async</code> function always returns a promise, even when you <code>return</code> a plain value. Whoever calls <code>getCourses()</code> must <code>await</code> it or use <code>.then()</code>.</p>

<h2>Running requests in parallel</h2>
<table>
<thead><tr><th scope="col">Helper</th><th scope="col">Settles when</th><th scope="col">Use it for</th></tr></thead>
<tbody>
<tr><td><code>Promise.all</code></td><td>All fulfil, or the first one rejects</td><td>Data you need all of, such as a course and its modules</td></tr>
<tr><td><code>Promise.allSettled</code></td><td>Every promise has settled, either way</td><td>Independent dashboard widgets, where one failure should not hide the rest</td></tr>
<tr><td><code>Promise.race</code></td><td>The first one settles</td><td>Racing a request against a timeout</td></tr>
<tr><td><code>Promise.any</code></td><td>The first one fulfils</td><td>Trying several mirrors and using whichever answers</td></tr>
</tbody>
</table>
<pre><code class="language-javascript">const results = await Promise.allSettled([getCourses(), getBatches(), getNotices()]);

for (const result of results) {
  if (result.status === 'fulfilled') console.log(result.value);
  else console.warn(result.reason.message);
}</code></pre>

<h2>Cancelling with AbortController</h2>
<p>A learner opens a course page, the request starts, and they click away before it finishes. The response still arrives, and code that then tries to update a screen that no longer exists is at best wasted work and at worst a bug. <code>AbortController</code> lets you cancel a <code>fetch</code>:</p>
<pre><code class="language-javascript">const controller = new AbortController();

fetch('/api/courses', { signal: controller.signal })
  .then((response) =&gt; response.json())
  .then((courses) =&gt; console.log(courses))
  .catch((error) =&gt; {
    if (error.name === 'AbortError') return;  // we cancelled it on purpose
    console.error(error);
  });

controller.abort();                           // for example, when the screen closes</code></pre>
<p>You will use exactly this in the cleanup function of a React effect in the data-fetching lesson. There is also <code>AbortSignal.timeout(5000)</code>, a signal that aborts by itself after five seconds — a neat way to give up on a slow server. (The error's name is then <code>TimeoutError</code>.)</p>

<h2>Errors belong on the screen</h2>
<p>In a script, logging an error to the Console may be enough. In an app, the user needs to know: "Could not load your courses. Try again." So functions that fetch data should <em>throw</em> meaningful errors, and the component that called them should <em>catch</em> them and keep the error in state so it can be rendered. You will build that pattern step by step later in this course.</p>

<h2>Common mistakes</h2>
<ul>
<li>Awaiting independent requests one by one inside a loop. Ten sequential requests take about ten times as long as one <code>Promise.all</code>.</li>
<li>Using <code>await</code> inside <code>forEach</code>. <code>forEach</code> does not wait for async callbacks; use <code>for...of</code> to go one at a time, or <code>Promise.all</code> with <code>map</code> to go all at once.</li>
<li>An empty <code>catch</code> block that swallows the error, so the screen simply stays blank.</li>
</ul>
<p><strong>Interview tip:</strong> be ready to explain the difference between <code>Promise.all</code> and <code>Promise.allSettled</code> with an example from a real screen.</p>`,
          resources: [
            {
              title: 'MDN: Using promises',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
            },
          ],
        },
        { kind: 'practice', question: 'js-map-vs-foreach', topic: 'Practice' },
        { kind: 'practice', question: 'js-const-object', topic: 'Practice' },
        { kind: 'practice', question: 'js-chunk-array', topic: 'Practice' },
        { kind: 'practice', question: 'js-event-loop-order', topic: 'Practice' },
      ],
    },
    {
      title: 'Components and JSX',
      summary:
        'Why React exists, how to start a project with Vite, and how to describe a user interface as small, pure components written in JSX.',
      lessons: [
        {
          kind: 'article',
          title: 'Why React? From manual DOM updates to declarative UI',
          minutes: 12,
          topic: 'Getting started',
          html: `<p>In the web development course you built a to-do list and a course catalogue in plain JavaScript. They worked, but notice how much of that code was about keeping the screen in step with the data: create an <code>li</code>, set its text, append it, empty the box, update the count. Add editing, deleting, filtering and a "done" checkbox, and the number of ways the screen and the data can disagree grows fast. React was built to solve exactly that problem.</p>

<h2>Imperative and declarative</h2>
<p>Plain DOM code is <strong>imperative</strong>: you give step-by-step instructions to change the page from what it is now into what it should be.</p>
<pre><code class="language-javascript">// Imperative: you change the page yourself
const item = document.createElement('li');
item.textContent = text;
list.append(item);
count.textContent = \`\${list.children.length} tasks\`;</code></pre>
<p>React is <strong>declarative</strong>: you describe what the page should look like <em>for the current data</em>, and React works out which DOM changes get it there.</p>
<pre><code class="language-jsx">// Declarative: you describe the result for the current data
function TaskList({ tasks }) {
  return (
    &lt;&gt;
      &lt;ul&gt;
        {tasks.map((task) =&gt; (
          &lt;li key={task.id}&gt;{task.text}&lt;/li&gt;
        ))}
      &lt;/ul&gt;
      &lt;p&gt;{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}&lt;/p&gt;
    &lt;/&gt;
  );
}</code></pre>
<p>When a task is added, you do not touch the list or the count. You update the <code>tasks</code> data; React calls <code>TaskList</code> again, compares the new description with the previous one, and applies only the differences to the real DOM. The usual way to say it: <strong>the UI is a function of the state</strong>.</p>

<h2>What React is, and what it is not</h2>
<ul>
<li>React is a <strong>library for building user interfaces out of components</strong>: reusable pieces such as <code>CourseCard</code>, <code>SearchBar</code> or <code>SignInForm</code>, each with its own markup, logic and data.</li>
<li>It is not a complete framework. Routing, data-fetching strategies and build tooling come from other tools, or from frameworks built on React such as Next.js and React Router.</li>
<li>It commonly runs in the browser as a <strong>single-page application</strong> (SPA): one HTML page is loaded once, and JavaScript renders every screen after that. It can also render on the server, which frameworks use for faster first loads and better search results.</li>
</ul>

<h2>Why companies use it</h2>
<ul>
<li><strong>Components scale.</strong> A team of twenty can work on one app because each component is a small, self-contained piece.</li>
<li><strong>Updates are predictable.</strong> When the screen is derived from state, a whole class of "the count did not update" bugs disappears.</li>
<li><strong>The ecosystem is huge</strong>, and the same skills carry over to React Native for mobile apps.</li>
</ul>
<p>React appears in a large share of front-end and full stack job descriptions, which is why it pairs naturally with the Java or Python back end you learn at SI Academy.</p>

<h2>Common misconceptions</h2>
<ul>
<li>"React replaces HTML, CSS and JavaScript." It does not. JSX produces HTML elements, you still style them with CSS, and every line of React is JavaScript. Weak fundamentals show up quickly in React code.</li>
<li>"React is faster than plain JavaScript because of the virtual DOM." Careful hand-written DOM code can be just as fast. React's real advantage is that your code stays simple and correct as the app grows, while remaining fast enough.</li>
</ul>
<p>Before moving on, do the warm-up lab in this module: finish a to-do list with plain DOM code. Keep it in mind — later you will build the same behaviour in React and see how much of the bookkeeping disappears.</p>`,
          resources: [{ title: 'React: Quick start', url: 'https://react.dev/learn' }],
        },
        {
          kind: 'article',
          title: 'Creating a React project with Vite',
          minutes: 12,
          topic: 'Getting started',
          html: `<p>React code is written in JSX and split into many modules, so it needs a <strong>build tool</strong> to turn your source files into plain JavaScript the browser can run, and a development server that updates the page as you edit. For learning React and for single-page apps, Vite is a popular and fast choice. For larger production apps, React's own documentation also recommends full frameworks such as Next.js or React Router; they build on exactly the skills you learn here.</p>

<h2>Create the project</h2>
<p>First install a current LTS version of Node.js, which includes npm. Then, in a terminal:</p>
<pre><code class="language-text">npm create vite@latest course-catalogue -- --template react
cd course-catalogue
npm install
npm run dev</code></pre>
<p>Open the <code>http://localhost:5173</code> address it prints. Edit a file and save it, and the page updates straight away, usually without losing what is on screen.</p>

<h2>A tour of the files</h2>
<pre><code class="language-text">course-catalogue/
  index.html        the single HTML page
  package.json      dependencies and scripts
  vite.config.js    build tool settings
  public/           files copied as they are (favicon, robots.txt)
  src/
    main.jsx        the entry point
    App.jsx         the root component
    App.css
    index.css
    assets/</code></pre>
<p><code>index.html</code> has an almost empty body: a <code>&lt;div id="root"&gt;&lt;/div&gt;</code> and a module script that loads <code>src/main.jsx</code>. Everything you see on screen is rendered into that div by React.</p>

<h2>The entry point</h2>
<pre><code class="language-jsx">// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  &lt;StrictMode&gt;
    &lt;App /&gt;
  &lt;/StrictMode&gt;,
);</code></pre>
<ul>
<li><code>createRoot</code> connects React to a DOM element, and <code>render</code> draws your root component into it.</li>
<li><code>StrictMode</code> adds extra checks during development only. One visible result: it deliberately runs your components and effects twice, to expose bugs early. It does nothing in a production build.</li>
<li>Importing a CSS file applies it to the page; the build tool takes care of the rest.</li>
</ul>

<h2>Your first component</h2>
<p>Replace the contents of <code>src/App.jsx</code> with:</p>
<pre><code class="language-jsx">export default function App() {
  const institute = 'SI Academy';
  return (
    &lt;main&gt;
      &lt;h1&gt;{institute} course catalogue&lt;/h1&gt;
      &lt;p&gt;Find the right course for your next role.&lt;/p&gt;
    &lt;/main&gt;
  );
}</code></pre>
<p>A component is a JavaScript function whose name starts with a capital letter and which returns JSX. That is all there is to it.</p>

<h2>The npm scripts you will use</h2>
<table>
<thead><tr><th scope="col">Command</th><th scope="col">What it does</th></tr></thead>
<tbody>
<tr><td><code>npm run dev</code></td><td>Starts the development server with instant updates</td></tr>
<tr><td><code>npm run build</code></td><td>Creates an optimised production build in <code>dist/</code></td></tr>
<tr><td><code>npm run preview</code></td><td>Serves the production build locally so you can check it</td></tr>
<tr><td><code>npm run lint</code></td><td>Runs ESLint to catch mistakes, including React-specific ones</td></tr>
</tbody>
</table>

<h2>Install the React Developer Tools</h2>
<p>Add the React Developer Tools extension to Chrome, Edge or Firefox. It adds Components and Profiler tabs to the developer tools, where you can select any component and see its props and state live — the React equivalent of the Elements panel.</p>

<h2>Common mistakes</h2>
<ul>
<li>Committing <code>node_modules</code> to Git. <code>npm install</code> rebuilds it from <code>package.json</code>, and the project's <code>.gitignore</code> already excludes it.</li>
<li>Opening <code>index.html</code> straight from the file system. It will not work; use <code>npm run dev</code> while developing.</li>
<li>Naming a component in lower case, as in <code>function app()</code>. JSX treats lower-case tags as HTML elements, so <code>&lt;app /&gt;</code> renders an unknown HTML tag instead of your component.</li>
</ul>`,
        },
        {
          kind: 'article',
          title: 'JSX: markup inside JavaScript',
          minutes: 14,
          topic: 'Components',
          html: `<p>JSX is the HTML-like syntax inside React components. It looks like HTML, but it is really a convenient way of writing JavaScript: the build tool turns every JSX tag into a function call that creates a description of an element. Keep that in mind and every one of JSX's rules makes sense.</p>

<h2>JavaScript inside curly braces</h2>
<pre><code class="language-jsx">function CourseHeader({ course }) {
  const seatsLeft = course.seats - course.enrolled;
  return (
    &lt;header className="course-header"&gt;
      &lt;h2&gt;{course.title}&lt;/h2&gt;
      &lt;p&gt;{course.weeks} weeks · ₹{course.fee.toLocaleString('en-IN')}&lt;/p&gt;
      &lt;p&gt;{seatsLeft &gt; 0 ? \`\${seatsLeft} seats left\` : 'Batch full'}&lt;/p&gt;
    &lt;/header&gt;
  );
}</code></pre>
<p>Inside <code>{ }</code> you can put any JavaScript <strong>expression</strong>: a variable, a calculation, a function call, a ternary. You cannot put <strong>statements</strong> such as <code>if</code>, <code>for</code> or variable declarations there; do that work above the <code>return</code>.</p>

<h2>The rules, and why they exist</h2>
<ol>
<li><strong>Return one root element.</strong> A function returns one value, so wrap siblings in a parent element, or in a Fragment <code>&lt;&gt;...&lt;/&gt;</code> when you do not want an extra element in the DOM.</li>
<li><strong>Close every tag.</strong> Void elements need a slash: <code>&lt;img /&gt;</code>, <code>&lt;input /&gt;</code>, <code>&lt;br /&gt;</code>.</li>
<li><strong>Attributes use JavaScript's camelCase names.</strong> <code>class</code> is a reserved word in JavaScript, so it becomes <code>className</code>; <code>for</code> on labels becomes <code>htmlFor</code>; <code>onclick</code> becomes <code>onClick</code> and <code>tabindex</code> becomes <code>tabIndex</code>. <code>aria-*</code> and <code>data-*</code> attributes keep their dashes.</li>
<li><strong>Strings in quotes, everything else in braces.</strong> <code>alt="Trainer photo"</code>, but <code>src={trainer.photoUrl}</code> and <code>maxLength={50}</code>.</li>
<li><strong>Inline styles are objects.</strong> <code>style={{ marginTop: 8, color: 'crimson' }}</code>: the outer braces mean "JavaScript here", the inner ones are the object, and the property names are camelCase. Prefer CSS classes for anything beyond an occasional dynamic value.</li>
</ol>
<pre><code class="language-jsx">&lt;&gt;
  &lt;label htmlFor="email"&gt;Email&lt;/label&gt;
  &lt;input id="email" type="email" className="field" aria-describedby="email-help" /&gt;
  &lt;p id="email-help"&gt;We will send your batch details here.&lt;/p&gt;
&lt;/&gt;</code></pre>

<h2>Conditional rendering</h2>
<pre><code class="language-jsx">function CourseBadges({ course }) {
  if (course.archived) {
    return null;                          // render nothing at all
  }
  return (
    &lt;div className="badges"&gt;
      {course.isNew &amp;&amp; &lt;span className="badge"&gt;New&lt;/span&gt;}
      {course.online ? &lt;span&gt;Online&lt;/span&gt; : &lt;span&gt;Classroom&lt;/span&gt;}
    &lt;/div&gt;
  );
}</code></pre>
<ul>
<li>An <code>if</code> with an early <code>return</code> suits decisions about the whole component; returning <code>null</code> renders nothing.</li>
<li><code>condition &amp;&amp; &lt;Element /&gt;</code> renders the element only when the condition is true.</li>
<li><code>condition ? &lt;A /&gt; : &lt;B /&gt;</code> chooses between two.</li>
</ul>
<p>Watch out with <code>&amp;&amp;</code> and numbers. <code>{messages.length &amp;&amp; &lt;Badge /&gt;}</code> renders a stray <strong>0</strong> when the list is empty, because React renders the number 0 (it skips only <code>null</code>, <code>undefined</code>, <code>true</code> and <code>false</code>). Write <code>{messages.length &gt; 0 &amp;&amp; &lt;Badge /&gt;}</code> instead.</p>

<h2>JSX is safe by default</h2>
<p>Text you put in braces is always escaped. If a learner's name contains <code>&lt;script&gt;</code>, React shows those characters as text instead of running them — the same protection <code>textContent</code> gave you in plain JavaScript. The escape hatch, <code>dangerouslySetInnerHTML</code>, has that name on purpose: use it only with HTML that has been sanitised.</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing <code>class=</code> or <code>for=</code>. React warns in the Console; the fix is <code>className</code> and <code>htmlFor</code>.</li>
<li>Returning two sibling elements without a wrapper or Fragment, which is a syntax error.</li>
<li>Putting an <code>if</code> statement inside the braces. Use a ternary or <code>&amp;&amp;</code>, or move the logic above the <code>return</code>.</li>
<li>HTML comments in JSX. Comments inside JSX are JavaScript comments wrapped in braces: <code>{/* note */}</code>.</li>
</ul>`,
          resources: [
            {
              title: 'React: Writing markup with JSX',
              url: 'https://react.dev/learn/writing-markup-with-jsx',
            },
            {
              title: 'React: Conditional rendering',
              url: 'https://react.dev/learn/conditional-rendering',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Thinking in components',
          minutes: 12,
          topic: 'Components',
          html: `<p>The hardest part of React is not the syntax; it is deciding where one component ends and the next begins. Good boundaries make an app easy to change, and poor ones produce 600-line files nobody wants to touch. This lesson walks through splitting a real screen.</p>

<h2>Start from the screen</h2>
<p>Picture the SI Academy catalogue page: a search box and a "show online only" checkbox at the top, and below them a grid of course cards, each with a title, duration, fee, trainer and an enquiry link. Draw boxes around the pieces on paper and name them:</p>
<pre><code class="language-text">CatalogPage
  CourseFilters     the search box and the checkbox
  CourseGrid        the grid, or a "no courses" message
    CourseCard      one course, with its enquiry link
      TrainerChip   the trainer's photo and name</code></pre>
<p>A useful test is the <strong>single responsibility</strong> principle: each component should do one thing. If you need the word "and" several times to describe a component, split it.</p>

<h2>Composing components</h2>
<pre><code class="language-jsx">// CourseCard.jsx
import TrainerChip from './TrainerChip.jsx';

export default function CourseCard({ course }) {
  return (
    &lt;article className="course-card"&gt;
      &lt;h3&gt;{course.title}&lt;/h3&gt;
      &lt;p&gt;{course.weeks} weeks · ₹{course.fee.toLocaleString('en-IN')}&lt;/p&gt;
      &lt;TrainerChip trainer={course.trainer} /&gt;
      &lt;a href={\`/courses/\${course.slug}#enquire\`}&gt;Enquire about {course.title}&lt;/a&gt;
    &lt;/article&gt;
  );
}

// CourseGrid.jsx
import CourseCard from './CourseCard.jsx';

export default function CourseGrid({ courses }) {
  if (courses.length === 0) {
    return &lt;p&gt;No courses match your filters.&lt;/p&gt;;
  }
  return (
    &lt;div className="course-grid"&gt;
      {courses.map((course) =&gt; (
        &lt;CourseCard key={course.slug} course={course} /&gt;
      ))}
    &lt;/div&gt;
  );
}</code></pre>
<p>Components use other components just like HTML elements, with a capital letter: <code>&lt;CourseCard /&gt;</code>. Data flows down through <strong>props</strong>, which the next module covers in depth.</p>

<h2>Components must be pure</h2>
<p>React expects a component to behave like a mathematical function of its props and state: <strong>the same inputs always give the same JSX</strong>, and rendering changes nothing outside the component. In practice:</p>
<ul>
<li>Do not modify props, or variables that existed before the component ran.</li>
<li>Do not fetch data, start timers or write to <code>localStorage</code> in the body of a component. Those are <em>side effects</em>; they belong in event handlers or effects, which come later.</li>
<li>Do calculate freely. Filtering, sorting copies and formatting dates and money are all fine during rendering.</li>
</ul>
<p>Purity is why Strict Mode renders components twice in development: an impure component behaves differently the second time, so the bug shows up early.</p>

<h2>Wrapping content with children</h2>
<p>Some components are containers — a card, a panel, a dialog — and should not care what goes inside them. They receive their nested JSX as the special <code>children</code> prop:</p>
<pre><code class="language-jsx">function Panel({ title, children }) {
  return (
    &lt;section className="panel"&gt;
      &lt;h2&gt;{title}&lt;/h2&gt;
      {children}
    &lt;/section&gt;
  );
}

&lt;Panel title="Upcoming batches"&gt;
  &lt;p&gt;Java Full Stack — the morning batch starts on 3 November.&lt;/p&gt;
&lt;/Panel&gt;</code></pre>

<h2>Practical conventions</h2>
<ul>
<li>One main component per file, with the file named after it: <code>CourseCard.jsx</code>.</li>
<li>As the app grows, group files by feature — <code>src/courses/</code>, <code>src/auth/</code> — rather than one huge <code>components/</code> folder.</li>
<li>Define components at the top level of a module, never inside another component. A component defined inside another is recreated on every render, and React throws away its state each time.</li>
</ul>
<p><strong>Interview tip:</strong> when asked how you would build a screen in React, sketch the component tree first and say which component owns which data. Interviewers care more about that reasoning than about syntax.</p>`,
          resources: [
            { title: 'React: Thinking in React', url: 'https://react.dev/learn/thinking-in-react' },
            {
              title: 'React: Keeping components pure',
              url: 'https://react.dev/learn/keeping-components-pure',
            },
          ],
        },
        {
          kind: 'lab',
          lab: 'web-todo-list',
          title: 'Warm-up: finish a to-do list without React',
          topic: 'Practice',
        },
      ],
    },
    {
      title: 'Props, state and events',
      summary:
        'Pass data into components with props, give components memory with state, and respond to clicks, typing and form submissions with controlled inputs.',
      lessons: [
        {
          kind: 'article',
          title: 'Props: passing data into a component',
          minutes: 12,
          topic: 'Props and state',
          html: `<p>Props (short for properties) are how a parent component passes data to a child, in the same way attributes pass information to an HTML element. They turn a component from a fixed piece of UI into a reusable template: one <code>ProfileCard</code> component can show every learner in a batch.</p>

<h2>Passing and reading props</h2>
<pre><code class="language-jsx">function ProfileCard({ name, role, photoUrl, skills = [] }) {
  return (
    &lt;article className="profile-card"&gt;
      &lt;img src={photoUrl} alt="" /&gt;
      &lt;h3&gt;{name}&lt;/h3&gt;
      &lt;p className="role"&gt;{role}&lt;/p&gt;
      &lt;p&gt;Skills: {skills.length &gt; 0 ? skills.join(', ') : 'not added yet'}&lt;/p&gt;
    &lt;/article&gt;
  );
}

function BatchPage() {
  return (
    &lt;&gt;
      &lt;ProfileCard name="Asha Raman" role="Java trainee" photoUrl="/img/asha.jpg" skills={['Java', 'SQL']} /&gt;
      &lt;ProfileCard name="Imran Khan" role="Python trainee" photoUrl="/img/imran.jpg" /&gt;
    &lt;/&gt;
  );
}</code></pre>
<p>React collects all the attributes into one object, the <strong>props object</strong>, and passes it as the component's first argument. Destructuring it in the parameter list, as above, is the usual style. A default value such as <code>skills = []</code> applies when the parent leaves that prop out.</p>

<h2>Any value can be a prop</h2>
<ul>
<li>Strings: <code>role="Java trainee"</code></li>
<li>Numbers and booleans, in braces: <code>score={86}</code>, <code>verified={true}</code> (or simply <code>verified</code>)</li>
<li>Arrays and objects: <code>skills={['Java', 'SQL']}</code>, <code>course={course}</code></li>
<li>Functions: <code>onEnquire={handleEnquire}</code>, which is how a child tells its parent that something happened</li>
<li>JSX: <code>icon={&lt;StarIcon /&gt;}</code>, or nested content passed as <code>children</code></li>
</ul>
<p>To pass every property of an object as separate props, spread it: <code>&lt;ProfileCard {...learner} /&gt;</code>. Use this sparingly; explicit props are easier to follow.</p>

<h2>Props are read-only</h2>
<p>A component must never change its own props. <code>props.name = 'Someone else'</code> breaks React's model: the parent owns that data, and the next render would overwrite your change anyway. When something must change over time — a counter, the text in a search box, whether a panel is open — that is <strong>state</strong>, the subject of the next lesson.</p>

<h2>Data flows down, events flow up</h2>
<p>Props travel from parent to child only. When a child needs to affect its parent — say, the Enquire button on a card should open a form that belongs to the page — the parent passes a function down, and the child calls it:</p>
<pre><code class="language-jsx">function CourseCard({ course, onEnquire }) {
  return (
    &lt;article&gt;
      &lt;h3&gt;{course.title}&lt;/h3&gt;
      &lt;button type="button" onClick={() =&gt; onEnquire(course)}&gt;Enquire&lt;/button&gt;
    &lt;/article&gt;
  );
}

function CatalogPage({ courses }) {
  function handleEnquire(course) {
    console.log('Open the enquiry form for', course.title);
  }
  return courses.map((c) =&gt; &lt;CourseCard key={c.slug} course={c} onEnquire={handleEnquire} /&gt;);
}</code></pre>
<p>By convention, props that receive event callbacks are named <code>onSomething</code>, and the functions that handle them <code>handleSomething</code>.</p>

<h2>Common mistakes</h2>
<ul>
<li>Passing a number as a string. <code>score="86"</code> gives the string <code>'86'</code>, so <code>score + 4</code> becomes <code>'864'</code>. Write <code>score={86}</code>.</li>
<li>Spelling a prop differently in the parent and the child. The child simply receives <code>undefined</code>, with no error. The React Developer Tools show exactly which props arrived.</li>
<li>Copying a prop into state "so it can change", then wondering why the child ignores later updates from the parent. Usually you should read the prop directly.</li>
</ul>`,
          resources: [
            {
              title: 'React: Passing props to a component',
              url: 'https://react.dev/learn/passing-props-to-a-component',
            },
          ],
        },
        {
          kind: 'article',
          title: 'State: giving a component memory with useState',
          minutes: 15,
          topic: 'Props and state',
          html: `<p>Props come from outside. But many components must remember something of their own: whether a dropdown is open, what the learner has typed, which tab is selected, how many seats are left. That memory is <strong>state</strong>, and in function components you create it with the <code>useState</code> hook.</p>

<h2>Why an ordinary variable does not work</h2>
<pre><code class="language-jsx">function SeatCounter() {
  let seats = 30;              // back to 30 on every render
  function book() {
    seats = seats - 1;         // changes the variable...
  }
  // ...but nothing tells React to render again
  return &lt;button type="button" onClick={book}&gt;Seats left: {seats}&lt;/button&gt;;
}</code></pre>
<p>Two things are wrong. Changing a local variable does not make React render again, and even if it did, the function would start from <code>let seats = 30</code> each time. State solves both: React keeps the value between renders, and renders again when you change it.</p>

<h2>useState</h2>
<pre><code class="language-jsx">import { useState } from 'react';

export default function SeatCounter() {
  const [seats, setSeats] = useState(30);

  function book() {
    if (seats &gt; 0) setSeats(seats - 1);
  }

  return (
    &lt;button type="button" onClick={book} disabled={seats === 0}&gt;
      {seats &gt; 0 ? \`Book a seat (\${seats} left)\` : 'Batch full'}
    &lt;/button&gt;
  );
}</code></pre>
<ul>
<li><code>useState(30)</code> creates a piece of state whose initial value is 30. The initial value is used only on the first render.</li>
<li>It returns a pair: the current value and a <strong>setter</strong> function. Name them <code>[something, setSomething]</code>.</li>
<li>Calling the setter stores the new value and asks React to render the component again. On that render, <code>seats</code> holds the new value.</li>
</ul>
<p>Hooks — functions whose names start with <code>use</code> — come with two rules: call them only at the top level of a component (never inside conditions, loops or nested functions), and only from components or other hooks. React tells your pieces of state apart by the order of the hook calls, so that order must be the same on every render.</p>

<h2>State is a snapshot</h2>
<p>Within one render, a state variable never changes. Calling the setter schedules a <em>new</em> render; it does not change the variable you are holding:</p>
<pre><code class="language-jsx">function bookThree() {
  setSeats(seats - 1);
  setSeats(seats - 1);
  setSeats(seats - 1);
  // seats was 30 throughout this function, so the result is 29, not 27
}</code></pre>
<p>When the new value depends on the previous one, pass an <strong>updater function</strong>. React calls it with the latest value, one update after another:</p>
<pre><code class="language-jsx">function bookThree() {
  setSeats((s) =&gt; s - 1);
  setSeats((s) =&gt; s - 1);
  setSeats((s) =&gt; s - 1);   // 27
}</code></pre>

<h2>Objects and arrays: replace, never mutate</h2>
<pre><code class="language-jsx">const [profile, setProfile] = useState({ name: 'Asha', city: 'Madurai' });
const [skills, setSkills] = useState(['Java']);

// Wrong: changes the existing object, so React sees the same object
profile.city = 'Chennai';

// Right: a new object with one field changed
setProfile({ ...profile, city: 'Chennai' });

// Right: new arrays to add, remove and update
setSkills([...skills, 'React']);
setSkills(skills.filter((s) =&gt; s !== 'Java'));
setSkills(skills.map((s) =&gt; (s === 'Java' ? 'Java 21' : s)));</code></pre>

<h2>How much state, and where?</h2>
<ul>
<li><strong>Keep state minimal.</strong> If a value can be calculated from props or other state — a filtered list, a total, a "form is complete" flag — calculate it during rendering instead of storing it. Duplicated state drifts out of sync.</li>
<li><strong>Put state in the closest common parent</strong> of the components that need it. If both a filter box and a course grid need the search text, the page that contains them should own it and pass it down. This is called <strong>lifting state up</strong>.</li>
<li><strong>Each instance has its own state.</strong> Two <code>SeatCounter</code>s on one page count separately.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Reading state straight after setting it and expecting the new value. You get this render's snapshot.</li>
<li>Mutating an object or array in state and then passing the same object to the setter.</li>
<li>Calling a hook inside an <code>if</code>. Call the hook unconditionally and put the condition inside your logic instead.</li>
</ul>`,
          resources: [
            {
              title: "React: State, a component's memory",
              url: 'https://react.dev/learn/state-a-components-memory',
            },
            {
              title: 'React: Updating objects in state',
              url: 'https://react.dev/learn/updating-objects-in-state',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Handling events',
          minutes: 12,
          topic: 'Events and forms',
          html: `<p>Event handling in React will feel familiar after <code>addEventListener</code>, with a few differences in spelling and one big difference in style: handlers are attached in the JSX, right next to the element they belong to.</p>

<h2>Attaching a handler</h2>
<pre><code class="language-jsx">function SyllabusToggle({ topics }) {
  const [open, setOpen] = useState(false);

  function handleClick() {
    setOpen(!open);
  }

  return (
    &lt;section&gt;
      &lt;button type="button" onClick={handleClick} aria-expanded={open}&gt;
        {open ? 'Hide syllabus' : 'Show syllabus'}
      &lt;/button&gt;
      {open &amp;&amp; (
        &lt;ol&gt;
          {topics.map((topic) =&gt; &lt;li key={topic}&gt;{topic}&lt;/li&gt;)}
        &lt;/ol&gt;
      )}
    &lt;/section&gt;
  );
}</code></pre>
<ul>
<li>Event props are camelCase: <code>onClick</code>, <code>onChange</code>, <code>onSubmit</code>, <code>onKeyDown</code>, <code>onFocus</code>, <code>onBlur</code>.</li>
<li>Pass the function, do not call it: <code>onClick={handleClick}</code>, not <code>onClick={handleClick()}</code>. The second form runs during rendering, and if it sets state you get an endless loop of renders.</li>
<li>To pass an argument, wrap the call in an arrow function: <code>onClick={() =&gt; removeTask(task.id)}</code>.</li>
</ul>

<h2>The event object</h2>
<p>Handlers receive an event object with the familiar members — <code>target</code>, <code>key</code>, <code>preventDefault()</code>, <code>stopPropagation()</code> — so most of what you already know carries over:</p>
<pre><code class="language-jsx">function SearchBox({ query, onQueryChange }) {
  function handleKeyDown(event) {
    if (event.key === 'Escape') onQueryChange('');
  }
  return (
    &lt;input
      type="search"
      aria-label="Search courses"
      value={query}
      onChange={(event) =&gt; onQueryChange(event.target.value)}
      onKeyDown={handleKeyDown}
    /&gt;
  );
}</code></pre>
<p>One React-specific detail: <code>onChange</code> on a text input fires on <em>every keystroke</em>, like the DOM's <code>input</code> event, not only when the field loses focus.</p>

<h2>Handlers are the place for side effects</h2>
<p>Unlike rendering, event handlers may do side effects: send a request, write to <code>localStorage</code>, navigate, set state. They run because the user did something, not because React rendered.</p>
<pre><code class="language-jsx">async function handleEnrol() {
  setStatus('saving');
  try {
    await enrol(course.id);
    setStatus('done');
  } catch {
    setStatus('error');
  }
}</code></pre>

<h2>Passing handlers down</h2>
<p>Most interesting events start in a small component deep in the tree but must change state that belongs higher up. The owner passes a function down, and the child calls it:</p>
<pre><code class="language-jsx">function TaskItem({ task, onToggle, onDelete }) {
  return (
    &lt;li&gt;
      &lt;label&gt;
        &lt;input type="checkbox" checked={task.done} onChange={() =&gt; onToggle(task.id)} /&gt;
        {task.text}
      &lt;/label&gt;
      &lt;button type="button" onClick={() =&gt; onDelete(task.id)} aria-label={\`Delete \${task.text}\`}&gt;
        ✕
      &lt;/button&gt;
    &lt;/li&gt;
  );
}

function TaskBoard({ initialTasks }) {
  const [tasks, setTasks] = useState(initialTasks);

  function handleToggle(id) {
    setTasks((all) =&gt; all.map((t) =&gt; (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function handleDelete(id) {
    setTasks((all) =&gt; all.filter((t) =&gt; t.id !== id));
  }

  return (
    &lt;ul&gt;
      {tasks.map((task) =&gt; (
        &lt;TaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} /&gt;
      ))}
    &lt;/ul&gt;
  );
}</code></pre>
<p>Compare this with the plain-JavaScript to-do list from the warm-up lab: no code finds list items, creates elements or updates a count. Each handler changes the data, and the list re-renders itself. (Adding new tasks needs a form, which is the next lesson.)</p>

<h2>Common mistakes</h2>
<ul>
<li><code>onClick={handleDelete(task.id)}</code>: it runs during render, deleting every task at once or looping forever. Wrap it: <code>onClick={() =&gt; handleDelete(task.id)}</code>.</li>
<li>Putting <code>onClick</code> on a <code>&lt;div&gt;</code> instead of using a <code>&lt;button&gt;</code>. The accessibility rules do not change because you are using React.</li>
<li>Forgetting that a <code>&lt;button&gt;</code> inside a form submits it. Add <code>type="button"</code> to buttons that should not.</li>
</ul>`,
          resources: [
            {
              title: 'React: Responding to events',
              url: 'https://react.dev/learn/responding-to-events',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Forms in React: controlled inputs',
          minutes: 15,
          topic: 'Events and forms',
          html: `<p>Forms are where React's "the UI is a function of the state" idea is most useful — and where beginners most often get stuck. The standard pattern is the <strong>controlled input</strong>: React state holds the field's value, and the field always shows that state.</p>

<h2>A controlled input</h2>
<pre><code class="language-jsx">function NameField() {
  const [name, setName] = useState('');
  return (
    &lt;&gt;
      &lt;label htmlFor="name"&gt;Full name&lt;/label&gt;
      &lt;input id="name" value={name} onChange={(e) =&gt; setName(e.target.value)} /&gt;
      &lt;p&gt;Hello, {name || 'there'}!&lt;/p&gt;
    &lt;/&gt;
  );
}</code></pre>
<p>Each keystroke fires <code>onChange</code>; the handler stores the new text in state; React renders again; the input shows the state. The loop sounds slow but is instant in practice, and it means the current value is always available in a variable — for live validation, for enabling the submit button, for a preview.</p>
<p>If you give an input a <code>value</code> but no <code>onChange</code>, React warns that the field is read-only, because typing could never change it. Use <code>defaultValue</code> when you only want an initial value and do not need to control the field.</p>

<h2>A complete enquiry form</h2>
<pre><code class="language-jsx">const EMPTY = { name: '', email: '', course: 'java', message: '' };

export default function EnquiryForm({ onSubmitted }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  function update(event) {
    const { name, value } = event.target;
    setForm((f) =&gt; ({ ...f, [name]: value }));
  }

  function validate(values) {
    const found = {};
    if (!values.name.trim()) found.name = 'Enter your name';
    if (!values.email.includes('@')) found.email = 'Enter a valid email address';
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length &gt; 0) return;

    setSending(true);
    try {
      await sendEnquiry(form);              // your API call
      setForm(EMPTY);
      onSubmitted();
    } catch {
      setErrors({ form: 'Could not send your enquiry. Please try again.' });
    } finally {
      setSending(false);
    }
  }

  return (
    &lt;form onSubmit={handleSubmit} noValidate&gt;
      &lt;label htmlFor="name"&gt;Full name&lt;/label&gt;
      &lt;input id="name" name="name" value={form.name} onChange={update}
             aria-invalid={Boolean(errors.name)} aria-describedby="name-error" /&gt;
      &lt;p id="name-error" role="alert"&gt;{errors.name}&lt;/p&gt;

      &lt;label htmlFor="email"&gt;Email&lt;/label&gt;
      &lt;input id="email" name="email" type="email" value={form.email} onChange={update}
             aria-invalid={Boolean(errors.email)} aria-describedby="email-error" /&gt;
      &lt;p id="email-error" role="alert"&gt;{errors.email}&lt;/p&gt;

      &lt;label htmlFor="course"&gt;Course&lt;/label&gt;
      &lt;select id="course" name="course" value={form.course} onChange={update}&gt;
        &lt;option value="java"&gt;Java Full Stack&lt;/option&gt;
        &lt;option value="python"&gt;Python Full Stack&lt;/option&gt;
      &lt;/select&gt;

      &lt;label htmlFor="message"&gt;Message&lt;/label&gt;
      &lt;textarea id="message" name="message" value={form.message} onChange={update} /&gt;

      {errors.form &amp;&amp; &lt;p role="alert"&gt;{errors.form}&lt;/p&gt;}
      &lt;button type="submit" disabled={sending}&gt;{sending ? 'Sending…' : 'Send enquiry'}&lt;/button&gt;
    &lt;/form&gt;
  );
}</code></pre>

<h2>What to notice</h2>
<ul>
<li><strong>One state object, one handler.</strong> Each field's <code>name</code> matches a key in the state, and <code>[name]: value</code> (a computed property name) updates the right key. Adding a field means one new key and one new input.</li>
<li><strong><code>onSubmit</code> on the form</strong>, with <code>event.preventDefault()</code>, handles both the button and the <kbd>Enter</kbd> key — just as in plain JavaScript.</li>
<li><strong>Errors are state too</strong>, rendered next to their fields and linked to them with <code>aria-describedby</code>.</li>
<li><strong>The button is disabled while sending</strong>, so an impatient double click cannot send two enquiries.</li>
<li><code>&lt;select&gt;</code> and <code>&lt;textarea&gt;</code> are controlled with <code>value</code> too; checkboxes use <code>checked</code> and <code>event.target.checked</code>.</li>
</ul>

<h2>Forms in React 19</h2>
<p>React 19 also lets you pass a function to a form's <code>action</code> prop. React calls it with the form's <code>FormData</code> when the form is submitted, and hooks such as <code>useActionState</code> and <code>useFormStatus</code> track the pending state and the result. Frameworks use this to send forms to server code. The controlled pattern above remains the everyday tool, and the one interviewers expect you to explain; read about actions in the React documentation once you are comfortable with it.</p>

<h2>Common mistakes</h2>
<ul>
<li><code>value={form.name}</code> where <code>form.name</code> starts as <code>undefined</code> and later becomes a string. React warns that an input switched from uncontrolled to controlled. Initialise every field, as <code>EMPTY</code> does.</li>
<li>Leaving out the <code>name</code> attributes, so the shared <code>update</code> handler writes to a key called <code>""</code>.</li>
<li>Treating this validation as security. It is a convenience for the user; the API must validate everything again.</li>
</ul>`,
          resources: [
            {
              title: 'React: Reacting to input with state',
              url: 'https://react.dev/learn/reacting-to-input-with-state',
            },
          ],
        },
        { kind: 'practice', question: 'js-closure-counter', topic: 'Practice' },
        { kind: 'practice', question: 'js-title-case', topic: 'Practice' },
      ],
    },
    {
      title: 'Lists, effects and data fetching',
      summary:
        'Render lists with stable keys, keep components in sync with the outside world using effects, load data with loading and error states, and reuse that logic in custom hooks.',
      lessons: [
        {
          kind: 'article',
          title: 'Rendering lists and choosing keys',
          minutes: 12,
          topic: 'Lists',
          html: `<p>Lists are everywhere in a learning platform: courses, modules, lessons, learners, results. In React you render a list by turning an array of data into an array of elements with <code>map</code>, and you give each element a <strong>key</strong> so React can keep track of it.</p>

<h2>From data to elements</h2>
<pre><code class="language-jsx">const modules = [
  { id: 'm1', title: 'Core Java', weeks: 8 },
  { id: 'm2', title: 'SQL', weeks: 3 },
  { id: 'm3', title: 'Spring Boot', weeks: 6 },
];

function ModuleList({ modules }) {
  return (
    &lt;ol className="module-list"&gt;
      {modules.map((m) =&gt; (
        &lt;li key={m.id}&gt;
          {m.title} — {m.weeks} weeks
        &lt;/li&gt;
      ))}
    &lt;/ol&gt;
  );
}</code></pre>
<p>Filtering and sorting happen on the data, before the <code>map</code>:</p>
<pre><code class="language-jsx">const visible = modules
  .filter((m) =&gt; m.title.toLowerCase().includes(query.toLowerCase()))
  .toSorted((a, b) =&gt; a.title.localeCompare(b.title));</code></pre>
<p>Because <code>visible</code> is calculated during rendering from state (<code>query</code>) and props (<code>modules</code>), there is nothing to keep in sync. Do not store it in its own state.</p>

<h2>What keys are for</h2>
<p>When a list renders again, React compares the new elements with the previous ones, and keys tell it which is which: "the item with key m2 is still here, m4 is new, m1 has gone". With good keys, React moves, inserts and removes DOM nodes correctly, and each item keeps its own state — the text typed into its input, or whether it is expanded.</p>
<p>A good key is:</p>
<ul>
<li><strong>Unique among its siblings</strong> — within this list, not across the whole app.</li>
<li><strong>Stable</strong> — the same item gets the same key on every render.</li>
<li><strong>Taken from the data</strong> — a database id, a slug, an email address. If items are created in the browser and have no id, generate one when the item is created, for example with <code>crypto.randomUUID()</code>, and store it with the item.</li>
</ul>

<h2>Why the array index is a poor key</h2>
<p><code>key={index}</code> silences the warning, but it breaks as soon as the list is reordered, filtered or has items inserted at the top. Imagine a list of learners, each row with a box for the trainer's remark, keyed by index. Delete the first learner and every remaining row moves up one index. React believes row 0 is still row 0 and keeps its state — so the remark you typed for Asha now sits next to Ravi. Index keys are acceptable only for lists that never change order and whose items hold no state.</p>
<p>Never generate keys during rendering, as in <code>key={Math.random()}</code>. Every render then produces new keys, so React destroys and recreates every item each time, losing their state and focus.</p>

<h2>The key goes on the element returned by map</h2>
<pre><code class="language-jsx">{courses.map((course) =&gt; (
  &lt;CourseCard key={course.slug} course={course} /&gt;
))}</code></pre>
<p>The key belongs on <code>&lt;CourseCard&gt;</code> here, not on an element inside <code>CourseCard</code>. React does not pass the key to your component as a prop; if the component needs the id, pass it separately. To return several elements per item without a wrapper, use the long form of a Fragment, which accepts a key: <code>&lt;Fragment key={item.id}&gt;...&lt;/Fragment&gt;</code>.</p>

<h2>Empty lists need a message</h2>
<pre><code class="language-jsx">if (modules.length === 0) {
  return &lt;p&gt;No modules have been added to this course yet.&lt;/p&gt;;
}</code></pre>
<p>An empty array renders nothing at all, so always decide what the user should see instead.</p>

<h2>Common mistakes</h2>
<ul>
<li>The Console warning "Each child in a list should have a unique key prop" means the element returned from <code>map</code> has no key.</li>
<li>Duplicate keys, such as using a course title when two batches share the same title.</li>
<li>Sorting a prop or state array with <code>sort()</code>, which mutates it. Use <code>toSorted()</code>.</li>
</ul>`,
          resources: [
            { title: 'React: Rendering lists', url: 'https://react.dev/learn/rendering-lists' },
          ],
        },
        {
          kind: 'article',
          title: 'Effects: synchronising with the outside world',
          minutes: 15,
          topic: 'Effects',
          html: `<p>Rendering must be pure: it calculates JSX from props and state and touches nothing else. But real components do need to reach outside React — start a timer, update the browser tab's title, fetch data, listen to the window being resized. When such work should happen <em>because the component is on the screen</em>, rather than because the user clicked something, it goes in an <strong>effect</strong>.</p>

<h2>useEffect</h2>
<pre><code class="language-jsx">import { useEffect } from 'react';

function CourseTitle({ course }) {
  useEffect(() =&gt; {
    document.title = \`\${course.title} | SI Academy\`;
  }, [course.title]);

  return &lt;h1&gt;{course.title}&lt;/h1&gt;;
}</code></pre>
<p>React runs the effect function <em>after</em> the component has rendered and the screen has been updated. The second argument, the <strong>dependency array</strong>, lists every value from the component that the effect uses, and React re-runs the effect only when one of them has changed since the last render.</p>
<table>
<thead><tr><th scope="col">Dependencies</th><th scope="col">The effect runs</th></tr></thead>
<tbody>
<tr><td><code>[course.title]</code></td><td>After the first render, and again whenever the title changes</td></tr>
<tr><td><code>[]</code></td><td>Only after the first render, when the component appears</td></tr>
<tr><td>No array at all</td><td>After every render — rarely what you want</td></tr>
</tbody>
</table>
<p>Never leave a dependency out just to make an effect run less often; the ESLint rule <code>react-hooks/exhaustive-deps</code> catches this. If an effect runs too often, change the code so that it needs fewer dependencies.</p>

<h2>Cleaning up</h2>
<p>Many effects start something that must be stopped. Return a <strong>cleanup function</strong>, and React calls it before running the effect again and when the component leaves the screen:</p>
<pre><code class="language-jsx">function ExamTimer({ endsAt }) {
  const [now, setNow] = useState(() =&gt; Date.now());

  useEffect(() =&gt; {
    const id = setInterval(() =&gt; setNow(Date.now()), 1000);
    return () =&gt; clearInterval(id);   // stop the timer
  }, []);

  const secondsLeft = Math.max(0, Math.round((endsAt - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  return &lt;p role="timer"&gt;Time left: {minutes}:{seconds}&lt;/p&gt;;
}</code></pre>
<p>Without the cleanup, every time the timer appeared it would start another interval that never stopped — a leak that also keeps calling <code>setNow</code> for a component that no longer exists.</p>

<h2>Why does my effect run twice?</h2>
<p>In development, Strict Mode mounts each component, unmounts it and mounts it again, so you see an effect run, clean up, and run once more. This is deliberate: it exposes effects with missing cleanup. If the double run causes a visible problem, the effect needs a cleanup. Production builds run it once.</p>

<h2>You might not need an effect</h2>
<p>Effects are for synchronising with <em>external</em> systems. Three common misuses:</p>
<ul>
<li><strong>Calculating a value from props or state.</strong> Do not keep <code>filteredCourses</code> in state and update it in an effect whenever <code>query</code> changes. Calculate it during rendering: <code>const filtered = courses.filter(...)</code>.</li>
<li><strong>Responding to a user action.</strong> If something should happen because the learner clicked "Enrol", do it in the click handler, not in an effect that watches a <code>clicked</code> flag.</li>
<li><strong>Resetting state when a prop changes.</strong> Give the component a key instead. <code>&lt;Profile key={learnerId} learnerId={learnerId} /&gt;</code> starts a fresh instance whenever the id changes.</li>
</ul>
<p>Fewer effects means fewer extra renders and fewer bugs. For every effect, ask: "which external system is this keeping in sync?" If there is no good answer, it probably should not be an effect.</p>

<h2>Common mistakes</h2>
<ul>
<li>Setting state in an effect that depends on that same state, which loops forever.</li>
<li>Making the effect function itself <code>async</code>. An effect must return nothing or a cleanup function, not a promise. Define an async function inside the effect and call it, as the next lesson shows.</li>
<li>Forgetting to clean up intervals, subscriptions and listeners added to <code>window</code>.</li>
</ul>`,
          resources: [
            {
              title: 'React: Synchronizing with effects',
              url: 'https://react.dev/learn/synchronizing-with-effects',
            },
            {
              title: 'React: You might not need an effect',
              url: 'https://react.dev/learn/you-might-not-need-an-effect',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Fetching data: loading, error and success',
          minutes: 16,
          topic: 'Data fetching',
          html: `<p>Almost every screen in a real app shows data from a server. Loading it well means handling four situations: the request is still in progress, it succeeded with data, it succeeded with nothing, or it failed. This lesson builds a course list that handles all four — and the subtle problem of responses arriving in the wrong order.</p>

<h2>The basic pattern</h2>
<pre><code class="language-jsx">import { useEffect, useState } from 'react';

export default function CourseList({ category }) {
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'

  useEffect(() =&gt; {
    const controller = new AbortController();

    async function load() {
      setStatus('loading');
      try {
        const params = new URLSearchParams({ category });
        const response = await fetch(\`/api/courses?\${params}\`, { signal: controller.signal });
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        setCourses(await response.json());
        setStatus('success');
      } catch (error) {
        if (error.name === 'AbortError') return;   // we cancelled it: ignore
        console.error(error);
        setStatus('error');
      }
    }

    load();
    return () =&gt; controller.abort();
  }, [category]);

  if (status === 'loading') return &lt;p role="status"&gt;Loading courses…&lt;/p&gt;;
  if (status === 'error') return &lt;p role="alert"&gt;Could not load courses. Please try again.&lt;/p&gt;;
  if (courses.length === 0) return &lt;p&gt;No courses in this category yet.&lt;/p&gt;;

  return (
    &lt;ul&gt;
      {courses.map((c) =&gt; (
        &lt;li key={c.slug}&gt;{c.title}&lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}</code></pre>

<h2>Walking through it</h2>
<ul>
<li>The effect depends on <code>category</code>, so it fetches when the component appears and again whenever the category changes.</li>
<li>The effect function itself is not <code>async</code>. It defines <code>load</code> and calls it, so it can still return a cleanup function.</li>
<li><code>URLSearchParams</code> builds the query string and encodes it safely, so a category such as "C &amp; C++" cannot break the URL.</li>
<li>One <code>status</code> value instead of separate <code>isLoading</code> and <code>isError</code> booleans means impossible combinations — loading <em>and</em> failed — cannot happen.</li>
<li>Every outcome renders something meaningful, and the messages use <code>role="status"</code> and <code>role="alert"</code> so screen readers announce them.</li>
</ul>

<h2>Race conditions, and why the cleanup matters</h2>
<p>Suppose a learner clicks "Java" and then quickly "Python". Two requests are now in flight. If the Java response is slower and arrives last, a naive version shows Java courses under the Python heading. The cleanup prevents that: when <code>category</code> changes, React runs the previous effect's cleanup, which aborts the Java request before the Python one starts. The aborted request rejects with an <code>AbortError</code>, which the code deliberately ignores. The same cleanup also stops a late response from updating a component that has already left the screen.</p>

<h2>Keep requests out of components</h2>
<p>Put URLs and response handling in a small API module:</p>
<pre><code class="language-javascript">// src/api/courses.js
export async function fetchCourses(category, { signal } = {}) {
  const params = new URLSearchParams({ category });
  const response = await fetch(\`/api/courses?\${params}\`, { signal });
  if (!response.ok) throw new Error(\`Could not load courses (HTTP \${response.status})\`);
  return response.json();
}</code></pre>
<p>The component then calls <code>fetchCourses(category, { signal: controller.signal })</code>, and when the API changes you edit one file.</p>

<h2>In real projects</h2>
<p>Hand-written effects are the right way to learn data fetching, and fine for small apps. Larger apps usually use a data-fetching library such as TanStack Query, or the data loading built into a framework, because they add caching, retries, background refreshes and de-duplication of identical requests. Underneath, they handle the same four states you just wrote by hand — which is why interviewers still ask you to write this version.</p>

<h2>Common mistakes</h2>
<ul>
<li>Leaving out the dependency array, so the effect fetches, sets state, renders, and fetches again — forever.</li>
<li>Starting with <code>status</code> as anything but loading, so the user briefly sees "No courses" before the data arrives.</li>
<li>Skipping the <code>response.ok</code> check, then trying to render the server's error object as if it were a list of courses.</li>
</ul>`,
          resources: [
            {
              title: 'MDN: AbortController',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Custom hooks: reusing stateful logic',
          minutes: 12,
          topic: 'Data fetching',
          html: `<p>Once you have written the loading, error and success pattern for courses, you will need it again for batches, results and notices. Copying the effect into every component would work, but React offers something better: a <strong>custom hook</strong>, a function that packages hooks and logic so that many components can share them.</p>

<h2>Writing a custom hook</h2>
<pre><code class="language-javascript">// src/hooks/useFetchJson.js
import { useEffect, useState } from 'react';

export function useFetchJson(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() =&gt; {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then((response) =&gt; {
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        return response.json();
      })
      .then((json) =&gt; {
        setData(json);
        setLoading(false);
      })
      .catch((err) =&gt; {
        if (err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      });

    return () =&gt; controller.abort();
  }, [url]);

  return { data, error, loading };
}</code></pre>

<h2>Using it</h2>
<pre><code class="language-jsx">function BatchList({ courseSlug }) {
  const { data: batches, error, loading } = useFetchJson(\`/api/courses/\${courseSlug}/batches\`);

  if (loading) return &lt;p role="status"&gt;Loading batches…&lt;/p&gt;;
  if (error) return &lt;p role="alert"&gt;Could not load batches.&lt;/p&gt;;
  return (
    &lt;ul&gt;
      {batches.map((b) =&gt; (
        &lt;li key={b.id}&gt;
          {b.name} — starts {b.startDate}
        &lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}</code></pre>
<p>The component now reads like a description of the screen, and all the fetching mechanics live in one place that you test once.</p>

<h2>The rules of custom hooks</h2>
<ul>
<li><strong>The name starts with <code>use</code>.</strong> That tells React and the linter that the function calls hooks, so the rules of hooks are checked inside it.</li>
<li><strong>Hooks share logic, not state.</strong> Two components that call <code>useFetchJson</code> each get their own independent state, exactly as if each had written the code inline. To share the same data between components, lift the state up to a common parent.</li>
<li><strong>Call them unconditionally</strong>, at the top level of a component or of another hook — the same rule as for built-in hooks.</li>
</ul>

<h2>Another hook worth having</h2>
<pre><code class="language-javascript">export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() =&gt; {
    const saved = localStorage.getItem(key);
    return saved === null ? initialValue : JSON.parse(saved);
  });

  useEffect(() =&gt; {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

// In a component: remembers the learner's chosen layout across visits
const [view, setView] = useLocalStorage('catalogue-view', 'grid');</code></pre>
<p>Notice the function passed to <code>useState</code>. It is a <strong>lazy initialiser</strong>: React calls it only on the first render, so the component does not read <code>localStorage</code> on every render.</p>

<h2>Common mistakes</h2>
<ul>
<li>Naming a hook without the <code>use</code> prefix, so the linter cannot protect you.</li>
<li>Extracting too early. Write the logic inline first, and extract a hook when a second or third component needs it.</li>
<li>Passing an object or array created during rendering as a dependency. It is a new object every time, so the effect re-runs on every render. Prefer strings and numbers as dependencies, as <code>useFetchJson</code> does with its URL.</li>
</ul>`,
          resources: [
            {
              title: 'React: Reusing logic with custom hooks',
              url: 'https://react.dev/learn/reusing-logic-with-custom-hooks',
            },
          ],
        },
        { kind: 'practice', question: 'js-fetch-await', topic: 'Practice' },
        { kind: 'practice', question: 'js-json-number-sum', topic: 'Practice' },
      ],
    },
    {
      title: 'Routing and REST APIs',
      summary:
        'Give a single-page app several screens with client-side routing, and connect it to a REST API such as the Spring Boot service you build, safely and reliably.',
      lessons: [
        {
          kind: 'article',
          title: 'Client-side routing: the idea behind every router',
          minutes: 12,
          topic: 'Routing',
          html: `<p>A single-page application loads one HTML page, yet users expect it to behave like a website with many pages: each screen has its own address, the Back button works, and a link to <code>/courses/java-full-stack</code> can be bookmarked or shared on WhatsApp. <strong>Client-side routing</strong> makes that happen without reloading the page.</p>

<h2>Server routing and client routing</h2>
<p>On a traditional website, clicking a link sends a request to the server, which returns a whole new HTML page. In an SPA, the router intercepts the click, changes the URL in the address bar with the browser's History API, and renders a different component. There is no request for a new page, so the change is instant and the app keeps its state.</p>

<h2>The moving parts</h2>
<ol>
<li><strong>A route table</strong> maps URL patterns to components: <code>/</code> to the home page, <code>/courses</code> to the catalogue, <code>/courses/:slug</code> to one course's details.</li>
<li><strong>Route parameters</strong> are the variable parts of a pattern. For <code>/courses/java-full-stack</code>, the parameter <code>slug</code> is <code>java-full-stack</code>, and the details screen uses it to fetch the right course.</li>
<li><strong>Navigation</strong> uses the History API. <code>history.pushState</code> changes the URL without a reload, and the <code>popstate</code> event fires when the user presses Back or Forward.</li>
<li><strong>A fallback route</strong> shows a "page not found" screen for unknown addresses.</li>
</ol>

<h2>A tiny router, to see how it works</h2>
<p>Real projects use a routing library, but writing a minimal router once makes those libraries far less mysterious:</p>
<pre><code class="language-jsx">import { useEffect, useState } from 'react';

function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() =&gt; {
    const onPop = () =&gt; setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () =&gt; window.removeEventListener('popstate', onPop);
  }, []);
  function navigate(to) {
    window.history.pushState({}, '', to);
    setPath(to);
  }
  return [path, navigate];
}

function Link({ to, navigate, children }) {
  function handleClick(event) {
    // Let the browser handle Ctrl-click, Shift-click and middle-click (new tabs and windows)
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  }
  return &lt;a href={to} onClick={handleClick}&gt;{children}&lt;/a&gt;;
}

export default function App() {
  const [path, navigate] = usePath();
  const courseMatch = path.match(/^[/]courses[/]([a-z0-9-]+)$/);

  let page;
  if (path === '/') page = &lt;HomePage /&gt;;
  else if (path === '/courses') page = &lt;CatalogPage /&gt;;
  else if (courseMatch) page = &lt;CourseDetails slug={courseMatch[1]} /&gt;;
  else page = &lt;NotFound /&gt;;

  return (
    &lt;&gt;
      &lt;nav aria-label="Main"&gt;
        &lt;Link to="/" navigate={navigate}&gt;Home&lt;/Link&gt;
        &lt;Link to="/courses" navigate={navigate}&gt;Courses&lt;/Link&gt;
      &lt;/nav&gt;
      &lt;main&gt;{page}&lt;/main&gt;
    &lt;/&gt;
  );
}</code></pre>
<p>Notice that the links are still real <code>&lt;a href&gt;</code> elements. They work with the keyboard, show their address on hover, can be opened in a new tab, and still work if the JavaScript fails. Never build navigation out of buttons or clickable divs.</p>

<h2>Routing libraries</h2>
<p>Libraries such as React Router, and the routers built into frameworks such as Next.js, do the same job with many extras: nested layouts, a hook that hands you the route parameters, redirects, loading data before a screen renders, and scroll restoration. The concepts above — a route table, parameters, links, history and a fallback — map directly onto their APIs, so learn a library's syntax when a project needs it.</p>

<h2>One server setting you must not forget</h2>
<p>If a learner opens <code>/courses/java-full-stack</code> directly, or refreshes on that screen, the browser asks the <em>server</em> for that path. There is no such file, so a plain static server answers 404. The hosting must be configured to return <code>index.html</code> for unknown paths, so the app loads and the router takes over. You will set this up in the deployment module.</p>

<h2>Common mistakes</h2>
<ul>
<li>Plain <code>&lt;a href&gt;</code> links inside the app without the router's link handling, causing a full page reload that throws away the app's state.</li>
<li>Forgetting focus after navigation. Move focus to the new screen's main heading, so screen reader users know the screen has changed.</li>
<li>Changing the URL but not the document title.</li>
</ul>`,
          resources: [
            {
              title: 'MDN: History API',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/History_API',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Calling a REST API from React',
          minutes: 15,
          topic: 'REST APIs',
          html: `<p>Your React app is the front end; the data lives behind a REST API — for SI Academy learners, often the Spring Boot service you build in the Java programme. This lesson connects the two: where the API's address comes from, how to read and send JSON, how to turn HTTP status codes into messages people understand, and how to handle CORS while developing.</p>

<h2>A small API client</h2>
<p>Put every request in one module, so components never deal with URLs, headers or status codes directly:</p>
<pre><code class="language-javascript">// src/api/client.js
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? \`Request failed with status \${status}\`);
    this.status = status;
    this.body = body;
  }
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(\`\${BASE_URL}\${path}\`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',   // send the session cookie, if the API uses one
  });

  if (response.status === 204) return null;   // success, nothing to read
  const data = await response.json().catch(() =&gt; null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const getCourses = (signal) =&gt; request('/api/courses', { signal });
export const createEnquiry = (enquiry) =&gt; request('/api/enquiries', { method: 'POST', body: enquiry });</code></pre>
<p><code>import.meta.env.VITE_API_URL</code> is how Vite exposes configuration: in development it might be <code>http://localhost:8080</code>, and in production the real API address. The deployment module covers environment variables in detail.</p>

<h2>Mapping status codes to the screen</h2>
<table>
<thead><tr><th scope="col">Status</th><th scope="col">Meaning</th><th scope="col">What the UI does</th></tr></thead>
<tbody>
<tr><td>200 OK</td><td>Here is the data</td><td>Render it</td></tr>
<tr><td>201 Created</td><td>The resource was created</td><td>Confirm it; the body often holds the new resource</td></tr>
<tr><td>204 No Content</td><td>Done, nothing to return</td><td>Update the screen, for example remove the deleted row</td></tr>
<tr><td>400 / 422</td><td>The data was invalid</td><td>Show the server's messages next to the fields</td></tr>
<tr><td>401 Unauthorized</td><td>Not signed in, or the session expired</td><td>Send the user to the sign-in screen</td></tr>
<tr><td>403 Forbidden</td><td>Signed in, but not allowed</td><td>Explain that they do not have access</td></tr>
<tr><td>404 Not Found</td><td>No such resource</td><td>Show a "not found" screen</td></tr>
<tr><td>409 Conflict</td><td>Clashes with existing data</td><td>"This email is already registered"</td></tr>
<tr><td>500 and above</td><td>The server failed</td><td>A friendly "something went wrong, please try again"</td></tr>
</tbody>
</table>
<p>A Spring Boot API typically reports validation problems as a JSON body listing each field and its message. Agree on that shape with the back-end developer — in your own projects, that is you — so the form can show "Email is already registered" beside the email field instead of a generic error.</p>

<h2>Using the client from a form</h2>
<pre><code class="language-jsx">async function handleSubmit(event) {
  event.preventDefault();
  try {
    await createEnquiry(form);
    setMessage('Thank you! Our admissions team will call you within one working day.');
  } catch (error) {
    if (error instanceof ApiError &amp;&amp; (error.status === 400 || error.status === 422)) {
      setErrors(error.body?.errors ?? {});
    } else {
      setMessage('Could not send your enquiry. Please try again.');
    }
  }
}</code></pre>

<h2>CORS while developing</h2>
<p>Your React dev server runs on one origin (say <code>http://localhost:5173</code>) and the Spring Boot API on another (<code>http://localhost:8080</code>). Browsers stop JavaScript from reading responses from a different origin unless the server allows it with CORS headers. You have two options:</p>
<ul>
<li><strong>Allow the front end's origin on the server.</strong> Configure CORS in Spring Boot to allow <code>http://localhost:5173</code> in development and your real front-end address in production. Never allow every origin on an API that relies on cookies.</li>
<li><strong>Use the dev server's proxy.</strong> Vite can forward <code>/api</code> requests to <code>http://localhost:8080</code>, so the browser sees a single origin and CORS never comes up during development.</li>
</ul>
<pre><code class="language-javascript">// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8080' },
  },
});</code></pre>
<p>A CORS error appears in the Console and the request shows as failed in the Network tab, even though the server may have processed it. CORS is enforced by the browser to protect users. It is not a bug in your React code, and it is fixed on the server (or avoided with the proxy).</p>

<h2>Common mistakes</h2>
<ul>
<li>Hard-coding <code>http://localhost:8080</code> in components, so the production build tries to call the learner's own laptop.</li>
<li>Calling <code>response.json()</code> on a 204 response or an HTML error page, which throws a confusing parse error.</li>
<li>Showing raw server messages or stack traces to users.</li>
</ul>`,
        },
        {
          kind: 'article',
          title: 'Signing in, tokens and keeping secrets out of the browser',
          minutes: 14,
          topic: 'REST APIs',
          html: `<p>Most real apps have screens that only signed-in users may see. Authentication itself is the back end's job, but the front end has to cooperate: send credentials correctly, react when a session expires and, above all, never hold secrets it cannot protect. This lesson covers the ideas every front-end developer must get right.</p>

<h2>Everything in the bundle is public</h2>
<p>Every line of your React app is downloaded to the user's browser, where anyone can read it in the developer tools. So the front end must never contain secrets: no database passwords, no payment gateway secret keys, no AI service API keys. A variable such as <code>VITE_API_URL</code> is fine, because an address is not a secret. When a feature needs a secret, the browser calls <em>your</em> back end, and the back end uses the secret.</p>

<h2>Sessions and tokens, in brief</h2>
<p>After the user signs in, the server must recognise their later requests. Two common approaches:</p>
<ul>
<li><strong>A session cookie.</strong> The server sets a cookie marked <code>HttpOnly</code> and <code>Secure</code>. The browser sends it automatically with each request to that API (across origins, with <code>credentials: 'include'</code>), and JavaScript cannot read it, so a malicious script cannot steal it either.</li>
<li><strong>A bearer token</strong>, such as a JWT, sent in an <code>Authorization: Bearer ...</code> header. The front end has to store it somewhere. Holding it only in memory is safest; <code>localStorage</code> survives a reload but can be read by any script that manages to run on your page, which turns an XSS bug into a stolen account.</li>
</ul>
<p>Which one your API uses is a back-end design decision. As a front-end developer you follow it — and you should understand the trade-off well enough to explain it in an interview.</p>

<h2>Handling 401 in one place</h2>
<pre><code class="language-javascript">// In src/api/client.js, inside request(), before throwing the ApiError
if (response.status === 401) {
  window.dispatchEvent(new Event('session-expired'));
}</code></pre>
<pre><code class="language-jsx">// In App.jsx
useEffect(() =&gt; {
  const onExpired = () =&gt; navigate('/sign-in?expired=1');
  window.addEventListener('session-expired', onExpired);
  return () =&gt; window.removeEventListener('session-expired', onExpired);
}, [navigate]);</code></pre>
<p>Now any request that discovers an expired session sends the user to the sign-in screen with a helpful message, instead of every component handling 401 on its own. A 403 is different: the user is signed in but not allowed, so show an explanation rather than a sign-in form.</p>

<h2>Hiding a button is not security</h2>
<p>Hiding the "Delete batch" button from learners is good UX. But anyone can call the API directly from the developer tools or with a tool like curl. The server must check permissions on <strong>every</strong> request; the front end only decides what is convenient to show.</p>

<h2>Guarding a screen</h2>
<pre><code class="language-jsx">function RequireSignIn({ user, children }) {
  if (user === undefined) return &lt;p role="status"&gt;Checking your session…&lt;/p&gt;;
  if (user === null) return &lt;SignInPrompt /&gt;;
  return children;
}

&lt;RequireSignIn user={user}&gt;
  &lt;MyCourses /&gt;
&lt;/RequireSignIn&gt;</code></pre>
<p>Here <code>undefined</code> means "we have not heard from the server yet" and <code>null</code> means "we asked, and nobody is signed in". Telling the two apart avoids flashing the sign-in screen at a user who is, in fact, signed in.</p>

<h2>Other front-end security habits</h2>
<ul>
<li>Let React escape text, and avoid <code>dangerouslySetInnerHTML</code> unless the HTML has been sanitised.</li>
<li>Check URLs that come from data before using them in <code>href</code>: a <code>javascript:</code> URL runs code when clicked.</li>
<li>Keep dependencies up to date and run <code>npm audit</code>; your app ships every package's code to users.</li>
<li>Never log tokens or personal data to the Console in production.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Putting a secret in a <code>VITE_</code> variable "because it is in the .env file". Anything with that prefix is copied into the public bundle.</li>
<li>Pasting real credentials, tokens or learner data into an AI assistant or a public forum while debugging.</li>
<li>Assuming that a route which is hidden from the menu is protected.</li>
</ul>`,
        },
        { kind: 'practice', question: 'rest-status-created', topic: 'Practice' },
        { kind: 'practice', question: 'rest-400-vs-422', topic: 'Practice' },
      ],
    },
    {
      title: 'Building and deploying',
      summary:
        'Prepare a React app for production: what the build produces, configuration for each environment, deploying a single-page app behind a CDN, and the checks to run before you ship.',
      lessons: [
        {
          kind: 'article',
          title: 'What npm run build produces',
          minutes: 12,
          topic: 'Building',
          html: `<p>The development server is built for speed of editing: it serves your files almost untouched and updates the page as you type. Users need something different — the smallest, fastest files possible. <code>npm run build</code> produces them.</p>

<h2>What the build does</h2>
<ol>
<li><strong>Transforms</strong> JSX (and TypeScript, if you use it) into plain JavaScript that browsers understand.</li>
<li><strong>Bundles</strong> hundreds of modules, including packages from <code>node_modules</code>, into a few files, so the browser makes fewer requests.</li>
<li><strong>Removes unused code</strong> (tree shaking) and development-only checks. React's production build is smaller and faster than its development build, and has no Strict Mode double renders.</li>
<li><strong>Minifies</strong> the code: removes whitespace and comments and shortens variable names.</li>
<li><strong>Adds content hashes to file names</strong>, such as <code>index-4f9a2c1b.js</code>. The hash changes only when the file's contents change.</li>
</ol>

<h2>The output</h2>
<pre><code class="language-text">dist/
  index.html
  favicon.svg
  assets/
    index-4f9a2c1b.js
    index-b81e07d3.css
    logo-9c2e4a10.svg</code></pre>
<p>That folder is your whole front end: static files that any web server or CDN can serve. A plain single-page app has no Node.js process running in production. Check the build locally with <code>npm run preview</code> before deploying; it serves <code>dist/</code> the way a real server would, and catches problems the dev server hides.</p>

<h2>Why the hashes matter: caching</h2>
<p>Because a file's name changes whenever its contents change, the hosting can tell browsers to keep everything in <code>assets/</code> for a year. Returning visitors download nothing new until you deploy a change, and then only the files that changed. <code>index.html</code> is the exception: it must <em>not</em> be cached for long, because it is the file that points to the latest hashed assets.</p>

<h2>Keeping the bundle small</h2>
<p>Every kilobyte of JavaScript has to be downloaded, parsed and run, and on a budget phone over a mobile connection that is noticeable. Habits that help:</p>
<ul>
<li>Check what a package weighs before you <code>npm install</code> it. Do you need a whole date library to format one date when <code>Intl.DateTimeFormat</code> is built in?</li>
<li>Split rarely used screens into their own chunk with <code>lazy</code>, so they load only when someone visits them:</li>
</ul>
<pre><code class="language-jsx">import { lazy, Suspense } from 'react';

const AdminReports = lazy(() =&gt; import('./admin/AdminReports.jsx'));

function ReportsScreen() {
  return (
    &lt;Suspense fallback={&lt;p role="status"&gt;Loading reports…&lt;/p&gt;}&gt;
      &lt;AdminReports /&gt;
    &lt;/Suspense&gt;
  );
}</code></pre>
<ul>
<li>Optimise images: serve modern formats such as WebP or AVIF, at the size they are displayed.</li>
<li>Run Lighthouse on the preview build with mobile settings, and fix its biggest suggestions first.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Deploying the <code>src</code> folder, or the dev server, instead of <code>dist/</code>.</li>
<li>Testing only with <code>npm run dev</code>, then discovering after deployment that a wrongly cased import path or a missing environment variable breaks the build.</li>
<li>Committing <code>dist/</code> to Git. It is generated from the source; build it in your pipeline instead.</li>
</ul>`,
          resources: [
            { title: 'React reference: lazy', url: 'https://react.dev/reference/react/lazy' },
          ],
        },
        {
          kind: 'article',
          title: 'Environment variables and configuration',
          minutes: 10,
          topic: 'Building',
          html: `<p>The same app runs in several places: on your laptop, on a test (staging) server and in production. Each needs different settings — above all, a different API address. Hard-coding them means editing code before every deployment, which sooner or later ships the wrong address. Environment variables keep those settings outside the code.</p>

<h2>How Vite handles them</h2>
<pre><code class="language-text"># .env.development (used by npm run dev)
VITE_API_URL=http://localhost:8080
VITE_SUPPORT_EMAIL=support@siacademy.example

# .env.production (used by npm run build)
VITE_API_URL=https://api.siacademy.example</code></pre>
<pre><code class="language-javascript">const apiUrl = import.meta.env.VITE_API_URL;
const isProduction = import.meta.env.PROD;  // true in a production build
const mode = import.meta.env.MODE;          // 'development' or 'production'</code></pre>
<ul>
<li>Only variables whose names start with <code>VITE_</code> reach your code. This is a safety net, so that other variables on your machine — database passwords, cloud keys — are not included by accident.</li>
<li>Values are <strong>replaced at build time</strong>. The built JavaScript contains the literal text <code>https://api.siacademy.example</code>, so changing a variable means building again.</li>
<li>Every value is a string. <code>VITE_FEATURE_CHAT=false</code> gives the string <code>'false'</code>, which is truthy, so compare explicitly: <code>import.meta.env.VITE_FEATURE_CHAT === 'true'</code>.</li>
</ul>

<h2>Build-time configuration is public</h2>
<p>Because the values are written into the bundle, anyone can read them. That is fine for an API address, a support email or a feature flag. It is <strong>never</strong> fine for a secret. If you find yourself creating <code>VITE_PAYMENT_SECRET</code> or <code>VITE_AI_API_KEY</code>, stop: that call must go through your back end, which keeps the secret in its own environment variables on the server.</p>

<h2>What goes into Git</h2>
<ul>
<li>Commit a <code>.env.example</code> that lists every variable with a safe placeholder value, so a new teammate knows what to set.</li>
<li>Keep machine-specific values in <code>.env.local</code>, which Vite also reads, and keep that file out of Git.</li>
<li>In CI and on the hosting platform, set the variables in the platform's settings, not in a committed file.</li>
</ul>

<h2>Fail loudly when something is missing</h2>
<pre><code class="language-javascript">// src/config.js
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl === undefined) {
  throw new Error('VITE_API_URL is not set. Copy .env.example to .env.local and fill it in.');
}
export const config = { apiUrl };</code></pre>
<p>A clear error while developing beats a production app that quietly calls <code>undefined/api/courses</code>. (An empty value is allowed here on purpose: with the dev server's proxy, an empty base URL sends requests to <code>/api</code> on the same origin.)</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting the <code>VITE_</code> prefix, so the variable is <code>undefined</code> in the app.</li>
<li>Changing a variable on the hosting platform and expecting the live site to change without a new build.</li>
<li>Reading <code>process.env</code> in browser code. That is Node.js; in a Vite project use <code>import.meta.env</code>.</li>
</ul>`,
        },
        {
          kind: 'article',
          title: 'Deploying a single-page app',
          minutes: 14,
          topic: 'Deploying',
          html: `<p>A built React app is a folder of static files, so deploying it is mostly a matter of putting those files somewhere fast and getting a few rules right. This lesson covers where to host, the two rules every SPA needs, and how to automate the whole thing so that a merged pull request goes live without anyone copying files by hand.</p>

<h2>Where to host</h2>
<ul>
<li><strong>Static hosting platforms</strong> such as Netlify, Vercel, Cloudflare Pages and GitHub Pages build and serve your app from a Git repository with very little setup. Good for portfolios and for many production apps.</li>
<li><strong>Object storage behind a CDN</strong>, such as Amazon S3 with CloudFront. You upload <code>dist/</code> to a bucket and the CDN serves it from locations close to your users. Common in companies that already run their back end on that cloud.</li>
<li><strong>Your own web server</strong>, such as Nginx in front of your Spring Boot API, serving the static files from a folder.</li>
</ul>
<p>A <strong>CDN</strong> (content delivery network) keeps copies of your files on servers around the world, including in Indian cities, so a learner in Coimbatore downloads them from nearby rather than from another continent.</p>

<h2>Rule 1: fall back to index.html</h2>
<p>As the routing lesson explained, a refresh on <code>/courses/java-full-stack</code> asks the server for that path. Configure the hosting so that any path that is not a real file returns <code>index.html</code>, and the router renders the right screen. Each platform has its own setting for this — a rewrite rule, a redirects file, or a custom error response on a CDN. After every new deployment, test it by opening a deep link in a fresh tab.</p>

<h2>Rule 2: cache hashed assets, not index.html</h2>
<table>
<thead><tr><th scope="col">Files</th><th scope="col">Cache-Control header</th><th scope="col">Why</th></tr></thead>
<tbody>
<tr><td><code>assets/*</code> (hashed names)</td><td><code>public, max-age=31536000, immutable</code></td><td>The name changes whenever the content does, so a year is safe</td></tr>
<tr><td><code>index.html</code></td><td><code>no-cache</code></td><td>Browsers must check for a new version on every visit</td></tr>
</tbody>
</table>
<p>Get this wrong and users keep seeing the old version after a release — or an old <code>index.html</code> points to asset files that no longer exist, and they get a blank page.</p>

<h2>Automate it with a CI/CD pipeline</h2>
<p>Continuous integration runs checks on every pull request; continuous deployment releases the main branch automatically once those checks pass. A typical pipeline for a React app:</p>
<ol>
<li>Check out the code and install dependencies with <code>npm ci</code>, which uses the exact versions in the lock file.</li>
<li>Run the linter and the tests.</li>
<li>Build with the production environment variables.</li>
<li>Upload <code>dist/</code> to the hosting and, on a CDN, invalidate the cached <code>index.html</code>.</li>
<li>Run a quick smoke test against the live site: does the home page load, and does a deep link work?</li>
</ol>
<pre><code class="language-text">on every pull request:  install → lint → test → build
on merge to main:       install → lint → test → build → deploy → smoke test</code></pre>
<p>GitHub Actions is a common way to run this, and the hosting platforms above can also build for you when you connect a repository.</p>

<h2>Before you call it live</h2>
<ul>
<li>HTTPS everywhere, on your own domain if you have one.</li>
<li>The API allows the production front-end origin in its CORS settings.</li>
<li>The error and "not found" screens look like your app, not like the hosting provider's default page.</li>
<li>You can roll back: keep the previous build, or redeploy the previous commit.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Deep links that return 404 because the fallback rule is missing.</li>
<li>Caching <code>index.html</code> for a long time, so a release seems not to have happened.</li>
<li>Deploying by hand from a laptop, along with whatever uncommitted changes happened to be there.</li>
</ul>
<p><strong>Interview tip:</strong> a live link to a deployed project, with a repository that has a clear README and a passing CI badge, is one of the strongest things a fresher can show. Deploy your capstone and put the link at the top of your resume.</p>`,
        },
        {
          kind: 'article',
          title: 'Quality before you ship: linting, testing and accessibility checks',
          minutes: 12,
          topic: 'Deploying',
          html: `<p>Shipping fast is good; shipping broken is expensive. A few automated checks catch most problems before users see them, and they are exactly what a team expects you to have run before you ask for a code review.</p>

<h2>Linting with ESLint</h2>
<p>A linter reads your code without running it and flags likely mistakes. Vite's React template comes with ESLint set up, including two rules from the React team that are worth more than any others:</p>
<ul>
<li><code>react-hooks/rules-of-hooks</code> flags hooks called conditionally or outside components.</li>
<li><code>react-hooks/exhaustive-deps</code> flags effects that use values missing from their dependency array.</li>
</ul>
<p>Treat these warnings as errors. Pair the linter with Prettier for formatting, so that code reviews discuss logic rather than spaces and commas.</p>

<h2>Testing components</h2>
<p>A component test renders a component, interacts with it the way a user would, and checks what appears on screen. A common setup is Vitest, a test runner that works with Vite, plus React Testing Library:</p>
<pre><code class="language-jsx">import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import SeatCounter from './SeatCounter.jsx';

test('booking a seat lowers the count', async () =&gt; {
  const user = userEvent.setup();
  render(&lt;SeatCounter /&gt;);

  await user.click(screen.getByRole('button', { name: /30 left/ }));

  expect(screen.getByRole('button', { name: /29 left/ })).toBeTruthy();
});</code></pre>
<p>Notice the queries: <code>getByRole('button', { name: ... })</code> finds elements the way a screen reader does, by role and accessible name. If a test cannot find your button that way, a screen reader user probably cannot either. Tests written like this keep passing when you rework a component's internals, and fail when its behaviour for users changes.</p>
<p>Test first what would hurt most if it broke: form validation, totals and fees, what each role is allowed to see, and the loading, error and empty states of your data screens.</p>

<h2>Accessibility checks</h2>
<ul>
<li>Add an accessibility lint plugin such as <code>eslint-plugin-jsx-a11y</code> to catch missing alt text, missing labels and clickable divs as you type.</li>
<li>Run Lighthouse on the preview build and fix every accessibility issue it reports.</li>
<li>Do a keyboard pass on each new screen: <kbd>Tab</kbd> through everything, open and close dialogs, submit the forms.</li>
</ul>

<h2>A checklist before you merge</h2>
<ol>
<li>No errors or warnings in the browser Console.</li>
<li><code>npm run lint</code> and the tests pass.</li>
<li><code>npm run build</code> succeeds, and the app works under <code>npm run preview</code>.</li>
<li>You have seen the loading, empty and error states at least once (throttle or block a request in the Network tab).</li>
<li>The screen works at 360px wide and with the keyboard alone.</li>
<li>No secrets, tokens or personal data in the code or the logs.</li>
</ol>

<h2>Code written with an AI assistant</h2>
<p>AI coding assistants can draft components and tests quickly, but you are responsible for every line you commit. Read generated code as carefully as a teammate's, run it, and check it against the list above: generated React code often skips keys, effect cleanup and accessibility. And never paste secrets or real learner data into a prompt.</p>

<h2>Common mistakes</h2>
<ul>
<li>Testing implementation details, such as state variable names or internal functions, so that every refactor breaks the tests.</li>
<li>Switching off a lint rule instead of understanding why it fired.</li>
<li>Skipping the production preview and discovering problems only after deployment.</li>
</ul>`,
        },
        { kind: 'practice', question: 'deploy-env-vars', topic: 'Practice' },
        { kind: 'practice', question: 'deploy-ci-pipeline', topic: 'Practice' },
      ],
    },
  ],
  assignments: [],
  tests: [
    {
      title: 'Frontend Development with React — JavaScript readiness test',
      kind: 'practice',
      description:
        'Check that your JavaScript is ready for React: block scope, strict equality, const objects, map versus forEach, closures, the event loop and reading JSON with fetch. Take it before the Components and JSX module, and revise any topic you miss.',
      durationMinutes: 15,
      sections: [
        {
          title: 'Modern JavaScript',
          questions: [
            'js-let-block-scope',
            'js-strict-equality',
            'js-const-object',
            'js-map-vs-foreach',
            'js-closure-counter',
            'js-event-loop-order',
            'js-fetch-await',
          ],
        },
      ],
    },
    {
      title: 'Frontend Development with React — APIs and deployment test',
      kind: 'weekly',
      description:
        'Talking to a REST API — status codes, idempotent methods, validation errors and endpoint naming — and shipping the app: secrets, CI pipelines, health checks and working with branches.',
      durationMinutes: 25,
      sections: [
        {
          title: 'Talking to a REST API',
          questions: [
            'js-fetch-await',
            'rest-status-created',
            'rest-idempotent-methods',
            'rest-400-vs-422',
            'rest-resource-naming',
          ],
        },
        {
          title: 'Shipping the app',
          questions: [
            'deploy-env-vars',
            'deploy-ci-pipeline',
            'deploy-health-check',
            'git-branch-purpose',
            'git-commit-message',
          ],
        },
      ],
    },
    {
      title: 'Frontend Development with React — final test',
      kind: 'final',
      description:
        'The whole course in one sitting: the JavaScript React relies on, accessible forms and markup, calling a REST API, and building and deploying the app.',
      durationMinutes: 40,
      sections: [
        {
          title: 'JavaScript for React',
          questions: [
            'js-let-block-scope',
            'js-strict-equality',
            'js-const-object',
            'js-map-vs-foreach',
            'js-closure-counter',
            'js-event-loop-order',
          ],
        },
        {
          title: 'Accessible forms and markup',
          questions: [
            'html-label-for',
            'html-button-submits',
            'html-alt-text',
            'html-heading-order',
          ],
        },
        {
          title: 'REST APIs',
          questions: [
            'js-fetch-await',
            'rest-status-created',
            'rest-400-vs-422',
            'rest-idempotent-methods',
          ],
        },
        {
          title: 'Building and deploying',
          questions: ['deploy-env-vars', 'deploy-ci-pipeline', 'deploy-health-check'],
        },
      ],
    },
  ],
};
