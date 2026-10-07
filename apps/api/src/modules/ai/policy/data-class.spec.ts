import { describe, expect, it } from 'vitest';
import { classifyAiRequest } from './data-class.js';

const none = { courseId: null, lessonId: null, questionId: null };
const id = '0190a0e4-7c1d-7b9e-8f00-000000000001';

describe('the data class of an AI request (ADR-0024, Phase 7C)', () => {
  it('treats a general learning question as public', () => {
    expect(
      classifyAiRequest({ purpose: 'workspace', subject: none, message: 'What is a class?' }),
    ).toEqual({ dataClass: 'public', reasons: ['general_question'] });
  });

  it('treats a lab hint as the learner’s own work: personal', () => {
    expect(
      classifyAiRequest({
        purpose: 'lab_hint',
        subject: { ...none, questionId: id },
        message: 'Why does my loop never end?',
      }),
    ).toEqual({ dataClass: 'personal', reasons: ['own_work'] });
  });

  it('treats a conversation about a course or lesson as course material', () => {
    for (const subject of [
      { ...none, courseId: id },
      { ...none, lessonId: id },
    ]) {
      expect(
        classifyAiRequest({ purpose: 'assistant', subject, message: 'Explain' }).dataClass,
      ).toBe('course');
    }
  });

  it('marks a message holding a credential restricted, whatever else it is', () => {
    // Made-up values, assembled at run time so the source holds nothing a secret scanner flags.
    const pem = (kind: string) => `-----BEGIN ${kind}PRIVATE KEY-----`;
    const credentials: [string, string][] = [
      ['private_key', `${pem('RSA ')}\nMIIEow...`],
      ['private_key', pem('')],
      ['aws_access_key', `my key is ${'AKIA'}${'QWERTYUIOPASDFGH'} ok`],
      ['google_api_key', `key=AIza${'S'.repeat(35)}`],
      ['github_token', `ghp_${'a1'.repeat(18)}`],
      ['github_token', `github_pat_${'A_'.repeat(30)}`],
      ['slack_token', `${'xox'}b-1234567890-abcdefghij`],
      ['stripe_live_key', `sk_live_${'x'.repeat(24)}`],
      ['openai_key', `sk-proj-${'q'.repeat(40)}`],
    ];
    for (const [code, message] of credentials) {
      const result = classifyAiRequest({ purpose: 'lab_hint', subject: none, message });
      expect(result.dataClass, code).toBe('restricted');
      expect(result.reasons, code).toContain(`credential:${code}`);
    }
  });

  it('does not refuse what learners ordinarily write', () => {
    for (const message of [
      'String password = "admin123"; // why does login fail?',
      'const apiKey = process.env.API_KEY;',
      'My email is learner@example.com and my roll number is 12345678901',
      'What does Bearer eyJhbGciOiJIUzI1NiJ9 mean in a header?',
      'AIza is how Google keys start, right?',
    ]) {
      expect(
        classifyAiRequest({ purpose: 'workspace', subject: none, message }).dataClass,
        message,
      ).toBe('public');
    }
  });

  it('treats the learning agent’s lab as course material: the run raises it when it reads the attempt (Phase 9C)', () => {
    expect(
      classifyAiRequest({
        purpose: 'agent',
        subject: { ...none, questionId: id },
        message: 'Explain my failed attempt',
      }),
    ).toEqual({ dataClass: 'course', reasons: ['lab_subject'] });
    // A credential is restricted whatever the subject.
    expect(
      classifyAiRequest({
        purpose: 'agent',
        subject: { ...none, questionId: id },
        message: `My token is ghp_${'A'.repeat(36)}`,
      }).dataClass,
    ).toBe('restricted');
  });
});
