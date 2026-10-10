/*
 * Unsent answers (code, text, a web lab's files) are kept in the browser under `lms-draft:` keys so
 * that a refresh does not lose them. A browser can be shared — a lab PC, a family laptop — so the
 * drafts belong to whoever wrote them: they are removed on sign-out, and before anybody else's
 * session can show them (Step 6 audit). Storage that refuses access is ignored.
 */
const PREFIX = 'lms-draft:';
const OWNER_KEY = 'lms-draft-owner';

/** Removes every unsent draft kept in this browser. */
export function clearLocalDrafts(): void {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) window.localStorage.removeItem(key);
    }
    window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage blocked or unavailable: there is nothing kept to remove.
  }
}

/**
 * Keeps the drafts in this browser only for the person signed in: anybody else's, or drafts nobody
 * claimed, are removed first.
 */
export function claimLocalDrafts(userId: string): void {
  try {
    if (window.localStorage.getItem(OWNER_KEY) === userId) return;
    clearLocalDrafts();
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Storage blocked or unavailable: no draft can be shown either.
  }
}
