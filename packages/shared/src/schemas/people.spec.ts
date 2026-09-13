import { describe, expect, it } from 'vitest';
import { batchCreateSchema, BATCH_STATUS_TRANSITIONS } from './batches.js';
import { customValuesSchema } from './custom-fields.js';
import {
  STUDENT_STATUS_TRANSITIONS,
  studentCreateSchema,
  studentPersonalSchema,
} from './people.js';

describe('studentCreateSchema', () => {
  it('defaults a new student to enrolled and to being invited', () => {
    const parsed = studentCreateSchema.parse({ name: 'Ada Lovelace', email: 'ADA@Test.Local' });
    expect(parsed.status).toBe('enrolled');
    expect(parsed.sendInvitation).toBe(true);
    expect(parsed.email).toBe('ada@test.local');
    expect(parsed.custom).toEqual({});
  });

  it('accepts an empty mobile but not a malformed one', () => {
    expect(
      studentCreateSchema.safeParse({ name: 'Ada L', email: 'a@b.co', mobile: '' }).success,
    ).toBe(true);
    expect(
      studentCreateSchema.safeParse({ name: 'Ada L', email: 'a@b.co', mobile: '12' }).success,
    ).toBe(false);
  });
});

describe('student status transitions', () => {
  it('moves forward through the lifecycle and allows dropping out', () => {
    expect(STUDENT_STATUS_TRANSITIONS.prospect).toContain('enrolled');
    expect(STUDENT_STATUS_TRANSITIONS.enrolled).toContain('active');
    expect(STUDENT_STATUS_TRANSITIONS.active).toContain('completed');
    expect(STUDENT_STATUS_TRANSITIONS.completed).toEqual(['alumni']);
    expect(STUDENT_STATUS_TRANSITIONS.dropped).toEqual(['enrolled']);
  });

  it('has no way out of alumni', () => {
    expect(STUDENT_STATUS_TRANSITIONS.alumni).toEqual([]);
  });
});

describe('studentPersonalSchema', () => {
  it('fills every field with a default so a partial record still parses', () => {
    const parsed = studentPersonalSchema.parse({});
    expect(parsed.gender).toBe('undisclosed');
    expect(parsed.dateOfBirth).toBeNull();
    expect(parsed.city).toBe('');
  });

  it('checks the postal code when one is given', () => {
    expect(studentPersonalSchema.safeParse({ pincode: '600001' }).success).toBe(true);
    expect(studentPersonalSchema.safeParse({ pincode: '60' }).success).toBe(false);
    expect(studentPersonalSchema.safeParse({ pincode: '' }).success).toBe(true);
  });
});

describe('batchCreateSchema', () => {
  const base = {
    programId: '0195b3b7-0000-7000-8000-000000000001',
    code: 'JFS-2026-B1',
    name: 'Batch One',
    startDate: '2026-01-05',
    endDate: '2026-06-30',
  };

  it('defaults mode and capacity', () => {
    const parsed = batchCreateSchema.parse(base);
    expect(parsed.mode).toBe('offline');
    expect(parsed.capacity).toBe(60);
  });

  it('rejects an end date before the start date', () => {
    const result = batchCreateSchema.safeParse({ ...base, endDate: '2025-12-31' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('insists on an upper-case code', () => {
    expect(batchCreateSchema.safeParse({ ...base, code: 'jfs-2026-b1' }).success).toBe(false);
  });
});

describe('batch status transitions', () => {
  it('only lets a batch move forward, and archiving is always possible until archived', () => {
    expect(BATCH_STATUS_TRANSITIONS.planned).toEqual(['running', 'archived']);
    expect(BATCH_STATUS_TRANSITIONS.running).toEqual(['completed', 'archived']);
    expect(BATCH_STATUS_TRANSITIONS.archived).toEqual([]);
  });
});

describe('customValuesSchema', () => {
  const definitions = [
    {
      entityType: 'student' as const,
      key: 'source',
      label: 'Source',
      type: 'select' as const,
      helpText: '',
      options: [{ value: 'walk_in', label: 'Walk-in' }],
      required: true,
      visibility: 'staff' as const,
      position: 0,
      archived: false,
    },
    {
      entityType: 'student' as const,
      key: 'fee_paid',
      label: 'Fee paid',
      type: 'boolean' as const,
      helpText: '',
      options: [],
      required: false,
      visibility: 'staff' as const,
      position: 1,
      archived: false,
    },
    {
      entityType: 'student' as const,
      key: 'old',
      label: 'Retired field',
      type: 'text' as const,
      helpText: '',
      options: [],
      required: false,
      visibility: 'staff' as const,
      position: 2,
      archived: true,
    },
  ];

  it('accepts declared values and coerces the simple types', () => {
    const parsed = customValuesSchema(definitions).parse({ source: 'walk_in', fee_paid: 'true' });
    expect(parsed).toEqual({ source: 'walk_in', fee_paid: true });
  });

  it('requires a required field and rejects a value outside the options', () => {
    expect(customValuesSchema(definitions).safeParse({}).success).toBe(false);
    expect(customValuesSchema(definitions).safeParse({ source: 'referral' }).success).toBe(false);
  });

  it('rejects unknown and archived keys rather than storing them silently', () => {
    expect(
      customValuesSchema(definitions).safeParse({ source: 'walk_in', typo: 'x' }).success,
    ).toBe(false);
    expect(customValuesSchema(definitions).safeParse({ source: 'walk_in', old: 'x' }).success).toBe(
      false,
    );
  });

  it('accepts anything when a client has defined no fields', () => {
    expect(customValuesSchema([]).safeParse({}).success).toBe(true);
  });
});
