import type { WebFiles } from '@lms/shared';

/**
 * A Web Lab's preview (ADR-0019). The learner's page is shown in an
 * `<iframe sandbox="allow-scripts" srcdoc>`: an opaque origin with no cookies, storage, forms,
 * popups or navigation of the app. This policy starts the document, and because a srcdoc frame
 * also keeps the app's own policy, it can only narrow what the frame may do: nothing is fetched
 * from anywhere.
 *
 * The preview decides nothing. Checks run in the sandbox (infra/sandbox/web), and the page is
 * assembled here exactly as the sandbox's page runner assembles it, so what a learner sees is what
 * is checked.
 */
export const PREVIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; form-action 'none'; base-uri 'none'";

/** Marks the console messages a preview frame posts to the page around it. */
export const PREVIEW_SOURCE = 'lms-web-lab';

export const PREVIEW_LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;
export type PreviewLevel = (typeof PREVIEW_LEVELS)[number];

export interface PreviewMessage {
  source: typeof PREVIEW_SOURCE;
  level: PreviewLevel;
  text: string;
}

/** The script types a browser runs; mirrors SCRIPT_TYPES in infra/sandbox/web/webpage.js. */
const SCRIPT_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
]);

/**
 * Runs first in the frame: passes what the page logs, and the errors it raises, to the page around
 * it as text. The values are written out the way the sandbox writes them for console checks.
 */
const BRIDGE = `(() => {
  'use strict';
  const format = (value) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'function') return 'function ' + value.name + '()';
    if (value === null || typeof value !== 'object') return String(value);
    try {
      if (typeof value.message === 'string' && typeof value.name === 'string') {
        return value.name + ': ' + value.message;
      }
      const json = JSON.stringify(value);
      if (json !== undefined) return json;
    } catch (error) {}
    return Object.prototype.toString.call(value);
  };
  const post = (level, args) => {
    try {
      parent.postMessage({ source: '${PREVIEW_SOURCE}', level, text: args.map(format).join(' ') }, '*');
    } catch (error) {}
  };
  for (const level of ${JSON.stringify(PREVIEW_LEVELS)}) {
    const original = console[level];
    console[level] = function (...args) {
      post(level, args);
      return original.apply(this, args);
    };
  }
  addEventListener('error', (event) => {
    const what = event.error ? format(event.error) : String(event.message);
    post('error', ['Uncaught ' + what + (event.lineno ? ' (line ' + event.lineno + ')' : '')]);
  });
  addEventListener('unhandledrejection', (event) => {
    post('error', ['Uncaught (in promise) ' + format(event.reason)]);
  });
})();`;

/** Text that sits inside a <script> or <style> cannot close it early. */
const keepInside = (text: string, tag: 'script' | 'style') =>
  text.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

/**
 * The preview document for a page's files:
 *   - index.html is parsed, never fetched from; <base>, <meta http-equiv="refresh"> and scripts
 *     with a src are removed;
 *   - styles.css goes in a <style> at the end of <head>;
 *   - the page's own inline scripts move to the end of <body>, followed by script.js;
 *   - the policy above and the console bridge come before everything else.
 */
export function buildPreviewDocument(files: WebFiles, parser: DOMParser = new DOMParser()): string {
  const doc = parser.parseFromString(files.html, 'text/html');
  for (const element of Array.from(doc.querySelectorAll('base'))) element.remove();
  for (const element of Array.from(doc.querySelectorAll('meta[http-equiv]'))) {
    if (/^\s*refresh\s*$/i.test(element.getAttribute('http-equiv') ?? '')) element.remove();
  }
  const scripts: string[] = [];
  for (const script of Array.from(doc.querySelectorAll('script'))) {
    const type = (script.getAttribute('type') ?? '').trim().toLowerCase();
    if (script.hasAttribute('src')) {
      script.remove();
    } else if (SCRIPT_TYPES.has(type)) {
      scripts.push(script.textContent ?? '');
      script.remove();
    }
  }
  if (files.js.trim()) scripts.push(files.js);
  if (files.css.trim()) {
    const style = doc.createElement('style');
    style.textContent = keepInside(files.css, 'style');
    doc.head.append(style);
  }
  for (const source of scripts) {
    const script = doc.createElement('script');
    script.textContent = keepInside(source, 'script');
    doc.body.append(script);
  }
  const policy = doc.createElement('meta');
  policy.setAttribute('http-equiv', 'Content-Security-Policy');
  policy.setAttribute('content', PREVIEW_CSP);
  const bridge = doc.createElement('script');
  bridge.textContent = BRIDGE;
  doc.head.prepend(policy, bridge);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

/** A message from a preview frame, or null when it is anything else. */
export function readPreviewMessage(data: unknown): PreviewMessage | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Partial<PreviewMessage>;
  if (message.source !== PREVIEW_SOURCE || typeof message.text !== 'string') return null;
  if (!PREVIEW_LEVELS.includes(message.level as PreviewLevel)) return null;
  return { source: PREVIEW_SOURCE, level: message.level!, text: message.text.slice(0, 2000) };
}
