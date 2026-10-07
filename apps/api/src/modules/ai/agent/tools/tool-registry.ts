import { Injectable } from '@nestjs/common';
import {
  AI_AGENT_TOOLS,
  AI_FEATURE_FLAGS,
  AI_MODULE_FLAG,
  type AiAgentToolName,
} from '@lms/shared';
import { AuthContextService } from '../../../../core/auth/auth-context.service.js';
import { type AuthUser, hasPermission } from '../../../../core/auth/auth-user.js';
import { ModuleStateService } from '../../../../core/registry/module-state.service.js';
import { ScopeService } from '../../../../core/scope/scope.service.js';
import { FlagsService } from '../../../settings/flags.service.js';
import { AttemptsService } from '../../../tests/index.js';
import { ModelRouter } from '../../routing/model-router.js';
import {
  type AgentTool,
  type AgentToolContext,
  AgentToolError,
  type AgentToolFailure,
  untilAborted,
} from './agent-tool.js';
import { KnowledgeSearchTool } from './knowledge-search.tool.js';
import { LabAttemptTool } from './lab-attempt.tool.js';
import { LearningStateTool } from './learning-state.tool.js';
import { LessonContentTool } from './lesson-content.tool.js';

/** A tool call as the run asks for it: a name and arguments, from the recipe or the model. */
export interface AgentToolCall {
  tool: string;
  arguments: unknown;
}

/** How a tool call ended: its checked output, or why there is none. Never its arguments. */
export type AgentToolOutcome =
  | { ok: true; tool: AiAgentToolName; output: object; durationMs: number }
  | {
      ok: false;
      tool: AiAgentToolName | null;
      failure: AgentToolFailure;
      code: string;
      durationMs: number;
    };

/** What the model is told of a tool: its name, what it does and its arguments. */
export interface AgentToolDescription {
  name: AiAgentToolName;
  description: string;
  arguments: string;
}

/**
 * The learning agent's tools (Roadmap Phase 9B; ADR-0039, ADR-0040): an allow-list of four — the
 * lesson, the knowledge base, and since Phase 9C the learner's own learning state and lab attempt —
 * and the only way any tool is run. Each call, whoever asked for it:
 *
 * 1. names a tool on the list — any other name is refused, never looked up anywhere else;
 * 2. carries exactly that tool's arguments, by its strict schema — an extra field (a learner, an
 *    institute, a course, a scope) refuses the call;
 * 3. is authorized again, now, for the run's pinned learner as they are now: still that learner,
 *    still `ai:agent` and the tool's own permissions (read afresh), `module.ai`, `ai.agent` and the
 *    tool's modules on for them, no timed test open, and the tool's data class approved for the
 *    provider; a tool switched off (its flags) is unavailable;
 * 4. runs within its own deadline and the run's, and stops when either ends;
 * 5. returns exactly its declared output, within its size — else nothing of it is used.
 *
 * Tools only read. The registry records how each call ended for the run's audit entry; it never
 * records arguments or output.
 */
@Injectable()
export class AgentToolRegistry {
  private readonly tools: ReadonlyMap<AiAgentToolName, AgentTool>;

  constructor(
    knowledge: KnowledgeSearchTool,
    lesson: LessonContentTool,
    state: LearningStateTool,
    lab: LabAttemptTool,
    private readonly authContext: AuthContextService,
    private readonly scope: ScopeService,
    private readonly flags: FlagsService,
    private readonly modules: ModuleStateService,
    private readonly attempts: AttemptsService,
    private readonly router: ModelRouter,
  ) {
    const tools = [knowledge, lesson, state, lab] as AgentTool[];
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
    // The allow-list is the registry: exactly the tools the contract names, each read-only.
    const names = [...this.tools.keys()].sort();
    if (
      names.join() !== [...AI_AGENT_TOOLS].sort().join() ||
      tools.some((tool) => tool.mutates !== false || tool.availableInTimedTest !== false)
    ) {
      throw new Error('The learning agent may only have its four read-only tools');
    }
  }

