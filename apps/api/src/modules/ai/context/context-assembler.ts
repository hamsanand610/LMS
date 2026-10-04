import type { AiPurpose } from '@lms/shared';
import type { AiChatMessage } from '../providers/ai-provider.js';
import { materialNote, summaryNote, systemPrompt } from '../policy/prompts.js';
import type { AiMaterial } from './material.js';

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
 * The request for an answer, in this order: the surface's instructions; the material the
 * conversation's subject brings — a course's outline, a lesson's words, a lab's statement with the
 * learner's own attempt (Phase 7E) — built on the server by the services that decide reach; the
 * conversation's notes on its older turns, when it has some (Phase 7D); the recent conversation;
 * the new question — nothing else (Phases 7C–7E; ADR-0031). Nothing is read here: there is no path
 * to a hidden case, a solution, another person's data or the system. The material, the notes and
 * whatever the learner wrote stay in learner-side messages, as data, never in the instructions.
 * The recent messages stay authoritative; the notes only cover what has left them.
 */
export function assembleContext(
  purpose: AiPurpose,
  history: readonly ContextTurn[],
  question: string,
  summary: ContextSummary | null = null,
  material: AiMaterial | null = null,
): AssembledContext {
  const notes = summary?.text.trim() ? summary : null;
  const brought = material?.text.trim() ? material : null;
  const window: ContextTurn[] = [];
  let characters = question.length + (notes?.text.length ?? 0) + (brought?.text.length ?? 0);
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
      ...(brought ? [{ role: 'user' as const, content: materialNote(brought.text) }] : []),
      ...(notes ? [{ role: 'user' as const, content: summaryNote(notes.text) }] : []),
      ...window.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: question },
    ],
    refs: [
      ...(brought ? brought.refs : []),
      ...(notes ? [`summary:${notes.through.toISOString()}`] : []),
      ...window.map((turn) => turn.id),
    ],
  };
}
