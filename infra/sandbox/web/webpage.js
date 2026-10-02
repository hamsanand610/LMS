#!/usr/bin/env node
'use strict';
/**
 * The Web Lab's page runner (ADR-0019), part of the sandbox image.
 *
 * harness.py starts it once per check: the learner's files are in the bundle named on the command
 * line, and the check's interaction steps (never its assertion) arrive on standard input. It loads
 * the page in jsdom, runs the learner's scripts, performs the steps and prints a snapshot of the
 * page as JSON: the element tree with the state of form fields, what the page logged, and the
 * errors it raised.
 *
 * The learner's scripts run in this process, and jsdom is not a security boundary: a page can
 * reach Node from inside it. That is why this process decides nothing. harness.py stops every
 * process this one leaves behind, then gives the snapshot and the check to webcheck.js, which runs
 * none of the page's code. A page that tampers with its snapshot only describes a page; it never
 * learns what is checked. The container is the isolation (ADR-0016): no network, no capabilities,
 * a read-only root and CPU, memory and process limits.
 *
 * The page is assembled the way the web app's preview assembles it
 * (apps/web/src/lib/labs/web-preview.ts):
 *   - index.html is parsed; <base>, <meta http-equiv="refresh"> and scripts with a src are removed,
 *     so nothing is ever fetched;
 *   - styles.css is added as a <style> at the end of <head>;
 *   - the page's inline scripts move to the end of <body>, followed by script.js, and run in that
 *     order once the HTML is parsed; DOMContentLoaded and load follow, then timers get a moment;
 *   - like the preview's sandboxed frame, the page has no storage, cookies, network or dialogs.
 */

const fs = require('fs');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const LIMITS = {
  fileChars: 20_000,
  steps: 10,
  selectorChars: 200,
  valueChars: 500,
  keyChars: 40,
  nodes: 20_000,
  depth: 256,
  textChars: 1_000_000,
  consoleLines: 500,
  consoleChars: 20_000,
  errors: 20,
  errorChars: 300,
};
/** Wall-clock time the page gets after load, and after each step, for timers and promises. */
const LOAD_SETTLE_MS = 300;
const STEP_SETTLE_MS = 60;
const PAGE_URL = 'https://web-lab.invalid/';
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const ACTIONS = new Set(['click', 'input', 'change', 'submit', 'focus', 'blur', 'keydown']);
/** The script types a browser runs; others (templates, JSON data blocks) are left as data. */
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
/** Single-line fields where Enter submits the form, as a browser does. */
const IMPLICIT_SUBMIT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
]);

/**
 * Run inside the page before the learner's scripts: what the preview's sandboxed frame gives a
 * page (no dialogs, storage or cookies; no network), and the few things a browser has and jsdom
 * lacks, so ordinary pages behave as they do in the preview.
 */
const PRELUDE = `(() => {
  'use strict';
  const define = (target, name, value) =>
    Object.defineProperty(target, name, { value, writable: true, configurable: true });
  define(window, 'alert', function alert() {});
  define(window, 'confirm', function confirm() { return false; });
  define(window, 'prompt', function prompt() { return null; });
  define(window, 'print', function print() {});
  define(window, 'open', function open() { return null; });
  define(window, 'scrollTo', function scrollTo() {});
  define(window, 'scrollBy', function scrollBy() {});
  define(window, 'scroll', function scroll() {});
  define(Element.prototype, 'scrollIntoView', function scrollIntoView() {});
  define(window, 'matchMedia', function matchMedia(query) {
    return {
      matches: false,
      media: String(query),
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    };
  });
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    configurable: true,
    enumerable: true,
    get() { return this.textContent; },
    set(value) { this.textContent = value === null || value === undefined ? '' : String(value); },
  });
  const denied = (what) => function () {
    throw new DOMException(what + ' is not available in a lab page', 'SecurityError');
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, get: denied('localStorage') });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get: denied('sessionStorage') });
  Object.defineProperty(Document.prototype, 'cookie', {
    configurable: true,
    get: denied('document.cookie'),
    set: denied('document.cookie'),
  });
  delete window.XMLHttpRequest;
  delete window.WebSocket;
})();`;

