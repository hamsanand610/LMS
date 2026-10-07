import type { AiAgentCitation, AiAgentStatePart } from '@lms/shared';
import { mostSensitive } from '../jobs/background-calls.js';
import type { EvidencePassage } from '../knowledge/answers/grounded-prompt.js';
import type { KnowledgePassage } from './tools/knowledge-search.tool.js';
import type { LabAttemptOutput } from './tools/lab-attempt.tool.js';
import type { DueSection, LearningStateOutput } from './tools/learning-state.tool.js';
import type { LessonContent } from './tools/lesson-content.tool.js';

/** Characters of the lesson's text in one passage: a lesson is cited part by part. */
const LESSON_PART_CHARACTERS = 1_500;

/** Where a passage of the run's evidence came from: a part of the lesson, or the knowledge base. */
type Origin =
  | {
      kind: 'lesson';
      lessonId: string;
      courseId: string;
      title: string;
      module: string;
      position: number;
    }
  | { kind: 'knowledge'; passage: KnowledgePassage }
  | {
      kind: 'state';
      part: AiAgentStatePart;
      courseId: string | null;
      title: string;
      sections: readonly DueSection[];
    }
  | { kind: 'lab'; part: 'problem' | 'attempt'; questionId: string; title: string };

/** A passage's data class: the learner's own records are `personal` (Phase 9C; ADR-0040). */
export type PassageDataClass = 'public' | 'course' | 'personal';

/** A passage of the run's evidence: as the model is given it, with its id, class and provenance. */
export interface RunPassage extends EvidencePassage {
  dataClass: PassageDataClass;
  origin: Origin;
}

/**
 * A run's evidence (Roadmap Phase 9B; ADR-0039, ADR-0040): everything the tools found that the draft
 * may draw on, in the order found, each passage with a citation id unique in the run (`S1`, `S2`,
 * …, whichever tool found it) and its data class — the learner's own state and attempt `personal`.
 * Bounded: at most `maxPassages`, and `maxCharacters` of text in all — a passage that would go past
 * either is left out, and a chunk already held is not taken twice. The provenance of a citation is
 * always the tool's, never the model's.
 */
export class RunEvidence {
  private readonly items: RunPassage[] = [];
  private readonly chunks = new Set<string>();
  private lessonTaken = false;
  private stateTaken = false;
  private labTaken = false;
  private total = 0;

  constructor(
    private readonly maxCharacters: number,
    private readonly maxPassages: number,
  ) {}

  get passages(): readonly RunPassage[] {
    return this.items;
  }

  /** Characters of evidence held. */
  get characters(): number {
    return this.total;
  }

  /** The lesson's text, part by part, once; returns how many parts were kept. */
  addLesson(lesson: LessonContent): number {
    if (this.lessonTaken || lesson.withheld || lesson.text.trim() === '') return 0;
    this.lessonTaken = true;
    let kept = 0;
    for (const [position, part] of partsOf(lesson.text, LESSON_PART_CHARACTERS).entries()) {
      if (!this.fits(part.length)) break;
      this.push({
        source: 'SI Academy course',
        document: `${lesson.courseTitle}: ${lesson.title}`,
        heading: lesson.moduleTitle,
        content: part,
        dataClass: 'course',
        origin: {
          kind: 'lesson',
          lessonId: lesson.lessonId,
          courseId: lesson.courseId,
          title: lesson.title,
          module: lesson.moduleTitle,
          position,
        },
      });
      kept += 1;
    }
    return kept;
  }

  /** Knowledge passages, best first, each chunk once; returns how many were kept. */
  addKnowledge(passages: readonly KnowledgePassage[]): number {
    let kept = 0;
    for (const passage of passages) {
      if (this.chunks.has(passage.chunkId) || !this.fits(passage.content.length)) continue;
      this.chunks.add(passage.chunkId);
      this.push({
        source: passage.sourceName,
        document: passage.title,
        heading: passage.heading,
        content: passage.content,
        dataClass: passage.dataClass,
        origin: { kind: 'knowledge', passage },
      });
      kept += 1;
    }
    return kept;
  }

  /**
   * The learner's own learning state (Phase 9C), once: each of its parts a passage, `personal`;
   * returns how many were kept.
   */
  addState(state: LearningStateOutput): number {
    if (this.stateTaken) return 0;
    this.stateTaken = true;
    let kept = 0;
    for (const passage of state.passages) {
      if (!this.fits(passage.text.length)) continue;
      this.push({
        source: 'SI Academy learning records',
        document: passage.title,
        heading: STATE_HEADING[passage.part],
        content: passage.text,
        dataClass: 'personal',
        origin: {
          kind: 'state',
          part: passage.part,
          courseId: passage.courseId,
          title: passage.title,
          sections: passage.sections,
        },
      });
      kept += 1;
    }
    return kept;
  }

