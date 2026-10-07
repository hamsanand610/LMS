import { describe, expect, it } from 'vitest';
import { RunEvidence, partsOf } from './run-evidence.js';
import type { KnowledgePassage } from './tools/knowledge-search.tool.js';
import type { LabAttemptOutput } from './tools/lab-attempt.tool.js';
import type { LearningStateOutput } from './tools/learning-state.tool.js';
import type { LessonContent } from './tools/lesson-content.tool.js';

const uuid = (n: number) => `0190a0e4-7c1d-7b9e-8f00-${String(n).padStart(12, '0')}`;

const lesson = (text: string, extra: Partial<LessonContent> = {}): LessonContent => ({
  lessonId: uuid(1),
  courseId: uuid(2),
  title: 'Loops',
  courseTitle: 'Java',
  moduleTitle: 'Basics',
  topic: '',
  text,
  truncated: false,
  withheld: false,
  ...extra,
});

const passage = (n: number, content: string, dataClass: 'public' | 'course' = 'public') =>
  ({
    chunkId: uuid(100 + n),
    sourceId: uuid(200),
    sourceName: 'Handbook',
    documentId: uuid(300 + n),
    versionId: uuid(400 + n),
    title: `Doc ${n}`,
    heading: 'Section',
    position: n,
    courseId: null,
    lessonId: null,
    similarity: 0.8,
    dataClass,
    content,
  }) satisfies KnowledgePassage;

