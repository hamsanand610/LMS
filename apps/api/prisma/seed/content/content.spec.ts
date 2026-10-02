import { describe, expect, it } from 'vitest';
import {
  assignmentCreateSchema,
  assignmentModuleSchema,
  DEFAULT_TERMS,
  questionCreateSchema,
} from '@lms/shared';
import { WRITTEN_ANSWERS } from './answers.js';
import {
  ASSIGNMENTS,
  BANK,
  casesOf,
  isRunnable,
  runSettings,
  TECHNOLOGY_TERMS,
  TOPIC_TERMS,
} from './index.js';
import type { BankQuestion } from './types.js';
import { currentVerification, fingerprintOf, loadVerifiedRuns } from './verified.js';

/** The question as an author would send it to the API: the shape the seed writes. */
function asInput(q: BankQuestion): unknown {
  const settings = isRunnable(q) ? runSettings(q) : null;
  const described = q.type === 'coding' || q.type === 'debugging' ? q : null;
  const input: Record<string, unknown> = {
    title: q.title,
    body: q.body,
    type: q.type,
    subject: q.technology,
    topic: q.topic,
    difficulty: q.level,
    marks: q.marks,
    explanation: q.explanation ?? '',
    tags: q.tags ?? [],
    hints: q.hints ?? [],
    rubric:
      q.type === 'descriptive' ||
      q.type === 'file_upload' ||
      q.type === 'practical' ||
      q.type === 'project'
        ? q.rubric
        : '',
    options:
      q.type === 'true_false'
        ? [
            { body: 'True', isCorrect: q.answer },
            { body: 'False', isCorrect: !q.answer },
          ]
        : q.type === 'mcq_single' || q.type === 'mcq_multi'
          ? q.options.map(([body, isCorrect, explanation]) => ({
              body,
              isCorrect,
              explanation: explanation ?? '',
            }))
          : [],
    ...(q.type === 'file_upload' || q.type === 'practical' || q.type === 'project'
      ? { spec: q.spec }
      : {}),
    coding:
      settings && isRunnable(q)
        ? {
            languages: settings.languages,
            starterCode: settings.starterCode,
            referenceSolution: settings.referenceSolution,
            timeLimitMs: settings.timeLimitMs,
            memoryLimitMb: settings.memoryLimitMb,
            inputFormat: described?.inputFormat ?? '',
            outputFormat: described?.outputFormat ?? '',
            constraints: described?.constraints ?? '',
            expectedBehaviour: q.type === 'debugging' ? q.expectedBehaviour : '',
            compareMode: settings.compareMode,
            setupSql: settings.setupSql,
            sqlCheck: settings.sqlCheck,
            testCases: casesOf(q).map((c) => ({
              input: c.input,
              expectedOutput: c.expected,
              isSample: c.sample ?? false,
              weight: c.weight ?? 1,
              label: c.label ?? '',
              explanation: c.explanation ?? '',
            })),
          }
        : null,
  };
  return input;
}

describe('the seeded question bank', () => {
  it('has unique, well-formed slugs', () => {
    const slugs = BANK.map((q) => q.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('passes the same validation an author’s question does', () => {
    const problems = BANK.flatMap((q) => {
      const parsed = questionCreateSchema.safeParse(asInput(q));
      return parsed.success
        ? []
        : [
            `${q.slug}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
          ];
    });
    expect(problems).toEqual([]);
  });

  it('uses only technologies and topics the taxonomy knows', () => {
    const technologies = new Set([...DEFAULT_TERMS.subject, ...TECHNOLOGY_TERMS].map((t) => t.key));
    const topics = new Set([...DEFAULT_TERMS.topic, ...TOPIC_TERMS].map((t) => t.key));
    expect(BANK.filter((q) => !technologies.has(q.technology)).map((q) => q.slug)).toEqual([]);
    expect(BANK.filter((q) => !topics.has(q.topic)).map((q) => q.slug)).toEqual([]);
  });

  it('gives every runnable question a visible example and at least one more case', () => {
    for (const q of BANK) {
      if (!isRunnable(q)) continue;
      const cases = casesOf(q);
      expect(
        cases.some((c) => c.sample),
        q.slug,
      ).toBe(true);
      expect(cases.length, q.slug).toBeGreaterThanOrEqual(q.type === 'sql' ? 1 : 3);
    }
  });

  it('has every runnable question verified in the sandbox as it is now', () => {
    const runs = loadVerifiedRuns();
    expect(runs, 'run `pnpm --filter @lms/api verify:questions -- --write`').not.toBeNull();
    const stale = BANK.filter(isRunnable)
      .filter((q) => !currentVerification(runs, q))
      .map((q) => `${q.slug} (fingerprint ${fingerprintOf(q)})`);
    expect(
      stale,
      'changed since it was last run: `pnpm --filter @lms/api verify:questions -- --write`',
    ).toEqual([]);
  });
});

describe('the seeded assignments', () => {
  const bySlug = new Map(BANK.map((q) => [q.slug, q]));

  it('pass the same validation an author’s assignment does', () => {
    for (const plan of ASSIGNMENTS) {
      const parsed = assignmentCreateSchema.safeParse({
        title: plan.title,
        description: plan.description,
        instructions: plan.instructions,
        subject: plan.technology,
        difficulty: plan.level,
        kind: plan.kind,
        estimatedMinutes: plan.estimatedMinutes,
        passPercent: plan.passPercent,
        settings: plan.settings,
      });
      expect(parsed.success, `${plan.title}: ${parsed.error?.message ?? ''}`).toBe(true);
      for (const module of plan.modules) {
        const moduleParsed = assignmentModuleSchema.safeParse({
          title: module.title,
          description: module.description,
          topic: module.topic,
          dueAfterDays: module.dueAfterDays ?? null,
          unlockRule: module.gatedAt
            ? { type: 'after_previous', minPercent: module.gatedAt }
            : { type: 'always' },
          questions: module.questions.map(() => ({
            questionId: '00000000-0000-4000-8000-000000000000',
          })),
        });
        expect(moduleParsed.success, `${plan.title} / ${module.title}`).toBe(true);
      }
    }
  });

  it('only use questions that exist, once each', () => {
    for (const plan of ASSIGNMENTS) {
      const slugs = plan.modules.flatMap((m) => m.questions);
      expect(
        slugs.filter((slug) => !bySlug.has(slug)),
        plan.title,
      ).toEqual([]);
      expect(new Set(slugs).size, plan.title).toBe(slugs.length);
    }
  });

  it('have a sample answer for every written question learners are asked', () => {
    const written = ASSIGNMENTS.flatMap((plan) => plan.modules.flatMap((m) => m.questions)).filter(
      (slug) => bySlug.get(slug)?.type === 'descriptive',
    );
    const reached = new Set(
      ASSIGNMENTS.filter((plan) => plan.audiences.some((a) => a.opensInDays <= 0)).flatMap((plan) =>
        plan.modules.flatMap((m) => m.questions),
      ),
    );
    expect(written.filter((slug) => reached.has(slug) && !WRITTEN_ANSWERS[slug])).toEqual([]);
  });

  it('cover every track the institute teaches', () => {
    const technologies = new Set(ASSIGNMENTS.map((a) => a.technology));
    for (const key of [
      'core-java',
      'sql',
      'javascript',
      'html',
      'python',
      'dsa',
      'spring-boot',
      'git',
      'testing',
      'career',
      'php',
      'programming',
    ]) {
      expect(technologies.has(key), key).toBe(true);
    }
  });
});