function fail(message) {
  fs.writeSync(2, `${message}\n`);
  process.exit(2);
}

function readBundle(path) {
  const value = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!value || value.format !== 'web/1') throw new Error('not a web bundle');
  const files = {};
  for (const name of ['html', 'css', 'js']) {
    if (typeof value[name] !== 'string' || value[name].length > LIMITS.fileChars) {
      throw new Error(`bad ${name}`);
    }
    files[name] = value[name];
  }
  return files;
}

function readSteps(text) {
  const value = JSON.parse(text || '{"steps":[]}');
  const steps = Array.isArray(value && value.steps) ? value.steps : [];
  if (steps.length > LIMITS.steps) throw new Error('too many steps');
  return steps.map((step) => {
    const text = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);
    const action = ACTIONS.has(step && step.action) ? step.action : null;
    const selector = text(step && step.selector, LIMITS.selectorChars);
    if (!action || !selector || !selector.trim()) throw new Error('bad step');
    return {
      action,
      selector: selector.trim(),
      value: text(step.value ?? '', LIMITS.valueChars) ?? '',
      key: text(step.key ?? '', LIMITS.keyChars) ?? '',
    };
  });
}

let files;
let steps;
try {
  files = readBundle(process.argv[2]);
} catch {
  fail("The page's files could not be read.");
}
try {
  steps = readSteps(fs.readFileSync(0, 'utf8'));
} catch {
  fail('The steps could not be read.');
}

// ───────────────────────── what the page says ─────────────────────────

const consoleLines = [];
let consoleChars = 0;
const errors = [];

function oneLine(text, max) {
  const flat = String(text)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** A logged value as a browser's console would show it in one line. */
function format(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'function') return `function ${value.name}()`;
  if (value === null || typeof value !== 'object') return String(value);
  try {
    if (typeof value.message === 'string' && typeof value.name === 'string') {
      return `${value.name}: ${value.message}`;
    }
    const json = JSON.stringify(value);
    if (json !== undefined) return json;
  } catch {
    // A value that cannot be written out is shown by its kind.
  }
  return Object.prototype.toString.call(value);
}

/** An error with where it happened, when the stack says: "TypeError: … (script.js, line 4)". */
function describeError(error) {
  const text = format(error);
  const stack = error !== null && typeof error === 'object' ? String(error.stack || '') : '';
  const where = /(inline script \d+|script\.js):(\d+)/.exec(stack);
  return where ? `${text} (${where[1]}, line ${where[2]})` : text;
}

function record(args) {
  if (consoleLines.length >= LIMITS.consoleLines || consoleChars >= LIMITS.consoleChars) return;
  const line = args
    .map(format)
    .join(' ')
    .slice(0, LIMITS.consoleChars - consoleChars);
  consoleChars += line.length;
  consoleLines.push(line);
}

function recordError(message) {
  if (errors.length < LIMITS.errors) errors.push(oneLine(message, LIMITS.errorChars));
}

const virtualConsole = new VirtualConsole();
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  virtualConsole.on(level, (...args) => record(args));
}
virtualConsole.on('jsdomError', (error) => {
  const message = String((error && error.message) || error);
  // What jsdom does not implement (navigation, layout) is not the learner's mistake.
  if (message.startsWith('Not implemented')) return;
  const detail = error && error.detail;
  recordError(detail && typeof detail.message === 'string' ? describeError(detail) : message);
});

// ───────────────────────── the page ─────────────────────────

const dom = new JSDOM(files.html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: PAGE_URL,
  virtualConsole,
});
const { window } = dom;
const { document } = window;

