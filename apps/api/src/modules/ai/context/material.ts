import type { AiCourseContext, AiLessonContext } from '../../courses/index.js';
import type { AiLabBrief } from '../../practice/index.js';

/**
 * The material a conversation's subject brings to a question (Phase 7E), as plain text. It is
 * built on the server, at every question, from what the services that own each subject let the
 * person see — the browser sends ids only — and it goes to the model as context, never as
 * instructions (`assembleContext`). No retrieval: Phase 8 replaces the course and lesson parts
 * with the material its RAG index finds, under the same reach rules.
 */
export interface AiMaterial {
  text: string;
  /** What it was built from, kept with the answer (ADR-0028): `course:<id>`, `lab:<id>`, … */
  refs: string[];
}

/** The longest material a question carries, and the longest of its parts. */
export const MATERIAL_MAX_CHARACTERS = 8000;
const LESSON_TEXT_CHARACTERS = 6000;
const STATEMENT_CHARACTERS = 2500;
const CODE_CHARACTERS = 4000;

function clip(text: string, characters: number): string {
  return text.length <= characters ? text : `${text.slice(0, characters - 1).trimEnd()}…`;
}

/** A course: its outline, as the learner sees it. */
export function courseMaterial(course: AiCourseContext): AiMaterial {
  const lines = [`Course: ${course.title}`];
  if (course.description.trim()) lines.push(`About the course: ${course.description.trim()}`);
  if (course.modules.length > 0) {
    lines.push('Its modules and lessons:');
    course.modules.forEach((module, index) => {
      const lessons = module.lessons.length > 0 ? `: ${module.lessons.join('; ')}` : '';
      lines.push(`${index + 1}. ${module.title}${lessons}`);
    });
  }
  return {
    text: clip(lines.join('\n'), MATERIAL_MAX_CHARACTERS),
    refs: [`course:${course.courseId}`],
  };
}

/** A lesson: where it sits, and its own words. */
export function lessonMaterial(lesson: AiLessonContext): AiMaterial {
  const lines = [
    `Course: ${lesson.courseTitle}`,
    `Module: ${lesson.moduleTitle}`,
    `Lesson: ${lesson.title}${lesson.topic ? ` (topic: ${lesson.topic})` : ''}`,
  ];
  lines.push(
    lesson.text
      ? `The lesson's text:\n${clip(lesson.text, LESSON_TEXT_CHARACTERS)}`
      : `This ${lesson.type} lesson has no text to show.`,
  );
  return {
    text: clip(lines.join('\n'), MATERIAL_MAX_CHARACTERS),
    refs: [`course:${lesson.courseId}`, `lesson:${lesson.lessonId}`],
  };
}

/** A lab: its statement and visible examples, and the learner's own latest attempt. */
export function labMaterial(brief: AiLabBrief): AiMaterial {
  const lines = [
    `Lab: ${brief.title} (${brief.type})`,
    `Problem:\n${clip(brief.statement, STATEMENT_CHARACTERS)}`,
  ];
  if (brief.inputFormat.trim()) lines.push(`Input: ${brief.inputFormat.trim()}`);
  if (brief.outputFormat.trim()) lines.push(`Output: ${brief.outputFormat.trim()}`);
  if (brief.constraints.trim()) lines.push(`Constraints: ${brief.constraints.trim()}`);
  brief.examples.forEach((example, index) => {
    lines.push(
      `Example ${index + 1}, input:\n${example.input}\nExpected output:\n${example.expectedOutput}`,
    );
  });
  const latest = brief.latest;
  if (latest) {
    const failing = latest.visible
      .filter((testCase) => testCase.verdict !== 'passed')
      .map((testCase) => testCase.label);
    lines.push(
      [
        `The learner's latest attempt, in ${latest.language}: ${latest.verdict}, ${latest.passed} of ${latest.total} checks passed.`,
        failing.length > 0 ? `Visible examples it did not pass: ${failing.join('; ')}.` : '',
        `Their code:\n${clip(latest.code, CODE_CHARACTERS)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return {
    text: clip(lines.join('\n\n'), MATERIAL_MAX_CHARACTERS),
    refs: [`lab:${brief.questionId}`, ...(latest ? [`attempt:${latest.runId}`] : [])],
  };
}
