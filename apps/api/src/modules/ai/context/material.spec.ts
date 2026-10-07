import { describe, expect, it } from 'vitest';
import type { AiCourseContext, AiLessonContext } from '../../courses/index.js';
import type { AiLabBrief } from '../../practice/index.js';
import {
  MATERIAL_MAX_CHARACTERS,
  courseMaterial,
  labMaterial,
  lessonMaterial,
} from './material.js';

const course: AiCourseContext = {
  courseId: 'c1',
  title: 'Java Foundations',
  description: 'Objects, classes and collections.',
  modules: [
    { title: 'Basics', lessons: ['Variables', 'Loops'] },
    { title: 'Objects', lessons: [] },
  ],
};

const lesson: AiLessonContext = {
  lessonId: 'l1',
  courseId: 'c1',
  courseTitle: 'Java Foundations',
  moduleTitle: 'Basics',
  title: 'Loops',
  type: 'text',
  topic: 'for and while',
  text: 'A loop repeats a block while its condition holds.',
  labQuestionId: null,
};

const brief: AiLabBrief = {
  questionId: 'q1',
  title: 'Sum of two numbers',
  type: 'coding',
  statement: 'Read two integers and print their sum.',
  inputFormat: 'Two integers on one line.',
  outputFormat: 'One integer.',
  constraints: '',
  examples: [{ input: '1 2', expectedOutput: '3' }],
  failedAttempts: 1,
  latest: {
    runId: 'r1',
    language: 'python',
    code: 'print(int(input()) - 1)',
    verdict: 'wrong_answer',
    passed: 0,
    total: 2,
    visible: [{ label: 'Example 1', verdict: 'wrong_answer' }],
  },
  latestFailed: null,
};

describe('the material a subject brings to a question (Phase 7E)', () => {
  it('gives a course as its outline', () => {
    const material = courseMaterial(course);
    expect(material.text).toContain('Course: Java Foundations');
    expect(material.text).toContain('1. Basics: Variables; Loops');
    expect(material.text).toContain('2. Objects');
    expect(material.refs).toEqual(['course:c1']);
  });

  it('gives a lesson as where it sits and its own words', () => {
    const material = lessonMaterial(lesson);
    expect(material.text).toContain('Module: Basics');
    expect(material.text).toContain('Lesson: Loops (topic: for and while)');
    expect(material.text).toContain('A loop repeats a block');
    expect(material.refs).toEqual(['course:c1', 'lesson:l1']);
    expect(lessonMaterial({ ...lesson, type: 'video', text: '' }).text).toContain(
      'This video lesson has no text to show.',
    );
  });

  it('gives a lab as its statement, its visible examples and the learner’s own attempt', () => {
    const material = labMaterial(brief);
    expect(material.text).toContain('Lab: Sum of two numbers (coding)');
    expect(material.text).toContain('Example 1, input:\n1 2\nExpected output:\n3');
    expect(material.text).toContain('wrong_answer, 0 of 2 checks passed');
    expect(material.text).toContain('Visible examples it did not pass: Example 1.');
    expect(material.text).toContain('print(int(input()) - 1)');
    expect(material.refs).toEqual(['lab:q1', 'attempt:r1']);
    expect(labMaterial({ ...brief, latest: null }).refs).toEqual(['lab:q1']);
  });

  it('keeps every material within its bound', () => {
    const long = 'x'.repeat(20_000);
    expect(lessonMaterial({ ...lesson, text: long }).text.length).toBeLessThanOrEqual(
      MATERIAL_MAX_CHARACTERS,
    );
    expect(
      labMaterial({ ...brief, statement: long, latest: { ...brief.latest!, code: long } }).text
        .length,
    ).toBeLessThanOrEqual(MATERIAL_MAX_CHARACTERS);
    expect(
      courseMaterial({ ...course, modules: Array(500).fill({ title: long, lessons: [] }) }).text
        .length,
    ).toBeLessThanOrEqual(MATERIAL_MAX_CHARACTERS);
  });
});
