import { z } from 'zod';

/**
 * Vocabularies a client curates: course levels, subjects, topics. Courses and, later, questions
 * reference the terms by key, so renaming a label never breaks the records that use it.
 */
export const TAXONOMY_KEYS = ['course-level', 'subject', 'topic'] as const;
export type TaxonomyKey = (typeof TAXONOMY_KEYS)[number];

export const TAXONOMY_LABELS: Record<TaxonomyKey, string> = {
  'course-level': 'Course levels',
  subject: 'Subjects',
  topic: 'Topics',
};

export const termCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and hyphens'),
  label: z.string().trim().min(1).max(80),
  position: z.number().int().min(0).max(1000).default(0),
});
export type TermCreateInput = z.infer<typeof termCreateSchema>;

export const termUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  position: z.number().int().min(0).max(1000).optional(),
  archived: z.boolean().optional(),
});

export interface TaxonomyTerm {
  id: string;
  taxonomy: TaxonomyKey;
  key: string;
  label: string;
  position: number;
  archived: boolean;
  /** How many records currently reference the term; a term in use cannot be deleted. */
  usageCount: number;
}

/** Terms every deployment starts with, so a client has something to pick on day one. */
export const DEFAULT_TERMS: Record<TaxonomyKey, { key: string; label: string }[]> = {
  'course-level': [
    { key: 'beginner', label: 'Beginner' },
    { key: 'intermediate', label: 'Intermediate' },
    { key: 'advanced', label: 'Advanced' },
  ],
  subject: [
    { key: 'programming', label: 'Programming' },
    { key: 'core-java', label: 'Core Java' },
    { key: 'advanced-java', label: 'Advanced Java' },
    { key: 'sql', label: 'SQL' },
    { key: 'html-css', label: 'HTML and CSS' },
    { key: 'javascript', label: 'JavaScript' },
    { key: 'aptitude', label: 'Aptitude' },
    { key: 'soft-skills', label: 'Soft skills' },
  ],
  topic: [
    { key: 'arrays', label: 'Arrays' },
    { key: 'strings', label: 'Strings' },
    { key: 'loops', label: 'Loops and conditions' },
    { key: 'functions', label: 'Functions' },
    { key: 'recursion', label: 'Recursion' },
    { key: 'oop', label: 'Objects and classes' },
    { key: 'collections', label: 'Collections' },
    { key: 'exceptions', label: 'Exceptions' },
    { key: 'queries', label: 'Queries' },
    { key: 'joins', label: 'Joins' },
    { key: 'dom', label: 'The DOM' },
    { key: 'async', label: 'Asynchronous code' },
    { key: 'numbers', label: 'Numbers' },
    { key: 'reasoning', label: 'Reasoning' },
  ],
};
