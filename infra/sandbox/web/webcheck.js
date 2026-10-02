#!/usr/bin/env node
'use strict';
/**
 * The Web Lab's checker (ADR-0019), part of the sandbox image and trusted.
 *
 * harness.py runs it once per job, after webpage.js has loaded the learner's page for every check
 * and every process those pages left behind has been stopped, so no learner code is running while
 * it works. Standard input is a JSON list of {check, snapshot}: one check as the author wrote it
 * and the path of the snapshot of the page it is judged on. For each, it rebuilds the page's
 * elements with scripts switched off and decides; it prints a JSON list, in the same order, of
 * {verdict}, where the verdict is `pass` or the one-line reason the check does not hold, or
 * {error} when that check could not be judged. The API compares a verdict with `pass`, so a hidden
 * check stays as hidden as a hidden test case.
 *
 * What a check reads:
 *   - text: the element's text with runs of white space made one space and the ends trimmed; for
 *     a text field, text area or list, its current value instead;
 *   - attribute: the attribute as the page left it;
 *   - style: the computed value of one property, as jsdom reports it (no layout, so sizes are as
 *     written); colours compare in any notation, and `bold`/`normal` match 700/400;
 *   - console: the page's console.log, info, warn, error and debug lines, joined by new lines.
 *
 * Exit codes: 0 when the list was judged; 2 when the input could not be read at all.
 */

const fs = require('fs');
const { JSDOM } = require('jsdom');

const LIMITS = {
  entries: 50,
  steps: 10,
  selectorChars: 200,
  valueChars: 500,
  snapshotBytes: 4 * 1024 * 1024,
};
const SHOWN_CHARS = 120;
const VERDICT_CHARS = 400;
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const TEXT_MATCHES = new Set(['equals', 'contains', 'matches']);
const ATTRIBUTE_MATCHES = new Set(['present', 'equals', 'contains']);
const ACTIONS = new Set(['click', 'input', 'change', 'submit', 'focus', 'blur', 'keydown']);
const ACTION_WORDS = {
  click: 'click',
  input: 'type into',
  change: 'change',
  submit: 'submit',
  focus: 'focus',
  blur: 'leave',
  keydown: 'press a key in',
};
const FONT_WEIGHTS = { normal: '400', bold: '700' };

const oneLine = (text, max) => {
  const flat = String(text)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
const normal = (text) => String(text).replace(/\s+/g, ' ').trim();
const quote = (text) => {
  const flat = normal(text);
  return `"${flat.length > SHOWN_CHARS ? `${flat.slice(0, SHOWN_CHARS - 1)}…` : flat}"`;
};

// ───────────────────────── reading ─────────────────────────

/** Mirrors webCheckSchema in packages/shared/src/schemas/web-lab.ts; it was validated on save too. */
function readCheck(text) {
  const value = JSON.parse(text);
  const str = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
  const int = (v) => Number.isInteger(v) && v >= 0 && v <= 1000;
  const pattern = (v) => {
    try {
      new RegExp(v);
      return true;
    } catch {
      return false;
    }
  };
  const textual = (a) =>
    TEXT_MATCHES.has(a.match) &&
    str(a.value, LIMITS.valueChars) &&
    (a.match !== 'matches' || pattern(a.value));
  const assertion = (a) => {
    if (!a || typeof a !== 'object') return false;
    const selectorOk = str(a.selector, LIMITS.selectorChars, 1) && a.selector.trim() !== '';
    switch (a.kind) {
      case 'exists':
        return (
          selectorOk &&
          (a.min === undefined || int(a.min)) &&
          (a.max === undefined || a.max === null || int(a.max))
        );
      case 'text':
        return selectorOk && textual(a);
      case 'attribute':
        return (
          selectorOk &&
          ATTRIBUTE_MATCHES.has(a.match) &&
          str(a.name, 100, 1) &&
          /^[A-Za-z_:][-A-Za-z0-9_:.]*$/.test(a.name.trim()) &&
          (a.value === undefined || str(a.value, LIMITS.valueChars))
        );
      case 'style':
        return (
          selectorOk &&
          str(a.property, 60, 1) &&
          /^-?[a-z][a-z-]*$/.test(a.property.trim()) &&
          str(a.value, 200, 1)
        );
      case 'console':
        return textual(a);
      default:
        return false;
    }
  };
  if (value && value.kind === 'interaction') {
    const steps = value.steps;
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > LIMITS.steps) return null;
    for (const step of steps) {
      if (!step || !ACTIONS.has(step.action) || !str(step.selector, LIMITS.selectorChars, 1)) {
        return null;
      }
    }
    return assertion(value.then) ? value : null;
  }
  return assertion(value) ? value : null;
}

