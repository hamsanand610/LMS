/**
 * A moderately sized synthetic knowledge document for the ingestion tests (Roadmap Phase 8B):
 * generated, deterministic, written for the tests from no book, course or web page. Each section
 * has a heading, paragraphs (every fifth one longer than a chunk), a nested list, code (every
 * fourth one longer than a chunk), a table and a quotation, so that every rule of the chunker meets
 * real material.
 */

const TOPICS = [
  'variables',
  'loops',
  'methods',
  'classes',
  'inheritance',
  'interfaces',
  'collections',
  'exceptions',
  'recursion',
  'generics',
] as const;

function topicOf(section: number): string {
  return TOPICS[section % TOPICS.length]!;
}

function sentence(section: number, index: number): string {
  const topic = topicOf(section);
  const forms = [
    `Section ${section} studies ${topic} through example ${index}.`,
    `The idea of ${topic} builds on what the earlier sections showed.`,
    `A learner who practises ${topic} daily sees the pattern sooner.`,
    `Exercise ${index} asks for a short program that uses ${topic}.`,
    `Mistakes with ${topic} are common, and each one teaches something.`,
    `Read the code below slowly, line by line, before running it.`,
  ];
  return forms[index % forms.length]!;
}

function paragraph(section: number, sentences: number, offset: number): string {
  return Array.from({ length: sentences }, (_, i) => sentence(section, offset + i)).join(' ');
}

function code(section: number, lines: number): string {
  const body = Array.from(
    { length: lines },
    (_, i) => `        total += step(${section}, ${i}); // step ${i} of section ${section}`,
  );
  return [
    '```java',
    `public class Section${section} {`,
    '    static int step(int a, int b) { return a * b + 1; }',
    '    public static void main(String[] args) {',
    '        int total = 0;',
    ...body,
    '        System.out.println(total);',
    '    }',
    '}',
    '```',
  ].join('\n');
}

function table(section: number): string {
  const rows = Array.from(
    { length: 8 },
    (_, i) =>
      `| ${topicOf(section + i)} | ${section * 10 + i} | uses ${topicOf(section)} \\| twice |`,
  );
  return ['| Topic | Marks | Note |', '| --- | ---: | --- |', ...rows].join('\n');
}

/** The document in Markdown: `sections` chapters of about 2,600 characters each. */
export function courseNotes(sections = 40): string {
  const parts = ['# Programming Course Notes', '', paragraph(0, 3, 0)];
  for (let s = 1; s <= sections; s += 1) {
    parts.push(
      '',
      `## ${s}. Working with ${topicOf(s)}`,
      '',
      paragraph(s, s % 5 === 0 ? 34 : 6, 0),
      '',
      paragraph(s, 5, 6),
      '',
      `### Steps for ${topicOf(s)}`,
      '',
      `1. Read section ${s}.`,
      `2. Try the ${topicOf(s)} example.`,
      `   - Change one value.`,
      `   - Run it again.`,
      `3. Write down what changed.`,
      '',
      code(s, s % 4 === 0 ? 40 : 6),
      '',
      table(s),
      '',
      `> Practice ${topicOf(s)} until it feels ordinary.`,
    );
  }
  return parts.join('\n');
}

/** The same kind of material as an HTML page, with the chrome a saved page carries. */
export function courseNotesHtml(sections = 10): string {
  const body: string[] = ['<h1>Programming Course Notes</h1>', `<p>${paragraph(0, 3, 0)}</p>`];
  for (let s = 1; s <= sections; s += 1) {
    body.push(
      `<h2>${s}. Working with ${topicOf(s)}</h2>`,
      `<p>${paragraph(s, 6, 0)}</p>`,
      '<ol><li>Read the section.</li><li>Try the example.<ul><li>Change one value.</li></ul></li></ol>',
      `<pre><code class="language-java">int total = 0;\nfor (int i = 0; i &lt; ${s}; i++) {\n    total += i;\n}</code></pre>`,
      `<table><tr><th>Topic</th><th>Marks</th></tr><tr><td>${topicOf(s)}</td><td>${s}</td></tr></table>`,
    );
  }
  return [
    '<!doctype html><html><head><title>Notes</title><style>body { color: red; }</style></head>',
    '<body><nav>Home · Courses · Sign in</nav><script>track();</script><main>',
    ...body,
    '</main><footer>Footer text</footer></body></html>',
  ].join('\n');
}