  /**
   * The open lab and the learner's latest attempt at it (Phase 9C), once: the problem as course
   * material, the attempt as `personal`; returns how many were kept.
   */
  addLab(lab: LabAttemptOutput): number {
    if (this.labTaken) return 0;
    this.labTaken = true;
    let kept = 0;
    const parts = [
      { part: 'problem' as const, text: lab.problem, dataClass: 'course' as const },
      { part: 'attempt' as const, text: lab.attempt, dataClass: 'personal' as const },
    ];
    for (const { part, text, dataClass } of parts) {
      if (text.trim() === '' || !this.fits(text.length)) continue;
      this.push({
        source: 'SI Academy Labs',
        document:
          part === 'problem' ? `Lab: ${lab.title}` : `Your latest failed attempt: ${lab.title}`,
        heading: part === 'problem' ? 'The lab' : 'Your attempt',
        content: text,
        dataClass,
        origin: { kind: 'lab', part, questionId: lab.questionId, title: lab.title },
      });
      kept += 1;
    }
    return kept;
  }

  /** The most sensitive data class among the passages: what a draft from them carries. */
  dataClass(): PassageDataClass {
    return mostSensitive(this.items.map((passage) => passage.dataClass)) as PassageDataClass;
  }

  /** The records the cited "what is due" passages were read from: asked again before delivery. */
  dueSections(ids: readonly string[]): Set<DueSection> {
    const sections = new Set<DueSection>();
    for (const item of this.items) {
      if (ids.includes(item.id) && item.origin.kind === 'state') {
        for (const section of item.origin.sections) sections.add(section);
      }
    }
    return sections;
  }

  /** Whether any of the evidence is the learner's own attempt at a lab: drafts then hold no code. */
  hasLabAttempt(): boolean {
    return this.items.some((item) => item.origin.kind === 'lab' && item.origin.part === 'attempt');
  }

  /** A passage's citation, from its provenance; null for an id the run never gave. */
  citation(id: string): AiAgentCitation | null {
    const passage = this.items.find((item) => item.id === id);
    if (!passage) return null;
    const origin = passage.origin;
    if (origin.kind === 'lesson') {
      return {
        kind: 'lesson',
        id,
        lessonId: origin.lessonId,
        courseId: origin.courseId,
        title: origin.title,
        heading: origin.module,
        position: origin.position,
      };
    }
    if (origin.kind === 'state') {
      return {
        kind: 'learning_state',
        id,
        part: origin.part,
        courseId: origin.courseId,
        title: origin.title,
      };
    }
    if (origin.kind === 'lab') {
      return {
        kind: 'lab_attempt',
        id,
        part: origin.part,
        questionId: origin.questionId,
        title: origin.title,
      };
    }
    const found = origin.passage;
    return {
      kind: 'knowledge',
      id,
      chunkId: found.chunkId,
      sourceId: found.sourceId,
      sourceName: found.sourceName,
      documentId: found.documentId,
      versionId: found.versionId,
      title: found.title,
      heading: found.heading,
      position: found.position,
      courseId: found.courseId,
      lessonId: found.lessonId,
      similarity: found.similarity,
    };
  }

  private fits(size: number): boolean {
    return this.items.length < this.maxPassages && this.total + size <= this.maxCharacters;
  }

  private push(passage: Omit<RunPassage, 'id'>): void {
    this.total += passage.content.length;
    this.items.push({ ...passage, id: `S${this.items.length + 1}` });
  }
}

/** How a learning-state passage is headed for the model. */
const STATE_HEADING: Record<AiAgentStatePart, string> = {
  progress: 'Learning state: progress',
  lessons: 'Learning state: lessons',
  due: 'Learning state: what is due',
  courses: 'Learning state: courses',
};

/**
 * A text in parts of at most `max` characters, at paragraph ends where it can, then at sentence
 * ends, then wherever it must.
 */
export function partsOf(text: string, max: number): string[] {
  const pieces = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .flatMap((line) => (line.length <= max ? [line] : sentencePieces(line, max)));
  const parts: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + 1 + piece.length > max) {
      parts.push(current);
      current = '';
    }
    current = current ? `${current}\n${piece}` : piece;
  }
  if (current) parts.push(current);
  return parts;
}

function sentencePieces(line: string, max: number): string[] {
  const pieces: string[] = [];
  for (const sentence of line.split(/(?<=[.!?])\s+/)) {
    for (let at = 0; at < sentence.length; at += max) pieces.push(sentence.slice(at, at + max));
  }
  return pieces;
}