/** Untouched references, taken before any of the page's code runs. */
const own = (proto, name) => Object.getOwnPropertyDescriptor(proto, name);
const P = {
  querySelector: window.Document.prototype.querySelector,
  querySelectorAll: window.Document.prototype.querySelectorAll,
  closest: window.Element.prototype.closest,
  remove: window.Element.prototype.remove,
  appendChild: window.Node.prototype.appendChild,
  createElement: window.Document.prototype.createElement,
  getAttribute: window.Element.prototype.getAttribute,
  hasAttribute: window.Element.prototype.hasAttribute,
  setText: own(window.Node.prototype, 'textContent').set,
  getText: own(window.Node.prototype, 'textContent').get,
  head: own(window.Document.prototype, 'head').get,
  body: own(window.Document.prototype, 'body').get,
  documentElement: own(window.Document.prototype, 'documentElement').get,
  firstChild: own(window.Node.prototype, 'firstChild').get,
  nextSibling: own(window.Node.prototype, 'nextSibling').get,
  nodeType: own(window.Node.prototype, 'nodeType').get,
  localName: own(window.Element.prototype, 'localName').get,
  namespaceURI: own(window.Element.prototype, 'namespaceURI').get,
  prefix: own(window.Element.prototype, 'prefix').get,
  attributes: own(window.Element.prototype, 'attributes').get,
  mapLength: own(window.NamedNodeMap.prototype, 'length').get,
  mapItem: window.NamedNodeMap.prototype.item,
  attrName: own(window.Attr.prototype, 'name').get,
  attrValue: own(window.Attr.prototype, 'value').get,
  attrNamespace: own(window.Attr.prototype, 'namespaceURI').get,
  data: own(window.CharacterData.prototype, 'data').get,
  listLength: own(window.NodeList.prototype, 'length').get,
  listItem: window.NodeList.prototype.item,
  inputValue: own(window.HTMLInputElement.prototype, 'value'),
  inputChecked: own(window.HTMLInputElement.prototype, 'checked'),
  inputType: own(window.HTMLInputElement.prototype, 'type').get,
  inputForm: own(window.HTMLInputElement.prototype, 'form').get,
  textareaValue: own(window.HTMLTextAreaElement.prototype, 'value'),
  selectValue: own(window.HTMLSelectElement.prototype, 'value'),
  optionSelected: own(window.HTMLOptionElement.prototype, 'selected').get,
  click: window.HTMLElement.prototype.click,
  focus: window.HTMLElement.prototype.focus,
  blur: window.HTMLElement.prototype.blur,
  requestSubmit: window.HTMLFormElement.prototype.requestSubmit,
  dispatchEvent: window.EventTarget.prototype.dispatchEvent,
  Event: window.Event,
  MouseEvent: window.MouseEvent,
  KeyboardEvent: window.KeyboardEvent,
  InputEvent: window.InputEvent,
  SubmitEvent: window.SubmitEvent,
};
const call = (fn, target, ...args) => Reflect.apply(fn, target, args);
const settle = (ms) => new Promise((done) => setTimeout(done, ms));

function all(selector) {
  const list = call(P.querySelectorAll, document, selector);
  const out = [];
  const length = call(P.listLength, list);
  for (let i = 0; i < length; i += 1) out.push(call(P.listItem, list, i));
  return out;
}

const isHtml = (el, name) =>
  call(P.namespaceURI, el) === HTML_NS && (name === undefined || call(P.localName, el) === name);

/** The page's inline scripts, in document order, out of their places; null for a data block. */
function takeScripts() {
  const taken = [];
  for (const script of all('script')) {
    const type = (call(P.getAttribute, script, 'type') || '').trim().toLowerCase();
    if (call(P.hasAttribute, script, 'src')) {
      call(P.remove, script);
    } else if (SCRIPT_TYPES.has(type)) {
      taken.push(call(P.getText, script));
      call(P.remove, script);
    }
  }
  return taken;
}

