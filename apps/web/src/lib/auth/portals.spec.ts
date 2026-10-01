import { describe, expect, it } from 'vitest';
import { portalHome, safeNext } from './portals';

describe('portalHome', () => {
  it('maps each portal to its landing route', () => {
    expect(portalHome('admin')).toBe('/admin');
    expect(portalHome('trainer')).toBe('/trainer');
    expect(portalHome('student')).toBe('/dashboard');
  });
});

describe('safeNext', () => {
  it('accepts only same-origin relative paths', () => {
    expect(safeNext('/admin/settings/general')).toBe('/admin/settings/general');
    expect(safeNext('/')).toBe('/');
    expect(safeNext('/courses?tab=outline#top')).toBe('/courses?tab=outline#top');
  });

  it('rejects external, protocol-relative and empty targets', () => {
    expect(safeNext('https://evil.example/login')).toBeNull();
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('admin')).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });

  it('rejects targets a browser would read as another site', () => {
    // A backslash reads as a slash, and tabs and newlines are dropped before navigating.
    expect(safeNext('/\\evil.example')).toBeNull();
    expect(safeNext('/\t/evil.example')).toBeNull();
    expect(safeNext('/\n/evil.example')).toBeNull();
    // Escaped in the URL itself, the same characters stay part of the path.
    expect(safeNext('/%5Cevil.example')).toBe('/%5Cevil.example');
  });
});