describe('a learning agent run’s evidence (Phase 9B; ADR-0039)', () => {
  it('numbers every passage in the run once, whichever tool found it', () => {
    const evidence = new RunEvidence(12_000, 12);
    expect(evidence.addKnowledge([passage(1, 'First.'), passage(2, 'Second.')])).toBe(2);
    expect(evidence.addLesson(lesson('The lesson text.'))).toBe(1);
    expect(evidence.addKnowledge([passage(2, 'Second.'), passage(3, 'Third.')])).toBe(1);
    expect(evidence.passages.map((p) => [p.id, p.content])).toEqual([
      ['S1', 'First.'],
      ['S2', 'Second.'],
      ['S3', 'The lesson text.'],
      ['S4', 'Third.'],
    ]);
  });

  it('cites from the tool’s provenance: the lesson’s part, or the knowledge passage', () => {
    const evidence = new RunEvidence(12_000, 12);
    evidence.addLesson(lesson('Loops repeat.'));
    evidence.addKnowledge([passage(1, 'A loop.')]);
    expect(evidence.citation('S1')).toEqual({
      kind: 'lesson',
      id: 'S1',
      lessonId: uuid(1),
      courseId: uuid(2),
      title: 'Loops',
      heading: 'Basics',
      position: 0,
    });
    expect(evidence.citation('S2')).toMatchObject({
      kind: 'knowledge',
      id: 'S2',
      chunkId: uuid(101),
      documentId: uuid(301),
      versionId: uuid(401),
    });
    expect(evidence.citation('S3')).toBeNull();
  });

  it('keeps within its characters and passages, and takes the lesson once', () => {
    const evidence = new RunEvidence(100, 3);
    expect(evidence.addKnowledge([passage(1, 'x'.repeat(60)), passage(2, 'y'.repeat(60))])).toBe(1);
    expect(evidence.addKnowledge([passage(3, 'z'.repeat(40))])).toBe(1);
    expect(evidence.characters).toBe(100);
    const few = new RunEvidence(12_000, 2);
    few.addKnowledge([passage(1, 'a'), passage(2, 'b'), passage(3, 'c')]);
    expect(few.passages).toHaveLength(2);
    const once = new RunEvidence(12_000, 12);
    expect(once.addLesson(lesson('Text.'))).toBe(1);
    expect(once.addLesson(lesson('Text.'))).toBe(0);
  });

  it('takes nothing of a withheld or empty lesson', () => {
    const evidence = new RunEvidence(12_000, 12);
    expect(evidence.addLesson(lesson('', { withheld: true }))).toBe(0);
    expect(evidence.addLesson(lesson('   '))).toBe(0);
    expect(evidence.passages).toHaveLength(0);
  });

  it('is course data once any passage is', () => {
    const evidence = new RunEvidence(12_000, 12);
    evidence.addKnowledge([passage(1, 'Public.')]);
    expect(evidence.dataClass()).toBe('public');
    evidence.addKnowledge([passage(2, 'Course.', 'course')]);
    expect(evidence.dataClass()).toBe('course');
  });

  it('cuts a lesson into parts at paragraph ends, then sentences', () => {
    expect(partsOf('One.\n\nTwo.\nThree.', 100)).toEqual(['One.\nTwo.\nThree.']);
    expect(partsOf('aaaa\nbbbb\ncccc', 9)).toEqual(['aaaa\nbbbb', 'cccc']);
    const long = `${'First sentence here. '.repeat(10)}`.trim();
    for (const part of partsOf(long, 50)) expect(part.length).toBeLessThanOrEqual(50);
    expect(partsOf('x'.repeat(25), 10)).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  });

  it('holds the learner’s own state and lab attempt as personal passages, cited by their kind (Phase 9C)', () => {
    const evidence = new RunEvidence(12_000, 12);
    evidence.addKnowledge([passage(1, 'Course material.', 'course')]);
    expect(evidence.dataClass()).toBe('course');
    const state: LearningStateOutput = {
      passages: [
        {
          part: 'progress',
          title: 'Your progress: Core Java',
          courseId: uuid(2),
          sections: [],
          text: 'Your progress in the course Core Java: 33% complete.',
        },
        {
          part: 'due',
          title: 'What is due',
          courseId: null,
          sections: ['assignments', 'tests'],
          text: 'Today is 7 October 2026.',
        },
      ],
    };
    expect(evidence.addState(state)).toBe(2);
    expect(evidence.addState(state)).toBe(0);
    expect(evidence.dataClass()).toBe('personal');
    expect(evidence.passages.map((p) => [p.id, p.dataClass])).toEqual([
      ['S1', 'course'],
      ['S2', 'personal'],
      ['S3', 'personal'],
    ]);
    expect(evidence.citation('S2')).toEqual({
      kind: 'learning_state',
      id: 'S2',
      part: 'progress',
      courseId: uuid(2),
      title: 'Your progress: Core Java',
    });
    expect(evidence.hasLabAttempt()).toBe(false);
    // What is due was read from the assignments and the tests: asked again only when it is cited.
    expect([...evidence.dueSections(['S2'])]).toEqual([]);
    expect([...evidence.dueSections(['S2', 'S3'])].sort()).toEqual(['assignments', 'tests']);

    const lab: LabAttemptOutput = {
      questionId: uuid(9),
      title: 'Sum two numbers',
      failedAttempts: 1,
      problem: 'Lab: Sum two numbers (coding).',
      attempt: 'Your latest attempt at Sum two numbers (python) failed: wrong answer.',
    };
    expect(evidence.addLab(lab)).toBe(2);
    expect(evidence.addLab(lab)).toBe(0);
    expect(evidence.passages.slice(3).map((p) => [p.document, p.dataClass])).toEqual([
      ['Lab: Sum two numbers', 'course'],
      ['Your latest failed attempt: Sum two numbers', 'personal'],
    ]);
    expect(evidence.citation('S5')).toEqual({
      kind: 'lab_attempt',
      id: 'S5',
      part: 'attempt',
      questionId: uuid(9),
      title: 'Sum two numbers',
    });
    expect(evidence.hasLabAttempt()).toBe(true);
  });

  it('leaves out a withheld lab problem, and what goes past the evidence’s bound (Phase 9C)', () => {
    const small = new RunEvidence(60, 12);
    small.addLab({
      questionId: uuid(9),
      title: 'Sum',
      failedAttempts: 1,
      problem: '',
      attempt: 'Your latest attempt at Sum (python) failed: wrong answer.',
    });
    expect(small.passages.map((p) => p.heading)).toEqual(['Your attempt']);
    expect(
      small.addState({
        passages: [
          {
            part: 'progress',
            title: 'Your progress',
            courseId: null,
            sections: [],
            text: 'x'.repeat(61),
          },
        ],
      }),
    ).toBe(0);
  });
});
