import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { optionalWebUrlSchema, webUrlOrEmptySchema } from './common.js';

describe('links people type for others to open', () => {
  const link = optionalWebUrlSchema(200);

  it('accepts web addresses and an empty field', () => {
    expect(link.parse('https://github.com/anika')).toBe('https://github.com/anika');
    expect(link.parse('http://intranet.example/page')).toBe('http://intranet.example/page');
    expect(link.parse('  ')).toBe('');
    expect(link.parse(undefined)).toBe('');
  });

  it('refuses links that would run or load something in the browser', () => {
    for (const value of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox',
      'file:///etc/passwd',
      'ftp://example.test/file',
    ]) {
      expect(link.safeParse(value).success, value).toBe(false);
    }
  });

  it('leaves a field out of a partial update when it was not sent', () => {
    const patch = z.object({ joinUrl: webUrlOrEmptySchema(500).optional() });
    expect(patch.parse({})).toEqual({});
    expect(patch.parse({ joinUrl: '' })).toEqual({ joinUrl: '' });
  });
});

describe('a change to some fields of a record (PATCH)', () => {
  it('leaves out what was not sent, instead of filling in defaults', async () => {
    const { courseUpdateSchema } = await import('./courses.js');
    const { testUpdateSchema } = await import('./tests.js');
    const { announcementUpdateSchema } = await import('./notifications.js');
    const { settingsUpdateSchema } = await import('./settings.js');
    const { programUpdateSchema } = await import('./batches.js');
    const { contentPageUpdateSchema } = await import('./content.js');
    expect(courseUpdateSchema.parse({ title: 'Java, renamed' })).toEqual({
      title: 'Java, renamed',
    });
    expect(testUpdateSchema.parse({ title: 'Week 3 test' })).toEqual({ title: 'Week 3 test' });
    expect(announcementUpdateSchema.parse({ title: 'Moved to Friday' })).toEqual({
      title: 'Moved to Friday',
    });
    expect(settingsUpdateSchema.parse({ records: { auditRetentionDays: 1095 } })).toEqual({
      records: { auditRetentionDays: 1095 },
    });
    expect(programUpdateSchema.parse({ name: 'Java Full Stack' })).toEqual({
      name: 'Java Full Stack',
    });
    expect(contentPageUpdateSchema.parse({ title: 'Privacy' })).toEqual({ title: 'Privacy' });
  });

  it('still checks a field that was sent', async () => {
    const { courseUpdateSchema } = await import('./courses.js');
    const { settingsUpdateSchema } = await import('./settings.js');
    expect(courseUpdateSchema.safeParse({ estimatedMinutes: -1 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ records: { auditRetentionDays: 30 } }).success).toBe(
      false,
    );
  });
});
