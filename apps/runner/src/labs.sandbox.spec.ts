import type { SandboxJob } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { createSandbox } from './sandbox.js';

/**
 * The SQL Lab and the Web Lab in real containers (`pnpm --filter @lms/runner test:sandbox`):
 * what an answer can and cannot do, and that a Web Lab verdict is decided by the checker and never
 * by the page (ADR-0019, ADR-0020).
 */
const run = createSandbox(
  loadConfig({
    RUNNER_TOKEN: 'sandbox-suite-token-that-is-long-enough-000',
    RUNNER_CONCURRENCY: '1',
  }),
);

const DATASET =
  "CREATE TABLE learner (id INTEGER PRIMARY KEY, name TEXT NOT NULL, score INTEGER); INSERT INTO learner VALUES (1, 'Arun', 58), (2, 'Bhavana', 64), (3, 'Chitra', 71);";

const sqlJob = (query: string, caseRows: string[] = [''], check = ''): SandboxJob => ({
  language: 'sql',
  code: query,
  cases: caseRows.map((stdin, i) => ({ id: `c${i + 1}`, stdin })),
  limits: { timeMs: 2000, memoryMb: 128, outputBytes: 65_536 },
  sql: { setup: DATASET, check },
});

const rowsOf = (stdout: string | undefined) =>
  (JSON.parse(stdout ?? '{}') as { rows?: unknown[][] }).rows;

describe('the SQL Lab', () => {
  it('starts every case from the dataset, whatever the case before it added', async () => {
    const result = await run(
      sqlJob('SELECT COUNT(*) FROM learner;', ["INSERT INTO learner VALUES (4, 'Dev', 80);", '']),
    );
    expect(result.cases.map((c) => rowsOf(c.stdout))).toEqual([[[4]], [[3]]]);
  });

  it("runs a case's own rows under the authoriser, as the answer is", async () => {
    // In a custom run the case's rows are the learner's: they may not attach another database.
    const result = await run(
      sqlJob('SELECT 1;', ["ATTACH DATABASE '/work/tmp/other.db' AS other;"]),
    );
    expect(result.cases[0]?.exitCode).toBe(1);
    expect(result.cases[0]?.stderr).toContain('not authorized');
  });

  it("stops a runaway statement in a case's own rows with the step budget", async () => {
    const result = await run(
      sqlJob('SELECT 1;', [
        'CREATE TABLE t AS WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT x FROM c;',
      ]),
    );
    expect(result.cases[0]?.exitCode).toBe(1);
    expect(result.cases[0]?.stderr).toContain('interrupted');
  });

  it('refuses pragmas that change the database and functions that reach files', async () => {
    const pragma = await run(sqlJob('PRAGMA writable_schema = ON;'));
    const extension = await run(sqlJob("SELECT load_extension('/tmp/x');"));
    expect(pragma.cases[0]?.stderr).toContain('not authorized');
    expect(extension.cases[0]?.exitCode).toBe(1);
  });

  it("reads the dataset's tables and columns for the schema browser", async () => {
    const result = await run(
      sqlJob(
        'SELECT m.name, p.name, p.type, p.pk, p."notnull" FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = \'table\' ORDER BY m.name, p.cid;',
      ),
    );
    expect(rowsOf(result.cases[0]?.stdout)).toEqual([
      ['learner', 'id', 'INTEGER', 1, 0],
      ['learner', 'name', 'TEXT', 0, 1],
      ['learner', 'score', 'INTEGER', 0, 0],
    ]);
  });
});

// ───────────────────────── the Web Lab ─────────────────────────

