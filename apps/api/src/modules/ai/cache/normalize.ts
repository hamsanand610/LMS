/**
 * How the Phase 7 answer cache compares questions (ADR-0032): exactly, after a deterministic
 * normalisation — never by similarity, which needs embeddings and is Phase 8's.
 *
 * The normalisation folds only differences of form:
 * - case, spacing, typographic quotes and sentence punctuation (`?`, `!`, a full stop, commas);
 * - how a question is framed: "what is", "explain", "define", "describe", "tell me about",
 *   "meaning of"; "meaning" or "definition" at the end; and the articles a, an and the;
 * - where a question names its one language or technology: "inheritance in Java" and "Java
 *   inheritance" are the same question.
 *
 * It keeps everything that can change what is asked: the order of the words (no sorting, so "Java
 * faster than Python" and "Python faster than Java" stay apart), every other word, and the
 * punctuation inside a word (`c`, `c++` and `c#`; `=` and `==`; `node.js`). Two questions that
 * differ in anything else are different questions: under-merging only costs a call, while
 * over-merging would answer the wrong question.
 *
 * Some questions are never cached, and only general ones are shared between people (see
 * `CacheQuestion`).
 */

/** Changing the rules below changes every key: this is part of each one. */
export const NORMALISATION_VERSION = 1;

/** The longest question the cache keeps: longer ones are rarely asked twice the same way. */
export const CACHE_MAX_QUESTION = 300;

export interface CacheQuestion {
  /** The question as the cache compares it; null when it may not be cached at all. */
  key: string | null;
  /**
   * It may be shared between people: nothing in it speaks of the asker — no first person ("I",
   * "my", "we", "our"…), no figures that could identify someone. Otherwise it is cached for the
   * asker alone.
   */
  shareable: boolean;
  /** Why it is not cached, or not shared, as codes. */
  reasons: string[];
}

/** Framings at the start of a question, longest first: they do not change what is asked. */
const LEADING = [
  'what do you mean by',
  'what is meant by',
  'what is the meaning of',
  'what is the definition of',
  'can you please explain',
  'could you please explain',
  'please explain',
  'can you explain',
  'could you explain',
  'can you tell me about',
  'could you tell me about',
  'tell me about',
  'explain to me',
  'help me understand',
  'give me',
  'show me',
  'teach me',
  'the meaning of',
  'the definition of',
  'meaning of',
  'definition of',
  'what is',
  'what are',
  "what's",
  'whats',
  'explain',
  'define',
  'describe',
]
  .map((phrase) => phrase.split(' '))
  .sort((a, b) => b.length - a.length);

/** Framings at the end of a question. */
const TRAILING = [['meaning'], ['definition'], ['explained'], ['explanation'], ['please']];

const ARTICLES = new Set(['a', 'an', 'the']);

/** The asker speaking of themselves: such a question is theirs, never shared. */
const FIRST_PERSON = new Set([
  'i',
  "i'm",
  'im',
  "i've",
  "i'd",
  "i'll",
  'me',
  'my',
  'mine',
  'myself',
  'we',
  "we're",
  "we've",
  "we'd",
  "we'll",
  'us',
  'our',
  'ours',
  'ourselves',
]);

/**
 * Languages and technologies SI Academy teaches, by every name a learner uses for them, mapped to
 * one name. A question naming exactly one of them is keyed by it, wherever it is named.
 */
const TECHNOLOGIES = new Map<string, string>([
  ['java', 'java'],
  ['python', 'python'],
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['typescript', 'typescript'],
  ['ts', 'typescript'],
  ['c', 'c'],
  ['c++', 'c++'],
  ['cpp', 'c++'],
  ['c#', 'c#'],
  ['csharp', 'c#'],
  ['go', 'go'],
  ['golang', 'go'],
  ['rust', 'rust'],
  ['kotlin', 'kotlin'],
  ['swift', 'swift'],
  ['php', 'php'],
  ['ruby', 'ruby'],
  ['r', 'r'],
  ['sql', 'sql'],
  ['mysql', 'mysql'],
  ['postgresql', 'postgresql'],
  ['postgres', 'postgresql'],
  ['sqlite', 'sqlite'],
  ['mongodb', 'mongodb'],
  ['html', 'html'],
  ['css', 'css'],
  ['react', 'react'],
  ['reactjs', 'react'],
  ['react.js', 'react'],
  ['angular', 'angular'],
  ['vue', 'vue'],
  ['vue.js', 'vue'],
  ['node', 'node.js'],
  ['nodejs', 'node.js'],
  ['node.js', 'node.js'],
  ['django', 'django'],
  ['flask', 'flask'],
  ['spring', 'spring'],
  ['git', 'git'],
  ['linux', 'linux'],
  ['bash', 'bash'],
  ['excel', 'excel'],
  ['pandas', 'pandas'],
  ['numpy', 'numpy'],
  ['dart', 'dart'],
  ['flutter', 'flutter'],
  ['scala', 'scala'],
]);

