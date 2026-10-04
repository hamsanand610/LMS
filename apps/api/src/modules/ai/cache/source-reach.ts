import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { PracticeService } from '../../practice/index.js';

/** What a cached answer drew on, as each entry records it: kinds of content, by id. */
export const aiCacheSourcesSchema = z.array(
  z.object({ kind: z.enum(['question', 'course', 'lesson']), id: z.uuid() }).strict(),
);
export type AiCacheSource = z.infer<typeof aiCacheSourcesSchema>[number];

/**
 * Whether the person asking may open, now, everything a cached answer drew on (ADR-0032). It runs
 * on every hit: a cache entry is never authority — reach can be lost after the answer was kept.
 * Anything that cannot be confirmed is a no, and the answer is not reused. A lab is checked by the
 * lab drafts' own rule. Answers that drew on a course's or a lesson's material (Phase 7E) are not
 * kept at all — a conversation with a subject is never a cache candidate — so an entry naming one
 * is never reused either.
 */
@Injectable()
export class AiSourceReach {
  constructor(private readonly practice: PracticeService) {}

  async confirm(user: AuthUser, sources: unknown): Promise<boolean> {
    const parsed = aiCacheSourcesSchema.safeParse(sources);
    if (!parsed.success) return false;
    for (const source of parsed.data) {
      if (source.kind !== 'question') return false;
      try {
        await this.practice.requireReachableLab(source.id, user);
      } catch {
        return false;
      }
    }
    return true;
  }
}
