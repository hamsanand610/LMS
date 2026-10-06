import { AI_AGENT_ROUTES } from '@lms/shared';
import { z } from 'zod';

/**
 * What a model may write to the learning agent (Roadmap Phase 9B; ADR-0039): JSON, in one of two
 * strict shapes, and nothing else. The provider contract has no tool calling, so a model proposes;
 * the server validates — here, then in the tool registry — and only the server ever runs a tool.
 * Strict: a field the shape does not name (an identity, a course, a scope) makes the whole reply
 * invalid, never a field that is ignored.
 */

/** The routing decision: a capability for the message, and what it would need. */
export const routingDecisionSchema = z
  .object({
    capability: z.enum(AI_AGENT_ROUTES),
    needsKnowledge: z.boolean(),
    needsLesson: z.boolean(),
  })
  .strict();
export type RoutingDecision = z.infer<typeof routingDecisionSchema>;

/**
 * The follow-up round's proposal: finish, or one more tool call. Only its envelope is checked here
 * (`{"action","tool","arguments"}`); the tool registry checks the tool's name against its allow-list
 * and the arguments against that tool's own strict schema.
 */
export const followUpSchema = z.union([
  z.object({ action: z.literal('finish') }).strict(),
  z
    .object({
      action: z.literal('tool'),
      tool: z.string().min(1).max(64),
      arguments: z.record(z.string(), z.unknown()),
    })
    .strict(),
]);
export type FollowUp = z.infer<typeof followUpSchema>;

/** The longest reply read as JSON: a routing decision or a proposal is a few hundred characters. */
const MAX_JSON_CHARACTERS = 2_000;

/**
 * A model's reply as the one JSON object it must be — the whole reply, or one ```json block that is
 * the whole reply — or undefined. Anything around the object, a second object, or prose with an
 * object inside it is not the reply asked for.
 */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?[ \t]*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  const body = (fenced ? fenced[1]! : trimmed).trim();
  if (body.length > MAX_JSON_CHARACTERS || !body.startsWith('{') || !body.endsWith('}')) {
    return undefined;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

/** The reply as a routing decision, or null when it is not exactly one. */
export function routingDecisionOf(text: string): RoutingDecision | null {
  const parsed = routingDecisionSchema.safeParse(parseModelJson(text));
  return parsed.success ? parsed.data : null;
}

/** The reply as a follow-up proposal, or null when it is not exactly one. */
export function followUpOf(text: string): FollowUp | null {
  const parsed = followUpSchema.safeParse(parseModelJson(text));
  return parsed.success ? parsed.data : null;
}
