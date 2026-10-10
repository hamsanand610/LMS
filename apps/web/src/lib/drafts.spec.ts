import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claimLocalDrafts, clearLocalDrafts } from './drafts';

/** A Storage over a Map, enough for the drafts' own use of localStorage. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  };
}

describe('drafts kept in a shared browser', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
    (globalThis as { window?: unknown }).window = { localStorage: storage };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('keeps the drafts of the person who wrote them', () => {
    claimLocalDrafts('learner-a');
    storage.setItem('lms-draft:placement-1:python', 'print(1)');
    claimLocalDrafts('learner-a');
    expect(storage.getItem('lms-draft:placement-1:python')).toBe('print(1)');
  });

  it('removes them before somebody else signed in on the same browser could see them', () => {
    claimLocalDrafts('learner-a');
    storage.setItem('lms-draft:placement-1:python', 'print(1)');
    storage.setItem('lms-draft:placement-2:text', 'my essay');
    storage.setItem('lms-theme', 'dark');
    claimLocalDrafts('learner-b');
    expect(storage.getItem('lms-draft:placement-1:python')).toBeNull();
    expect(storage.getItem('lms-draft:placement-2:text')).toBeNull();
    // Only drafts go: the browser's own settings stay.
    expect(storage.getItem('lms-theme')).toBe('dark');
    expect(storage.getItem('lms-draft-owner')).toBe('learner-b');
  });

  it('removes drafts nobody claimed (kept before drafts had an owner)', () => {
    storage.setItem('lms-draft:placement-1:web', '{}');
    claimLocalDrafts('learner-a');
    expect(storage.getItem('lms-draft:placement-1:web')).toBeNull();
  });

  it('removes every draft on sign-out', () => {
    claimLocalDrafts('learner-a');
    storage.setItem('lms-draft:placement-1:python', 'print(1)');
    clearLocalDrafts();
    expect(storage.length).toBe(0);
  });

  it('does nothing when the browser refuses storage', () => {
    (globalThis as { window?: unknown }).window = {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    };
    expect(() => claimLocalDrafts('learner-a')).not.toThrow();
    expect(() => clearLocalDrafts()).not.toThrow();
  });
});