  /** The tools, as the model is told of them. */
  descriptions(): AgentToolDescription[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      arguments: tool.argumentsHint,
    }));
  }

  /** A call, checked, authorized, run and its output checked (above). */
  async execute(
    context: AgentToolContext,
    call: AgentToolCall,
    signal: AbortSignal,
    budgetMs = Number.POSITIVE_INFINITY,
  ): Promise<AgentToolOutcome> {
    const started = performance.now();
    const failed = (
      tool: AiAgentToolName | null,
      failure: AgentToolFailure,
      code: string = failure,
    ): AgentToolOutcome => ({
      ok: false,
      tool,
      failure,
      code,
      durationMs: Math.round(performance.now() - started),
    });

    const tool = this.toolNamed(call.tool);
    if (!tool) return failed(null, 'unknown_tool');
    const input = tool.input.safeParse(call.arguments);
    if (!input.success) return failed(tool.name, 'invalid_arguments');
    if (signal.aborted) return failed(tool.name, 'cancelled');

    let user: AuthUser;
    try {
      const refusal = await this.authorize(context, tool);
      if ('failure' in refusal) return failed(tool.name, refusal.failure, refusal.code);
      user = refusal.user;
    } catch {
      // Whether they may cannot be read: they may not.
      return failed(tool.name, 'forbidden', 'unverifiable');
    }

    const deadline = AbortSignal.timeout(Math.max(1, Math.min(tool.timeoutMs, budgetMs)));
    const callSignal = AbortSignal.any([signal, deadline]);
    try {
      const output = await untilAborted(
        tool.run(Object.freeze({ ...context, user }), input.data, callSignal),
        callSignal,
      );
      const checked = tool.output.safeParse(output);
      if (!checked.success || tool.characters(checked.data) > tool.maxOutputCharacters) {
        return failed(tool.name, 'invalid_output');
      }
      return {
        ok: true,
        tool: tool.name,
        output: checked.data,
        durationMs: Math.round(performance.now() - started),
      };
    } catch (error) {
      if (signal.aborted) return failed(tool.name, 'cancelled');
      if (deadline.aborted) return failed(tool.name, 'timeout');
      if (error instanceof AgentToolError) return failed(tool.name, error.failure, error.code);
      return failed(tool.name, 'failed', 'internal');
    }
  }

  /** The tool of that name on the allow-list, or none: nothing else is ever looked up. */
  private toolNamed(name: string): AgentTool | null {
    return (AI_AGENT_TOOLS as readonly string[]).includes(name)
      ? (this.tools.get(name as AiAgentToolName) ?? null)
      : null;
  }

  /**
   * Whether the run's learner may have this tool now, decided afresh: their permissions as they are
   * now (not as the request found them), their learner profile, the flags, the modules, a timed test.
   */
  private async authorize(
    context: AgentToolContext,
    tool: AgentTool,
  ): Promise<{ user: AuthUser } | { failure: AgentToolFailure; code: string }> {
    const forbidden = (code: string) => ({ failure: 'forbidden' as const, code });
    const loaded = await this.authContext.load(context.user.id);
    if (
      !loaded ||
      loaded.status !== 'active' ||
      loaded.organizationId !== context.user.organizationId
    ) {
      return forbidden('not_active');
    }
    const user: AuthUser = { ...loaded, sessionId: context.user.sessionId };
    const person = await this.scope.personFor(user.id);
    if (!person.studentId || person.studentId !== context.studentId)
      return forbidden('not_learner');
    for (const permission of ['ai:agent', ...tool.permissions]) {
      if (!hasPermission(user, permission)) return forbidden('permission');
    }
    const flags = await this.flags.effectiveFor(user);
    if (flags[AI_MODULE_FLAG] !== true || flags[AI_FEATURE_FLAGS.agent] !== true) {
      return forbidden('agent_off');
    }
    for (const key of ['ai', ...tool.modules]) {
      if (!(await this.modules.isEnabledFor(key, user))) return forbidden('module_off');
    }
    // No AI during a timed test (ADR-0031), however the run began.
    if (await this.attempts.hasOpenAttempt(user.id)) return forbidden('timed_test');
    if (!this.router.approvedDataClasses().includes(tool.dataClass)) {
      return { failure: 'unavailable', code: 'data_not_approved' };
    }
    if (tool.availableWith.some((flag) => flags[flag] !== true)) {
      return { failure: 'unavailable', code: 'switched_off' };
    }
    return { user };
  }
}
