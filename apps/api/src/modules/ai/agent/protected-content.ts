import { credentialsIn } from '../policy/data-class.js';

/**
 * Credentials the learning agent also keeps out (Roadmap Phase 9B; ADR-0039), besides the
 * platform's own patterns (`credentialsIn`): a Groq key, now that Groq stands in (ADR-0038), and a
 * signed token. Applied to the learner's message, to everything a tool returns and to every draft.
 */
const AGENT_CREDENTIALS: readonly { code: string; pattern: RegExp }[] = [
  { code: 'groq_key', pattern: /\bgsk_[A-Za-z0-9]{20,}/ },
  {
    code: 'signed_token',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  },
];

/** The credentials a text holds, as codes: the platform's patterns and the agent's. */
export function agentCredentialsIn(text: string): string[] {
  return [
    ...credentialsIn(text),
    ...AGENT_CREDENTIALS.filter(({ pattern }) => pattern.test(text)).map(
      ({ code }) => `credential:${code}`,
    ),
  ];
}

/** A text cut to at most `max` characters, at the last space before the cut when there is one. */
export function boundText(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max);
  const space = cut.search(/\s\S*$/);
  return { text: (space > max / 2 ? cut.slice(0, space) : cut).trimEnd(), truncated: true };
}
