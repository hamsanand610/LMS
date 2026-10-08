'use client';

/**
 * Keeps every open tab on the account that is actually signed in. A browser's tabs share their
 * cookies, so signing out, or in as someone else, in one tab silently changes who the others act
 * as, while they still show the previous person's pages: an administrator's course list, say,
 * whose "Create course" is then refused because the request now comes from a learner. A tab told
 * that the session changed reloads, and the server's portal guard decides again what it shows.
 * The API remains the authority either way; this only stops a page from showing someone else.
 */
const CHANNEL = 'si-academy-session';

export type SessionChange = { type: 'signed-in'; userId: string } | { type: 'signed-out' };

/** Tells the other tabs of this browser that the session changed. */
export function announceSessionChange(change: SessionChange): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(change);
  channel.close();
}

/**
 * Calls `onChange` when another tab signs out, or signs in as anyone but `userId`. Returns the
 * function that stops listening.
 */
export function watchSessionChanges(userId: string, onChange: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<SessionChange | null>) => {
    const change = event.data;
    if (change?.type === 'signed-out' || (change?.type === 'signed-in' && change.userId !== userId))
      onChange();
  };
  return () => channel.close();
}
