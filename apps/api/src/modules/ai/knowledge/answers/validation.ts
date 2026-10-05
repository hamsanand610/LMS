import { credentialsIn } from '../../policy/data-class.js';
import { CONFLICT_MARKER, INSUFFICIENT_EVIDENCE_TOKEN } from './grounded-prompt.js';
import { supportOf } from './support.js';

/** Why a model's answer was not accepted as grounded (ADR-0037). */
export const ANSWER_FAULTS = [
  'empty',
  'too_long',
  'instruction_leak',
  'protected_content',
  'unknown_citation',
  'no_citation',
  'uncited_claim',
  'unsupported_citation',
  'conflict_without_sources',
] as const;
export type AnswerFault = (typeof ANSWER_FAULTS)[number];

export type CheckedAnswer =
  | { ok: true; kind: 'answer' | 'conflict'; text: string; cited: string[] }
  | { ok: true; kind: 'declined' }
  | { ok: false; fault: AnswerFault };

/** An answer the checks accepted: given as it is, or as a decline. */
export type AcceptedAnswer = Extract<CheckedAnswer, { ok: true }>;

export interface AnswerChecks {
  /** The citation ids of the evidence the model was given. */
  ids: ReadonlySet<string>;
  /** Text an answer must never contain: the request's reference code and the instructions' phrases. */
  secrets: readonly string[];
  maxCharacters: number;
  /** Each citation id's passage as the model was given it — document, section and text (8F). */
  passages: ReadonlyMap<string, string>;
}

/** A citation as the platform writes it. */
const CITATION = /\[S([1-9][0-9]?)\]/g;
/** Anything a reader could take for a citation: `[S1]`, `[s 2]`, `[S]`, `[S01]`, `[Source 3]`… */
const CITATION_LIKE = /\[\s*s(?:ource)?\s*\d*\s*\]/gi;

/**
 * Whether a model's answer may be given as grounded, deterministically — no second model judges it:
 *
 * 1. something was written, and not more than a concise answer;
 * 2. none of the instructions leaked (the reference code, their phrases);
 * 3. no credential, which is never sent or shown;
 * 4. the model's own decline (`INSUFFICIENT_EVIDENCE`) is a decline, whatever surrounds it;
 * 5. every citation is one of the evidence's ids, written as the platform writes it — anything
 *    else shaped like one is a fabrication;
 * 6. every sentence ends with at least one citation, so no claim stands without a source; a
 *    conflict cites at least two passages;
 * 7. the passages a sentence cites support it as far as words can show (Phase 8F, `supportOf`):
 *    every number it states is theirs, and at least half of its content words.
 *
 * It does not understand meaning: a claim in the passage's own words but negated, or a related
 * passage cited instead of the right one, can pass it (ADR-0037; the Phase 8 closure's limits).
 */
export function checkAnswer(raw: string, checks: AnswerChecks): CheckedAnswer {
  const text = raw.trim();
  if (text === '') return { ok: false, fault: 'empty' };
  if (text.length > checks.maxCharacters) return { ok: false, fault: 'too_long' };
  const lower = text.toLowerCase();
  if (checks.secrets.some((secret) => secret !== '' && lower.includes(secret.toLowerCase()))) {
    return { ok: false, fault: 'instruction_leak' };
  }
  if (credentialsIn(text).length > 0) return { ok: false, fault: 'protected_content' };
  if (text.includes(INSUFFICIENT_EVIDENCE_TOKEN)) return { ok: true, kind: 'declined' };

  const conflict = text.startsWith(CONFLICT_MARKER);
  const body = conflict ? text.slice(CONFLICT_MARKER.length).trim() : text;
  const cited: string[] = [];
  for (const match of body.matchAll(CITATION_LIKE)) {
    const exact = /^\[S([1-9][0-9]?)\]$/.exec(match[0]);
    if (!exact || !checks.ids.has(`S${exact[1]}`)) return { ok: false, fault: 'unknown_citation' };
  }
  for (const match of body.matchAll(CITATION)) {
    const id = `S${match[1]}`;
    if (!cited.includes(id)) cited.push(id);
  }
  if (cited.length === 0) return { ok: false, fault: 'no_citation' };
  const sentences = sentencesOf(body);
  if (sentences.some((sentence) => !CITATION_ALONE.test(sentence))) {
    return { ok: false, fault: 'uncited_claim' };
  }
  for (const sentence of sentences) {
    const sources = [...sentence.matchAll(CITATION)].map(
      (match) => checks.passages.get(`S${match[1]}`) ?? '',
    );
    if (!supportOf(sentence, sources).supported) {
      return { ok: false, fault: 'unsupported_citation' };
    }
  }
  if (conflict && cited.length < 2) return { ok: false, fault: 'conflict_without_sources' };
  return { ok: true, kind: conflict ? 'conflict' : 'answer', text: body, cited };
}

const CITATION_ALONE = /\[S[1-9][0-9]?\]/;

/**
 * The sentences of an answer that say something, each with the citations that follow it: split at
 * line ends and at `.`, `!` or `?` before a capital, a digit, a quote or a bracket, with citations
 * written just after a full stop moved back to the sentence they close — so a claim after them is
 * a sentence of its own. Text with no letter or digit (a bullet, a stray mark) is not a sentence.
 */
export function sentencesOf(text: string): string[] {
  const pieces = text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'“‘([])/))
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');
  const sentences: string[] = [];
  for (const piece of pieces) {
    const leading = /^((?:\[S[1-9][0-9]?\]\s*)+)(.*)$/s.exec(piece);
    if (leading && sentences.length > 0) {
      sentences[sentences.length - 1] += ` ${leading[1]!.trim()}`;
      const rest = leading[2]!.trim();
      if (rest !== '') sentences.push(rest);
      continue;
    }
    sentences.push(piece);
  }
  return sentences.filter((sentence) => /[\p{L}\p{N}]/u.test(sentence.replace(CITATION_G, '')));
}

const CITATION_G = /\[S[1-9][0-9]?\]/g;
