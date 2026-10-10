import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  type FeatureFlag,
  type KnowledgeSourceView,
} from '@lms/shared';
import { type Session, expectStatus } from './http.js';

/**
 * Empties the institute's knowledge base, so that a spec draws only on the knowledge it makes
 * itself. Every file of a run shares one test database, in an order that changes (vitest runs the
 * files that failed last time first; `--sequence.shuffle.files` any order): another spec's
 * published passages otherwise join a spec's retrievals, crowd its own out of the top K, or pass
 * its evidence floor (10 October 2026). Through the knowledge base's own deletion route, which
 * purges each source's documents, versions, chunks, vectors and stored files. `admin` manages the
 * knowledge base and the flags (a Super Admin); the two flags the routes need are switched on for
 * it and left as they were. Another institute's knowledge is never in reach, and stays.
 */
export async function emptyKnowledgeBase(admin: Session): Promise<void> {
  const flags = expectStatus(await admin.get('/flags'), 200).body as FeatureFlag[];
  const off = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG].filter(
    (key) => flags.find((flag) => flag.key === key)?.enabled !== true,
  );
  for (const key of off) expectStatus(await admin.patch(`/flags/${key}`, { enabled: true }), 200);
  const sources = expectStatus(await admin.get('/ai/knowledge/sources'), 200)
    .body as KnowledgeSourceView[];
  for (const source of sources) {
    expectStatus(await admin.delete(`/ai/knowledge/sources/${source.id}`), 204);
  }
  for (const key of off) expectStatus(await admin.patch(`/flags/${key}`, { enabled: false }), 200);
}
