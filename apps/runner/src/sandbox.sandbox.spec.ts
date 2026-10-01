import type { SandboxJob } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { createSandbox } from './sandbox.js';

/**
 * Real jobs in real containers (`pnpm --filter @lms/runner test:sandbox`). These are the checks
 * that the isolation holds: what learner code can and cannot do inside the sandbox.
 */
const run = createSandbox(
  loadConfig({
    RUNNER_TOKEN: 'sandbox-suite-token-that-is-long-enough-000',
    RUNNER_CONCURRENCY: '1',
  }),
);

const job = (
  language: SandboxJob['language'],
  code: string,
  stdins: string[] = [''],
  extra: Partial<SandboxJob> = {},
): SandboxJob => ({
  language,
  code,
  cases: stdins.map((stdin, i) => ({ id: `c${i + 1}`, stdin })),
  limits: { timeMs: 2000, memoryMb: 128, outputBytes: 65_536 },
  ...extra,
});

describe('every language runs and reads its input', () => {
  it('Java compiles and runs each case', async () => {
    const result = await run(
      job(
        'java',
        'import java.util.*;\npublic class Main { public static void main(String[] a) { Scanner s = new Scanner(System.in); int x = s.nextInt(), y = s.nextInt(); System.out.println(x + y); } }',
        ['2 3\n', '10 -4\n'],
      ),
    );
    expect(result.compile.ok).toBe(true);
    expect(result.cases.map((c) => c.stdout.trim())).toEqual(['5', '6']);
    expect(result.cases.every((c) => c.exitCode === 0 && c.memoryKb > 0)).toBe(true);
  });

  it('Python, JavaScript and PHP run', async () => {
    const python = await run(job('python', 'print(sum(map(int, input().split())))', ['4 5\n']));
    const javascript = await run(
      job(
        'javascript',
        "const d=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);console.log(d[0]*d[1]);",
        ['6 7\n'],
      ),
    );
    const php = await run(
      job(
        'php',
        '<?php $p = explode(" ", trim(fgets(STDIN))); echo intdiv((int)$p[0], (int)$p[1]), PHP_EOL;',
        ['9 2\n'],
      ),
    );
    expect(python.cases[0]?.stdout.trim()).toBe('9');
    expect(javascript.cases[0]?.stdout.trim()).toBe('42');
    expect(php.cases[0]?.stdout.trim()).toBe('4');
  });

  it('SQL runs against a throwaway database and returns the result table', async () => {
    const result = await run(
      job(
        'sql',
        'SELECT name FROM learner WHERE score >= 60 ORDER BY name;',
        ["INSERT INTO learner VALUES (3, 'Divya', 71);"],
        {
          sql: {
            setup:
              "CREATE TABLE learner (id INTEGER PRIMARY KEY, name TEXT, score INTEGER); INSERT INTO learner VALUES (1, 'Arun', 58), (2, 'Bhavana', 64);",
            check: '',
          },
        },
      ),
    );
    const table = JSON.parse(result.cases[0]?.stdout ?? '{}') as { rows: string[][] };
    expect(table.rows).toEqual([['Bhavana'], ['Divya']]);
  });

  it('reports a compile error without running anything', async () => {
    const result = await run(job('java', 'public class Main { void broken( }'));
    expect(result.compile.ok).toBe(false);
    expect(result.compile.output).toContain('Main.java');
    expect(result.cases).toEqual([]);
  });
});

describe('what learner code cannot do', () => {
  it('cannot run past its time limit', async () => {
    const result = await run(
      job('python', 'while True:\n    pass', [''], {
        limits: { timeMs: 1000, memoryMb: 64, outputBytes: 4096 },
      }),
    );
    expect(result.cases[0]?.timedOut).toBe(true);
  });

  it('is judged on the CPU it uses, so a pause on the host does not fail a correct answer', async () => {
    // Sleeping stands in for a cold or busy host: wall time passes, CPU time does not.
    const result = await run(
      job('python', 'import time\ntime.sleep(1.5)\nprint(int(input()) * 2)', ['21\n'], {
        limits: { timeMs: 1000, memoryMb: 64, outputBytes: 4096 },
      }),
    );
    expect(result.cases[0]?.timedOut).toBe(false);
    expect(result.cases[0]?.stdout.trim()).toBe('42');
    expect(result.cases[0]?.durationMs).toBeLessThan(1000);
  });

  it('cannot wait for ever either: the wall clock stops it', async () => {
    const result = await run(
      job('python', 'import time\ntime.sleep(60)', [''], {
        limits: { timeMs: 1000, memoryMb: 64, outputBytes: 4096 },
      }),
    );
    expect(result.cases[0]?.timedOut).toBe(true);
  });

  it('cannot take more memory than it is given', async () => {
    const result = await run(
      job('python', 'x = bytearray(512 * 1024 * 1024)\nprint(len(x))', [''], {
        limits: { timeMs: 3000, memoryMb: 64, outputBytes: 4096 },
      }),
    );
    const c = result.cases[0]!;
    expect(c.stdout).toBe('');
    expect(c.exitCode === 0).toBe(false);
  });

  it('has no network', async () => {
    const result = await run(
      job(
        'python',
        "import socket\ntry:\n    socket.create_connection(('1.1.1.1', 80), timeout=2)\n    print('connected')\nexcept OSError as e:\n    print('blocked')",
      ),
    );
    expect(result.cases[0]?.stdout.trim()).toBe('blocked');
  });

  it('cannot write outside its scratch directory, and sees no secrets in its environment', async () => {
    const result = await run(
      job(
        'python',
        "import os\ntry:\n    open('/etc/owned', 'w').write('x')\n    print('wrote')\nexcept OSError:\n    print('read-only')\nprint(sorted(k for k in os.environ if k not in ('PATH','HOME','LANG','PWD','LC_CTYPE')))",
      ),
    );
    const [first, second] = (result.cases[0]?.stdout ?? '').trim().split('\n');
    expect(first).toBe('read-only');
    expect(second).toBe('[]');
  });

  it('cannot exhaust the machine with processes', async () => {
    const result = await run(
      job(
        'python',
        "import os\nn = 0\ntry:\n    while True:\n        if os.fork() == 0:\n            import time; time.sleep(5); os._exit(0)\n        n += 1\nexcept OSError:\n    print('limited', n < 200)",
        [''],
        { limits: { timeMs: 3000, memoryMb: 128, outputBytes: 4096 } },
      ),
    );
    expect(result.cases[0]?.stdout.trim()).toBe('limited True');
  });

  it('cannot flood the output', async () => {
    const result = await run(
      job('python', "import sys\nsys.stdout.write('x' * 10_000_000)", [''], {
        limits: { timeMs: 3000, memoryMb: 128, outputBytes: 4096 },
      }),
    );
    const c = result.cases[0]!;
    expect(c.truncated).toBe(true);
    expect(c.stdout.length).toBeLessThanOrEqual(4096);
  });

  it('runs every job in a fresh container', async () => {
    const write = await run(
      job('python', "open('/work/tmp/left-behind', 'w').write('x')\nprint('ok')"),
    );
    const read = await run(
      job('python', "import os\nprint(os.path.exists('/work/tmp/left-behind'))"),
    );
    expect(write.cases[0]?.stdout.trim()).toBe('ok');
    expect(read.cases[0]?.stdout.trim()).toBe('False');
  });
});
