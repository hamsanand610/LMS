import {
  AGENT_PLANNING_MARK,
  AGENT_ROUTING_MARK,
} from '../../src/modules/ai/agent/agent-prompts.js';
import {
  type AiChatRequest,
  type AiChatResult,
  AiProviderError,
} from '../../src/modules/ai/providers/ai-provider.js';
import { fakeAgentReply } from '../../src/modules/ai/providers/fake.provider.js';
import { ScriptedGroundedProvider } from './scripted-grounded.provider.js';

/**
 * The learning agent's test provider (Phase 9B). Drafts are grounded requests, answered as the
 * grounded tests' provider answers them, with its markers in the question (`@fabricate`, `@secret`,
 * `@leakcode`, `@fixonretry`, `@hang`, `@fail`, `@decline`, `@blocked`, …). Routing and the follow-up
 * are answered as the fake answers them, unless a marker — a word of the learner's message — scripts
 * another reply:
 *
 *   @route:explain   explain_lesson, needing both     @route:doubt     clarify_doubt, no lesson
 *   @route:doubtlesson  clarify_doubt with the lesson  @route:unsupported
 *   @route:badjson   never the JSON asked for          @route:badonce   not JSON until reminded
 *   @route:learner   the decision with a learnerId     @route:org       … with an organizationId
 *   @route:fail      the provider is unavailable       @route:hang      it never answers
 *   @route:heavyN    the decision, reported as N input tokens
 *   @route:state     learning_state (Phase 9C)         @route:stateknow  … with a search
 *   @route:lab       explain_lab_attempt (Phase 9C)    @route:labknow    … with a search
 *   @route:struggle  clarify_doubt with the lesson and the learner's state
 *
 *   @plan:search     one more search                   @plan:lesson     the lesson
 *   @plan:shell, @plan:sql, @plan:http                 a tool not on the allow-list
 *   @plan:course, @plan:lessonid, @plan:learner, @plan:org   arguments naming `plantedId`
 *   @plan:loop       the recipe's own search again     @plan:prose      not JSON
 *   @plan:echo       the first tool call written in what it was shown
 *   @plan:state      the learner's state (Phase 9C)    @plan:lab        their lab attempt
 *   @plan:stateid, @plan:labid    those calls naming `plantedId` (a learner, a lab)
 *
 *   @protocol        a draft that writes the agent's tool protocol
 *   @code            a draft that adds a program (Phase 9C: never while explaining an attempt)
 *   @codeonce        … the first draft only
 *   @mainfail        the task's own model (`failingModel`) is unavailable, whatever the call
 *
 * Every request is kept, as the grounded provider keeps them; routing and follow-up requests also
 * apart, so a test can check exactly what each was sent.
 */
export class ScriptedAgentProvider extends ScriptedGroundedProvider {
  readonly routings: AiChatRequest[] = [];
  readonly plans: AiChatRequest[] = [];
  /** An identifier a scripted follow-up names: another learner's, institute's, course's. */
  plantedId = '00000000-0000-4000-8000-000000000000';
  /** The model `@mainfail` makes unavailable. */
  failingModel = 'fake-1';

