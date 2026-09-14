'use client';

import { JS_WORKER_SOURCE } from './js-worker';

/** One case to run code against. */
export interface RunCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface RunCaseResult {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  stderr: string;
  durationMs: number;
}

export interface RunOutcome {
  verdict: 'passed' | 'failed' | 'error' | 'timeout';
  driver: 'browser-sandbox';
  durationMs: number;
  results: RunCaseResult[];
}

/** Version pinned so a CDN change cannot alter what the demo runs. */
const PYODIDE_VERSION = '0.28.3';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyodideRuntime {
  runPython: (code: string) => unknown;
  setStdin: (options: { stdin: () => string }) => void;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (options: { indexURL: string }) => Promise<PyodideRuntime>;
  }
}

let pyodidePromise: Promise<PyodideRuntime> | null = null;

/** Trailing whitespace differences are not wrong answers. */
function normalise(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Runs learner code against a set of cases, in the browser.
 *
 * This is the whole of the `browser-sandbox` driver's execution side (ADR-0007): the server is
 * never asked to run anything, and what this returns is a claim the server records as untrusted.
 */
export async function runCases(
  language: string,
  code: string,
  cases: RunCase[],
  timeLimitMs = 5000,
): Promise<RunOutcome> {
  const started = Date.now();
  const results: RunCaseResult[] = [];
  let sawError = false;
  let timedOut = false;

  for (const testCase of cases) {
    const outcome =
      language === 'python'
        ? await runPython(code, testCase.input, timeLimitMs)
        : await runJavaScript(code, testCase.input, timeLimitMs);
    if (outcome.timedOut) timedOut = true;
    if (outcome.stderr) sawError = true;
    results.push({
      testCaseId: testCase.id,
      passed: !outcome.stderr && normalise(outcome.stdout) === normalise(testCase.expectedOutput),
      actualOutput: outcome.stdout.slice(0, 20_000),
      stderr: outcome.stderr.slice(0, 20_000),
      durationMs: outcome.durationMs,
    });
  }

  const allPassed = results.length > 0 && results.every((r) => r.passed);
  return {
    verdict: timedOut ? 'timeout' : allPassed ? 'passed' : sawError ? 'error' : 'failed',
    driver: 'browser-sandbox',
    durationMs: Date.now() - started,
    results,
  };
}

interface SingleRun {
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

function runJavaScript(code: string, stdin: string, timeLimitMs: number): Promise<SingleRun> {
  return new Promise((resolve) => {
    const blob = new Blob([JS_WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const started = Date.now();
    let settled = false;

    const finish = (run: SingleRun) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(run);
    };

    const timer = setTimeout(() => {
      finish({
        stdout: '',
        stderr: `The program was still running after ${timeLimitMs} ms and was stopped`,
        durationMs: timeLimitMs,
        timedOut: true,
      });
    }, timeLimitMs);

    worker.onmessage = (
      event: MessageEvent<{ stdout: string; stderr: string; durationMs: number }>,
    ) => {
      finish({
        stdout: event.data.stdout ?? '',
        stderr: event.data.stderr ?? '',
        durationMs: event.data.durationMs ?? Date.now() - started,
        timedOut: false,
      });
    };
    worker.onerror = (event) => {
      finish({
        stdout: '',
        stderr: event.message || 'The program could not be started',
        durationMs: Date.now() - started,
        timedOut: false,
      });
    };

    worker.postMessage({ code, stdin });
  });
}

/**
 * Python runs through Pyodide, which is fetched the first time somebody chooses it. It runs on the
 * page rather than in a worker, so the time limit cannot interrupt a runaway loop; the loader says
 * so plainly in the workspace rather than pretending otherwise.
 */
async function runPython(code: string, stdin: string, timeLimitMs: number): Promise<SingleRun> {
  const started = Date.now();
  try {
    const pyodide = await loadPyodide();
    let stdout = '';
    let stderr = '';
    let consumed = false;
    pyodide.setStdin({
      stdin: () => {
        if (consumed) return '';
        consumed = true;
        return stdin;
      },
    });
    pyodide.setStdout({
      batched: (text) => {
        stdout += `${text}\n`;
      },
    });
    pyodide.setStderr({
      batched: (text) => {
        stderr += `${text}\n`;
      },
    });
    pyodide.runPython(code);
    return { stdout, stderr, durationMs: Date.now() - started, timedOut: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      stdout: '',
      stderr: message,
      durationMs: Date.now() - started,
      timedOut: message.includes(String(timeLimitMs)),
    };
  }
}

/** Loads Pyodide once and reuses it; the download is several megabytes. */
async function loadPyodide(): Promise<PyodideRuntime> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${PYODIDE_BASE}pyodide.js`;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error('Python could not be loaded; check the network connection'));
        document.head.appendChild(script);
      });
    }
    if (!window.loadPyodide) throw new Error('Python could not be loaded');
    return window.loadPyodide({ indexURL: PYODIDE_BASE });
  })();
  return pyodidePromise;
}

/** True once Python is ready, so the workspace can say what a first run will cost. */
export function pythonLoaded(): boolean {
  return pyodidePromise !== null;
}