/** A snapshot webpage.js printed: checked for shape, since that process ran the page's code. */
function readSnapshot(path) {
  if (fs.statSync(path).size > LIMITS.snapshotBytes) return { tooLarge: true };
  const value = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!value || value.format !== 'snapshot/1') throw new Error('not a snapshot');
  const lines = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const step =
    value.step && Number.isInteger(value.step.index) && typeof value.step.problem === 'string'
      ? value.step
      : null;
  return {
    tree: value.tree && typeof value.tree === 'object' ? value.tree : null,
    truncated: value.truncated === true,
    console: lines(value.console),
    errors: lines(value.errors),
    step,
  };
}

// ───────────────────────── the page, rebuilt ─────────────────────────

/** Builds a snapshot's tree with DOM calls, so its structure is exactly the page's. */
function rebuild(tree) {
  // Scripts never run here: jsdom's default, stated so it is not changed by accident.
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'https://web-lab.invalid/',
    runScripts: undefined,
  });
  const { window } = dom;
  const { document } = window;
  const fields = [];
  let root;
  try {
    root = document.createElementNS(
      tree.ns || HTML_NS,
      typeof tree.n === 'string' ? tree.n : 'html',
    );
  } catch {
    root = document.createElementNS(HTML_NS, 'html');
  }
  const stack = [{ data: tree, element: root }];
  while (stack.length > 0) {
    const { data, element } = stack.pop();
    for (const attribute of Array.isArray(data.a) ? data.a : []) {
      const [name, value, namespace] = Array.isArray(attribute) ? attribute : [];
      if (typeof name !== 'string' || typeof value !== 'string') continue;
      try {
        if (namespace) element.setAttributeNS(namespace, name, value);
        else element.setAttribute(name, value);
      } catch {
        // A name the page could make but setAttribute refuses; nothing a check can name.
      }
    }
    if (typeof data.v === 'string' || typeof data.k === 'boolean' || typeof data.s === 'boolean') {
      fields.push({ element, data });
    }
    for (const child of Array.isArray(data.c) ? data.c : []) {
      if (!child || typeof child !== 'object') continue;
      if (child.t === 't') {
        element.appendChild(document.createTextNode(typeof child.d === 'string' ? child.d : ''));
        continue;
      }
      if (child.t !== 'e' || typeof child.n !== 'string') continue;
      let made;
      try {
        const name = typeof child.p === 'string' && child.p ? `${child.p}:${child.n}` : child.n;
        made = child.ns ? document.createElementNS(child.ns, name) : document.createElement(name);
      } catch {
        continue;
      }
      element.appendChild(made);
      stack.push({ data: child, element: made });
    }
  }
  document.replaceChild(root, document.documentElement);
  // Live values are applied once the elements are in the page, as the page left them.
  for (const { element, data } of fields) {
    try {
      if (typeof data.s === 'boolean') element.selected = data.s;
      if (typeof data.k === 'boolean') element.checked = data.k;
      if (typeof data.v === 'string') element.value = data.v;
    } catch {
      // A value a field of this type does not take.
    }
  }
  return { window, document };
}

// ───────────────────────── deciding ─────────────────────────

class Unmatched extends Error {}

function first(document, selector) {
  let element;
  try {
    element = document.querySelector(selector);
  } catch {
    throw new Unmatched(`\`${selector}\` is not a valid CSS selector`);
  }
  if (!element) throw new Unmatched(`Nothing matches \`${selector}\` on the page`);
  return element;
}

function textOf(element) {
  if (element.namespaceURI === HTML_NS) {
    const name = element.localName;
    if (name === 'textarea' || name === 'select') return element.value;
    if (name === 'input' && !['checkbox', 'radio'].includes(element.type)) return element.value;
  }
  return element.textContent;
}

function compareText(match, actual, expected) {
  if (match === 'equals') return normal(actual) === normal(expected);
  if (match === 'contains') return normal(actual).includes(normal(expected));
  return new RegExp(expected).test(normal(actual));
}

/** A value as the engine would compute it, through an element nothing else sees. */
function computedFor(page, property, value) {
  const probe = page.document.createElement('div');
  probe.style.setProperty(property, value);
  if (!probe.style.getPropertyValue(property)) return null;
  page.document.body.appendChild(probe);
  const computed = page.window.getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return computed;
}

function styleMatches(page, property, actual, expected) {
  const tidy = (v) =>
    normal(v)
      .toLowerCase()
      .replace(/\s*,\s*/g, ', ');
  const want = new Set([tidy(expected)]);
  const computed = page.document.body ? computedFor(page, property, expected) : null;
  if (computed) want.add(tidy(computed));
  const got = tidy(actual);
  if (property === 'font-weight') {
    return [...want].some((w) => (FONT_WEIGHTS[w] ?? w) === (FONT_WEIGHTS[got] ?? got));
  }
  return want.has(got);
}