function addElement(parent, name, text) {
  const element = call(P.createElement, document, name);
  call(P.setText, element, text);
  call(P.appendChild, parent, element);
}

for (const element of all('base, meta[http-equiv]')) {
  const equiv = call(P.getAttribute, element, 'http-equiv');
  if (call(P.localName, element) === 'base' || /^\s*refresh\s*$/i.test(equiv || '')) {
    call(P.remove, element);
  }
}
const scripts = takeScripts().map((source, index) => ({
  source,
  name: `inline script ${index + 1}`,
}));
if (files.js.trim()) scripts.push({ source: files.js, name: 'script.js' });
if (files.css.trim()) addElement(call(P.head, document), 'style', files.css);
// The scripts stay in the page, where the preview puts them; they run from here, once.
for (const script of scripts) addElement(call(P.body, document), 'script', script.source);

const context = dom.getInternalVMContext();
new vm.Script(PRELUDE, { filename: 'lab-prelude.js' }).runInContext(context);
for (const script of scripts) {
  try {
    new vm.Script(script.source, { filename: script.name }).runInContext(context);
  } catch (error) {
    const text = describeError(error);
    recordError(text.includes(`(${script.name}`) ? text : `${text} (${script.name})`);
  }
}

// ───────────────────────── the steps ─────────────────────────

function setValue(element, value) {
  if (isHtml(element, 'input')) {
    const type = call(P.inputType, element);
    if (type === 'checkbox' || type === 'radio') {
      const on =
        value === '' ? !call(P.inputChecked.get, element) : !/^(false|off|no|0)$/i.test(value);
      call(P.inputChecked.set, element, on);
    } else {
      call(P.inputValue.set, element, value);
    }
  } else if (isHtml(element, 'textarea')) {
    call(P.textareaValue.set, element, value);
  } else if (isHtml(element, 'select')) {
    call(P.selectValue.set, element, value);
  }
}

function fire(element, event) {
  return call(P.dispatchEvent, element, event);
}

/** Submits the form the way pressing its submit button does: validation, then `submit`. */
function submit(form) {
  try {
    call(P.requestSubmit, form);
  } catch {
    fire(form, new P.SubmitEvent('submit', { bubbles: true, cancelable: true }));
  }
}

