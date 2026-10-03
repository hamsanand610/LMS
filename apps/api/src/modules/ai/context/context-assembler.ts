import type { AiPurpose } from '@lms/shared';
import type { AiChatMessage } from '../providers/ai-provider.js';
import { systemPrompt } from '../policy/prompts.js';

/**
 * How much of a conversation goes with a question (Phase 7C): the most recent completed messages,
 * at most this many and this long together. Never the whole history, and no memory beyond it.
 */
export const CONTEXT_MAX_MESSAGES = 10;
export const CONTEXT_MAX_CHARACTERS = 16_000;

/** A completed message of the conversation, oldest first. */
export interface ContextTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AssembledContext {
  messages: AiChatMessage[];
  /** The ids of the messages used, kept with the answer (ADR-0028: what it was built from). */
  refs: string[];
}

/**
 * The request for an answer: the surface's instructions, the recent conversation and the new
 * question — nothing else (Phase 7C; ADR-0031). No course content, other person's data, test,
 * solution or system data is read here: there is no path to them. Whatever the learner wrote stays
 * in user messages, as data, never in the instructions.
 */
export function assembleContext(
  purpose: AiPurpose,
  history: readonly ContextTurn[],
  question: string,
): AssembledContext {
  const window: ContextTurn[] = [];
  let characters = question.length;
  for (let i = history.length - 1; i >= 0 && window.length < CONTEXT_MAX_MESSAGES; i -= 1) {
    const turn = history[i]!;
    if (characters + turn.content.length > CONTEXT_MAX_CHARACTERS) break;
    characters += turn.content.length;
    window.unshift(turn);
  }
  // The window opens on a question, never on an answer whose question was left out.
  while (window[0]?.role === 'assistant') window.shift();
  return {
    messages: [
      { role: 'system', content: systemPrompt(purpose) },
      ...window.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: question },
    ],
    refs: window.map((turn) => turn.id),
  };
}
