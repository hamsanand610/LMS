import { describe, expect, it, vi } from 'vitest';
import { announceSessionChange, watchSessionChanges } from './session-sync';

/** BroadcastChannel delivers on a later turn of the event loop. */
const delivered = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('one browser, one account across its tabs', () => {
  it('tells a tab when another signs out, or in as someone else, and stops when asked', async () => {
    const onChange = vi.fn();
    const stop = watchSessionChanges('user-a', onChange);

    announceSessionChange({ type: 'signed-in', userId: 'user-a' });
    await delivered();
    expect(onChange, 'the same person signing in again changes nothing').not.toHaveBeenCalled();

    announceSessionChange({ type: 'signed-in', userId: 'user-b' });
    await delivered();
    expect(onChange).toHaveBeenCalledTimes(1);

    announceSessionChange({ type: 'signed-out' });
    await delivered();
    expect(onChange).toHaveBeenCalledTimes(2);

    stop();
    announceSessionChange({ type: 'signed-out' });
    await delivered();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
