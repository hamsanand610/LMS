/**
 * The JavaScript sandbox, as source for a Worker built from a blob.
 *
 * A blob worker runs at an opaque origin with no DOM, no cookies and no access to the page, which
 * is the isolation ADR-0007 asks for on the client side. The page terminates it when the time
 * limit passes, so a runaway loop costs one worker rather than the tab.
 *
 * Learner code is written for standard input and output, so the sandbox provides just enough of
 * that shape: `console.log` collects lines, and `require('fs').readFileSync(0, 'utf8')` hands back
 * the case's input. Nothing else is reachable from inside.
 */
export const JS_WORKER_SOURCE = String.raw`
self.onmessage = function (event) {
  var data = event.data || {};
  var stdin = String(data.stdin == null ? '' : data.stdin);
  var lines = [];

  function write() {
    var parts = [];
    for (var i = 0; i < arguments.length; i += 1) {
      var value = arguments[i];
      parts.push(typeof value === 'string' ? value : stringify(value));
    }
    lines.push(parts.join(' '));
  }

  function stringify(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }
    return String(value);
  }

  var fakeConsole = { log: write, info: write, warn: write, error: write, debug: write };
  var fakeProcess = {
    stdout: { write: function (chunk) { lines.push(String(chunk).replace(/\n$/, '')); } },
    argv: ['node', 'solution'],
    env: {},
    exit: function () {},
  };
  function fakeRequire(name) {
    if (name === 'fs' || name === 'node:fs') {
      return {
        readFileSync: function () { return stdin; },
        readFile: function (_path, _encoding, callback) { callback(null, stdin); },
      };
    }
    if (name === 'readline' || name === 'node:readline') {
      throw new Error('readline is not available in this sandbox; read standard input with fs');
    }
    throw new Error('The module "' + name + '" is not available in this sandbox');
  }

  var started = Date.now();
  try {
    var run = new Function(
      'console',
      'process',
      'require',
      'self',
      'window',
      'globalThis',
      'fetch',
      'XMLHttpRequest',
      'importScripts',
      '"use strict";' + data.code,
    );
    run(fakeConsole, fakeProcess, fakeRequire, undefined, undefined, undefined, undefined, undefined, undefined);
    self.postMessage({
      ok: true,
      stdout: lines.join('\n'),
      stderr: '',
      durationMs: Date.now() - started,
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      stdout: lines.join('\n'),
      stderr: error && error.message ? String(error.message) : String(error),
      durationMs: Date.now() - started,
    });
  }
};
`;
