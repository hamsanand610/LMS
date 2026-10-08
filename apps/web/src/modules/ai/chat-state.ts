import type { AiAgentCitation, AiAnswerEnding, AiMessageStatus, AiMessageView } from '@lms/shared';

let turnSequence = 0;

/**
 * A local key for a question being asked: unique even for two questions in the same millisecond,
 * which a withdrawn question relies on (it removes only its own turns).
 */
export function nextTurnKey(): string {
  turnSequence += 1;
  return `t${Date.now()}-${turnSequence}`;
}

/** A message as the thread shows it: kept ones by id, the one being written by a local key. */
export interface ChatTurn {
  key: string;
  role: 'user' | 'assistant';
  text: string;
  status: AiMessageStatus;
  /** What the learning agent is doing now, in the platform's safe words (Phase 9D). */
  step?: string | null;
  /** The sources a verified agent answer cites (Phase 9D). */
  sources?: AiAgentCitation[];
  /** The text is the platform's own words, not an answer: shown as a note (Phase 9D). */
  notice?: boolean;
}

export interface ChatState {
  turns: ChatTurn[];
  /** The answer being written now, if any. */
  pending: string | null;
}

export const EMPTY_CHAT: ChatState = { turns: [], pending: null };

export type ChatAction =
  | { type: 'load'; messages: readonly AiMessageView[] }
  | { type: 'ask'; key: string; question: string }
  | { type: 'append'; text: string }
  | { type: 'end'; status: AiAnswerEnding }
  /** Refused before anything was kept: the question and its placeholder go. */
  | { type: 'withdraw' }
  | { type: 'reset' }
  /** The learning agent's run moved on to a step (Phase 9D): its safe label only. */
  | { type: 'step'; step: string | null }
  /** The verified answer's sources (Phase 9D). */
  | { type: 'sources'; citations: AiAgentCitation[] }
  /** The run gave the platform's own words instead of an answer (Phase 9D). */
  | { type: 'notice'; text: string };

/**
 * The thread's state (Phase 7E), kept apart from React so every way an answer can go is easy to
 * test. A question and its answer's placeholder go in together; text is added to the answer being
 * written; the stream's `done` closes it; a refusal before anything was kept takes both out.
 */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'load':
      return {
        pending: null,
        turns: action.messages.map((message) => ({
          key: message.id,
          role: message.role,
          text: message.content,
          status: message.status,
        })),
      };
    case 'ask': {
      const answer = `${action.key}:answer`;
      return {
        pending: answer,
        turns: [
          ...state.turns,
          {
            key: `${action.key}:question`,
            role: 'user',
            text: action.question,
            status: 'complete',
          },
          { key: answer, role: 'assistant', text: '', status: 'streaming' },
        ],
      };
    }
    case 'append':
      if (!state.pending || !action.text) return state;
      return {
        ...state,
        turns: state.turns.map((turn) =>
          turn.key === state.pending ? { ...turn, text: turn.text + action.text } : turn,
        ),
      };
    case 'end':
      if (!state.pending) return state;
      return {
        pending: null,
        turns: state.turns.map((turn) =>
          turn.key === state.pending
            ? {
                ...turn,
                step: null,
                status: action.status,
                // A stopped answer stays in view as far as it got (the server keeps none of it); a
                // failed or withheld one is not shown as if it were an answer.
                text:
                  action.status === 'complete' || action.status === 'cancelled' ? turn.text : '',
              }
            : turn,
        ),
      };
    case 'withdraw': {
      if (!state.pending) return state;
      const question = state.pending.replace(/:answer$/, ':question');
      return {
        pending: null,
        turns: state.turns.filter((turn) => turn.key !== state.pending && turn.key !== question),
      };
    }
    case 'reset':
      return EMPTY_CHAT;
    case 'step':
      if (!state.pending) return state;
      return {
        ...state,
        turns: state.turns.map((turn) =>
          turn.key === state.pending ? { ...turn, step: action.step } : turn,
        ),
      };
    case 'sources':
      if (!state.pending) return state;
      return {
        ...state,
        turns: state.turns.map((turn) =>
          turn.key === state.pending ? { ...turn, sources: action.citations } : turn,
        ),
      };
    case 'notice':
      if (!state.pending || !action.text) return state;
      return {
        ...state,
        turns: state.turns.map((turn) =>
          turn.key === state.pending ? { ...turn, text: action.text, notice: true } : turn,
        ),
      };
  }
}

/** What each ending says under the answer; a complete one says nothing. */
export const ENDING_NOTE: Partial<Record<AiMessageStatus, string>> = {
  cancelled: 'Stopped. What was written so far is not kept.',
  failed: 'No answer this time.',
  blocked: 'SI Academy AI could not answer this.',
};

/**
 * Text arriving token by token is added to the screen once per frame, not once per token, so a
 * long answer does not re-render the thread hundreds of times (Phase 7E).
 */
export function createDeltaBuffer(
  flush: (text: string) => void,
  schedule: (run: () => void) => unknown = defaultSchedule,
) {
  let buffered = '';
  let scheduled = false;
  const drain = () => {
    scheduled = false;
    if (!buffered) return;
    const text = buffered;
    buffered = '';
    flush(text);
  };
  return {
    push(text: string) {
      if (!text) return;
      buffered += text;
      if (!scheduled) {
        scheduled = true;
        schedule(drain);
      }
    },
    /** Hands over whatever is waiting now: before the answer is closed. */
    drain,
  };
}

function defaultSchedule(run: () => void): unknown {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => run())
    : setTimeout(run, 16);
}
