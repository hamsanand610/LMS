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
