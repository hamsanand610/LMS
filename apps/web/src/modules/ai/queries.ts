'use client';

import { useQuery } from '@tanstack/react-query';
import type { AiAvailability, AiConversationSummary, Paginated } from '@lms/shared';
import { api } from '@/lib/api/http';

/** The newest conversations the history shows; the API keeps the rest until retention ends. */
export const HISTORY_PAGE_SIZE = 50;

export const AI_KEYS = {
  all: ['ai'] as const,
  availability: ['ai', 'availability'] as const,
  conversations: ['ai', 'conversations'] as const,
  conversation: (id: string) => ['ai', 'conversation', id] as const,
  adminStatus: ['ai', 'admin', 'status'] as const,
  adminSettings: ['ai', 'admin', 'settings'] as const,
  usage: (from: string, to: string) => ['ai', 'usage', from, to] as const,
};

/**
 * Whether SI Academy AI can answer this person now, and which subjects the institute approved
 * (Phase 7E). It only decides what is offered: every question is checked again by the API.
 */
export function useAiAvailability(enabled = true) {
  return useQuery({
    queryKey: AI_KEYS.availability,
    queryFn: () => api<AiAvailability>('/ai/availability'),
    enabled,
    staleTime: 60_000,
  });
}

/** The person's own conversations, most recent first: the API returns no one else's. */
export function useAiConversations(enabled = true) {
  return useQuery({
    queryKey: AI_KEYS.conversations,
    queryFn: () =>
      api<Paginated<AiConversationSummary>>(`/ai/conversations?pageSize=${HISTORY_PAGE_SIZE}`),
    enabled,
  });
}

/** A conversation's title, or what it is while it has none yet. */
export function conversationTitle(conversation: Pick<AiConversationSummary, 'title' | 'purpose'>) {
  if (conversation.title.trim()) return conversation.title;
  return conversation.purpose === 'lab_hint' ? 'Lab hint' : 'New conversation';
}

/** What a conversation is about, said beside its title; none for the workspace's own. */
export const PURPOSE_LABEL: Record<AiConversationSummary['purpose'], string | null> = {
  workspace: null,
  assistant: 'Assistant',
  lab_hint: 'Lab hint',
};
