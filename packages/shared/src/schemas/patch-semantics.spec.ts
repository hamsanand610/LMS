import { describe, expect, it } from 'vitest';
import { applicationStatusSchema } from './placement.js';
import { assignmentUpdateSchema } from './assignments.js';
import { brandingUpdateSchema } from './branding.js';
import { definedFields } from './common.js';
import { integrationUpdateSchema } from './content.js';
import { customValuesSchema } from './custom-fields.js';
import { feedbackFormCreateSchema } from './feedback.js';
import { featureFlagUpdateSchema } from './flags.js';
import { announcementCreateSchema } from './notifications.js';
import { sessionCreateSchema } from './sessions.js';
import { attemptAnswersSchema, testScheduleSchema, testUpdateSchema } from './tests.js';

const id = '0190a0e4-7c1d-7b9e-8f00-000000000001';

/**
 * Phase 6: an update names what it changes. Zod 4 fills an object's defaults even inside an
 * optional or partial wrapper, so a patch carrying one nested field would otherwise arrive with
 * every sibling reset to its default — and the service would store that.
 */
describe('a patch carries only what was sent', () => {
  it('leaves the other settings of a test or an assignment out', () => {
    expect(testUpdateSchema.parse({ settings: { maxAttempts: 3 } })).toEqual({
      settings: { maxAttempts: 3 },
    });
    expect(assignmentUpdateSchema.parse({ settings: { attemptsPerQuestion: 2 } })).toEqual({
      settings: { attemptsPerQuestion: 2 },
    });
    expect(testUpdateSchema.parse({ title: 'Renamed test' })).toEqual({ title: 'Renamed test' });
  });

  it('leaves a flag audience’s other list out', () => {
    expect(featureFlagUpdateSchema.parse({ audience: { roleKeys: ['trainer'] } })).toEqual({
      audience: { roleKeys: ['trainer'] },
    });
  });

  it('leaves the other fields of a branding section out', () => {
    expect(brandingUpdateSchema.parse({ login: { welcomeTitle: 'Hello' } })).toEqual({
      login: { welcomeTitle: 'Hello' },
    });
    expect(brandingUpdateSchema.parse({ email: { footerText: 'Bye' } })).toEqual({
      email: { footerText: 'Bye' },
    });
  });

  it('leaves an integration’s stored settings and an application’s note alone when not sent', () => {
    const integration = integrationUpdateSchema.parse({ driver: 'smtp' });
    expect(integration).not.toHaveProperty('config');
    expect(integration.secret).toBeUndefined();
    expect(applicationStatusSchema.parse({ status: 'shortlisted' }).note).toBeUndefined();
  });

  it('saves only the parts of an answer that were sent', () => {
    const parsed = attemptAnswersSchema.parse({ answers: [{ testQuestionId: id, flagged: true }] });
    expect(parsed.answers[0]).toEqual({ testQuestionId: id, flagged: true });
  });

  it('drops undefined fields, keeping null, false and empty values', () => {
    expect(definedFields({ a: undefined, b: null, c: false, d: '', e: 0 })).toEqual({
      b: null,
      c: false,
      d: '',
      e: 0,
    });
  });
});

describe('custom yes/no fields', () => {
  const schema = customValuesSchema([
    {
      key: 'relocate',
      label: 'Willing to relocate',
      entity: 'student',
      type: 'boolean',
      required: false,
      options: [],
      archived: false,
      position: 0,
      helpText: '',
    } as never,
  ]);

  it('reads "false" as false, not as a non-empty string', () => {
    expect(schema.parse({ relocate: 'false' })).toEqual({ relocate: false });
    expect(schema.parse({ relocate: 'true' })).toEqual({ relocate: true });
    expect(schema.parse({ relocate: false })).toEqual({ relocate: false });
    expect(schema.safeParse({ relocate: 'yes' }).success).toBe(false);
  });
});

describe('windows compare instants, not text', () => {
  // Text order puts "…00Z" after "…00.500Z", though it is half a second earlier.
  const later = '2026-11-02T10:00:00.500Z';
  const earlier = '2026-11-02T10:00:00Z';
  const question = [{ id: 'q1', kind: 'rating', prompt: 'How was it?' }];

  const windows: [
    string,
    (from: string, to: string) => { success: boolean; error?: unknown },
    string,
  ][] = [
    [
      'a class',
      (from, to) => sessionCreateSchema.safeParse({ subject: 'java', startsAt: from, endsAt: to }),
      'endsAt',
    ],
    [
      'an announcement',
      (from, to) =>
        announcementCreateSchema.safeParse({
          title: 'Notice',
          body: 'Body',
          startsAt: from,
          endsAt: to,
        }),
      'endsAt',
    ],
    [
      'a test window',
      (from, to) => testScheduleSchema.safeParse({ batchId: id, opensAt: from, closesAt: to }),
      'closesAt',
    ],
    [
      'a feedback form',
      (from, to) =>
        feedbackFormCreateSchema.safeParse({
          title: 'Feedback',
          batchId: id,
          opensAt: from,
          closesAt: to,
          questions: question,
        }),
      'closesAt',
    ],
  ];

  it.each(windows)(
    'refuses %s that ends before it starts, whatever the precision',
    (_, parse, field) => {
      expect(parse(earlier, later).success).toBe(true);
      const wrong = parse(later, earlier);
      expect(wrong.success).toBe(false);
      const issues = (wrong.error as { issues: { path: PropertyKey[] }[] }).issues;
      expect(issues.map((i) => i.path.join('.'))).toEqual([field]);
    },
  );
});
