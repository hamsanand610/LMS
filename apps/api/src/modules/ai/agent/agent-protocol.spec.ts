import { describe, expect, it } from 'vitest';
import { followUpOf, parseModelJson, routingDecisionOf } from './agent-protocol.js';

const id = '0190a0e4-7c1d-7b9e-8f00-000000000001';
const decision = { capability: 'clarify_doubt', needsKnowledge: true, needsLesson: false };

describe('what a model may write to the learning agent (Phase 9B; ADR-0039)', () => {
  it('is one JSON object, the whole reply — fenced at most', () => {
    expect(parseModelJson(JSON.stringify(decision))).toEqual(decision);
    expect(parseModelJson(`  ${JSON.stringify(decision)}\n`)).toEqual(decision);
    expect(parseModelJson('```json\n{"action":"finish"}\n```')).toEqual({ action: 'finish' });
    for (const reply of [
      'Sure! {"action":"finish"}',
      '{"action":"finish"} Done.',
      '{"action":"finish"}{"action":"finish"}',
      '[{"action":"finish"}]',
      '{"action":',
      '',
      `{"action":"finish","pad":"${'x'.repeat(2_000)}"}`,
    ]) {
      expect(parseModelJson(reply), reply.slice(0, 40)).toBeUndefined();
    }
  });

  it('routes to a capability with exactly the decision’s fields', () => {
    expect(routingDecisionOf(JSON.stringify(decision))).toEqual(decision);
    expect(
      routingDecisionOf(JSON.stringify({ ...decision, capability: 'unsupported' }))?.capability,
    ).toBe('unsupported');
    for (const bad of [
      { ...decision, capability: 'run_sql' },
      { ...decision, needsKnowledge: 'yes' },
      { capability: 'explain_lesson' },
      // Strict: an identity, a scope or a tool in the decision makes it no decision at all.
      { ...decision, learnerId: id },
      { ...decision, organizationId: id },
      { ...decision, courseId: id },
      { ...decision, tool: 'knowledge_search' },
    ]) {
      expect(routingDecisionOf(JSON.stringify(bad)), JSON.stringify(bad)).toBeNull();
    }
    expect(routingDecisionOf('{"__proto__":{"x":1},"capability":"clarify_doubt"}')).toBeNull();
  });

  it('proposes finishing, or one tool call as an envelope the registry checks', () => {
    expect(followUpOf('{"action":"finish"}')).toEqual({ action: 'finish' });
    expect(
      followUpOf('{"action":"tool","tool":"knowledge_search","arguments":{"query":"loops"}}'),
    ).toEqual({ action: 'tool', tool: 'knowledge_search', arguments: { query: 'loops' } });
    // The name and the arguments are the registry's to judge: the envelope only has their shape.
    expect(followUpOf('{"action":"tool","tool":"shell","arguments":{"cmd":"ls"}}')?.action).toBe(
      'tool',
    );
    for (const bad of [
      '{"action":"tool","tool":"knowledge_search"}',
      '{"action":"tool","tool":"knowledge_search","arguments":["loops"]}',
      '{"action":"tool","tool":"knowledge_search","arguments":null}',
      '{"action":"tool","tool":"","arguments":{}}',
      '{"action":"finish","tool":"knowledge_search"}',
      '{"action":"tools","calls":[]}',
      `{"action":"tool","tool":"${'x'.repeat(65)}","arguments":{}}`,
      '{"action":"tool","tool":"lesson_content","arguments":{},"learnerId":"x"}',
    ]) {
      expect(followUpOf(bad), bad).toBeNull();
    }
  });
});
