import { describe, expect, it } from 'vitest';
import { CACHE_MAX_QUESTION, normaliseQuestion } from './normalize.js';

const keyOf = (question: string) => normaliseQuestion(question).key;

describe('the answer cache’s question key (Phase 7D, ADR-0032)', () => {
  it('gives equivalent ways of asking one general question the same key', () => {
    const same = [
      'What is inheritance in Java?',
      'Explain inheritance in Java',
      'Java inheritance meaning',
      'what is inheritance in java',
      '  WHAT   IS  INHERITANCE IN JAVA ?? ',
      'Explain inheritance in Java.',
      'Tell me about inheritance in Java',
      'Can you explain inheritance in Java?',
      'What is the meaning of inheritance in Java?',
      'Define inheritance in Java programming',
      'Describe “inheritance” in Java',
    ];
    for (const question of same) expect(keyOf(question), question).toBe('java|inheritance');
  });

  it('folds the names a learner uses for one technology', () => {
    expect(keyOf('What is a closure in JS?')).toBe(keyOf('Explain closure in JavaScript'));
    expect(keyOf('Explain vectors in cpp')).toBe(keyOf('What are vectors in C++?'));
    expect(keyOf('Node.js event loop')).toBe(keyOf('Explain event loop in nodejs'));
  });

  it('keeps materially different questions apart', () => {
    const apart = [
      'What is inheritance in Java?',
      'What is inheritance in Python?',
      'What is polymorphism in Java?',
      'Why use inheritance in Java?',
      'How does inheritance work in Java?',
      'Is Java faster than Python?',
      'Is Python faster than Java?',
      'Convert string to int in Java',
      'Convert int to string in Java',
      'What is C?',
      'What is C++?',
      'What is C#?',
      'Difference between == and === in JavaScript',
      'Difference between = and == in JavaScript',
      'list in dict',
      'dict in list',
      'What is a class?',
      'What are classes?',
    ];
    const keys = apart.map(keyOf);
    expect(new Set(keys).size).toBe(apart.length);
    expect(keyOf('What is C++?')).toBe('|c++');
    expect(keyOf('Is Java faster than Python?')).toBe('|is java faster than python');
  });

  it('shares a question only when nothing in it speaks of the asker', () => {
    expect(normaliseQuestion('What is recursion?')).toEqual({
      key: '|recursion',
      shareable: true,
      reasons: [],
    });
    for (const question of [
      'Why does my loop never end?',
      'I get a NullPointerException in Java, why?',
      'Can we use goto in C?',
      'Is our project structure right?',
      'Why is me = 3 an error?',
    ]) {
      const result = normaliseQuestion(question);
      expect(result.key, question).not.toBeNull();
      expect(result.shareable, question).toBe(false);
      expect(result.reasons, question).toEqual(['first_person']);
    }
    // A framing that only asks to be told is not the asker speaking of themselves.
    expect(normaliseQuestion('Tell me about recursion').shareable).toBe(true);
  });

  it('never caches what may hold a person’s details, their code, or too much', () => {
    const refused: [string, string][] = [
      ['', 'empty'],
      ['x'.repeat(CACHE_MAX_QUESTION + 1), 'too_long'],
      ['What is this?\nint x = 1', 'several_lines'],
      ['Why does int x = 1; fail?', 'code'],
      ['for (i = 0; i < n; i++) { }', 'code'],
      ['```java\nclass A {}\n```', 'several_lines'],
      ['Mail me at learner@example.com about streams', 'email_address'],
      ['My roll number is 2026001234, what is a stream?', 'long_number'],
      ['Call +91 98765 43210 about sorting', 'long_number'],
      ['Explain https://example.com/lesson', 'link'],
    ];
    for (const [question, reason] of refused) {
      expect(normaliseQuestion(question), question).toEqual({
        key: null,
        shareable: false,
        reasons: [reason],
      });
    }
    // Ordinary small numbers are not a person's.
    expect(normaliseQuestion('Why is 0.1 + 0.2 not 0.3 in Python?').key).not.toBeNull();
  });

  it('is deterministic', () => {
    const question = 'What is the difference between a list and a tuple in Python?';
    expect(normaliseQuestion(question)).toEqual(normaliseQuestion(question));
    expect(keyOf(question)).toBe('python|difference between list and tuple');
  });
});
