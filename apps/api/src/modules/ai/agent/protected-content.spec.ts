import { describe, expect, it } from 'vitest';
import { agentCredentialsIn, boundText } from './protected-content.js';

describe('what the learning agent keeps out (Phase 9B)', () => {
  it('finds the platform’s credentials, a Groq key and a signed token', () => {
    expect(agentCredentialsIn(`use ghp_${'A'.repeat(36)} here`)).toEqual([
      'credential:github_token',
    ]);
    expect(agentCredentialsIn(`key gsk_${'b'.repeat(40)}`)).toEqual(['credential:groq_key']);
    expect(
      agentCredentialsIn('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijkl'),
    ).toEqual(['credential:signed_token']);
    // A beginner's practice code is not a credential.
    expect(agentCredentialsIn('password = "admin123"; token = 3')).toEqual([]);
  });

  it('cuts a text at a space within its bound', () => {
    expect(boundText('short', 10)).toEqual({ text: 'short', truncated: false });
    const cut = boundText('one two three four five', 12);
    expect(cut).toEqual({ text: 'one two', truncated: true });
    expect(cut.text.length).toBeLessThanOrEqual(12);
    expect(boundText('x'.repeat(30), 10)).toEqual({ text: 'x'.repeat(10), truncated: true });
  });
});
