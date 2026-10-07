import { INSTRUCTION_FINGERPRINTS } from '../knowledge/answers/grounded-prompt.js';
import {
  type AnswerFault,
  type CheckedAnswer,
  checkAnswer,
} from '../knowledge/answers/validation.js';
import { AGENT_INSTRUCTION_FINGERPRINTS } from './agent-prompts.js';
import { agentCredentialsIn } from './protected-content.js';

/** Why a draft was not accepted: Phase 8E/8F's checks', and the agent's own. */
export type DraftFault =
  | AnswerFault
  /** The provider withheld it (its safety filters). */
  | 'blocked'
  /** It stopped at its length limit: an answer cut short is not complete. */
  | 'incomplete'
  /** It writes the agent's tool protocol: a tool call is never an answer. */
  | 'tool_protocol'
  /** It shows signs of obeying instructions planted in what it was given. */
  | 'prompt_injection'
  /** It holds an identifier of the run's own — the learner's, the institute's, a record's. */
  | 'protected_data'
  /**
   * It writes code while explaining the learner's own lab attempt (Phase 9C; ADR-0040): the agent
   * points to what to check, and never hands over a solution or a corrected program (ADR-0031).
   */
  | 'solution_code';

/** The faults that mean the draft was unsafe, not merely unsupported: never `not_grounded`. */
export const SAFETY_FAULTS: ReadonlySet<DraftFault> = new Set<DraftFault>([
  'instruction_leak',
  'protected_content',
  'tool_protocol',
  'prompt_injection',
  'protected_data',
  'solution_code',
  'blocked',
]);

export type VerifiedDraft = Extract<CheckedAnswer, { ok: true }> | { ok: false; fault: DraftFault };

export interface DraftChecks {
  /** The run's evidence ids, `S1`…: every citation must be one of them. */
  ids: ReadonlySet<string>;
  /** Each id's passage as the model was given it (document, section, text), for support. */
  passages: ReadonlyMap<string, string>;
  /** The run's reference code: in a draft, the instructions leaked. */
  referenceCode: string;
  /** Identifiers of the run that no draft may hold: the learner, institute, conversation, … */
  identifiers: readonly string[];
  maxCharacters: number;
  /** The evidence holds the learner's own lab attempt: no draft may then hold code (Phase 9C). */
  noCode?: boolean;
}

/**
 * The agent's own tool protocol, written out — `"action": "tool"`, a `"tool"` with its `"arguments"`,
 * a tool's name — and not merely JSON, which a programming answer may well quote.
 */
const TOOL_PROTOCOL: readonly RegExp[] = [
  /"\s*action\s*"\s*:\s*"\s*(?:tool|finish)\s*"/i,
  /"\s*tool\s*"\s*:\s*"[^"]*"\s*,\s*"\s*arguments\s*"/i,
  /\b(?:knowledge_search|lesson_content|learning_state|lab_attempt)\b/,
];

/**
 * What code looks like in an answer meant to be prose (Phase 9C): a fenced block; a line ending as a
 * statement or a block does (`;`, `{`, `}`), or holding a brace alone; a long inline code span; a run
 * of indented lines. A short inline mention — `i <= n`, a function's name — is not code; a program is.
 */
const CODE_SIGNS: readonly RegExp[] = [
  /```/,
  /~~~/,
  /`[^`\n]{50,}`/,
  /^[ \t]*[{}][ \t]*$/m,
  /[;{}][ \t]*$/m,
  /(?:^(?: {4}|\t)\S.*\n){2,}/m,
];

/** Whether a draft writes code: its citations taken out first, so `[S2]` ends no line for it. */
export function writesCode(text: string): boolean {
  const plain = text.replace(/\s*\[S[1-9][0-9]?\]/g, '');
  return CODE_SIGNS.some((sign) => sign.test(plain));
}

/**
 * What a model writes when it has followed instructions planted in its input, rather than its own:
 * a role taken on, its rules set aside, its instructions talked about. A learner's answer has no
 * reason to say any of it.
 */
const INJECTION_SIGNS: readonly RegExp[] = [
  /\bdeveloper mode\b/i,
  /\b(?:system|hidden) prompt\b/i,
  /\bignor(?:e|ing) (?:all |any |the |my |your )?(?:previous |prior |above |earlier )?(?:instructions|rules)\b/i,
  /\b(?:set(?:ting)?|put(?:ting)?) (?:the )?(?:documents|passages|evidence|sources) aside\b/i,
  /\bwithout (?:sources|citations|restrictions)\b/i,
  /\bI (?:will|can) (?:now )?answer anything\b/i,
];

/**
 * Whether a draft may be given to the learner (Roadmap Phase 9B; ADR-0039) — deterministic, every
 * check on every draft, before a word of it is streamed:
 *
 * 1. the provider gave a whole answer: not withheld, not cut short at its length limit;
 * 2. no tool protocol, and no sign of obeying planted instructions (prompt-injection defence);
 * 3. none of the run's own identifiers, and no credential — the platform's patterns and the
 *    agent's (protected data); with the learner's own lab attempt in the evidence, no code
 *    (Phase 9C: an explanation points to what to check, and never hands over a solution);
 * 4. Phase 8E/8F's grounded checks (`checkAnswer`): within its length; none of the instructions
 *    (their phrases, the agent's, the reference code); every citation one of the run's evidence ids;
 *    every sentence cited; each sentence supported by the passages it cites; a conflict citing two.
 *
 * The learner's authorization is checked again by the run itself, after this and before streaming.
 */
export function verifyDraft(
  draft: { text: string; finishReason: string },
  checks: DraftChecks,
): VerifiedDraft {
  if (draft.finishReason === 'blocked') return { ok: false, fault: 'blocked' };
  if (draft.finishReason === 'length') return { ok: false, fault: 'incomplete' };
  const text = draft.text;
  if (TOOL_PROTOCOL.some((protocol) => protocol.test(text))) {
    return { ok: false, fault: 'tool_protocol' };
  }
  if (INJECTION_SIGNS.some((sign) => sign.test(text))) {
    return { ok: false, fault: 'prompt_injection' };
  }
  const lower = text.toLowerCase();
  if (checks.identifiers.some((id) => id !== '' && lower.includes(id.toLowerCase()))) {
    return { ok: false, fault: 'protected_data' };
  }
  if (agentCredentialsIn(text).length > 0) return { ok: false, fault: 'protected_content' };
  if (checks.noCode && writesCode(text)) return { ok: false, fault: 'solution_code' };
  return checkAnswer(text, {
    ids: checks.ids,
    secrets: [checks.referenceCode, ...INSTRUCTION_FINGERPRINTS, ...AGENT_INSTRUCTION_FINGERPRINTS],
    maxCharacters: checks.maxCharacters,
    passages: checks.passages,
  });
}