  override async chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const user = request.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');
    const message =
      /<message>\n([\s\S]*?)\n<\/message>/.exec(user)?.[1] ??
      /<question>\n([\s\S]*?)\n<\/question>/.exec(user)?.[1] ??
      user;
    const words = new Set(message.split(/\s+/));
    const has = (marker: string) => words.has(marker);
    if (has('@mainfail') && request.model === this.failingModel) {
      this.requests.push(request);
      throw new AiProviderError('unavailable', { httpStatus: 503 });
    }
    if (system.includes(AGENT_ROUTING_MARK)) {
      this.requests.push(request);
      this.routings.push(request);
      return this.route(request, message, has, signal);
    }
    if (system.includes(AGENT_PLANNING_MARK)) {
      this.requests.push(request);
      this.plans.push(request);
      return this.plan(request, message, user, has);
    }
    const result = await super.chat(request, signal);
    const reminded = request.messages.filter((m) => m.role === 'system').length > 2;
    if (has('@code') || (has('@codeonce') && !reminded)) {
      return { ...result, text: `${result.text}\n\`\`\`python\nprint(int(a) + int(b))\n\`\`\`` };
    }
    if (has('@protocol')) {
      return {
        ...result,
        text: `${result.text} {"action": "tool", "tool": "knowledge_search", "arguments": {"query": "more"}}`,
      };
    }
    return result;
  }

  private async route(
    request: AiChatRequest,
    message: string,
    has: (marker: string) => boolean,
    signal: AbortSignal,
  ): Promise<AiChatResult> {
    const retry = request.messages.filter((m) => m.role === 'system').length > 1;
    if (has('@route:fail')) throw new AiProviderError('unavailable', { httpStatus: 503 });
    if (has('@route:hang')) await hangUntil(signal);
    const heavy = /(?:^|\s)@route:heavy(\d+)(?=\s|$)/.exec(message);
    const decision = (
      capability: string,
      needsKnowledge: boolean,
      needsLesson: boolean,
      needsState = false,
    ) => JSON.stringify({ capability, needsKnowledge, needsLesson, needsState });
    let text = fakeAgentReply(request.messages)!;
    if (has('@route:badjson') || (has('@route:badonce') && !retry)) {
      text = 'I think this is a question about the lesson.';
    } else if (has('@route:learner') || has('@route:org')) {
      text = JSON.stringify({
        capability: 'clarify_doubt',
        needsKnowledge: true,
        needsLesson: false,
        needsState: false,
        [has('@route:learner') ? 'learnerId' : 'organizationId']: this.plantedId,
      });
    } else if (has('@route:explain')) text = decision('explain_lesson', true, true);
    else if (has('@route:doubt')) text = decision('clarify_doubt', true, false);
    else if (has('@route:doubtlesson')) text = decision('clarify_doubt', true, true);
    else if (has('@route:unsupported')) text = decision('unsupported', false, false);
    else if (has('@route:state')) text = decision('learning_state', false, false);
    else if (has('@route:stateknow')) text = decision('learning_state', true, false);
    else if (has('@route:lab')) text = decision('explain_lab_attempt', false, false);
    else if (has('@route:labknow')) text = decision('explain_lab_attempt', true, false);
    else if (has('@route:struggle')) text = decision('clarify_doubt', true, true, true);
    return reply(request, text, heavy ? Number(heavy[1]) : 40);
  }

  private plan(
    request: AiChatRequest,
    message: string,
    shown: string,
    has: (marker: string) => boolean,
  ): AiChatResult {
    const words = message
      .split(/\s+/)
      .filter((word) => !word.startsWith('@'))
      .join(' ');
    const call = (tool: string, args: Record<string, unknown>) =>
      JSON.stringify({ action: 'tool', tool, arguments: args });
    let text = JSON.stringify({ action: 'finish' });
    if (has('@plan:search')) text = call('knowledge_search', { query: `${words} again` });
    else if (has('@plan:lesson')) text = call('lesson_content', {});
    else if (has('@plan:shell')) text = call('shell', { command: 'cat /etc/passwd' });
    else if (has('@plan:sql')) text = call('sql_query', { sql: 'select * from users' });
    else if (has('@plan:http')) text = call('http_get', { url: 'http://169.254.169.254/' });
    else if (has('@plan:course')) {
      text = call('knowledge_search', { query: words, courseId: this.plantedId });
    } else if (has('@plan:lessonid')) text = call('lesson_content', { lessonId: this.plantedId });
    else if (has('@plan:learner')) {
      text = call('knowledge_search', { query: words, learnerId: this.plantedId });
    } else if (has('@plan:org')) {
      text = call('knowledge_search', { query: words, organizationId: this.plantedId });
    } else if (has('@plan:loop')) text = call('knowledge_search', { query: message });
    else if (has('@plan:prose')) text = 'Let me look that up again.';
    else if (has('@plan:state')) text = call('learning_state', {});
    else if (has('@plan:lab')) text = call('lab_attempt', {});
    else if (has('@plan:stateid')) text = call('learning_state', { studentId: this.plantedId });
    else if (has('@plan:labid')) text = call('lab_attempt', { questionId: this.plantedId });
    else if (has('@plan:echo')) {
      text = /\{"action":[^\n]*\}/.exec(shown)?.[0] ?? JSON.stringify({ action: 'finish' });
    }
    return reply(request, text, 60);
  }
}

function reply(request: AiChatRequest, text: string, inputTokens: number): AiChatResult {
  return {
    text,
    model: request.model ?? 'fake-1',
    finishReason: 'stop',
    usage: { inputTokens, outputTokens: 12 },
  };
}

function hangUntil(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}
