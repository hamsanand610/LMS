// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiWorkspace } from './ai-workspace';
import { LEARNER_FLAGS, answered, meWith, renderWith, streamOf } from './testing';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  streamApi: vi.fn(),
  replace: vi.fn(),
  search: '',
}));
vi.mock('@/lib/api/http', () => ({ api: mocks.api }));
vi.mock('@/lib/api/stream', () => ({ streamApi: mocks.streamApi }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ONE = '0190a0e4-7c1d-7b9e-8f00-0000000000c1';
const TWO = '0190a0e4-7c1d-7b9e-8f00-0000000000c2';
const NEW = '0190a0e4-7c1d-7b9e-8f00-0000000000c3';
const summary = (id: string, title: string, purpose = 'workspace') => ({
  id,
  purpose,
  title,
  status: 'active',
  createdAt: '2026-10-04T10:00:00.000Z',
  lastMessageAt: '2026-10-04T10:05:00.000Z',
});
const learner = meWith(LEARNER_FLAGS, ['ai:chat', 'ai:hints']);

let deleteRelease: () => void = () => undefined;

function serve() {
  mocks.api.mockImplementation(
    async (path: string, options?: { body?: unknown; method?: string }) => {
      if (path.startsWith('/ai/conversations?')) {
        return {
          data: [summary(ONE, 'Java inheritance basics'), summary(TWO, '', 'lab_hint')],
          meta: { page: 1, pageSize: 50, total: 2 },
        };
      }
      if (path === `/ai/conversations/${ONE}` && !options?.method) {
        return {
          ...summary(ONE, 'Java inheritance basics'),
          context: { courseId: null, lessonId: null, questionId: null },
          messages: [
            {
              id: '0190a0e4-7c1d-7b9e-8f00-000000000001',
              conversationId: ONE,
              role: 'user',
              content: 'What is inheritance?',
              status: 'complete',
              createdAt: '2026-10-04T10:00:00.000Z',
            },
            {
              id: '0190a0e4-7c1d-7b9e-8f00-000000000002',
              conversationId: ONE,
              role: 'assistant',
              content: 'A class can extend another.',
              status: 'complete',
              createdAt: '2026-10-04T10:00:01.000Z',
            },
          ],
        };
      }
      if (options?.method === 'DELETE') {
        return new Promise<void>((resolve) => {
          deleteRelease = resolve;
        });
      }
      if (path === '/ai/conversations' && options?.body) return summary(NEW, '');
      throw new Error(`unexpected ${path}`);
    },
  );
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.streamApi.mockReset();
  mocks.replace.mockReset();
  mocks.search = '';
});
afterEach(cleanup);

describe('the SI Academy AI workspace (Phase 7E)', () => {
  it('lists the person’s own conversations, newest first, with what each is', async () => {
    serve();
    renderWith(<AiWorkspace />, learner);
    const history = await screen.findByRole('complementary', { name: 'Your conversations' });
    await within(history).findByText('Java inheritance basics');
    expect(within(history).getAllByRole('button', { name: /^Delete/ })).toHaveLength(2);
    // A hint without a title yet is named for what it is.
    expect(within(history).getAllByText('Lab hint').length).toBeGreaterThan(0);
    expect(mocks.api).toHaveBeenCalledWith('/ai/conversations?pageSize=50');
  });

  it('opens a conversation from the address with its messages', async () => {
    serve();
    mocks.search = `c=${ONE}`;
    renderWith(<AiWorkspace />, learner);
    expect(await screen.findByText('A class can extend another.')).toBeTruthy();
    expect(screen.getByText('What is inheritance?')).toBeTruthy();
  });

  it('starts a new conversation with the first question and puts it in the address', async () => {
    serve();
    mocks.streamApi.mockImplementation(() =>
      streamOf(answered('Polymorphism lets one name do many things.')),
    );
    renderWith(<AiWorkspace />, learner);
    fireEvent.change(await screen.findByLabelText('Your question'), {
      target: { value: 'What is polymorphism?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Polymorphism lets one name do many things.');
    expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', { body: { purpose: 'workspace' } });
    expect(mocks.replace).toHaveBeenCalledWith(`/ai?c=${NEW}`, { scroll: false });
    // The thread was not started over when the conversation got its id.
    expect(screen.getByText('What is polymorphism?')).toBeTruthy();
  });

  it('deletes a conversation after asking, and it disappears at once — before the server answers', async () => {
    serve();
    renderWith(<AiWorkspace />, learner);
    const history = await screen.findByRole('complementary', { name: 'Your conversations' });
    await within(history).findByText('Java inheritance basics');
    fireEvent.click(
      within(history).getByRole('button', { name: 'Delete “Java inheritance basics”' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete this conversation?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(within(history).queryByText('Java inheritance basics')).toBeNull());
    expect(mocks.api).toHaveBeenCalledWith(`/ai/conversations/${ONE}`, { method: 'DELETE' });
    deleteRelease();
  });

  it('keeps the history beside the thread on a wide screen and in a drawer on a phone', async () => {
    serve();
    renderWith(<AiWorkspace />, learner);
    const history = await screen.findByRole('complementary', { name: 'Your conversations' });
    expect(history.className).toContain('hidden');
    expect(history.className).toContain('lg:flex');
    const drawerButton = screen.getByRole('button', { name: 'Conversations' });
    expect(drawerButton.className).toContain('lg:hidden');
    fireEvent.click(drawerButton);
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Java inheritance basics')).toBeTruthy();
  });
});
