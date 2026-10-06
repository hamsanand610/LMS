import { Inject, Injectable } from '@nestjs/common';
import { AI_ERROR_CODES, AI_KNOWLEDGE_FLAG, KNOWLEDGE_ERROR_CODES } from '@lms/shared';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../../../core/config/env.js';
import { AppError } from '../../../../core/http/errors.js';
import { AiQuotaExceededError } from '../../ai-errors.js';
import { evidenceFloorFor, packEvidence } from '../../knowledge/answers/evidence.js';
import { activeEmbeddingContract } from '../../knowledge/embedding/contract.js';
import { KnowledgeRetrievalService } from '../../knowledge/retrieval/retrieval.service.js';
import { ModelRouter } from '../../routing/model-router.js';
import { AGENT_LIMITS } from '../agent-limits.js';
import { agentCredentialsIn } from '../protected-content.js';
import { type AgentTool, type AgentToolContext, AgentToolError } from './agent-tool.js';

/** A search query, and nothing else: no learner, institute, course, lesson, scope or size. */
const knowledgeSearchInputSchema = z
  .object({
    query: z.string().trim().min(3).max(1000),
  })
  .strict();
export type KnowledgeSearchInput = z.infer<typeof knowledgeSearchInputSchema>;

const uuid = z.uuid();
const knowledgePassageSchema = z
  .object({
    chunkId: uuid,
    sourceId: uuid,
    sourceName: z.string(),
    documentId: uuid,
    versionId: uuid,
    title: z.string(),
    heading: z.string(),
    position: z.number().int().min(0),
    courseId: uuid.nullable(),
    lessonId: uuid.nullable(),
    similarity: z.number().min(-1).max(1),
    dataClass: z.enum(['public', 'course']),
    content: z.string(),
  })
  .strict();
export type KnowledgePassage = z.infer<typeof knowledgePassageSchema>;

const knowledgeSearchOutputSchema = z
  .object({
    /** Passages retrieval returned for the learner. */
    retrieved: z.number().int().min(0),
    /** Those kept as evidence, best first, at most six and 12,000 characters. */
    passages: z.array(knowledgePassageSchema).max(AGENT_LIMITS.searchTopK),
    /** Passages not kept: below the floor, a class not approved, a credential, past the bounds. */
    withheld: z.number().int().min(0),
  })
  .strict();
export type KnowledgeSearchOutput = z.infer<typeof knowledgeSearchOutputSchema>;

/**
 * `knowledge_search` (Roadmap Phase 9B; ADR-0039): the knowledge base, searched for the learner by
 * `KnowledgeRetrievalService` — the one authority on what they may draw on (Phase 8D), with every
 * rule of its own: the flags, the institute, published sources, current versions, the reach rule
 * (`courses:read` and the Courses module for course material), a credential in the query refused,
 * the allowance and the budget, its records. The run's pinned course or lesson is the search's
 * context; the model gives the words and nothing else. Of what retrieval returns, only evidence is
 * kept, by Phase 8E's own rule (`packEvidence`: the measured floor, approved data classes, no
 * credential, six passages and 12,000 characters at most) and the agent's credential patterns.
 */
@Injectable()
export class KnowledgeSearchTool implements AgentTool<KnowledgeSearchInput, KnowledgeSearchOutput> {
  readonly name = 'knowledge_search' as const;
  readonly description =
    "Searches SI Academy's knowledge base, within what the learner may draw on.";
  readonly argumentsHint = '{"query": "<a short search query>"}';
  readonly input = knowledgeSearchInputSchema;
  readonly output = knowledgeSearchOutputSchema;
  readonly dataClass = 'course' as const;
  readonly permissions = [] as const;
  readonly modules = [] as const;
  readonly availableWith = [AI_KNOWLEDGE_FLAG] as const;
  readonly timeoutMs = AGENT_LIMITS.knowledgeSearchMs;
  readonly maxOutputCharacters = AGENT_LIMITS.evidenceCharacters;
  readonly availableInTimedTest = false as const;
  readonly mutates = false as const;

