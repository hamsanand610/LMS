import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { MeResponse } from '@lms/shared';
import type { StreamEvent } from '@/lib/api/stream';
import { MeProvider } from '@/shell/me-context';

/** Test support for SI Academy AI's components (Phase 7E): not part of the app. */

export const AVAILABLE = {
  available: true,
  reason: null,
  features: {
    assistant: true,
    workspace: true,
    lab_hints: true,
    semantic_cache: false,
    agent: false,
  },
  subjects: { course: true, labHints: true },
} as const;

/**
 * A signed-in person with these flags and permissions — a learner unless `learner` is false;
 * nothing else of `me` is read here.
 */
export function meWith(
  flags: Record<string, boolean>,
  permissions: string[],
  learner = true,
): MeResponse {
  return {
    flags,
    permissions: permissions.map((key) => ({ key, scope: 'own' })),
    person: {
      studentId: learner ? '0190a0e4-7c1d-7b9e-8f00-0000000000f1' : null,
      studentCode: learner ? 'STU-2026-0001' : null,
      trainerId: null,
      batchIds: [],
    },
  } as unknown as MeResponse;
}

export const LEARNER_FLAGS = {
  'module.ai': true,
  'ai.assistant': true,
  'ai.workspace': true,
  'ai.lab_hints': true,
};

export function renderWith(ui: React.ReactElement, me: MeResponse) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MeProvider me={me}>{ui}</MeProvider>
      </QueryClientProvider>,
    ),
  };
}

/** An answer stream, as `streamApi` would hand it over. */
export async function* streamOf(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const event of events) yield event;
}

export const answered = (text: string): StreamEvent[] => [
  {
    event: 'meta',
    data: {
      conversationId: '0190a0e4-7c1d-7b9e-8f00-0000000000c1',
      userMessageId: '0190a0e4-7c1d-7b9e-8f00-000000000001',
      assistantMessageId: '0190a0e4-7c1d-7b9e-8f00-000000000002',
    },
  },
  ...text.split(' ').map((word, i) => ({ event: 'delta', data: { text: i ? ` ${word}` : word } })),
  {
    event: 'done',
    data: { messageId: '0190a0e4-7c1d-7b9e-8f00-000000000002', status: 'complete' },
  },
];
