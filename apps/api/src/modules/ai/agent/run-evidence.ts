import type { AiAgentCitation } from '@lms/shared';
import type { EvidencePassage } from '../knowledge/answers/grounded-prompt.js';
import type { KnowledgePassage } from './tools/knowledge-search.tool.js';
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
  | { kind: 'knowledge'; passage: KnowledgePassage };

/** A passage of the run's evidence: as the model is given it, with its id, class and provenance. */
export interface RunPassage extends EvidencePassage {
  dataClass: 'public' | 'course';
  origin: Origin;
}

/**
 * A run's evidence (Roadmap Phase 9B; ADR-0039): everything the tools found that the draft may
 * draw on, in the order found, each passage with a citation id unique in the run (`S1`, `S2`, …,
 * whichever tool found it). Bounded: at most `maxPassages`, and `maxCharacters` of text in all — a
 * passage that would go past either is left out, and a chunk already held is not taken twice. The
 * provenance of a citation is always the tool's, never the model's.
 */
export class RunEvidence {
  private readonly items: RunPassage[] = [];
  private readonly chunks = new Set<string>();
  private lessonTaken = false;
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

  /** The most sensitive data class among the passages: what a draft from them carries. */
  dataClass(): 'public' | 'course' {
    return this.items.some((passage) => passage.dataClass === 'course') ? 'course' : 'public';
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
