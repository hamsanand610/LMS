import type { AiAgentCitation, AiAgentStep, MeResponse } from '@lms/shared';
import { canUseAi } from './access';

/**
 * What the learner is told the learning agent is doing (Phase 9D): safe, fixed words for each step
 * the server announces — never a prompt, a tool, its arguments or the model's reasoning.
 */
export const AGENT_STEP_LABEL: Record<AiAgentStep, string> = {
  routing: 'Understanding your question',
  planning: 'Understanding your question',
  reading_lesson: 'Checking the lesson',
  reading_progress: 'Checking your learning progress',
  reading_lab_attempt: 'Checking your lab attempt',
  searching_knowledge: 'Searching SI Academy knowledge',
  drafting: 'Preparing the answer',
  verifying: 'Preparing the answer',
};

/** The words a verified answer's source is shown with, by what it is. */
export function sourceLabel(citation: AiAgentCitation): string {
  switch (citation.kind) {
    case 'lesson':
      return `Lesson: ${citation.title}`;
    case 'knowledge':
      return citation.heading ? `${citation.title} — ${citation.heading}` : citation.title;
    case 'learning_state':
      return citation.title;
    case 'lab_attempt':
      return citation.part === 'attempt'
        ? `Your latest failed attempt: ${citation.title}`
        : `Lab: ${citation.title}`;
  }
}

/** What the agent is pinned to on the page: a lesson, a course, a lab, or nothing in particular. */
export type AgentPlace = 'lesson' | 'course' | 'lab' | 'general';

/**
 * The questions offered before the first one (Phase 9D): one click asks. Those about the learner's
 * own progress or attempt are offered only while the institute approved them for the AI provider
 * (`learnerContext`); the API refuses them otherwise, whatever the page offers.
 */
export function agentPrompts(place: AgentPlace, learnerContext: boolean): string[] {
  const own = learnerContext;
  switch (place) {
    case 'lesson':
      return [
        'Explain this lesson',
        ...(own
          ? [
              'What should I learn next?',
              'How am I progressing?',
              'Why am I struggling with this topic?',
            ]
          : []),
      ];
    case 'course':
      return own
        ? ['What should I learn next?', 'How am I progressing?', 'What is due soon?']
        : ['What does this course cover?'];
    case 'lab':
      return own ? ['Explain my failed attempt'] : [];
    case 'general':
      return own ? ['What should I learn next?', 'How am I progressing?'] : [];
  }
}

/**
 * Whether the learning agent may be offered to this person (Phase 9D): `module.ai`, `ai.agent` and
 * `ai:agent`, and a learner's profile — staff are never offered it, whatever a role grants. The API
 * decides again on every run.
 */
export function canUseAgent(me: Pick<MeResponse, 'flags' | 'permissions' | 'person'>): boolean {
  return canUseAi(me, 'agent') && me.person.studentId !== null;
}
