/**
 * SI Academy's curriculum (the client's locked plan, Step 2): courses written for this institute,
 * structured as the reference portal's are (modules of lessons with their length, practice inside
 * the module, class recordings as lessons, resources on each lesson) but with original writing
 * only (operating rule 43). Pure data: prisma/seed/curriculum.ts writes it.
 */

/** A link to the official documentation of a technology (curriculum.spec.ts lists the hosts). */
export interface CurriculumResource {
  title: string;
  url: string;
}

/** Notes: an article with the lesson's explanation and examples, as lesson HTML. */
export interface ArticleLesson {
  kind: 'article';
  title: string;
  /** Reading and trying-it-out time, in minutes. */
  minutes: number;
  /** A label that groups lessons inside the module on the learner's outline. */
  topic?: string;
  /**
   * The body: h2–h5, p, ul/ol/li, table, pre/code (class `language-x`), strong/em, a (no target),
   * details/summary. Code is HTML-escaped (`&lt;`, `&gt;`, `&amp;`).
   */
  html: string;
  resources?: CurriculumResource[];
}

/** Practice inside the module: the bank question (by slug) a learner answers to complete it. */
export interface PracticeLesson {
  kind: 'practice';
  question: string;
  /** Defaults to the question's own title. */
  title?: string;
  topic?: string;
}

/** A lab from the bank (debugging or web), opened from the lesson; passing it completes it. */
export interface LabLesson {
  kind: 'lab';
  lab: string;
  title?: string;
  topic?: string;
}

export type CurriculumLesson = ArticleLesson | PracticeLesson | LabLesson;

export interface CurriculumModule {
  title: string;
  /** What the module covers, in one sentence (also the class recording's description). */
  summary: string;
  /** Opens only once the previous module reaches this percentage; absent: always open. */
  gatedAt?: number;
  lessons: CurriculumLesson[];
}

/** A test definition, drafted for staff to schedule to a batch. Objective or written questions. */
export interface CurriculumTest {
  title: string;
  kind: 'weekly' | 'practice' | 'mock' | 'final';
  description: string;
  durationMinutes: number;
  sections: { title: string; questions: string[] }[];
}

export interface CurriculumCourse {
  slug: string;
  title: string;
  /** A subject taxonomy key (core-java, sql, …). */
  subject: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  tags: string[];
  modules: CurriculumModule[];
  /** Titles of the bank's assignment definitions that belong with this course. */
  assignments: string[];
  tests: CurriculumTest[];
}