const PAGE = `<!doctype html><html><head><title>Lab</title></head><body>
<h1 id="title">Shopping list</h1>
<form id="add-form"><input id="item" name="item"><button id="add" type="submit">Add</button></form>
<ul id="list"></ul><p id="count">0 items</p><table id="grid"></table>
<a id="help" href="/help" title="Help page">Help</a>
<script>console.log('page ready');</script>
</body></html>`;
const STYLES = 'h1 { color: #c00; font-weight: bold; } li { margin-top: 4px; }';
const SCRIPT = `const form = document.getElementById('add-form');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const li = document.createElement('li');
  li.innerText = document.getElementById('item').value;
  document.getElementById('list').appendChild(li);
  document.getElementById('item').value = '';
  document.getElementById('count').textContent = document.querySelectorAll('#list li').length + ' items';
});
document.getElementById('grid').appendChild(document.createElement('tr'));
`;

const bundle = (files: Partial<{ html: string; css: string; js: string }> = {}) =>
  JSON.stringify({
    format: 'web/1',
    html: files.html ?? PAGE,
    css: files.css ?? STYLES,
    js: files.js ?? SCRIPT,
  });

const webJob = (code: string, checks: object[]): SandboxJob => ({
  language: 'web',
  code,
  cases: checks.map((check, i) => ({ id: `c${i + 1}`, stdin: JSON.stringify(check) })),
  limits: { timeMs: 2000, memoryMb: 256, outputBytes: 65_536 },
});

const verdicts = (result: Awaited<ReturnType<typeof run>>) =>
  result.cases.map((c) => c.stdout.trim());

