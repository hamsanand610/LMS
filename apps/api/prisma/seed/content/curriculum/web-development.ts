import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'web-development',
  title: 'Web Development: HTML, CSS and JavaScript',
  subject: 'html-css',
  level: 'beginner',
  description:
    'Build real web pages from the ground up: how browsers and servers talk, semantic and accessible HTML, CSS layouts with flexbox and grid that work from a phone to a laptop, and the JavaScript that makes a page respond — the DOM, events, form checks and loading data with fetch and async/await.',
  tags: ['html', 'css', 'javascript', 'dom', 'responsive-design', 'accessibility', 'web'],
  modules: [
    {
      title: 'How the web works',
      summary:
        'What happens between typing an address and seeing a page: clients, servers and HTTP, the separate jobs of HTML, CSS and JavaScript, and the tools you build with.',
      lessons: [
        {
          kind: 'article',
          title: 'What happens when you open a web page',
          minutes: 12,
          topic: 'The web',
          html: `<p>Almost every web developer is asked some version of this question in an interview: "What happens when you type an address into the browser and press Enter?" It is a good question, because the answer touches everything you will build in this course. Let us walk through it with a real example: you open <code>https://siacademy.example/courses</code> to see the course catalogue.</p>

<h2>Clients and servers</h2>
<p>The web is a conversation between two programs. The <strong>client</strong> asks for something. Usually it is a browser such as Chrome, Firefox or Edge, but it could also be a mobile app or a script. The <strong>server</strong> is a program running on a computer somewhere else; it listens for requests and sends back responses. One server answers thousands of clients, and one page often talks to several servers: the HTML may come from one, the fonts from another and a video from a third.</p>

<h2>From address to page, step by step</h2>
<ol>
<li><strong>The browser reads the URL.</strong> <code>https</code> is the scheme (encrypted HTTP), <code>siacademy.example</code> is the host, and <code>/courses</code> is the path of the resource on that host.</li>
<li><strong>DNS turns the name into an address.</strong> Computers find each other by IP address, so the browser asks the Domain Name System which address belongs to <code>siacademy.example</code>. The answer is cached, so the next visit skips this step.</li>
<li><strong>A secure connection is opened.</strong> The browser connects to that address and agrees on encryption keys with the server (the TLS handshake). From now on, nobody in between can read or change the traffic.</li>
<li><strong>The browser sends an HTTP request.</strong> It names a method (GET, to fetch something), the path, and headers with extra information.</li>
<li><strong>The server sends an HTTP response.</strong> It carries a status code, headers and a body: here, the HTML of the catalogue page.</li>
<li><strong>The browser renders the page.</strong> It reads the HTML from top to bottom, and every time it meets a stylesheet, script, image or font, it sends another request for that file. Then it works out the layout and paints pixels on the screen.</li>
</ol>
<p>Written out as plain text, the first request and response look roughly like this:</p>
<pre><code class="language-text">GET /courses HTTP/1.1
Host: siacademy.example
Accept: text/html

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: no-cache

&lt;!doctype html&gt;
&lt;html lang="en"&gt;
...</code></pre>
<p>Modern browsers use newer versions of HTTP (HTTP/2 and HTTP/3) that send the same information in a faster binary form, but the ideas — method, path, headers, status, body — do not change. You can watch all of it in the Network tab of the browser's developer tools.</p>

<h2>Status codes you will meet</h2>
<table>
<thead><tr><th scope="col">Code</th><th scope="col">Meaning</th><th scope="col">Typical cause</th></tr></thead>
<tbody>
<tr><td>200 OK</td><td>Here is what you asked for</td><td>A normal page or API call</td></tr>
<tr><td>201 Created</td><td>A new resource was made</td><td>Registering for a batch through an API</td></tr>
<tr><td>301 / 302</td><td>It lives somewhere else</td><td>An old URL redirected to a new one</td></tr>
<tr><td>304 Not Modified</td><td>Use your cached copy</td><td>Reloading a page whose CSS has not changed</td></tr>
<tr><td>400 Bad Request</td><td>The request itself is wrong</td><td>Malformed data sent by the client</td></tr>
<tr><td>401 / 403</td><td>Not signed in / not allowed</td><td>Opening the admin area as a learner</td></tr>
<tr><td>404 Not Found</td><td>Nothing at this path</td><td>A typo in the URL</td></tr>
<tr><td>500 Internal Server Error</td><td>The server failed</td><td>A bug or a database outage</td></tr>
</tbody>
</table>
<p>A simple rule: 200s mean success, 300s mean "look elsewhere", 400s mean the client made a mistake and 500s mean the server did.</p>

<h2>Static and dynamic pages</h2>
<p>A <strong>static</strong> page is a file the server sends exactly as it is stored, like a college fest website made of plain HTML files. A <strong>dynamic</strong> page is built for each request: a Java or Python program on the server reads the database and produces HTML or JSON on the fly. Many modern sites send a nearly empty HTML page plus JavaScript, and the JavaScript then fetches data from an API. You will build exactly that by the end of this course.</p>

<h2>Common mistakes</h2>
<ul>
<li>Treating "the internet" and "the web" as the same thing. The internet is the network; the web (HTTP and pages) is one service running on it, alongside email and many others.</li>
<li>Believing a 404 or 500 means the network is down. The server answered; it simply answered with an error.</li>
<li>Forgetting that every image, stylesheet and script is a separate request. Ten large images are ten downloads before the page feels complete.</li>
</ul>

<details><summary>Check yourself: why does the second visit to a site often load faster?</summary><p>The DNS answer and many files (stylesheets, scripts, images) are cached by the browser, so fewer requests travel over the network, and some are answered with a short 304 Not Modified instead of a full download.</p></details>`,
          resources: [
            { title: 'MDN: HTTP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP' },
            {
              title: 'MDN: Learn web development',
              url: 'https://developer.mozilla.org/en-US/docs/Learn',
            },
          ],
        },
        {
          kind: 'article',
          title: 'HTML, CSS and JavaScript: who does what',
          minutes: 10,
          topic: 'The web',
          html: `<p>Every page you build in this course uses three languages, and each has one job. Mixing up those jobs is the most common reason a beginner's page becomes hard to change. Think of the menu board in your college canteen:</p>
<ul>
<li><strong>HTML is the content and its structure</strong>: the dishes, their names and prices, which items are breakfast and which are lunch.</li>
<li><strong>CSS is the presentation</strong>: the font, the colours, the two columns, the prices lined up on the right.</li>
<li><strong>JavaScript is the behaviour</strong>: tapping "Add" puts a dish in your order and updates the total.</li>
</ul>

<h2>One small feature in all three languages</h2>
<p>Here is a single menu item. First the HTML, which says what things <em>are</em>:</p>
<pre><code class="language-html">&lt;article class="dish"&gt;
  &lt;h3&gt;Masala dosa&lt;/h3&gt;
  &lt;p class="price"&gt;₹60&lt;/p&gt;
  &lt;button type="button" class="add"&gt;Add to order&lt;/button&gt;
&lt;/article&gt;
&lt;p id="total"&gt;Total: ₹0&lt;/p&gt;</code></pre>
<p>Then the CSS, which says how they <em>look</em>:</p>
<pre><code class="language-css">.dish {
  border: 1px solid #dddddd;
  border-radius: 8px;
  padding: 1rem;
}

.price {
  font-weight: bold;
  color: #7f2331;
}</code></pre>
<p>And finally the JavaScript, which says what <em>happens</em>:</p>
<pre><code class="language-javascript">let total = 0;
const totalText = document.querySelector('#total');

document.querySelector('.add').addEventListener('click', () =&gt; {
  total += 60;
  totalText.textContent = \`Total: ₹\${total}\`;
});</code></pre>
<p>You could change the colours without touching the HTML, or rearrange the HTML of the card without touching the click logic, as long as the class names stay the same. That independence is the whole point.</p>

<h2>How the browser puts them together</h2>
<p>When the HTML arrives, the browser parses it into the <strong>DOM</strong> (Document Object Model): a tree of objects, one for each element. It reads the CSS and works out which rules apply to which elements. Then it calculates the <strong>layout</strong> — the position and size of every box — and <strong>paints</strong> the result. JavaScript can read and change the DOM at any time; when it does, the browser updates the layout and repaints what changed.</p>
<p>Where you put each file matters. Stylesheets go in the <code>&lt;head&gt;</code>, so the page never flashes unstyled. Scripts also go in the head, with the <code>defer</code> attribute, so they download in parallel with the HTML but run only after it has been fully parsed:</p>
<pre><code class="language-html">&lt;link rel="stylesheet" href="css/styles.css"&gt;
&lt;script src="js/app.js" defer&gt;&lt;/script&gt;</code></pre>

<h2>Why keep them separate?</h2>
<ul>
<li><strong>Easier to change.</strong> A designer can restyle a whole site by editing one CSS file.</li>
<li><strong>Accessible by default.</strong> Screen readers, search engines and reader modes rely on meaningful HTML, not on how things look.</li>
<li><strong>Faster.</strong> Separate CSS and JavaScript files are downloaded once, cached and reused on every page.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Choosing an element for its look: an <code>&lt;h1&gt;</code> because you want big text, or several <code>&lt;br&gt;</code> tags to make space. Choose the element for its meaning and control size and spacing with CSS.</li>
<li>Writing inline styles (<code>style="color: red"</code>) on every element, so one colour change means editing fifty lines.</li>
<li>Putting a script in the head without <code>defer</code>. It runs before the elements it looks for exist, and <code>querySelector</code> returns <code>null</code>.</li>
</ul>

<details><summary>Check yourself: a "Show more" button reveals a hidden paragraph. Which language handles each part?</summary><p>HTML holds the paragraph and the button, CSS hides the paragraph and styles the button, and JavaScript listens for the click and changes a class or attribute so that the paragraph becomes visible.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Setting up: an editor, a browser and the developer tools',
          minutes: 12,
          topic: 'Tools',
          html: `<p>You need surprisingly little to build for the web: a code editor (VS Code is a popular free choice), a modern browser and a folder. This lesson sets up a workspace you will use for the rest of the course and introduces the tool professional developers keep open all day — the browser's developer tools.</p>

<h2>A project folder that scales</h2>
<p>Keep each project in its own folder with a predictable layout:</p>
<pre><code class="language-text">course-catalogue/
  index.html
  css/
    styles.css
  js/
    app.js
  images/
    logo.svg</code></pre>
<p>Use lower-case file names without spaces (<code>course-list.html</code>, not <code>Course List.html</code>). Many web servers treat file names as case-sensitive, so a link that works on your Windows laptop can break once the site is deployed to a Linux server.</p>

<h2>The starting page</h2>
<p>Every page you write starts from the same skeleton. Type it out a few times until you can write it from memory:</p>
<pre><code class="language-html">&lt;!doctype html&gt;
&lt;html lang="en"&gt;
  &lt;head&gt;
    &lt;meta charset="utf-8"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;
    &lt;title&gt;Course catalogue | SI Academy&lt;/title&gt;
    &lt;link rel="stylesheet" href="css/styles.css"&gt;
    &lt;script src="js/app.js" defer&gt;&lt;/script&gt;
  &lt;/head&gt;
  &lt;body&gt;
    &lt;h1&gt;Our courses&lt;/h1&gt;
  &lt;/body&gt;
&lt;/html&gt;</code></pre>
<ul>
<li><code>&lt;!doctype html&gt;</code> tells the browser to use modern standards mode.</li>
<li><code>lang="en"</code> lets screen readers pronounce the text correctly and lets the browser offer translation.</li>
<li><code>charset="utf-8"</code> makes characters such as ₹, é, and Tamil or Devanagari script display properly.</li>
<li>The <code>viewport</code> line stops phones from shrinking the page to a tiny desktop view. Without it, responsive CSS does not work.</li>
<li>The <code>&lt;title&gt;</code> appears in the browser tab, in bookmarks and in search results.</li>
</ul>

<h2>Open it the right way</h2>
<p>Double-clicking <code>index.html</code> opens it with a <code>file://</code> address. That is fine for plain HTML and CSS, but some features — fetching data and JavaScript modules, for example — are blocked on <code>file://</code> pages for security reasons. Use a small local web server instead, such as your editor's live-preview extension or <code>npx serve</code> run inside the project folder, and open the <code>http://localhost</code> address it prints. Most such tools also reload the page whenever you save.</p>

<h2>A tour of the developer tools</h2>
<p>Press <kbd>F12</kbd> (or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>) in Chrome, Edge or Firefox.</p>
<dl>
<dt>Elements (Inspector in Firefox)</dt>
<dd>The live DOM. Select an element to see every CSS rule that applies to it, which rules were overridden, and its box model. You can edit styles here to experiment, then copy the values that work into your CSS file.</dd>
<dt>Console</dt>
<dd>JavaScript errors appear here in red, with the file name and line number. You can also type JavaScript to try things out.</dd>
<dt>Network</dt>
<dd>Every request the page made, with its status code, size and timing. When an image or an API call fails, look here first.</dd>
<dt>Device toolbar</dt>
<dd>Shows the page at phone and tablet sizes, so you can test responsive layouts without a phone in your hand.</dd>
<dt>Lighthouse</dt>
<dd>Audits the page for performance, accessibility and best practices, and explains each problem it finds.</dd>
</dl>

<h2>Common mistakes</h2>
<ul>
<li>A wrong relative path: <code>href="styles.css"</code> when the file is inside <code>css/</code>. The Network tab shows the request as a 404.</li>
<li>Editing one file while viewing another. Check the address bar.</li>
<li>Ignoring the Console. If a button does nothing, there is almost always a red error message explaining why.</li>
</ul>
<p><strong>Interview tip:</strong> when you are asked how you debug a front-end problem, describe the tools concretely: "I check the Console for errors, the Network tab for failed requests, and the Elements panel to see which CSS rule is winning."</p>`,
        },
      ],
    },
    {
      title: 'HTML',
      summary:
        'Well-structured, semantic HTML: elements and attributes, landmarks and headings, links, images and tables, and accessible forms that work for every user.',
      lessons: [
        {
          kind: 'article',
          title: 'Elements, attributes and the shape of a document',
          minutes: 12,
          topic: 'Structure',
          html: `<p>HTML (HyperText Markup Language) is not a programming language: it has no loops or variables. It is a <strong>markup</strong> language. You wrap pieces of content in tags that say what each piece is, and the browser, search engines and assistive technology all read those tags to understand your page.</p>

<h2>Anatomy of an element</h2>
<pre><code class="language-html">&lt;a href="/courses/java"&gt;Java Full Stack&lt;/a&gt;</code></pre>
<ul>
<li><code>&lt;a&gt;</code> is the <strong>opening tag</strong> and <code>&lt;/a&gt;</code> the <strong>closing tag</strong>.</li>
<li><code>href="/courses/java"</code> is an <strong>attribute</strong>: a name and a value that add information to the element.</li>
<li><code>Java Full Stack</code> is the <strong>content</strong>.</li>
</ul>
<p>Some elements never have content, so they have no closing tag. These are <strong>void elements</strong>; the ones you will use most are <code>&lt;img&gt;</code>, <code>&lt;input&gt;</code>, <code>&lt;meta&gt;</code>, <code>&lt;link&gt;</code>, <code>&lt;br&gt;</code> and <code>&lt;hr&gt;</code>. You may see them written with a slash, as in <code>&lt;br /&gt;</code>; in HTML that slash is optional and changes nothing.</p>

<h2>Nesting: elements inside elements</h2>
<p>Elements nest like boxes inside boxes, and they must close in the reverse order they opened:</p>
<pre><code class="language-html">&lt;!-- Correct --&gt;
&lt;p&gt;The fee is &lt;strong&gt;₹45,000&lt;/strong&gt; for the full course.&lt;/p&gt;

&lt;!-- Wrong: strong closes after p --&gt;
&lt;p&gt;The fee is &lt;strong&gt;₹45,000&lt;/p&gt;&lt;/strong&gt;</code></pre>
<p>Browsers try to repair broken nesting, but the repair is often not what you meant. Indenting nested elements by two spaces makes such mistakes easy to spot.</p>
<p>Elements also have rules about what may go inside them. A <code>&lt;p&gt;</code> may contain text and inline elements such as <code>&lt;a&gt;</code> and <code>&lt;strong&gt;</code>, but not another paragraph, a list or a heading. A <code>&lt;ul&gt;</code> may contain only <code>&lt;li&gt;</code> elements as direct children.</p>

<h2>Attributes worth knowing early</h2>
<table>
<thead><tr><th scope="col">Attribute</th><th scope="col">Used on</th><th scope="col">Purpose</th></tr></thead>
<tbody>
<tr><td><code>id</code></td><td>Any element</td><td>A unique name for one element on the page, used by links, labels and scripts</td></tr>
<tr><td><code>class</code></td><td>Any element</td><td>One or more names, separated by spaces, for styling groups of elements</td></tr>
<tr><td><code>lang</code></td><td><code>&lt;html&gt;</code> or any element</td><td>The language of the content</td></tr>
<tr><td><code>href</code></td><td><code>&lt;a&gt;</code>, <code>&lt;link&gt;</code></td><td>Where the link points</td></tr>
<tr><td><code>src</code>, <code>alt</code></td><td><code>&lt;img&gt;</code></td><td>The image file and its text alternative</td></tr>
<tr><td><code>hidden</code></td><td>Any element</td><td>A boolean attribute: if it is present, the element is not shown</td></tr>
</tbody>
</table>
<p>Quote attribute values with double quotes. Unquoted values break as soon as they contain a space.</p>

<h2>Head and body</h2>
<p>The <code>&lt;head&gt;</code> holds information <em>about</em> the page — its title, character set, stylesheets and scripts — and nothing in it is displayed as content. The <code>&lt;body&gt;</code> holds everything the user sees. Comments, written <code>&lt;!-- like this --&gt;</code>, are ignored by the browser, but anyone can read them with View Source, so never put passwords or private notes in them.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting a closing tag, so the rest of the page turns bold or becomes part of a link.</li>
<li>Using the same <code>id</code> twice. Labels, links and scripts find only the first one.</li>
<li>Mixing upper- and lower-case tags. HTML does not care, but the convention is lower case everywhere.</li>
</ul>
<p>Run your pages through the W3C Markup Validation Service now and then. It reports unclosed tags, duplicate ids and invalid nesting with line numbers — the same things a reviewer will check in your practical.</p>

<details><summary>Check yourself: is <code>&lt;p&gt;&lt;ul&gt;&lt;li&gt;Java&lt;/li&gt;&lt;/ul&gt;&lt;/p&gt;</code> valid?</summary><p>No. A paragraph cannot contain a list. The browser closes the paragraph just before the <code>&lt;ul&gt;</code>, leaving an empty paragraph and a stray closing tag. Put the list after the paragraph instead.</p></details>`,
          resources: [
            { title: 'MDN: HTML', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
            { title: 'web.dev: Learn HTML', url: 'https://web.dev/learn/html' },
          ],
        },
        {
          kind: 'article',
          title: 'Semantic HTML: giving every part of the page a meaning',
          minutes: 12,
          topic: 'Structure',
          html: `<p>Two pages can look identical in the browser and still be completely different underneath. One is built from dozens of <code>&lt;div&gt;</code> elements; the other uses elements that say what each region <em>is</em>. The second page is <strong>semantic</strong>, and it is better for everyone who cannot simply look at it: screen reader users, search engines, browser reader modes, and the developer who maintains it after you.</p>

<h2>The landmark elements</h2>
<p>Here is the outline of the SI Academy catalogue page, written semantically:</p>
<pre><code class="language-html">&lt;body&gt;
  &lt;header&gt;
    &lt;a href="/"&gt;SI Academy&lt;/a&gt;
    &lt;nav aria-label="Main"&gt;
      &lt;ul&gt;
        &lt;li&gt;&lt;a href="/courses"&gt;Courses&lt;/a&gt;&lt;/li&gt;
        &lt;li&gt;&lt;a href="/placements"&gt;Placements&lt;/a&gt;&lt;/li&gt;
        &lt;li&gt;&lt;a href="/contact"&gt;Contact&lt;/a&gt;&lt;/li&gt;
      &lt;/ul&gt;
    &lt;/nav&gt;
  &lt;/header&gt;

  &lt;main&gt;
    &lt;h1&gt;Our courses&lt;/h1&gt;
    &lt;section&gt;
      &lt;h2&gt;Full stack programmes&lt;/h2&gt;
      &lt;article&gt;
        &lt;h3&gt;Java Full Stack&lt;/h3&gt;
        &lt;p&gt;Six months, from Core Java to Spring Boot and React.&lt;/p&gt;
      &lt;/article&gt;
      &lt;article&gt;
        &lt;h3&gt;Python Full Stack&lt;/h3&gt;
        &lt;p&gt;Five months, from Python basics to Django.&lt;/p&gt;
      &lt;/article&gt;
    &lt;/section&gt;
    &lt;aside&gt;
      &lt;h2&gt;Next batch&lt;/h2&gt;
      &lt;p&gt;Starts on 3 November.&lt;/p&gt;
    &lt;/aside&gt;
  &lt;/main&gt;

  &lt;footer&gt;
    &lt;p&gt;© 2026 SI Academy&lt;/p&gt;
  &lt;/footer&gt;
&lt;/body&gt;</code></pre>
<dl>
<dt><code>&lt;header&gt;</code></dt><dd>Introductory content: the logo, the site name and usually the main navigation. An article can have its own header too.</dd>
<dt><code>&lt;nav&gt;</code></dt><dd>A block of major navigation links. Keep it for the main menu, a table of contents or breadcrumbs, not for every group of links.</dd>
<dt><code>&lt;main&gt;</code></dt><dd>The page's own content, once per page. Screen reader users can jump straight to it instead of hearing the header on every page.</dd>
<dt><code>&lt;section&gt;</code></dt><dd>A thematic group of content with its own heading.</dd>
<dt><code>&lt;article&gt;</code></dt><dd>A self-contained piece that would make sense on its own: a course card, a blog post, a comment.</dd>
<dt><code>&lt;aside&gt;</code></dt><dd>Content related to the main content but outside its flow, such as a sidebar or a call-out.</dd>
<dt><code>&lt;footer&gt;</code></dt><dd>Closing information: copyright, contact details, secondary links.</dd>
</dl>

<h2>Headings are the outline</h2>
<p>Screen reader users often move through a page by its headings, the way you skim a textbook by its chapter titles. So heading levels must describe structure: one <code>&lt;h1&gt;</code> for the page's main topic, <code>&lt;h2&gt;</code> for its sections, <code>&lt;h3&gt;</code> inside those, without skipping levels on the way down. If a card title should look small, keep it an <code>&lt;h3&gt;</code> and make it small with CSS. Never choose <code>&lt;h6&gt;</code> just because it looks the right size.</p>

<h2>When a div is fine</h2>
<p><code>&lt;div&gt;</code> and <code>&lt;span&gt;</code> are not wrong. They are the elements with no meaning, used when you need a wrapper purely for styling or layout. The rule is: reach for a meaningful element first, and fall back to a div when none fits. The classic mistake is a div with a click handler pretending to be a button. Use <code>&lt;button&gt;</code>, which already works with the keyboard and is announced as a button.</p>

<h2>Common mistakes</h2>
<ul>
<li>Wrapping everything in <code>&lt;section&gt;</code>. A section without a heading is usually just a div.</li>
<li>Putting several visible <code>&lt;main&gt;</code> elements on one page.</li>
<li>Choosing <code>&lt;b&gt;</code> or <code>&lt;i&gt;</code> when you mean importance or emphasis. Use <code>&lt;strong&gt;</code> for importance and <code>&lt;em&gt;</code> for stress emphasis.</li>
</ul>
<p><strong>Interview tip:</strong> "What is semantic HTML, and why does it matter?" is a favourite question for freshers. Name the three beneficiaries — accessibility, search engines and maintainability — and give one concrete example, such as a real <code>&lt;button&gt;</code> versus a clickable div.</p>`,
        },
        {
          kind: 'article',
          title: 'Links, images, lists and tables',
          minutes: 14,
          topic: 'Content',
          html: `<p>Most of what you put on a page is text, links, images, lists and the occasional table. Each comes with a few details that separate a careless page from a professional one.</p>

<h2>Links</h2>
<pre><code class="language-html">&lt;a href="https://www.example.com/brochure"&gt;Download the brochure&lt;/a&gt;
&lt;a href="/courses/java"&gt;Java Full Stack&lt;/a&gt;
&lt;a href="fees.html"&gt;Fee structure&lt;/a&gt;
&lt;a href="#faq"&gt;Frequently asked questions&lt;/a&gt;
&lt;a href="mailto:admissions@siacademy.example"&gt;Email admissions&lt;/a&gt;</code></pre>
<ul>
<li>An <strong>absolute</strong> URL includes the scheme and host. Use it for other sites.</li>
<li>A <strong>root-relative</strong> URL starts with <code>/</code> and is resolved from the root of your site.</li>
<li>A <strong>relative</strong> URL such as <code>fees.html</code> is resolved from the current page's folder; <code>../</code> goes up one folder.</li>
<li><code>#faq</code> jumps to the element with <code>id="faq"</code> on the same page.</li>
</ul>
<p>Link text must make sense on its own, because screen reader users can pull up a list of every link on the page. Five links all saying "Click here" tell them nothing; "Read the Java Full Stack syllabus" does. If a link opens in a new tab, say so in the link text, because it surprises users.</p>

<h2>Images</h2>
<pre><code class="language-html">&lt;img src="images/lab.jpg" alt="Learners working together in the SI Academy lab"
     width="800" height="450"&gt;

&lt;figure&gt;
  &lt;img src="images/placements-2026.png"
       alt="Bar chart: 312 learners placed in 2026, up from 240 in 2025"&gt;
  &lt;figcaption&gt;Placements by year&lt;/figcaption&gt;
&lt;/figure&gt;</code></pre>
<ul>
<li><code>alt</code> is the text that replaces the image for screen reader users and when the image fails to load. Describe what the image <em>communicates</em> in its context, not its file name.</li>
<li>For a purely decorative image, write an empty <code>alt=""</code> so screen readers skip it. Leaving <code>alt</code> out entirely is different: some screen readers then read out the file name.</li>
<li><code>width</code> and <code>height</code> let the browser reserve space before the image downloads, so the text below it does not jump.</li>
<li><code>&lt;figure&gt;</code> with <code>&lt;figcaption&gt;</code> groups an image, a chart or a code sample with its caption.</li>
</ul>

<h2>Lists</h2>
<p>Use <code>&lt;ul&gt;</code> when the order does not matter (course features), <code>&lt;ol&gt;</code> when it does (admission steps), and <code>&lt;dl&gt;</code> for name–value pairs such as a glossary or an FAQ. Navigation menus are usually lists of links, so that a screen reader announces "list, 4 items" and the user knows what to expect.</p>

<h2>Tables, for tabular data only</h2>
<pre><code class="language-html">&lt;table&gt;
  &lt;caption&gt;Java Full Stack: modules and duration&lt;/caption&gt;
  &lt;thead&gt;
    &lt;tr&gt;
      &lt;th scope="col"&gt;Module&lt;/th&gt;
      &lt;th scope="col"&gt;Weeks&lt;/th&gt;
    &lt;/tr&gt;
  &lt;/thead&gt;
  &lt;tbody&gt;
    &lt;tr&gt;
      &lt;th scope="row"&gt;Core Java&lt;/th&gt;
      &lt;td&gt;8&lt;/td&gt;
    &lt;/tr&gt;
    &lt;tr&gt;
      &lt;th scope="row"&gt;SQL&lt;/th&gt;
      &lt;td&gt;3&lt;/td&gt;
    &lt;/tr&gt;
  &lt;/tbody&gt;
&lt;/table&gt;</code></pre>
<p>The <code>&lt;caption&gt;</code> names the table, and <code>&lt;th&gt;</code> with <code>scope</code> tells a screen reader which header belongs to each cell, so it can say "SQL, Weeks, 3" instead of a bare "3". Tables are for data with real rows and columns. Never use them to lay out a page; CSS grid and flexbox do that job.</p>

<h2>Common mistakes</h2>
<ul>
<li><code>alt="image"</code> or <code>alt="photo"</code>: words that add nothing.</li>
<li>An image of text, such as a poster with the fee details, with no text alternative. The details are invisible to screen readers and to search.</li>
<li>Links styled to look exactly like plain text, so nobody can find them.</li>
</ul>

<details><summary>Check yourself: what alt text would you give the SI Academy logo in the header, where it links to the home page?</summary><p>Describe where the link goes, for example <code>alt="SI Academy home"</code>. When an image is the only content of a link, its alt text becomes the link's name.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Forms: labels, input types and buttons',
          minutes: 15,
          topic: 'Forms and accessibility',
          html: `<p>Forms are where users give you information: an enquiry, a sign-in, an exam answer. A good form is quick to fill in on a phone, works with the keyboard and a screen reader, and catches mistakes before they reach the server. Most of that comes free when you choose the right HTML.</p>

<h2>A complete enquiry form</h2>
<pre><code class="language-html">&lt;form action="/enquiries" method="post"&gt;
  &lt;label for="name"&gt;Full name&lt;/label&gt;
  &lt;input id="name" name="name" autocomplete="name" required&gt;

  &lt;label for="email"&gt;Email&lt;/label&gt;
  &lt;input id="email" name="email" type="email" autocomplete="email" required&gt;

  &lt;label for="phone"&gt;Mobile number&lt;/label&gt;
  &lt;input id="phone" name="phone" type="tel" autocomplete="tel"&gt;

  &lt;label for="course"&gt;Course&lt;/label&gt;
  &lt;select id="course" name="course"&gt;
    &lt;option value="java"&gt;Java Full Stack&lt;/option&gt;
    &lt;option value="python"&gt;Python Full Stack&lt;/option&gt;
  &lt;/select&gt;

  &lt;fieldset&gt;
    &lt;legend&gt;Preferred batch&lt;/legend&gt;
    &lt;input type="radio" id="morning" name="batch" value="morning"&gt;
    &lt;label for="morning"&gt;Morning&lt;/label&gt;
    &lt;input type="radio" id="evening" name="batch" value="evening"&gt;
    &lt;label for="evening"&gt;Evening&lt;/label&gt;
  &lt;/fieldset&gt;

  &lt;label for="message"&gt;Message&lt;/label&gt;
  &lt;textarea id="message" name="message" rows="4"&gt;&lt;/textarea&gt;

  &lt;button type="submit"&gt;Send enquiry&lt;/button&gt;
&lt;/form&gt;</code></pre>

<h2>Labels are not optional</h2>
<p>Every field needs a visible <code>&lt;label&gt;</code> whose <code>for</code> matches the field's <code>id</code>. That one connection does three things: a screen reader announces "Email, edit text" when the field gets focus; clicking the label focuses the field, which gives a much bigger target for small radio buttons; and voice-control users can say "click Email". A <code>placeholder</code> is not a label. It disappears as soon as you type and is often too faint to read.</p>

<h2>Name, value and how data is sent</h2>
<p>When the form is submitted, the browser sends each field as a <code>name=value</code> pair. A field without a <code>name</code> is not sent at all — a common reason for "the server says the email is missing". The <code>action</code> attribute is the URL the data goes to. <code>method="get"</code> puts the data in the URL, which suits a search box; <code>method="post"</code> sends it in the request body, which suits anything that changes data or is private.</p>

<h2>Input types do real work</h2>
<table>
<thead><tr><th scope="col">Type</th><th scope="col">What you get</th></tr></thead>
<tbody>
<tr><td><code>email</code></td><td>A check for a valid address, and an email keyboard on phones</td></tr>
<tr><td><code>tel</code></td><td>A number pad on phones (no format check, because formats vary)</td></tr>
<tr><td><code>number</code></td><td>Number checks, with <code>min</code>, <code>max</code> and <code>step</code></td></tr>
<tr><td><code>date</code></td><td>A date picker</td></tr>
<tr><td><code>password</code></td><td>Hidden characters</td></tr>
<tr><td><code>checkbox</code>, <code>radio</code></td><td>Several choices, or one choice from a group that shares a <code>name</code></td></tr>
</tbody>
</table>
<p>Attributes such as <code>required</code>, <code>minlength</code>, <code>maxlength</code> and <code>pattern</code> make the browser check values before submitting and show a message next to the field. The <code>autocomplete</code> attribute lets the browser fill in names, emails and addresses the user has saved — a real help on a phone.</p>
<p>These checks are a convenience for honest users, not security. Anyone can send any data straight to your server, so the server must always validate again.</p>

<h2>Buttons</h2>
<p>A <code>&lt;button&gt;</code> inside a form submits the form unless you say otherwise, because its default <code>type</code> is <code>submit</code>. Give buttons that do something else — "Show password", "Add another phone number" — <code>type="button"</code>, or they will send a half-filled form.</p>

<h2>Common mistakes</h2>
<ul>
<li>Radio buttons with different <code>name</code> values, so the user can select all of them at once.</li>
<li>Related choices without a <code>&lt;fieldset&gt;</code> and <code>&lt;legend&gt;</code>. A screen reader then says "Morning, radio button" without ever saying what the question was.</li>
<li><code>type="number"</code> for phone numbers, PIN codes or roll numbers. They are not quantities: leading zeros vanish and the up and down arrows make no sense. Use <code>type="tel"</code>, or a text input with <code>inputmode="numeric"</code>.</li>
</ul>`,
          resources: [{ title: 'web.dev: Learn Forms', url: 'https://web.dev/learn/forms' }],
        },
        {
          kind: 'article',
          title: 'Accessibility from the first line',
          minutes: 12,
          topic: 'Forms and accessibility',
          html: `<p>Accessibility (often shortened to <strong>a11y</strong>) means people can use your page whatever their abilities or circumstances: a learner who is blind and uses a screen reader, someone who cannot use a mouse after a wrist injury, a user with low vision who zooms to 200%, or anyone reading a phone in bright sunlight. Government websites in India follow guidelines based on WCAG, the international accessibility standard, many companies require it too, and accessibility questions come up in front-end interviews. The good news: most of it is simply using HTML correctly.</p>

<h2>How assistive technology reads your page</h2>
<p>A screen reader does not see your layout. It reads the <strong>accessibility tree</strong>, which the browser builds from your HTML. For each element it knows a role (button, link, heading, text field), a name (the label or text) and a state (checked, expanded, disabled). <code>&lt;button&gt;Enrol&lt;/button&gt;</code> becomes "Enrol, button". A <code>&lt;div&gt;</code> with a click handler becomes just "Enrol" — with no hint that it can be pressed, and no way to reach it with the <kbd>Tab</kbd> key.</p>

<h2>A checklist for every page</h2>
<ol>
<li><strong>Use native elements.</strong> <code>&lt;button&gt;</code> for actions, <code>&lt;a href&gt;</code> for navigation, real form controls with labels. They bring keyboard support and correct roles for free.</li>
<li><strong>Give images text alternatives.</strong> Meaningful <code>alt</code> text for informative images, <code>alt=""</code> for decoration.</li>
<li><strong>Keep the heading outline in order</strong> and use the landmarks: <code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;footer&gt;</code>.</li>
<li><strong>Make everything work with the keyboard.</strong> Press <kbd>Tab</kbd> through the page. Can you reach and use every control, in a sensible order, and always see where you are?</li>
<li><strong>Never remove the focus outline</strong> without replacing it. <code>outline: none</code> on its own leaves keyboard users lost.</li>
<li><strong>Check colour contrast.</strong> Normal text needs a contrast ratio of at least 4.5:1 against its background. Light grey on white usually fails.</li>
<li><strong>Do not rely on colour alone.</strong> An error shown only as a red border is invisible to many colour-blind users; add text such as "Enter a valid email address".</li>
<li><strong>Set the page language</strong> with <code>lang</code> on the <code>&lt;html&gt;</code> element.</li>
</ol>

<h2>A word about ARIA</h2>
<p>ARIA attributes (<code>aria-label</code>, <code>aria-expanded</code>, <code>role="alert"</code> and others) add to or change what the accessibility tree says. They are powerful and easy to misuse, so the first rule of ARIA is: if a native HTML element already does the job, use it instead. ARIA changes only what is <em>announced</em>; it adds no behaviour. Putting <code>role="button"</code> on a div does not make it respond to the <kbd>Enter</kbd> key — you would have to program that yourself. Two safe and common uses:</p>
<pre><code class="language-html">&lt;!-- An icon-only button still needs a name --&gt;
&lt;button type="button" aria-label="Close dialog"&gt;✕&lt;/button&gt;

&lt;!-- Text inserted here later is read out immediately --&gt;
&lt;p id="form-error" role="alert"&gt;&lt;/p&gt;</code></pre>

<h2>Test like a user</h2>
<ul>
<li>Put the mouse aside and complete the main task on your page with the keyboard alone.</li>
<li>Zoom the browser to 200% and check that nothing is cut off or overlapping.</li>
<li>Run the Lighthouse accessibility audit in the developer tools and fix what it reports. Automated tools catch only some problems: whether your alt text actually makes sense is something only a person can judge.</li>
<li>Try a screen reader once. NVDA is free on Windows, and VoiceOver is built into macOS and the iPhone.</li>
</ul>

<details><summary>Check yourself: a designer asks you to remove the "ugly ring" that appears around buttons. What do you do?</summary><p>Keep a visible focus indicator for keyboard users, but style it to match the design — for example a 2px outline in the brand colour — and use the <code>:focus-visible</code> selector, so it appears for keyboard focus and not after every mouse click.</p></details>`,
          resources: [
            {
              title: 'MDN: Accessibility',
              url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility',
            },
            { title: 'web.dev: Learn Accessibility', url: 'https://web.dev/learn/accessibility' },
          ],
        },
        { kind: 'lab', lab: 'web-profile-card', topic: 'Practice' },
        { kind: 'practice', question: 'html-label-for', topic: 'Practice' },
        { kind: 'practice', question: 'html-heading-order', topic: 'Practice' },
      ],
    },
    {
      title: 'CSS',
      summary:
        'Style and lay out pages with CSS: selectors and the cascade, the box model, flexbox, grid and mobile-first responsive design.',
      lessons: [
        {
          kind: 'article',
          title: 'Selectors, the cascade and specificity',
          minutes: 14,
          topic: 'CSS basics',
          html: `<p>CSS (Cascading Style Sheets) is a list of rules. Each rule says "for these elements, set these properties to these values". Writing one rule is easy; the real skill is predicting which rule wins when several apply to the same element. That is what the <strong>cascade</strong> decides.</p>

<h2>The parts of a rule</h2>
<pre><code class="language-css">.course-card h3 {
  color: #7f2331;
  font-size: 1.25rem;
}</code></pre>
<p><code>.course-card h3</code> is the <strong>selector</strong>. Inside the braces are <strong>declarations</strong>, each a <strong>property</strong> and a <strong>value</strong> followed by a semicolon.</p>

<h2>Selectors you will use every day</h2>
<table>
<thead><tr><th scope="col">Selector</th><th scope="col">Matches</th></tr></thead>
<tbody>
<tr><td><code>p</code></td><td>Every <code>&lt;p&gt;</code> element (a type selector)</td></tr>
<tr><td><code>.price</code></td><td>Every element with <code>price</code> among its classes</td></tr>
<tr><td><code>#enrol</code></td><td>The element with <code>id="enrol"</code></td></tr>
<tr><td><code>.card h3</code></td><td>Any <code>&lt;h3&gt;</code> anywhere inside an element with the class card</td></tr>
<tr><td><code>.menu &gt; li</code></td><td>Only <code>&lt;li&gt;</code> elements that are direct children of .menu</td></tr>
<tr><td><code>h2, h3</code></td><td>Both: a list of selectors sharing one rule</td></tr>
<tr><td><code>input[type="email"]</code></td><td>Elements with that attribute value</td></tr>
<tr><td><code>a:hover</code>, <code>button:focus-visible</code></td><td>Elements in a particular state (pseudo-classes)</td></tr>
<tr><td><code>li:first-child</code>, <code>tr:nth-child(even)</code></td><td>Elements by their position</td></tr>
</tbody>
</table>
<p>In practice, style mostly with classes. They are reusable, they describe purpose (<code>.price</code>, <code>.badge</code>), and they keep specificity low and predictable.</p>

<h2>The cascade: which rule wins?</h2>
<p>When two rules set the same property on the same element, the browser decides in this order:</p>
<ol>
<li><strong>Importance.</strong> A declaration marked <code>!important</code> beats normal ones. Treat it as a last resort; it makes every later change painful.</li>
<li><strong>Specificity.</strong> The more specific selector wins.</li>
<li><strong>Source order.</strong> If specificity is equal, the rule that comes later wins.</li>
</ol>
<p>Specificity is counted as three numbers: ids, then classes (which include attribute selectors and pseudo-classes), then types (element names). Compare the first number; only if it is equal, compare the second, and so on.</p>
<table>
<thead><tr><th scope="col">Selector</th><th scope="col">Ids, classes, types</th></tr></thead>
<tbody>
<tr><td><code>p</code></td><td>0, 0, 1</td></tr>
<tr><td><code>.card p</code></td><td>0, 1, 1</td></tr>
<tr><td><code>.card .price</code></td><td>0, 2, 0</td></tr>
<tr><td><code>#enrol</code></td><td>1, 0, 0</td></tr>
</tbody>
</table>
<p>So one id beats any number of classes. Given <code>&lt;button id="enrol" class="cta"&gt;</code>, the rule <code>#enrol { color: green; }</code> wins over <code>.cta { color: red; }</code>, even when the <code>.cta</code> rule comes later. Inline <code>style</code> attributes beat every selector, which is one more reason to avoid them.</p>

<h2>Inheritance</h2>
<p>Some properties, mostly about text — <code>color</code>, <code>font-family</code>, <code>font-size</code>, <code>line-height</code> — are inherited: set them on <code>body</code> and every element inside uses them unless it has its own value. Box properties such as <code>border</code>, <code>padding</code> and <code>width</code> are not inherited. That is why most stylesheets start with a body rule:</p>
<pre><code class="language-css">body {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  color: #1f2937;
}</code></pre>

<h2>Custom properties</h2>
<p>Custom properties (often called CSS variables) let you name a value once and reuse it everywhere:</p>
<pre><code class="language-css">:root {
  --brand: #7f2331;
  --radius: 8px;
}

.cta {
  background: var(--brand);
  border-radius: var(--radius);
}</code></pre>
<p>Change the brand colour in one place, and the whole site follows.</p>

<h2>Common mistakes</h2>
<ul>
<li>Fighting specificity with more ids or <code>!important</code>. Instead, lower the specificity of the rule you want to override, or reorder your rules.</li>
<li>A missing semicolon, which silently breaks the next declaration as well. The Elements panel shows such declarations crossed out or with a warning icon.</li>
<li>Reading <code>.card.featured</code> (both classes on one element) as if it were <code>.card .featured</code> (an element inside another). The space matters.</li>
</ul>`,
          resources: [
            { title: 'MDN: CSS', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS' },
            { title: 'web.dev: Learn CSS', url: 'https://web.dev/learn/css' },
          ],
        },
        {
          kind: 'article',
          title: 'The box model and box-sizing',
          minutes: 12,
          topic: 'CSS basics',
          html: `<p>Every element on a page is drawn as a rectangle — even a round profile photo. Once you understand how the browser works out the size of that rectangle, most "why is there extra space here?" puzzles solve themselves.</p>

<h2>Four layers</h2>
<p>From the inside out, every box has:</p>
<ol>
<li><strong>Content</strong>: the text or image itself, sized by <code>width</code> and <code>height</code>.</li>
<li><strong>Padding</strong>: space inside the box, between the content and the border. It shows the box's background colour.</li>
<li><strong>Border</strong>: a line around the padding.</li>
<li><strong>Margin</strong>: space outside the border that pushes other boxes away. It is always transparent.</li>
</ol>
<pre><code class="language-css">.course-card {
  width: 300px;
  padding: 20px;          /* all four sides */
  border: 2px solid #dddddd;
  margin: 0 0 16px;       /* top, left and right, bottom */
}</code></pre>
<p>The shorthands take one to four values, going clockwise from the top: <code>padding: 8px 16px</code> means 8px top and bottom, 16px left and right.</p>

<h2>content-box versus border-box</h2>
<p>How wide is that card on screen? By default (<code>box-sizing: content-box</code>), <code>width</code> sets only the content, and padding and border are added on top: 300 + 20 + 20 + 2 + 2 = <strong>344px</strong>. That surprises nearly everyone, and it breaks layouts the moment you add padding to a box that was meant to fit exactly.</p>
<p>With <code>box-sizing: border-box</code>, <code>width</code> includes the padding and border. The card is exactly <strong>300px</strong> wide, and the content area shrinks to 256px to make room. Almost every professional stylesheet switches all elements to border-box at the very top:</p>
<pre><code class="language-css">*,
*::before,
*::after {
  box-sizing: border-box;
}</code></pre>

<h2>Block and inline boxes</h2>
<p>Elements such as <code>&lt;div&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;h2&gt;</code> and <code>&lt;section&gt;</code> are <strong>block</strong> boxes: each starts on a new line and stretches across the full width available. Elements such as <code>&lt;a&gt;</code>, <code>&lt;span&gt;</code>, <code>&lt;strong&gt;</code> and <code>&lt;code&gt;</code> are <strong>inline</strong>: they flow inside a line of text, and <code>width</code>, <code>height</code> and vertical margins have no effect on them. <code>display: inline-block</code> gives you an element that sits in a line but respects width, height and padding — handy for badges and small buttons.</p>

<h2>Margin collapsing</h2>
<p>When two block boxes are stacked, their vertical margins do not add up; the larger one wins. A heading with <code>margin-bottom: 24px</code> above a paragraph with <code>margin-top: 16px</code> leaves a 24px gap, not 40px. This happens only to vertical margins in normal block layout — not inside flex or grid containers, and never to padding.</p>

<h2>Seeing the box</h2>
<p>Select any element in the Elements panel of the developer tools and look at the box model diagram: content, padding, border and margin are drawn in different colours with their sizes. Hovering an element on the page highlights the same layers. This is the fastest way to find where an unexpected gap comes from.</p>

<h2>Common mistakes</h2>
<ul>
<li>Using margin to create space inside a coloured box. Space inside belongs in padding; margin sits outside the background.</li>
<li>A fixed <code>height</code> on a box that holds text. When the text wraps on a phone, it overflows. Let the content decide the height, or use <code>min-height</code>.</li>
<li>Giving an inline <code>&lt;a&gt;</code> a width and wondering why nothing changes.</li>
</ul>

<details><summary>Check yourself: with border-box, a box has <code>width: 200px; padding: 10px; border: 5px solid</code>. How wide is its content area?</summary><p>200 − 10 − 10 − 5 − 5 = 170px. The box itself stays exactly 200px wide.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Flexbox: laying things out in a row or a column',
          minutes: 15,
          topic: 'Layout',
          html: `<p>Before flexbox, centring something vertically in CSS was a running joke. Flexbox is a layout mode for arranging items in <strong>one direction</strong> — a row or a column — and controlling how they share space and line up. Navigation bars, button groups, a card header with the title on the left and a badge on the right: all flexbox.</p>

<h2>The container and its items</h2>
<p>You switch flexbox on for a <strong>container</strong>, and its direct children become <strong>flex items</strong>:</p>
<pre><code class="language-html">&lt;nav class="site-nav"&gt;
  &lt;a href="/"&gt;SI Academy&lt;/a&gt;
  &lt;ul class="links"&gt;
    &lt;li&gt;&lt;a href="/courses"&gt;Courses&lt;/a&gt;&lt;/li&gt;
    &lt;li&gt;&lt;a href="/placements"&gt;Placements&lt;/a&gt;&lt;/li&gt;
  &lt;/ul&gt;
&lt;/nav&gt;</code></pre>
<pre><code class="language-css">.site-nav {
  display: flex;
  justify-content: space-between; /* logo left, links right */
  align-items: center;            /* centred vertically */
  gap: 1rem;
}

.links {
  display: flex;
  gap: 1.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}</code></pre>
<p>Only direct children are affected. The list items inside <code>.links</code> are not flex items of <code>.site-nav</code>, which is why <code>.links</code> needs its own <code>display: flex</code>.</p>

<h2>Two axes</h2>
<p>Every flex container has a <strong>main axis</strong>, set by <code>flex-direction</code>, and a <strong>cross axis</strong> at right angles to it. With the default <code>flex-direction: row</code>, the main axis runs from left to right; with <code>column</code>, from top to bottom.</p>
<ul>
<li><code>justify-content</code> places items along the <strong>main</strong> axis: <code>flex-start</code>, <code>center</code>, <code>flex-end</code>, <code>space-between</code>, <code>space-around</code>, <code>space-evenly</code>.</li>
<li><code>align-items</code> places them along the <strong>cross</strong> axis: <code>stretch</code> (the default, which makes items equal height), <code>flex-start</code>, <code>center</code>, <code>flex-end</code>, <code>baseline</code>.</li>
<li><code>gap</code> puts space between items without adding margins to the first or last one.</li>
</ul>
<p>So centring a child both ways in a row container takes two lines:</p>
<pre><code class="language-css">.hero {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}</code></pre>
<p>Switch to <code>flex-direction: column</code> and the two properties swap their visual effect, because the axes have turned. This is the most common source of flexbox confusion: think "main axis" and "cross axis", not "horizontal" and "vertical".</p>

<h2>How items share space</h2>
<p>Each item has three sizing properties, usually set together with the <code>flex</code> shorthand:</p>
<ul>
<li><code>flex-grow</code>: how much of the leftover space the item takes (0 means none).</li>
<li><code>flex-shrink</code>: how much it gives up when space is short (1 means it may shrink).</li>
<li><code>flex-basis</code>: its starting size before growing or shrinking.</li>
</ul>
<pre><code class="language-css">.search {
  display: flex;
  gap: 0.5rem;
}

.search input {
  flex: 1;      /* take all the remaining width */
}

.search button {
  flex: none;   /* keep its natural size */
}</code></pre>
<p>That gives you a search box that stretches while its button stays the right size, at any screen width.</p>

<h2>Wrapping</h2>
<p>By default, flex items stay on one line and shrink to fit. Add <code>flex-wrap: wrap</code> to let them move to a new line when there is not enough room, as with a row of course tags. For a gallery of equal cards in rows <em>and</em> columns, CSS grid (the next lesson) is usually the better tool.</p>

<h2>Common mistakes</h2>
<ul>
<li>Putting <code>display: flex</code> on the item instead of its parent.</li>
<li>Using <code>justify-content</code> to centre vertically in a row container. Vertical is the cross axis there, so you need <code>align-items</code>.</li>
<li>Trying <code>justify-items</code> or <code>justify-self</code> in flexbox. They belong to grid and do nothing to flex items.</li>
<li>Adding margins between items when <code>gap</code> does it in one line.</li>
</ul>
<p><strong>Interview tip:</strong> a common question is "flexbox or grid?" A good short answer: flexbox for one-dimensional layouts where the content decides the sizes (a row of buttons, a navigation bar); grid for two-dimensional layouts where you define rows and columns first (a card gallery, a page layout).</p>`,
          resources: [
            {
              title: 'MDN: CSS flexible box layout',
              url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout',
            },
          ],
        },
        {
          kind: 'article',
          title: 'CSS Grid: two-dimensional layouts',
          minutes: 14,
          topic: 'Layout',
          html: `<p>Flexbox arranges items along one line at a time. <strong>CSS grid</strong> lets you define rows and columns together and place items into them — exactly what you need for a gallery of course cards, a dashboard, or a whole page with a header, sidebar, content area and footer.</p>

<h2>Your first grid</h2>
<pre><code class="language-css">.course-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}</code></pre>
<p>Every direct child of <code>.course-grid</code> becomes a grid item, placed into three columns from left to right and wrapping into new rows automatically. The <code>fr</code> unit means "one fraction of the free space", so <code>repeat(3, 1fr)</code> makes three equal columns that share the width. <code>gap</code> adds space between rows and columns, but not around the outside.</p>
<p>You can mix units: <code>grid-template-columns: 240px 1fr</code> gives a fixed-width sidebar and a content column that takes the rest, and <code>2fr 1fr</code> gives the first column twice the share of the second.</p>

<h2>Responsive columns without media queries</h2>
<p>This declaration is worth memorising:</p>
<pre><code class="language-css">.course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1.5rem;
}</code></pre>
<p>It says: make as many columns as fit, each at least 16rem wide, and share any extra space equally. On a phone you get one column, on a tablet two, on a laptop three or four — without a single media query. (With <code>auto-fit</code> instead of <code>auto-fill</code>, a short row of items stretches across the full width instead of leaving empty columns.)</p>

<h2>Placing items and naming areas</h2>
<p>Grid lines are numbered from 1, and an item can span several tracks:</p>
<pre><code class="language-css">.featured {
  grid-column: span 2;   /* two columns wide */
}</code></pre>
<p>For whole-page layouts, named areas make the CSS read like a sketch of the page:</p>
<pre><code class="language-css">.page {
  display: grid;
  grid-template-columns: 15rem 1fr;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  min-height: 100vh;
}

.page &gt; header { grid-area: header; }
.page &gt; nav    { grid-area: sidebar; }
.page &gt; main   { grid-area: main; }
.page &gt; footer { grid-area: footer; }</code></pre>
<p>To stack everything on a phone, a media query only has to redefine the areas as a single column. The HTML does not change at all.</p>

<h2>Lining things up inside cells</h2>
<p>Grid uses the same alignment words as flexbox: <code>align-items</code> for the vertical direction, <code>justify-items</code> for the horizontal direction, and <code>place-items: center</code> as a shorthand for both. By default items stretch to fill their cell, which is why cards in the same row come out the same height — something that used to take real effort.</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing <code>grid-template-rows</code> when you mean columns. Rows usually take care of themselves.</li>
<li>Fixed column widths in pixels that add up to more than a phone screen, causing a sideways scroll. Prefer <code>fr</code>, <code>minmax()</code> and percentages.</li>
<li>Rearranging items visually with grid placement until the screen order no longer matches the HTML order. Keyboard users move through the page in HTML order, so the two should agree.</li>
</ul>

<details><summary>Check yourself: you want four equal columns with 1rem between them. What do you write?</summary><p><code>display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;</code></p></details>`,
          resources: [
            {
              title: 'MDN: CSS grid layout',
              url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Responsive design, mobile first',
          minutes: 14,
          topic: 'Responsive design',
          html: `<p>For many learners in India, a phone is the main — sometimes the only — device they browse on, often over a patchy mobile connection. A <strong>responsive</strong> page uses one set of HTML and adapts its layout to the space available: one column on a phone, two on a tablet, three on a laptop. This lesson covers the tools, and the habit that makes them easy to use: writing CSS <strong>mobile first</strong>.</p>

<h2>Step 1: the viewport meta tag</h2>
<pre><code class="language-html">&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;</code></pre>
<p>Without this line, a phone pretends to be about 980px wide and shrinks the whole page to fit, so the text is tiny and your media queries never match. Every page needs it.</p>

<h2>Step 2: flexible units instead of fixed sizes</h2>
<ul>
<li><code>rem</code> is relative to the root font size (usually 16px). Use it for font sizes and spacing, so everything scales when a user increases their browser's text size.</li>
<li><code>%</code>, <code>fr</code> and <code>vw</code> are relative to the space available.</li>
<li><code>max-width</code> instead of <code>width</code> lets a box shrink on small screens but stop growing on large ones. <code>max-width: 70rem; margin-inline: auto;</code> gives you a centred, readable content column.</li>
<li>Images should never overflow their container:</li>
</ul>
<pre><code class="language-css">img {
  max-width: 100%;
  height: auto;
}</code></pre>

<h2>Step 3: media queries, mobile first</h2>
<p>A media query applies rules only when a condition is true, usually a minimum width. Mobile first means your base CSS, outside any media query, is for the smallest screen, and each query <em>adds</em> layout as space grows:</p>
<pre><code class="language-css">/* Base: phones get one column. */
.course-grid {
  display: grid;
  gap: 1rem;
}

/* From 640px: two columns. */
@media (min-width: 640px) {
  .course-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* From 1024px: three columns. */
@media (min-width: 1024px) {
  .course-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}</code></pre>
<p>Why start small? The phone layout is usually the simplest — everything stacked — so it needs the least CSS. You then never write desktop styles only to undo them for phones with <code>max-width</code> queries, which quickly turns into a tangle of overrides.</p>
<p>Choose breakpoints where <strong>your content</strong> starts to look wrong, not by device names. Drag the browser window narrower and add a breakpoint where the layout breaks.</p>

<h2>Fluid type with clamp()</h2>
<p><code>clamp(minimum, preferred, maximum)</code> lets a value grow smoothly with the screen between two limits, which suits headings well:</p>
<pre><code class="language-css">h1 {
  font-size: clamp(1.75rem, 1.2rem + 2.5vw, 3rem);
}</code></pre>

<h2>Testing responsiveness</h2>
<ul>
<li>Use the device toolbar in the developer tools, and also drag the window from very narrow to very wide.</li>
<li>Test at 360px wide, a common width for budget Android phones. There should be no sideways scrolling.</li>
<li>Check tap targets: buttons and links should be comfortably large (around 44px) with space between them.</li>
<li>Throttle the network in the Network tab to a slow mobile setting and see how the page feels.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting the viewport meta tag and blaming the media queries.</li>
<li>Writing <code>@media (max-width: 768px)</code> blocks to patch a desktop-first page one bug at a time.</li>
<li>A fixed-width element, such as a 600px table or image, that forces the whole page to scroll sideways. Wrap wide tables in a container with <code>overflow-x: auto</code>.</li>
<li>Hiding important content on phones with <code>display: none</code>. Phone users need the same information.</li>
</ul>`,
          resources: [
            { title: 'web.dev: Learn Responsive Design', url: 'https://web.dev/learn/design' },
          ],
        },
        { kind: 'practice', question: 'css-specificity', topic: 'Practice' },
        { kind: 'practice', question: 'css-flex-centre', topic: 'Practice' },
        { kind: 'practice', question: 'css-mobile-first', topic: 'Practice' },
      ],
    },
    {
      title: 'JavaScript',
      summary:
        'The JavaScript language: values and variables, decisions and loops, functions and closures, arrays and objects, and asynchronous code with promises, async/await and fetch.',
      lessons: [
        {
          kind: 'article',
          title: 'Values, variables and types',
          minutes: 14,
          topic: 'The language',
          html: `<p>JavaScript is the only programming language that runs natively in every browser, and with Node.js it runs on servers too. If you already know some Java or Python, much of it will feel familiar — and a few things will surprise you. This lesson covers the building blocks: values, variables and types.</p>

<h2>Trying code</h2>
<p>Open the Console in your browser's developer tools and type along. <code>console.log()</code> prints a value, and in the Console you can also type any expression and see its result straight away.</p>

<h2>Declaring variables: const and let</h2>
<pre><code class="language-javascript">const instituteName = 'SI Academy';
let seatsLeft = 30;

seatsLeft = seatsLeft - 1;   // fine: a let variable can be reassigned
instituteName = 'Other';     // TypeError: Assignment to constant variable.</code></pre>
<ul>
<li>Use <code>const</code> by default. It tells the reader "this name always refers to the same value", which makes code easier to follow.</li>
<li>Use <code>let</code> when the variable must change, such as a counter or a running total.</li>
<li>Avoid the old <code>var</code>. It ignores block scope and lets you use a variable before its declaration, and both cause bugs.</li>
</ul>
<p><code>let</code> and <code>const</code> are <strong>block-scoped</strong>: a variable declared inside a pair of braces exists only inside those braces.</p>
<pre><code class="language-javascript">if (seatsLeft &gt; 0) {
  const message = 'Seats available';
}
console.log(message); // ReferenceError: message is not defined</code></pre>
<p>Note that <code>const</code> fixes the <em>variable</em>, not the value it refers to. The contents of a <code>const</code> object or array can still change; you just cannot point the name at a different object.</p>

<h2>The types of values</h2>
<table>
<thead><tr><th scope="col">Type</th><th scope="col">Examples</th></tr></thead>
<tbody>
<tr><td>string</td><td><code>'Java'</code>, <code>"Ravi"</code>, <code>\`Batch \${n}\`</code></td></tr>
<tr><td>number</td><td><code>42</code>, <code>3.14</code>, <code>-7</code> (one type for whole and decimal numbers)</td></tr>
<tr><td>boolean</td><td><code>true</code>, <code>false</code></td></tr>
<tr><td>undefined</td><td>A variable that has not been given a value</td></tr>
<tr><td>null</td><td>"Deliberately empty", set by you</td></tr>
<tr><td>bigint</td><td><code>12345678901234567890n</code>, for very large whole numbers</td></tr>
<tr><td>object</td><td><code>{ name: 'Asha' }</code>, and also arrays, functions and dates</td></tr>
</tbody>
</table>
<p>There is also <code>symbol</code>, which you will rarely need. <code>typeof</code> tells you the type of a value, with two famous quirks: <code>typeof null</code> is <code>'object'</code>, and so is <code>typeof []</code>. Use <code>Array.isArray()</code> to check for arrays.</p>
<p>Numbers are 64-bit floating point, so <code>0.1 + 0.2</code> is <code>0.30000000000000004</code>. For money, work in whole paise (<code>4500000</code> rather than <code>45000.00</code> rupees) and format the amount only when you display it.</p>

<h2>Template literals</h2>
<p>Strings written in backticks can contain expressions inside <code>\${ }</code> and can span several lines:</p>
<pre><code class="language-javascript">const learner = 'Priya';
const score = 86;
console.log(\`\${learner} scored \${score}% in the weekly test.\`);</code></pre>

<h2>Equality: always use ===</h2>
<p><code>==</code> converts both sides to a common type before comparing, using rules that are hard to remember: <code>'5' == 5</code> is <code>true</code>, and so is <code>0 == ''</code>. <code>===</code> compares type and value without any conversion, so <code>'5' === 5</code> is <code>false</code>. Use <code>===</code> and <code>!==</code> everywhere. Values read from form fields are always strings, so convert them with <code>Number(input.value)</code> before comparing them with numbers.</p>

<h2>Truthy and falsy</h2>
<p>In an <code>if</code>, every value counts as either true or false. The falsy values are <code>false</code>, <code>0</code>, <code>-0</code>, <code>0n</code>, <code>''</code> (the empty string), <code>null</code>, <code>undefined</code> and <code>NaN</code>. Everything else is truthy — including <code>'0'</code>, <code>'false'</code>, <code>[]</code> and <code>{}</code>.</p>

<h2>Common mistakes</h2>
<ul>
<li>Adding a number to a string from a form: <code>'5' + 1</code> is <code>'51'</code>, because <code>+</code> joins strings. Convert first.</li>
<li>Declaring everything with <code>let</code> "just in case". Reach for <code>const</code> first.</li>
<li>Believing <code>const</code> makes an object read-only. Use <code>Object.freeze()</code> when you truly need that.</li>
</ul>`,
          resources: [
            {
              title: 'MDN: JavaScript Guide',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Decisions and loops',
          minutes: 12,
          topic: 'The language',
          html: `<p>Programs earn their keep by making decisions and repeating work. JavaScript's syntax for both is close to Java and C, with a few extra loops and operators that make everyday code shorter and safer.</p>

<h2>if, else if, else</h2>
<pre><code class="language-javascript">function grade(score) {
  if (score &gt;= 90) {
    return 'A';
  } else if (score &gt;= 75) {
    return 'B';
  } else if (score &gt;= 50) {
    return 'C';
  } else {
    return 'Needs another attempt';
  }
}

console.log(grade(82)); // 'B'</code></pre>
<p>The conditions are checked from the top, and only the first true branch runs. That is why the highest threshold comes first.</p>

<h2>The conditional (ternary) operator</h2>
<p>For a choice between two values, <code>condition ? valueIfTrue : valueIfFalse</code> is shorter than an if statement:</p>
<pre><code class="language-javascript">const label = seatsLeft === 1 ? '1 seat left' : \`\${seatsLeft} seats left\`;</code></pre>
<p>Keep it for simple cases; nested ternaries are hard to read.</p>

<h2>Logical operators and defaults</h2>
<ul>
<li><code>&amp;&amp;</code> (and), <code>||</code> (or) and <code>!</code> (not) combine conditions: <code>if (isEnrolled &amp;&amp; !feesPending)</code>.</li>
<li><code>??</code> (nullish coalescing) supplies a default only when a value is <code>null</code> or <code>undefined</code>: <code>const batchSize = settings.batchSize ?? 30;</code></li>
<li><code>||</code> also supplies defaults, but for <em>any</em> falsy value. <code>settings.discount || 10</code> replaces a real discount of 0 with 10 — a classic bug that <code>??</code> avoids.</li>
<li><code>?.</code> (optional chaining) stops at <code>null</code> or <code>undefined</code> instead of throwing an error: <code>learner.address?.city</code> is simply <code>undefined</code> when there is no address.</li>
</ul>

<h2>switch</h2>
<pre><code class="language-javascript">switch (day) {
  case 'Saturday':
  case 'Sunday':
    console.log('Weekend batch');
    break;
  default:
    console.log('Weekday batch');
}</code></pre>
<p>Forget the <code>break</code> and execution falls through into the next case. When you are only mapping one value to another, an object lookup is often clearer than a switch.</p>

<h2>Loops</h2>
<pre><code class="language-javascript">const fees = [12000, 8000, 15000];

// The counting loop: when you need the index
for (let i = 0; i &lt; fees.length; i++) {
  console.log(\`Instalment \${i + 1}: ₹\${fees[i]}\`);
}

// for...of: the values of an array (or a string, Map or Set)
let total = 0;
for (const fee of fees) {
  total += fee;
}
console.log(total); // 35000

// while: when you do not know in advance how many times
let savings = 100000;
let years = 0;
while (savings &lt; 200000) {
  savings *= 1.08;   // 8% growth a year
  years++;
}
console.log(years); // 10</code></pre>
<p><code>break</code> leaves a loop early and <code>continue</code> skips to the next pass. There is also <code>for...in</code>, which walks over an object's property <em>names</em>; do not use it on arrays, where it gives you the indexes as strings.</p>
<p>In everyday code you will often replace loops over arrays with methods such as <code>map</code>, <code>filter</code> and <code>reduce</code>, which you will meet two lessons from now. Loops remain the right tool when you need to stop early or do several things on each pass.</p>

<h2>Common mistakes</h2>
<ul>
<li>Declaring a running total <em>inside</em> the loop, so that it starts again from zero on every pass. Declare it once, before the loop.</li>
<li>Off-by-one errors: <code>i &lt;= fees.length</code> reads one element past the end and gets <code>undefined</code>.</li>
<li>Writing <code>if (x = 5)</code>, an assignment, instead of the comparison <code>if (x === 5)</code>.</li>
</ul>
<p>The first mistake is exactly what the debugging lab in this module asks you to find and fix.</p>`,
        },
        {
          kind: 'article',
          title: 'Functions, arrow functions and closures',
          minutes: 15,
          topic: 'Functions',
          html: `<p>A function is a named, reusable piece of logic: give it inputs and get back an output. In JavaScript, functions are also <strong>values</strong>. You can store them in variables, pass them to other functions and return them from functions. That idea powers event handlers, array methods and, later, React.</p>

<h2>Three ways to write a function</h2>
<pre><code class="language-javascript">// 1. A function declaration
function withGst(amount) {
  return amount * 1.18;
}

// 2. A function expression stored in a variable
const withGstToo = function (amount) {
  return amount * 1.18;
};

// 3. An arrow function
const withGstArrow = (amount) =&gt; amount * 1.18;</code></pre>
<p>Arrow functions are the most common style in modern code. When the arrow is followed by a single expression, its value is returned automatically. With braces, you need an explicit <code>return</code>:</p>
<pre><code class="language-javascript">const feeWithGst = (amount) =&gt; {
  const gst = amount * 0.18;
  return amount + gst;
};</code></pre>
<p>To return an object from a one-line arrow function, wrap it in parentheses: <code>(name) =&gt; ({ name, enrolled: true })</code>. Without them, the braces are read as a function body.</p>
<p>One practical difference: function declarations are <strong>hoisted</strong>, so you can call them before the line where they are written. A function stored in a <code>const</code> cannot be used before its line.</p>

<h2>Parameters</h2>
<pre><code class="language-javascript">function greet(name, greeting = 'Welcome') {
  return \`\${greeting}, \${name}!\`;
}

greet('Karthik');           // 'Welcome, Karthik!'
greet('Karthik', 'Hello');  // 'Hello, Karthik!'

function average(...marks) {
  const total = marks.reduce((sum, m) =&gt; sum + m, 0);
  return total / marks.length;
}

average(70, 85, 90);        // 81.666...</code></pre>
<p>A default parameter is used when the argument is missing (or <code>undefined</code>). A <strong>rest parameter</strong> such as <code>...marks</code> collects any number of arguments into an array.</p>

<h2>Functions as values</h2>
<pre><code class="language-javascript">function applyDiscount(amount, rule) {
  return rule(amount);
}

const scholarship = (amount) =&gt; amount * 0.5;
const earlyBird = (amount) =&gt; amount - 2000;

applyDiscount(40000, scholarship); // 20000
applyDiscount(40000, earlyBird);   // 38000</code></pre>
<p>A function passed to another function is called a <strong>callback</strong>. You will pass callbacks constantly: to <code>addEventListener</code>, to <code>setTimeout</code>, to <code>map</code> and <code>filter</code>.</p>

<h2>Closures</h2>
<p>A function remembers the variables that were in scope where it was <em>created</em>, even after the outer function has finished running. This is called a <strong>closure</strong>:</p>
<pre><code class="language-javascript">function makeTokenMachine() {
  let next = 0;
  return () =&gt; {
    next += 1;
    return \`T-\${next}\`;
  };
}

const takeToken = makeTokenMachine();
takeToken(); // 'T-1'
takeToken(); // 'T-2'
takeToken(); // 'T-3'</code></pre>
<p>Picture the token machine at a canteen counter: <code>next</code> is private to the machine. Nobody outside can reset it or skip a number; all they can do is take the next token. Each call to <code>makeTokenMachine()</code> builds a new machine with its own counter. Closures are how JavaScript keeps data private, and every event handler that uses a variable from the surrounding code relies on one.</p>

<h2>Common mistakes</h2>
<ul>
<li>Calling a function when you meant to pass it: <code>button.addEventListener('click', save())</code> runs <code>save</code> immediately and passes its result. Write <code>save</code> without the parentheses.</li>
<li>Forgetting <code>return</code> inside an arrow function with braces, so it returns <code>undefined</code>.</li>
<li>Very long functions. If you cannot name a function in a few words, it is doing too much; split it.</li>
</ul>
<p><strong>Interview tip:</strong> "Explain closures with an example" is one of the most asked JavaScript questions. A counter like the one above is the standard answer; be ready to say what it returns after three calls, and why.</p>`,
        },
        {
          kind: 'article',
          title: 'Arrays and objects in everyday code',
          minutes: 15,
          topic: 'Functions',
          html: `<p>Almost every real program works with lists of records: the courses in a catalogue, the learners in a batch, the dishes on a menu. In JavaScript those are <strong>arrays</strong> of <strong>objects</strong>. This lesson shows how to build, read and transform them the way professional code does.</p>

<h2>Objects: named values kept together</h2>
<pre><code class="language-javascript">const course = {
  slug: 'java-full-stack',
  title: 'Java Full Stack',
  weeks: 24,
  fee: 45000,
  tags: ['java', 'spring', 'react'],
};

console.log(course.title);   // dot notation
console.log(course['fee']);  // bracket notation, for names held in variables
course.weeks = 26;           // change a property
course.mode = 'Hybrid';      // add one
delete course.mode;          // remove it</code></pre>
<p>When a variable already has the property's name, use the shorthand: <code>const name = 'Asha'; const learner = { name };</code> creates <code>{ name: 'Asha' }</code>. <code>Object.keys()</code>, <code>Object.values()</code> and <code>Object.entries()</code> give you arrays of an object's names, values or name–value pairs.</p>

<h2>Arrays: ordered lists</h2>
<pre><code class="language-javascript">const batch = ['Asha', 'Ravi', 'Meena'];
batch.length;            // 3
batch[0];                // 'Asha'
batch.at(-1);            // 'Meena' (counts from the end)
batch.push('Imran');     // adds to the end
batch.includes('Ravi');  // true</code></pre>

<h2>The methods that replace most loops</h2>
<pre><code class="language-javascript">const courses = [
  { title: 'Java Full Stack', fee: 45000, level: 'beginner' },
  { title: 'Python Full Stack', fee: 40000, level: 'beginner' },
  { title: 'Spring Microservices', fee: 30000, level: 'advanced' },
];

// map: turn every item into something new (same length)
const titles = courses.map((c) =&gt; c.title);

// filter: keep the items that pass a test
const forBeginners = courses.filter((c) =&gt; c.level === 'beginner');

// find: the first item that passes, or undefined
const python = courses.find((c) =&gt; c.title.startsWith('Python'));

// some and every: does any item pass? does every item pass?
const anyAdvanced = courses.some((c) =&gt; c.level === 'advanced'); // true

// reduce: combine all the items into one value
const totalFees = courses.reduce((sum, c) =&gt; sum + c.fee, 0); // 115000</code></pre>
<p>These methods leave the original array unchanged and return new values. They also chain well: <code>courses.filter((c) =&gt; c.fee &lt; 42000).map((c) =&gt; c.title)</code> gives the titles of the courses under ₹42,000.</p>
<p><code>forEach</code> also visits every item, but it always returns <code>undefined</code>. Use it for side effects such as logging; use <code>map</code> when you want a new array.</p>

<h2>Sorting without surprises</h2>
<p><code>sort()</code> changes the array in place and, without a compare function, sorts the items as <em>strings</em>, so <code>[10, 9, 100].sort()</code> gives <code>[10, 100, 9]</code>. Always pass a compare function, and prefer <code>toSorted()</code> (added in ES2023), which returns a sorted copy and leaves the original alone:</p>
<pre><code class="language-javascript">const cheapestFirst = courses.toSorted((a, b) =&gt; a.fee - b.fee);</code></pre>

<h2>Destructuring and JSON</h2>
<p>Destructuring pulls values out into variables in one line: <code>const { title, fee } = course;</code> and <code>const [first, second] = batch;</code>. You will use it constantly in React.</p>
<p>JSON is the text format APIs use to send this kind of data. <code>JSON.stringify(course)</code> turns an object into a JSON string, and <code>JSON.parse(text)</code> turns JSON text back into objects and arrays. JSON looks like JavaScript, but its keys must be in double quotes, and it cannot hold functions or <code>undefined</code>.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting to return from the callback: <code>courses.map((c) =&gt; { c.title; })</code> gives an array of <code>undefined</code>, because braces need an explicit <code>return</code>.</li>
<li>Comparing objects with <code>===</code>. Two objects with identical contents are still two different objects; compare a field such as an id instead.</li>
<li>"Copying" an array with <code>const copy = original;</code>. Both names now refer to the same array. Use <code>[...original]</code> to make a (shallow) copy.</li>
</ul>`,
        },
        {
          kind: 'article',
          title: 'Asynchronous JavaScript: promises, async/await and fetch',
          minutes: 16,
          topic: 'Asynchronous code',
          html: `<p>Some work takes time: downloading the course list from a server, reading a file, waiting for a timer. JavaScript in the browser runs your code on a single thread, so if it simply waited, the whole page would freeze — no scrolling, no clicks. Instead it starts the slow work, carries on, and comes back when the result is ready. This is <strong>asynchronous</strong> code.</p>

<h2>The event loop in one paragraph</h2>
<p>Your synchronous code always runs to the end first. The results of slow operations wait in queues. When nothing else is running, the event loop first runs every waiting <strong>microtask</strong> (promise callbacks), then takes the next <strong>task</strong> (a timer callback, a click handler), and repeats. That explains a classic interview puzzle:</p>
<pre><code class="language-javascript">console.log('A');
setTimeout(() =&gt; console.log('B'), 0);
Promise.resolve().then(() =&gt; console.log('C'));
console.log('D');
// Prints A, D, C, B</code></pre>
<p>A and D are synchronous. C is a promise callback, a microtask, so it runs before B, the timer callback — even though the timer's delay is 0.</p>

<h2>Promises</h2>
<p>A <strong>promise</strong> is an object that stands in for a result that is not ready yet. It starts <em>pending</em> and later becomes either <em>fulfilled</em> with a value or <em>rejected</em> with an error. You can attach callbacks with <code>.then()</code> and <code>.catch()</code>, but modern code mostly uses <code>async</code> and <code>await</code>, which let asynchronous code read like ordinary step-by-step code.</p>

<h2>async and await</h2>
<pre><code class="language-javascript">async function loadCourses() {
  const response = await fetch('/api/courses');
  if (!response.ok) {
    throw new Error(\`Could not load courses (HTTP \${response.status})\`);
  }
  return response.json();
}</code></pre>
<ul>
<li><code>async</code> in front of a function makes it return a promise.</li>
<li><code>await</code> pauses <em>this function</em> — not the page — until the promise settles, then gives you its value, or throws its error.</li>
<li><code>fetch()</code> resolves with a <code>Response</code> as soon as the headers arrive. Reading the body with <code>response.json()</code> is a second asynchronous step that also returns a promise.</li>
<li><code>fetch()</code> rejects only when the request could not be made at all (no network, or blocked by the browser). A 404 or 500 response still <em>fulfils</em>, so check <code>response.ok</code> (true for statuses 200–299) yourself.</li>
</ul>

<h2>Handling errors</h2>
<pre><code class="language-javascript">async function showCourseCount() {
  try {
    const courses = await loadCourses();
    console.log(\`\${courses.length} courses available\`);
  } catch (error) {
    console.error(error);
    console.log('Sorry, the course list is not available right now.');
  }
}</code></pre>
<p>Every <code>await</code> that can fail needs a <code>try...catch</code> somewhere up the chain. A rejected promise that nobody catches shows up in the Console as an "Uncaught (in promise)" error, and the user is left looking at a page that never finishes loading.</p>

<h2>Sending data</h2>
<p>To send data, give <code>fetch</code> a second argument (inside an async function, as before):</p>
<pre><code class="language-javascript">const response = await fetch('/api/enquiries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Asha', course: 'java' }),
});</code></pre>

<h2>Several requests at once</h2>
<p>Awaiting requests one after another makes them run one after another. When they do not depend on each other, start them together and wait for all of them with <code>Promise.all</code>:</p>
<pre><code class="language-javascript">async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`HTTP \${response.status} for \${url}\`);
  return response.json();
}

async function loadPage() {
  const [courses, batches] = await Promise.all([
    getJson('/api/courses'),
    getJson('/api/batches'),
  ]);
  console.log(courses.length, batches.length);
}</code></pre>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>await</code>: <code>const data = response.json();</code> gives you a pending promise, not the data.</li>
<li>Using <code>await</code> outside an <code>async</code> function in a classic script. (It is allowed at the top level of JavaScript modules.)</li>
<li>Assuming that a <code>fetch</code> that did not throw means the request succeeded. Always check <code>response.ok</code>.</li>
</ul>`,
          resources: [
            {
              title: 'MDN: Fetch API',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
            },
          ],
        },
        { kind: 'practice', question: 'js-strict-equality', topic: 'Practice' },
        { kind: 'lab', lab: 'debug-js-running-total', topic: 'Practice' },
        { kind: 'practice', question: 'js-title-case', topic: 'Practice' },
        { kind: 'practice', question: 'js-event-loop-order', topic: 'Practice' },
      ],
    },
    {
      title: 'The browser and the DOM',
      summary:
        'Make pages interactive: find and change elements through the DOM, respond to events, check forms before they are sent, and show data loaded from an API.',
      lessons: [
        {
          kind: 'article',
          title: 'The DOM: finding and changing elements',
          minutes: 14,
          topic: 'The DOM',
          html: `<p>When the browser reads your HTML, it builds the <strong>DOM</strong> (Document Object Model): a tree of JavaScript objects, one for each element, with the <code>document</code> object at the top. The HTML file is only the starting point. Your JavaScript works on the tree, and whatever you change there appears on the screen straight away.</p>

<h2>Finding elements</h2>
<pre><code class="language-javascript">// The first match for any CSS selector, or null
const heading = document.querySelector('h1');
const totalText = document.querySelector('#total');
const firstCard = document.querySelector('.course-card');

// Every match, as a NodeList you can loop over with for...of
const cards = document.querySelectorAll('.course-card');

// By id (no # here)
const form = document.getElementById('enquiry');</code></pre>
<p>Any CSS selector you know works in <code>querySelector</code>. If it returns <code>null</code>, either the selector is wrong or the script ran before the element existed — load your scripts with <code>defer</code>.</p>

<h2>Reading and changing text</h2>
<pre><code class="language-javascript">heading.textContent = 'Courses starting this month';

const fee = Number(document.querySelector('.fee').textContent); // read, then convert</code></pre>
<p><code>textContent</code> treats whatever you give it as plain text. There is also <code>innerHTML</code>, which parses its value as HTML. Never put text that came from a user or a server into <code>innerHTML</code>: if a learner's "name" is <code>&lt;img src=x onerror="..."&gt;</code>, the browser runs that code. This is called cross-site scripting (XSS), one of the most common security bugs on the web. Use <code>textContent</code> for text, and <code>createElement</code> when you need structure.</p>

<h2>Classes, attributes and visibility</h2>
<pre><code class="language-javascript">const card = document.querySelector('.course-card');

card.classList.add('selected');
card.classList.remove('selected');
card.classList.toggle('expanded');     // add if absent, remove if present
card.classList.contains('expanded');   // true or false

const link = card.querySelector('a');
link.getAttribute('href');             // '/courses/java'
link.setAttribute('aria-current', 'page');

const details = card.querySelector('.details');
details.hidden = true;                 // the hidden attribute, as a property</code></pre>
<p>Prefer switching classes over setting <code>element.style</code> directly. Your CSS stays in charge of how things look, and JavaScript only says which state an element is in.</p>

<h2>Creating and removing elements</h2>
<pre><code class="language-javascript">const list = document.querySelector('#batch-list');

for (const name of ['Asha', 'Ravi', 'Meena']) {
  const item = document.createElement('li');
  item.textContent = name;
  list.append(item);
}

list.firstElementChild.remove();       // removes 'Asha'</code></pre>
<p><code>append</code> adds at the end, <code>prepend</code> at the start, and <code>remove()</code> takes an element out of the page. <code>list.replaceChildren()</code> with no arguments removes every child, and with arguments swaps in a new set.</p>

<h2>Walking the tree</h2>
<p>Every element knows its relatives: <code>parentElement</code>, <code>children</code>, <code>firstElementChild</code>, <code>nextElementSibling</code>. <code>element.closest('.course-card')</code> walks <em>up</em> from an element to the nearest ancestor that matches a selector, which is very useful in event handlers, as the next lesson shows.</p>

<h2>Common mistakes</h2>
<ul>
<li>Calling methods on <code>null</code>. "Cannot read properties of null" almost always means <code>querySelector</code> found nothing.</li>
<li>Treating the result of <code>querySelectorAll</code> as one element. <code>cards.classList</code> does not exist; loop over the cards instead.</li>
<li>Using <code>innerHTML +=</code> in a loop. It re-parses the whole list every time and throws away any event listeners inside it.</li>
</ul>`,
          resources: [
            {
              title: 'MDN: Document Object Model',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Events: clicks, keys and form submissions',
          minutes: 14,
          topic: 'Events',
          html: `<p>A page becomes interactive when it reacts to what the user does. Every click, key press, form submission and scroll creates an <strong>event</strong>, and you can ask the browser to call your function — an <strong>event listener</strong> — when a particular event happens on a particular element.</p>

<h2>Listening for an event</h2>
<pre><code class="language-javascript">const button = document.querySelector('#show-syllabus');
const syllabus = document.querySelector('#syllabus');

button.addEventListener('click', () =&gt; {
  syllabus.hidden = !syllabus.hidden;
  button.textContent = syllabus.hidden ? 'Show syllabus' : 'Hide syllabus';
  button.setAttribute('aria-expanded', String(!syllabus.hidden));
});</code></pre>
<p>The first argument is the event type, the second the function to call. Pass the function itself; do not call it. Avoid the old inline style (<code>onclick="..."</code> in the HTML): it mixes behaviour into the markup and allows only one handler per event.</p>

<h2>The event object</h2>
<p>Your listener receives an <strong>event object</strong> describing what happened:</p>
<pre><code class="language-javascript">document.addEventListener('keydown', (event) =&gt; {
  if (event.key === 'Escape') {
    closeSyllabus();
  }
});</code></pre>
<ul>
<li><code>event.target</code>: the element where the event started, such as the exact button clicked.</li>
<li><code>event.currentTarget</code>: the element whose listener is running.</li>
<li><code>event.key</code>: for keyboard events, the key, such as <code>'Enter'</code> or <code>'a'</code>.</li>
<li><code>event.preventDefault()</code>: stops the browser's default action, such as following a link or submitting a form.</li>
</ul>

<h2>Common events</h2>
<table>
<thead><tr><th scope="col">Event</th><th scope="col">Fires when</th></tr></thead>
<tbody>
<tr><td><code>click</code></td><td>An element is clicked, or a button is activated with <kbd>Enter</kbd> or <kbd>Space</kbd></td></tr>
<tr><td><code>input</code></td><td>A field's value changes, on every keystroke</td></tr>
<tr><td><code>change</code></td><td>A value is committed: an option chosen, a box ticked, a text field left</td></tr>
<tr><td><code>submit</code></td><td>A form is submitted, by its button or by <kbd>Enter</kbd> in a field</td></tr>
<tr><td><code>keydown</code></td><td>A key is pressed</td></tr>
<tr><td><code>DOMContentLoaded</code></td><td>The HTML has been parsed (deferred scripts already wait for this)</td></tr>
</tbody>
</table>

<h2>Forms: listen for submit, not click</h2>
<pre><code class="language-javascript">const form = document.querySelector('#search-form');

form.addEventListener('submit', (event) =&gt; {
  event.preventDefault();          // stay on this page
  const query = form.elements.query.value.trim();
  showResults(query);
});</code></pre>
<p>A <code>submit</code> listener on the form catches both a click on the submit button and the <kbd>Enter</kbd> key in a text field. A click listener on the button misses the second.</p>

<h2>Bubbling and event delegation</h2>
<p>Events <strong>bubble</strong>: a click on a button inside a card also fires on the card, then on the list around it, and so on up to the document. That lets one listener on a parent handle clicks on many children — including children added later:</p>
<pre><code class="language-javascript">const menu = document.querySelector('#menu');

menu.addEventListener('click', (event) =&gt; {
  const button = event.target.closest('button.add');
  if (!button) return;             // the click was somewhere else
  const dish = button.closest('.dish');
  addToOrder(dish.dataset.name);
});</code></pre>
<p>This pattern is called <strong>event delegation</strong>. Instead of attaching fifty listeners to fifty "Add" buttons on a canteen menu, you attach one to the menu. <code>dataset.name</code> reads the element's <code>data-name</code> attribute, the standard place to keep small pieces of data on an element.</p>

<h2>Common mistakes</h2>
<ul>
<li><code>addEventListener('click', handleClick())</code>: the parentheses call the function at once and pass its return value instead of the function.</li>
<li>Adding the same listener again every time the page updates, so one click runs the handler three times.</li>
<li>Making a <code>&lt;div&gt;</code> clickable. It cannot be reached with <kbd>Tab</kbd> and ignores <kbd>Enter</kbd>; a <code>&lt;button&gt;</code> handles both for you.</li>
</ul>`,
        },
        {
          kind: 'article',
          title: 'Checking forms with JavaScript',
          minutes: 12,
          topic: 'Events',
          html: `<p>HTML attributes such as <code>required</code> and <code>type="email"</code> give you basic checks for free. Sometimes you need more: your own wording, a rule involving two fields, or messages shown in your own design. This lesson shows a pattern that works with the browser's built-in validation instead of against it, and stays accessible.</p>

<h2>The form</h2>
<pre><code class="language-html">&lt;form id="signup" novalidate&gt;
  &lt;label for="email"&gt;Email address&lt;/label&gt;
  &lt;input id="email" name="email" type="email" required
         aria-describedby="email-error"&gt;
  &lt;p id="email-error" class="error" role="alert"&gt;&lt;/p&gt;

  &lt;label for="password"&gt;Password (at least 8 characters)&lt;/label&gt;
  &lt;input id="password" name="password" type="password" minlength="8" required
         aria-describedby="password-error"&gt;
  &lt;p id="password-error" class="error" role="alert"&gt;&lt;/p&gt;

  &lt;label for="confirm"&gt;Confirm password&lt;/label&gt;
  &lt;input id="confirm" name="confirm" type="password" required
         aria-describedby="confirm-error"&gt;
  &lt;p id="confirm-error" class="error" role="alert"&gt;&lt;/p&gt;

  &lt;button type="submit"&gt;Create account&lt;/button&gt;
  &lt;p id="done"&gt;&lt;/p&gt;
&lt;/form&gt;</code></pre>
<p><code>novalidate</code> switches off the browser's own pop-up messages so you can show yours, while the rules (<code>required</code>, <code>type</code>, <code>minlength</code>) still apply and can be read from JavaScript. <code>aria-describedby</code> links each field to its error text so a screen reader reads both, and <code>role="alert"</code> makes new error text be announced as soon as it appears.</p>

<h2>The script</h2>
<pre><code class="language-javascript">const form = document.querySelector('#signup');
const { email, password, confirm } = form.elements;

function showError(field, message) {
  document.querySelector(\`#\${field.id}-error\`).textContent = message;
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  return message === '';
}

function checkEmail() {
  return showError(email, email.validity.valid ? '' : 'Enter an email address like name@example.com');
}

function checkPassword() {
  return showError(password, password.validity.valid ? '' : 'Use at least 8 characters');
}

function checkConfirm() {
  return showError(confirm, confirm.value === password.value ? '' : 'The two passwords do not match');
}

form.addEventListener('submit', (event) =&gt; {
  event.preventDefault();
  const results = [checkEmail(), checkPassword(), checkConfirm()];
  if (results.includes(false)) {
    form.querySelector('[aria-invalid="true"]').focus();
    return;
  }
  document.querySelector('#done').textContent = 'Account created. Check your email.';
});</code></pre>
<p><code>field.validity</code> reports which built-in rule failed — <code>valueMissing</code>, <code>typeMismatch</code>, <code>tooShort</code>, <code>patternMismatch</code> and more — and <code>validity.valid</code> sums them up. Reading it means your JavaScript agrees with the HTML rules instead of re-implementing them. Every check runs on submit (collecting the results in an array, so that all the messages appear at once), and focus then moves to the first invalid field, so keyboard and screen reader users land exactly where the problem is.</p>

<h2>Good error messages</h2>
<ul>
<li>Say what to do, not only what is wrong: "Enter a 10-digit mobile number" beats "Invalid input".</li>
<li>Show the message next to the field, in text — not only as a red border, which colour-blind users may not see.</li>
<li>Check on submit, and then again as the user corrects a field (listen for <code>input</code> and call the same check), so the message disappears as soon as the problem is fixed. Flagging errors in a field the user has not finished typing in is irritating.</li>
</ul>

<h2>Never trust the browser alone</h2>
<p>Everything in the browser can be bypassed: a user can switch off JavaScript, edit the page in the developer tools, or send a request straight to your API. Client-side checks exist to help honest users fix mistakes quickly. The server must check every value again before saving it.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>event.preventDefault()</code>, so the page reloads and your message flashes for a split second.</li>
<li>Leaving an old error on screen after the user has fixed the field. Clear messages on success, as <code>showError(field, '')</code> does above.</li>
<li>Showing a thank-you message and an error at the same time.</li>
</ul>
<p>The sign-up lab in this module asks you to build the core of this pattern: refuse an address without an @, thank the learner for a good one, and never show both messages together.</p>`,
        },
        {
          kind: 'article',
          title: 'Putting it together: showing a course list from an API',
          minutes: 15,
          topic: 'Fetching data',
          html: `<p>This lesson combines everything in the course so far — semantic HTML, <code>fetch</code> with <code>async</code> and <code>await</code>, and DOM updates — into the core of a real feature: a catalogue page that loads courses from an API and lets the learner filter them. Along the way you will handle the states beginners usually forget: loading, empty and error.</p>

<h2>The HTML</h2>
<pre><code class="language-html">&lt;main&gt;
  &lt;h1&gt;Course catalogue&lt;/h1&gt;
  &lt;label for="filter"&gt;Filter by title&lt;/label&gt;
  &lt;input id="filter" type="search"&gt;
  &lt;p id="status" role="status"&gt;Loading courses…&lt;/p&gt;
  &lt;ul id="courses" class="course-grid"&gt;&lt;/ul&gt;
&lt;/main&gt;</code></pre>
<p>The status paragraph has <code>role="status"</code>, so screen readers announce its changes politely, without interrupting what the user is doing.</p>

<h2>The data</h2>
<p>Suppose <code>GET /api/courses</code> returns JSON like this:</p>
<pre><code class="language-json">[
  { "slug": "java-full-stack", "title": "Java Full Stack", "weeks": 24 },
  { "slug": "python-full-stack", "title": "Python Full Stack", "weeks": 20 }
]</code></pre>

<h2>The script</h2>
<pre><code class="language-javascript">const list = document.querySelector('#courses');
const statusLine = document.querySelector('#status');
const filter = document.querySelector('#filter');

let courses = [];      // the single source of truth
let loading = true;

function courseItem(course) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = \`/courses/\${course.slug}\`;
  link.textContent = course.title;
  const weeks = document.createElement('p');
  weeks.textContent = \`\${course.weeks} weeks\`;
  item.append(link, weeks);
  return item;
}

function render() {
  const query = filter.value.trim().toLowerCase();
  const visible = courses.filter((c) =&gt; c.title.toLowerCase().includes(query));
  list.replaceChildren(...visible.map(courseItem));

  if (loading) statusLine.textContent = 'Loading courses…';
  else if (visible.length === 0) statusLine.textContent = 'No courses match your filter.';
  else statusLine.textContent = '';
}

async function load() {
  try {
    const response = await fetch('/api/courses');
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    courses = await response.json();
    loading = false;
    render();
  } catch (error) {
    console.error(error);
    statusLine.textContent = 'Sorry, we could not load the courses. Please try again later.';
  }
}

filter.addEventListener('input', render);
load();</code></pre>

<h2>Why it is built this way</h2>
<ul>
<li><strong>State in one place.</strong> The <code>courses</code> array and the <code>loading</code> flag are the truth, and <code>render()</code> rebuilds the list from them. Whenever something changes — data arrives, the filter changes — you update the state and call <code>render()</code>. This is exactly the idea React is built on, as you will see in the React course.</li>
<li><strong>textContent, never innerHTML.</strong> Course titles come from a server, and data from a server can contain anything. Building elements and setting <code>textContent</code> keeps the page safe from injected HTML.</li>
<li><strong>Every state has a message.</strong> Loading, an empty result and a failure each tell the user what is going on. A blank page tells them nothing.</li>
<li><strong>The filter works on data already loaded</strong>, so typing feels instant and makes no extra requests.</li>
</ul>

<h2>Trying it without a backend</h2>
<p>You do not need a server-side application to practise. Save the JSON above as <code>courses.json</code> next to your page, fetch <code>'courses.json'</code> instead of the API path, and open the page through a local web server (remember that <code>fetch</code> does not work from <code>file://</code>). Later you can point the same code at a real API, such as the Spring Boot service you build in the Java programme.</p>

<h2>Check yourself</h2>
<details><summary>What would go wrong if <code>render()</code> did not check the <code>loading</code> flag?</summary><p>A learner who types in the filter before the data arrives would see "No courses match your filter." even though the courses simply have not loaded yet. The flag lets <code>render()</code> keep showing "Loading courses…" instead.</p></details>
<details><summary>Why does the filter listen for <code>input</code> rather than <code>change</code>?</summary><p><code>input</code> fires on every keystroke, so the list updates as the learner types. On a text field, <code>change</code> fires only when the value is committed, usually when the learner leaves the field.</p></details>`,
        },
        { kind: 'lab', lab: 'web-todo-list', topic: 'Practice' },
        { kind: 'lab', lab: 'web-signup-check', topic: 'Practice' },
        { kind: 'practice', question: 'js-fetch-await', topic: 'Practice' },
      ],
    },
  ],
  assignments: ['Web Foundations: HTML and CSS', 'JavaScript Essentials'],
  tests: [
    {
      title: 'Web Development — HTML and CSS weekly test',
      kind: 'weekly',
      description:
        'Ten quick questions on semantic and accessible HTML, forms, specificity, the box model, flexbox, grid and mobile-first media queries. Take it at the end of the HTML and CSS modules.',
      durationMinutes: 20,
      sections: [
        {
          title: 'HTML',
          questions: [
            'html-main-element',
            'html-alt-text',
            'html-label-for',
            'html-button-submits',
            'html-heading-order',
          ],
        },
        {
          title: 'CSS',
          questions: [
            'css-specificity',
            'css-box-sizing',
            'css-flex-centre',
            'css-grid-columns',
            'css-mobile-first',
          ],
        },
      ],
    },
    {
      title: 'Web Development — JavaScript weekly test',
      kind: 'weekly',
      description:
        'Scope, equality, const objects, array methods, closures, the event loop and reading JSON with fetch. Take it at the end of the JavaScript module.',
      durationMinutes: 20,
      sections: [
        {
          title: 'The language',
          questions: [
            'js-let-block-scope',
            'js-strict-equality',
            'js-const-object',
            'js-map-vs-foreach',
          ],
        },
        {
          title: 'Functions and asynchronous code',
          questions: ['js-closure-counter', 'js-event-loop-order', 'js-fetch-await'],
        },
      ],
    },
    {
      title: 'Web Development — final test',
      kind: 'final',
      description:
        'The whole course in one sitting: semantic HTML and forms, CSS layout and responsive design, and the JavaScript language from scope to asynchronous code.',
      durationMinutes: 40,
      sections: [
        {
          title: 'HTML',
          questions: [
            'html-main-element',
            'html-alt-text',
            'html-label-for',
            'html-button-submits',
            'html-heading-order',
          ],
        },
        {
          title: 'CSS',
          questions: [
            'css-specificity',
            'css-box-sizing',
            'css-flex-centre',
            'css-grid-columns',
            'css-mobile-first',
          ],
        },
        {
          title: 'JavaScript',
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
  ],
};
