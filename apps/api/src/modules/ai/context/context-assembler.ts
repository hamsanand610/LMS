import type { AiPurpose } from '@lms/shared';
import type { AiChatMessage } from '../providers/ai-provider.js';
import { summaryNote, systemPrompt } from '../policy/prompts.js';

/**
 * How much of a conversation goes with a question (Phase 7C): the most recent completed messages,
 * at most this many and this long together. Never the whole history, and no memory beyond it.
 */
export const CONTEXT_MAX_MESSAGES = 10;
export const CONTEXT_MAX_CHARACTERS = 16_000;

/**
 * When a conversation's notes are brought up to date (Phase 7D): once at least this many completed
 * messages have left the window and are not in the notes yet — every few turns, never every message.
 */
export const SUMMARY_BATCH_MESSAGES = 6;

/** A completed message of the conversation, oldest first. */
export interface ContextTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** A conversation's notes on its older turns (Phase 7D), and the time of the last one they cover. */
export interface ContextSummary {
  text: string;
  through: Date;
}

export interface AssembledContext {
  messages: AiChatMessage[];
  /**
   * What the answer was built from, kept with it (ADR-0028): the messages, by id, and the notes,
   * as `summary:<the time they cover to>`. Empty: the question was asked on its own.
   */
  refs: string[];
}

/**
 * The request for an answer, in this order: the surface's instructions; the conversation's notes
 * on its older turns, when it has some (Phase 7D); the recent conversation; the new question —
 * nothing else (Phases 7C–7D; ADR-0031). No course content, other person's data, test, solution or
 * system data is read here: there is no path to them. Whatever the learner wrote stays in
 * learner-side messages, as data, never in the instructions — the notes too, as they were written
 * from it. The recent messages stay authoritative; the notes only cover what has left them.
 */
export function assembleContext(
  purpose: AiPurpose,
  history: readonly ContextTurn[],
  question: string,
  summary: ContextSummary | null = null,
): AssembledContext {
  const notes = summary?.text.trim() ? summary : null;
  const window: ContextTurn[] = [];
  let characters = question.length + (notes?.text.length ?? 0);
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
      ...(notes ? [{ role: 'user' as const, content: summaryNote(notes.text) }] : []),
      ...window.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: question },
    ],
    refs: [
      ...(notes ? [`summary:${notes.through.toISOString()}`] : []),
      ...window.map((turn) => turn.id),
    ],
  };
}
