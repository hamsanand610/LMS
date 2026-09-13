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
  });

  it('rejects external, protocol-relative and empty targets', () => {
    expect(safeNext('https://evil.example/login')).toBeNull();
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('admin')).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