/** A technology named after "in", at the end, may also be followed by one of these. */
const TECHNOLOGY_NOUNS = new Set(['language', 'programming']);

/**
 * The question as the cache compares it, and whether it may be cached or shared at all. Pure and
 * deterministic: the same question always gives the same answer.
 */
export function normaliseQuestion(question: string): CacheQuestion {
  const text = question
    .normalize('NFKC')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
  const refused = refusal(text);
  if (refused) return { key: null, shareable: false, reasons: [refused] };

  let words = text
    .toLowerCase()
    .split(/\s+/)
    .map(trimWord)
    .filter((word) => word !== '');
  words = stripFraming(words);
  words = words.filter((word) => !ARTICLES.has(word));

  const firstPerson = words.some((word) => FIRST_PERSON.has(word));
  const named = [...new Set(words.map((word) => TECHNOLOGIES.get(word)).filter(Boolean))];
  let technology = '';
  if (named.length === 1) {
    const extracted = withoutTechnology(words);
    if (extracted) {
      technology = extracted.technology;
      words = extracted.rest;
    }
  }
  if (words.length === 0) return { key: null, shareable: false, reasons: ['empty'] };
  return {
    key: `${technology}|${words.join(' ')}`,
    shareable: !firstPerson,
    reasons: firstPerson ? ['first_person'] : [],
  };
}

/** Why a question may not be cached at all, or null. */
function refusal(text: string): string | null {
  if (text.length === 0) return 'empty';
  if (text.length > CACHE_MAX_QUESTION) return 'too_long';
  if (/[\r\n]/.test(text)) return 'several_lines';
  // Code, or something pasted: about the asker's own work.
  if (/[{};]|'''|"""/.test(text)) return 'code';
  // Details that could identify a person: an address, a number of six digits or more, a link.
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return 'email_address';
  if (/\d{6,}/.test(text.replace(/[\s()+-]/g, ''))) return 'long_number';
  if (/:\/\/|\bwww\./i.test(text)) return 'link';
  return null;
}

/**
 * A word without the sentence punctuation around it. Punctuation inside it stays, and so do the
 * characters a name ends with: `c++` and `c#` keep theirs; only the sentence's go.
 */
function trimWord(word: string): string {
  return word.replace(/^["'(]+/, '').replace(/[?!.,:"')]+$/, '');
}

function stripFraming(words: string[]): string[] {
  let current = words;
  for (let changed = true; changed;) {
    changed = false;
    for (const phrase of LEADING) {
      if (phrase.length < current.length && phrase.every((word, i) => current[i] === word)) {
        current = current.slice(phrase.length);
        changed = true;
        break;
      }
    }
    for (const phrase of TRAILING) {
      const start = current.length - phrase.length;
      if (start > 0 && phrase.every((word, i) => current[start + i] === word)) {
        current = current.slice(0, start);
        changed = true;
        break;
      }
    }
  }
  return current;
}

/**
 * The question's one technology taken out, when it is named at the start ("Java inheritance") or
 * after "in" at the end ("inheritance in Java", "… in Java programming"); otherwise null and the
 * words stay as they are.
 */
function withoutTechnology(words: string[]): { technology: string; rest: string[] } | null {
  const last = words.length - 1;
  const trailingNoun = TECHNOLOGY_NOUNS.has(words[last] ?? '') ? 1 : 0;
  const at = last - trailingNoun;
  if (at >= 2 && words[at - 1] === 'in' && TECHNOLOGIES.has(words[at]!)) {
    return { technology: TECHNOLOGIES.get(words[at]!)!, rest: words.slice(0, at - 1) };
  }
  if (words.length >= 2 && TECHNOLOGIES.has(words[0]!)) {
    return { technology: TECHNOLOGIES.get(words[0]!)!, rest: words.slice(1) };
  }
  return null;
}