function evaluate(page, assertion, logged) {
  const { document, window } = page;
  switch (assertion.kind) {
    case 'exists': {
      let count;
      try {
        count = document.querySelectorAll(assertion.selector).length;
      } catch {
        return `\`${assertion.selector}\` is not a valid CSS selector`;
      }
      const min = assertion.min ?? 1;
      const max = assertion.max ?? null;
      if (count >= min && (max === null || count <= max)) return null;
      if (count === 0) return `Nothing matches \`${assertion.selector}\` on the page`;
      return `${count} ${count === 1 ? 'element matches' : 'elements match'} \`${assertion.selector}\``;
    }
    case 'text': {
      const actual = textOf(first(document, assertion.selector));
      return compareText(assertion.match, actual, assertion.value)
        ? null
        : `The text of \`${assertion.selector}\` is ${quote(actual)}`;
    }
    case 'attribute': {
      const element = first(document, assertion.selector);
      const name = assertion.name.trim();
      if (!element.hasAttribute(name)) {
        return `\`${assertion.selector}\` has no \`${name}\` attribute`;
      }
      if (assertion.match === 'present') return null;
      const actual = element.getAttribute(name);
      const ok =
        assertion.match === 'equals'
          ? actual === assertion.value
          : actual.includes(assertion.value ?? '');
      return ok
        ? null
        : `The \`${name}\` attribute of \`${assertion.selector}\` is ${quote(actual)}`;
    }
    case 'style': {
      const element = first(document, assertion.selector);
      const property = assertion.property.trim();
      const actual = window.getComputedStyle(element).getPropertyValue(property);
      if (!actual) return `\`${assertion.selector}\` has no value for \`${property}\``;
      return styleMatches(page, property, actual, assertion.value.trim())
        ? null
        : `\`${assertion.selector}\` has \`${property}: ${normal(actual)}\``;
    }
    case 'console': {
      const output = logged.join('\n');
      if (compareText(assertion.match, output, assertion.value)) return null;
      return output.trim()
        ? `The console showed ${quote(output)}`
        : 'Nothing was logged to the console';
    }
    default:
      return 'This check cannot be evaluated';
  }
}

function stepProblem(check, step) {
  const failed = check.steps[step.index];
  const what = failed
    ? `Step ${step.index + 1} (${ACTION_WORDS[failed.action]} \`${failed.selector}\`)`
    : `Step ${step.index + 1}`;
  if (step.problem === 'invalid') return `${what}: not a valid CSS selector`;
  if (step.problem === 'not-a-form') return `${what}: it is not a form and is not inside one`;
  return `${what}: nothing matches it on the page`;
}

/** Snapshots read and pages rebuilt once each: the checks of a static page share one. */
const snapshots = new Map();
const pages = new Map();

function judge(entry) {
  let check;
  try {
    check = readCheck(entry.check);
  } catch {
    check = null;
  }
  if (!check) return { error: 'The check could not be read.' };
  if (!snapshots.has(entry.snapshot)) {
    try {
      snapshots.set(entry.snapshot, readSnapshot(entry.snapshot));
    } catch {
      snapshots.set(entry.snapshot, null);
    }
  }
  const snapshot = snapshots.get(entry.snapshot);
  if (!snapshot) return { error: 'The page could not be read back.' };
  if (snapshot.tooLarge) return { verdict: 'The page grew too large to check' };
  if (snapshot.truncated) return { verdict: 'The page has too many elements to check' };
  if (check.kind === 'interaction' && snapshot.step) {
    return { verdict: stepProblem(check, snapshot.step) };
  }
  if (!snapshot.tree) return { verdict: 'The page has no elements' };
  if (!pages.has(entry.snapshot)) pages.set(entry.snapshot, rebuild(snapshot.tree));
  const assertion = check.kind === 'interaction' ? check.then : check;
  let reason;
  try {
    reason = evaluate(pages.get(entry.snapshot), assertion, snapshot.console);
  } catch (error) {
    if (!(error instanceof Unmatched)) {
      return { error: `The check could not be completed: ${oneLine(error && error.message, 200)}` };
    }
    reason = error.message;
  }
  if (reason === null) return { verdict: 'pass' };
  // The first error the page raised is often why: say so.
  const hint = snapshot.errors.length > 0 ? ` (the page reported: ${snapshot.errors[0]})` : '';
  return { verdict: oneLine(`${reason}${hint}`, VERDICT_CHARS) };
}

let entries;
try {
  entries = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  entries = null;
}
if (
  !Array.isArray(entries) ||
  entries.length > LIMITS.entries ||
  !entries.every((e) => e && typeof e.check === 'string' && typeof e.snapshot === 'string')
) {
  fs.writeSync(2, 'The checks could not be read.\n');
  process.exit(2);
}
fs.writeSync(1, JSON.stringify(entries.map(judge)));
process.exit(0);