  constructor(
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly router: ModelRouter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  characters(output: KnowledgeSearchOutput): number {
    return output.passages.reduce((sum, passage) => sum + passage.content.length, 0);
  }

  async run(
    context: AgentToolContext,
    input: KnowledgeSearchInput,
    signal: AbortSignal,
  ): Promise<KnowledgeSearchOutput> {
    // Without a floor measured for the embedding model, nothing tells evidence from noise (8E).
    const floor = evidenceFloorFor(
      activeEmbeddingContract(this.router)?.model ?? null,
      this.config.AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY,
    );
    if (floor === null) throw new AgentToolError('unavailable', 'not_calibrated');
    let retrieval;
    try {
      retrieval = await this.retrieval.retrieve(
        context.user,
        {
          query: input.query,
          topK: AGENT_LIMITS.searchTopK,
          // The run's lesson brings its course; a course alone, its own material.
          ...(context.lessonId
            ? { lessonId: context.lessonId }
            : context.courseId
              ? { courseId: context.courseId }
              : {}),
        },
        signal,
      );
    } catch (error) {
      throw toolErrorOf(error);
    }
    const evidence = packEvidence(retrieval.results, {
      floor,
      approved: this.router.approvedDataClasses(),
    });
    // Public and course material only (retrieval draws on nothing else), and no credential.
    const passages = evidence.packed.filter(
      (passage) =>
        (passage.result.source.dataClass === 'public' ||
          passage.result.source.dataClass === 'course') &&
        agentCredentialsIn(
          [passage.source, passage.document, passage.heading, passage.content].join('\n'),
        ).length === 0,
    );
    const withheld =
      evidence.withheld.belowFloor +
      evidence.withheld.unapproved +
      evidence.withheld.restricted +
      evidence.withheld.overBudget +
      (evidence.packed.length - passages.length);
    return {
      retrieved: retrieval.results.length,
      withheld,
      passages: passages.map(({ result }) => ({
        chunkId: result.chunkId,
        sourceId: result.source.id,
        sourceName: result.source.name,
        documentId: result.document.id,
        versionId: result.version.id,
        title: result.document.title,
        heading: result.heading,
        position: result.position,
        courseId: result.source.courseId,
        lessonId: result.document.lessonId,
        similarity: result.similarity,
        dataClass: result.source.dataClass as 'public' | 'course',
        content: result.content,
      })),
    };
  }
}

/** Retrieval's refusals and failures, in the registry's terms. */
function toolErrorOf(error: unknown): unknown {
  if (error instanceof AiQuotaExceededError) {
    return new AgentToolError('quota', `quota_${error.limit}`);
  }
  if (!(error instanceof AppError)) return error;
  switch (error.code) {
    case KNOWLEDGE_ERROR_CODES.RETRIEVAL_FORBIDDEN:
      return new AgentToolError('forbidden', 'context_forbidden');
    case AI_ERROR_CODES.NOT_ALLOWED:
      return new AgentToolError('forbidden', 'timed_test');
    case AI_ERROR_CODES.FEATURE_DISABLED:
      return new AgentToolError('unavailable', 'knowledge_off');
    case AI_ERROR_CODES.DATA_NOT_APPROVED:
      return new AgentToolError('unavailable', 'data_not_approved');
    case AI_ERROR_CODES.RESTRICTED_CONTENT:
      return new AgentToolError('restricted', 'restricted_query');
    case KNOWLEDGE_ERROR_CODES.RETRIEVAL_TIMEOUT:
      return new AgentToolError('timeout', 'retrieval_timeout');
    case KNOWLEDGE_ERROR_CODES.RETRIEVAL_UNAVAILABLE:
      return new AgentToolError('unavailable', 'retrieval_unavailable');
    default:
      return new AgentToolError(
        'failed',
        error.status === 422 ? 'invalid_query' : 'retrieval_failed',
      );
  }
}