function perform(step, element) {
  switch (step.action) {
    case 'click':
      if (isHtml(element)) call(P.click, element);
      else
        fire(element, new P.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return null;
    case 'input':
      setValue(element, step.value);
      fire(
        element,
        new P.InputEvent('input', { bubbles: true, data: step.value, inputType: 'insertText' }),
      );
      return null;
    case 'change':
      setValue(element, step.value);
      fire(
        element,
        new P.InputEvent('input', { bubbles: true, data: step.value, inputType: 'insertText' }),
      );
      fire(element, new P.Event('change', { bubbles: true }));
      return null;
    case 'submit': {
      const form = isHtml(element, 'form') ? element : call(P.closest, element, 'form');
      if (!form) return 'is not a form and is not inside one';
      submit(form);
      return null;
    }
    case 'focus':
      if (isHtml(element)) call(P.focus, element);
      return null;
    case 'blur':
      if (isHtml(element)) call(P.blur, element);
      return null;
    case 'keydown': {
      const init = { key: step.key, bubbles: true, cancelable: true };
      const proceed = fire(element, new P.KeyboardEvent('keydown', init));
      if (proceed && (step.key.length === 1 || step.key === 'Enter')) {
        fire(element, new P.KeyboardEvent('keypress', init));
      }
      fire(element, new P.KeyboardEvent('keyup', init));
      if (
        proceed &&
        step.key === 'Enter' &&
        isHtml(element, 'input') &&
        IMPLICIT_SUBMIT_TYPES.has(call(P.inputType, element))
      ) {
        const form = call(P.inputForm, element);
        if (form) submit(form);
      }
      return null;
    }
    default:
      return 'is not something a step can do';
  }
}

async function runSteps() {
  for (const [index, step] of steps.entries()) {
    let element;
    try {
      element = call(P.querySelector, document, step.selector);
    } catch {
      return { index, problem: 'invalid' };
    }
    if (!element) return { index, problem: 'missing' };
    let problem;
    try {
      problem = perform(step, element);
    } catch (error) {
      recordError(`${describeError(error)} (step ${index + 1})`);
    }
    if (problem) return { index, problem: 'not-a-form' };
    await settle(STEP_SETTLE_MS);
  }
  return null;
}

// ───────────────────────── the snapshot ─────────────────────────

/**
 * The element tree as data, walked with the untouched references. It keeps exactly the structure
 * the page's scripts built (HTML would be re-parsed differently: a <tr> added straight to a <table>
 * gains a <tbody>), and the live state of form fields, which HTML attributes do not carry.
 */
function snapshotTree() {
  let nodes = 0;
  let textChars = 0;
  let truncated = false;
  const rootElement = call(P.documentElement, document);
  if (!rootElement) return { tree: null, truncated: false };
  const root = { t: 'e' };
  const stack = [{ node: rootElement, out: root, depth: 0 }];
  while (stack.length > 0) {
    const { node, out, depth } = stack.pop();
    const type = call(P.nodeType, node);
    nodes += 1;
    if (type === 3 || type === 4) {
      const data = call(P.data, node);
      textChars += data.length;
      out.t = 't';
      out.d = data;
      continue;
    }
    out.t = 'e';
    out.n = call(P.localName, node);
    out.ns = call(P.namespaceURI, node);
    const prefix = call(P.prefix, node);
    if (prefix) out.p = prefix;
    const map = call(P.attributes, node);
    const count = call(P.mapLength, map);
    out.a = [];
    for (let i = 0; i < count; i += 1) {
      const attr = call(P.mapItem, map, i);
      const value = call(P.attrValue, attr);
      textChars += value.length;
      out.a.push([call(P.attrName, attr), value, call(P.attrNamespace, attr)]);
    }
    if (isHtml(node, 'input')) {
      out.v = call(P.inputValue.get, node);
      out.k = call(P.inputChecked.get, node);
    } else if (isHtml(node, 'textarea')) {
      out.v = call(P.textareaValue.get, node);
    } else if (isHtml(node, 'option')) {
      out.s = call(P.optionSelected, node);
    }
    out.c = [];
    if (depth >= LIMITS.depth) {
      truncated = truncated || call(P.firstChild, node) !== null;
      continue;
    }
    const children = [];
    for (let child = call(P.firstChild, node); child; child = call(P.nextSibling, child)) {
      const childType = call(P.nodeType, child);
      if (childType !== 1 && childType !== 3 && childType !== 4) continue;
      if (nodes + children.length >= LIMITS.nodes || textChars >= LIMITS.textChars) {
        truncated = true;
        break;
      }
      const slot = {};
      out.c.push(slot);
      children.push({ node: child, out: slot, depth: depth + 1 });
    }
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
  }
  return { tree: root, truncated };
}

async function main() {
  // DOMContentLoaded and load come from jsdom once this turn ends; then timers get their moment.
  await settle(LOAD_SETTLE_MS);
  const step = await runSteps();
  if (steps.length > 0) await settle(LOAD_SETTLE_MS);
  const { tree, truncated } = snapshotTree();
  const snapshot = {
    format: 'snapshot/1',
    tree,
    truncated,
    console: consoleLines,
    errors,
    step,
  };
  fs.writeSync(1, JSON.stringify(snapshot));
  process.exit(0);
}

main().catch((error) => {
  fs.writeSync(2, `The page could not be checked: ${oneLine(format(error), 300)}\n`);
  process.exit(2);
});