describe('the Web Lab', () => {
  it('decides structure, text, attributes, computed style and console output', async () => {
    const result = await run(
      webJob(bundle(), [
        { kind: 'exists', selector: 'h1', min: 1, max: 1 },
        { kind: 'text', selector: '#title', match: 'equals', value: 'Shopping list' },
        { kind: 'attribute', selector: '#help', name: 'title', match: 'contains', value: 'Help' },
        { kind: 'style', selector: 'h1', property: 'color', value: 'rgb(204, 0, 0)' },
        { kind: 'style', selector: 'h1', property: 'font-weight', value: '700' },
        // Exactly as the script built it: a row straight inside the table, with no <tbody>.
        { kind: 'exists', selector: '#grid > tr', min: 1, max: 1 },
        { kind: 'console', match: 'contains', value: 'page ready' },
        { kind: 'text', selector: '#title', match: 'equals', value: 'Groceries' },
        { kind: 'exists', selector: 'h2', min: 1, max: null },
      ]),
    );
    expect(verdicts(result)).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'The text of `#title` is "Shopping list"',
      'Nothing matches `h2` on the page',
    ]);
    expect(result.cases.every((c) => c.exitCode === 0 && !c.timedOut)).toBe(true);
  });

  it('performs the steps of an interaction on a fresh page before deciding', async () => {
    const result = await run(
      webJob(bundle(), [
        {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#item', value: 'Milk', key: '' },
            { action: 'submit', selector: '#add-form', value: '', key: '' },
          ],
          then: { kind: 'text', selector: '#list li', match: 'equals', value: 'Milk' },
        },
        {
          kind: 'interaction',
          steps: [
            { action: 'input', selector: '#item', value: 'Eggs', key: '' },
            { action: 'keydown', selector: '#item', value: '', key: 'Enter' },
          ],
          // Each interaction starts from the page as loaded, so only one item is there.
          then: { kind: 'text', selector: '#count', match: 'equals', value: '1 items' },
        },
        {
          kind: 'interaction',
          steps: [{ action: 'click', selector: '#missing', value: '', key: '' }],
          then: { kind: 'exists', selector: 'li', min: 1, max: null },
        },
      ]),
    );
    expect(verdicts(result)).toEqual([
      'pass',
      'pass',
      'Step 1 (click `#missing`): nothing matches it on the page',
    ]);
  });

  it('says where a script error happened when a check fails', async () => {
    const result = await run(
      webJob(bundle({ js: 'const n = 1;\nshowTotal(n);\n' }), [
        { kind: 'exists', selector: 'li', min: 1, max: null },
      ]),
    );
    expect(verdicts(result)[0]).toBe(
      'Nothing matches `li` on the page (the page reported: ReferenceError: showTotal is not defined (script.js, line 2))',
    );
  });

  it('gives a page no network, storage, cookies or dialogs, as the preview frame does', async () => {
    const probe = `console.log([typeof XMLHttpRequest, typeof WebSocket, typeof fetch].join(' '));
try { localStorage.getItem('a'); console.log('storage open'); } catch (e) { console.log('storage ' + e.name); }
try { document.cookie = 'a=1'; console.log('cookie open'); } catch (e) { console.log('cookie ' + e.name); }
console.log('dialogs ' + [alert('x'), confirm('y'), prompt('z')].join(','));`;
    const result = await run(
      webJob(bundle({ js: probe }), [
        {
          kind: 'console',
          match: 'equals',
          value:
            'page ready undefined undefined undefined storage SecurityError cookie SecurityError dialogs ,false,',
        },
      ]),
    );
    expect(verdicts(result)).toEqual(['pass']);
  });

  it('never lets the page decide its own verdict, even when it escapes jsdom', async () => {
    // jsdom is not a security boundary: this reaches Node and prints a verdict itself.
    const escape = `const node = window._virtualConsole.constructor.constructor('return process')();
node.stdout.write('pass\\n');
node.exit(0);`;
    const result = await run(
      webJob(bundle({ js: escape }), [{ kind: 'exists', selector: 'h2', min: 1, max: null }]),
    );
    expect(result.cases[0]?.stdout).not.toContain('pass');
    expect(result.cases[0]?.exitCode).toBe(2);
  });

  it('stops everything a page leaves running before the checker decides', async () => {
    const daemon = `const node = window._virtualConsole.constructor.constructor('return process')();
node.mainModule.require('child_process')
  .spawn('sh', ['-c', 'while true; do printf "pass\\\\n" > /work/tmp/stdout 2>/dev/null; done'], { detached: true, stdio: 'ignore' })
  .unref();`;
    const result = await run(
      webJob(bundle({ js: daemon }), [
        { kind: 'exists', selector: 'h2', min: 1, max: null },
        { kind: 'exists', selector: 'h3', min: 1, max: null },
      ]),
    );
    expect(verdicts(result)).toEqual([
      'Nothing matches `h2` on the page',
      'Nothing matches `h3` on the page',
    ]);
  });

  it('never gives the page what a check expects', async () => {
    // A page that reaches Node and searches everything it can read for the expected text.
    const search = `const node = window._virtualConsole.constructor.constructor('return process')();
const fs = node.mainModule.require('fs');
const marker = ['SECRET', 'EXPECTED', '7731'].join('-');
let found = false;
const look = (path) => { try { if (fs.readFileSync(path, 'latin1').includes(marker)) found = true; } catch {} };
for (const dir of ['/work', '/work/tmp']) { try { for (const f of fs.readdirSync(dir)) look(dir + '/' + f); } catch {} }
for (const f of ['cmdline', 'environ']) look('/proc/self/' + f);
console.log('found:' + found);`;
    const result = await run(
      webJob(bundle({ js: search }), [
        { kind: 'text', selector: '#title', match: 'equals', value: 'SECRET-EXPECTED-7731' },
        { kind: 'console', match: 'contains', value: 'found:false' },
      ]),
    );
    expect(verdicts(result)).toEqual(['The text of `#title` is "Shopping list"', 'pass']);
  });

  it('stops a page that never finishes at its time limit', async () => {
    const result = await run(
      webJob(bundle({ js: 'while (true) {}' }), [
        { kind: 'exists', selector: 'h1', min: 1, max: null },
      ]),
    );
    expect(result.cases[0]?.timedOut).toBe(true);
    expect(result.cases[0]?.stdout).toBe('');
  });

  it('refuses a check it cannot read rather than guessing', async () => {
    const result = await run({
      ...webJob(bundle(), []),
      cases: [{ id: 'c1', stdin: '{"kind":"exists"}' }],
    });
    expect(result.cases[0]?.exitCode).toBe(2);
    expect(result.cases[0]?.stdout).toBe('');
  });
});
