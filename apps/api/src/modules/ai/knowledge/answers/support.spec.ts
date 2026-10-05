import { describe, expect, it } from 'vitest';
import { SUPPORT_MIN_WORD_SHARE, supportOf } from './support.js';

const ATTENDANCE =
  'SI Academy learners must attend at least 75 percent of the sessions of a course to sit its final exam. Absences with a medical certificate are not counted against attendance.';
const CERTIFICATE =
  'A course certificate is issued once every graded assignment is passed and the final exam score reaches 60 percent. Certificates are downloaded from the learner dashboard.';
const LIBRARY = 'Library books may be borrowed for three weeks at a time.';
const REFUNDS = 'Refund requests are reviewed by the accounts team within ten working days.';

/**
 * The synthetic evaluation of the support check (Phase 8F): sentences whose truth is known, each
 * with the passages it cites. The check's verdict on each is recorded as measured — what it catches
 * and what it cannot, so the documented limits stay true.
 */
const CASES: {
  kind: string;
  sentence: string;
  cites: string[];
  truth: 'supported' | 'unsupported';
  verdict: 'supported' | 'unsupported';
}[] = [
  {
    kind: 'correct citation, the passage’s words',
    sentence:
      'SI Academy learners must attend at least 75 percent of the sessions of a course to sit its final exam [S1].',
    cites: [ATTENDANCE],
    truth: 'supported',
    verdict: 'supported',
  },
  {
    kind: 'correct citation, paraphrased with its key words',
    sentence:
      'Learners need to attend at least 75 percent of a course’s sessions before they can sit the final exam [S1].',
    cites: [ATTENDANCE],
    truth: 'supported',
    verdict: 'supported',
  },
  {
    kind: 'correct citation, a number the passage writes in words',
    sentence: 'The accounts team reviews refund requests within 10 working days [S1].',
    cites: [REFUNDS],
    truth: 'supported',
    verdict: 'supported',
  },
  {
    kind: 'multi-source claim citing both passages',
    sentence:
      'A certificate needs every graded assignment passed and an exam score of 60 percent, and books may be borrowed for three weeks [S1][S2].',
    cites: [CERTIFICATE, LIBRARY],
    truth: 'supported',
    verdict: 'supported',
  },
  {
    kind: 'correct citation, paraphrased in other words (a limit: refused)',
    sentence:
      'Pupils have to be present for three quarters of the classes to take the last test [S1].',
    cites: [ATTENDANCE],
    truth: 'supported',
    verdict: 'unsupported',
  },
  {
    kind: 'irrelevant citation',
    sentence: 'Late fees are waived on Fridays [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'unsupported',
  },
  {
    kind: 'citation to the wrong passage, another topic',
    sentence: 'Library books may be borrowed for three weeks at a time [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'unsupported',
  },
  {
    kind: 'citation to the wrong passage, a related topic (a limit: accepted)',
    sentence: 'Certificates are downloaded from the learner dashboard [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'supported',
  },
  {
    kind: 'a figure the passage does not give',
    sentence:
      'Learners must attend at least 60 percent of the sessions to sit the final exam [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'unsupported',
  },
  {
    kind: 'partially supporting citation, no number (a limit: accepted)',
    sentence:
      'Learners must attend the sessions to sit the final exam, and they must also pass an oral viva [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'supported',
  },
  {
    kind: 'partially supporting citation, with a number',
    sentence: 'Learners must attend 75 percent of sessions and complete 20 practice labs [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'unsupported',
  },
  {
    kind: 'unsupported claim on the passage’s topic',
    sentence: 'Attendance is recorded by fingerprint scanners at every session [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'unsupported',
  },
  {
    kind: 'unsupported claim in the passage’s own words, negated (a limit: accepted)',
    sentence: 'Absences with a medical certificate are counted against attendance [S1].',
    cites: [ATTENDANCE],
    truth: 'unsupported',
    verdict: 'supported',
  },
  {
    kind: 'multi-source claim citing one of its passages',
    sentence:
      'A certificate needs every graded assignment passed, and library books may be borrowed for three weeks [S1].',
    cites: [CERTIFICATE],
    truth: 'unsupported',
    verdict: 'unsupported',
  },
];

describe('supportOf', () => {
  it('holds every number the sentence states to its cited passages — digits, separators, words', () => {
    expect(supportOf('It costs 1,200 rupees [S1].', ['The fee is 1200 rupees.'])).toMatchObject({
      supported: true,
      missingNumbers: [],
    });
    expect(supportOf('Deadlines are at 17:00 [S1].', ['Deadlines fall at 17:00.'])).toMatchObject({
      supported: true,
    });
    expect(supportOf('Reviews take 10 days [S1].', ['Reviews take ten days.'])).toMatchObject({
      supported: true,
    });
    expect(supportOf('Reviews take 12 days [S1].', ['Reviews take ten days.'])).toMatchObject({
      supported: false,
      missingNumbers: ['12'],
    });
    // A citation's own digits are not a figure of the claim.
    expect(supportOf('Reviews take days [S1][S2].', ['Reviews take days.'])).toMatchObject({
      supported: true,
      missingNumbers: [],
    });
  });

  it('needs half of the sentence’s content words in its passages, their forms taken as one', () => {
    expect(
      supportOf('The host approved the visit [S1].', ['The host approves visits.']).wordShare,
    ).toBe(1);
    const half = supportOf('Learners borrow books daily [S1].', ['Learners may borrow books.']);
    expect(half.wordShare).toBeCloseTo(0.75);
    expect(SUPPORT_MIN_WORD_SHARE).toBe(0.5);
    expect(supportOf('It is so [S1].', ['Anything.'])).toMatchObject({
      supported: true,
      wordShare: 1,
    });
  });

  it('is measured against a synthetic evaluation of known truth — and its limits are recorded', () => {
    const measured = CASES.map((c) => ({
      kind: c.kind,
      verdict: supportOf(c.sentence, c.cites).supported ? 'supported' : 'unsupported',
    }));
    expect(measured).toEqual(CASES.map(({ kind, verdict }) => ({ kind, verdict })));

    const unsupported = CASES.filter((c) => c.truth === 'unsupported');
    const supported = CASES.filter((c) => c.truth === 'supported');
    expect({
      unsupportedCaught: unsupported.filter((c) => c.verdict === 'unsupported').length,
      unsupported: unsupported.length,
      supportedAccepted: supported.filter((c) => c.verdict === 'supported').length,
      supported: supported.length,
    }).toEqual({ unsupportedCaught: 6, unsupported: 9, supportedAccepted: 4, supported: 5 });
  });
});
