import { describe, expect, it } from 'vitest';
import { AI_CACHE_KNOWLEDGE_VERSION, type AiCacheKeyParts, cacheKeyHash } from './cache-key.js';

const shared: AiCacheKeyParts = {
  organizationId: '0190a0e4-7c1d-7b9e-8f00-0000000000a1',
  scope: 'shared',
  userId: null,
  purpose: 'workspace',
  dataClass: 'public',
  language: 'en',
  modelFamily: 'gemini-flash',
  promptVersion: 'si-academy-7d-1',
  knowledgeVersion: AI_CACHE_KNOWLEDGE_VERSION,
  question: 'java|inheritance',
};

describe('the answer cache’s key (Phase 7D, ADR-0032)', () => {
  it('is the same for the same parts, and a SHA-256 in hex', () => {
    expect(cacheKeyHash(shared)).toBe(cacheKeyHash({ ...shared }));
    expect(cacheKeyHash(shared)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes with every part: institute, scope, person, surface, class, language, model family, prompt, knowledge, question', () => {
    const person = '0190a0e4-7c1d-7b9e-8f00-0000000000b1';
    const variants: AiCacheKeyParts[] = [
      shared,
      { ...shared, organizationId: '0190a0e4-7c1d-7b9e-8f00-0000000000a2' },
      { ...shared, scope: 'user', userId: person },
      { ...shared, scope: 'user', userId: '0190a0e4-7c1d-7b9e-8f00-0000000000b2' },
      { ...shared, purpose: 'assistant' },
      { ...shared, dataClass: 'course' },
      { ...shared, language: 'hi' },
      { ...shared, modelFamily: 'gemini-flash-lite' },
      { ...shared, promptVersion: 'si-academy-7d-2' },
      { ...shared, knowledgeVersion: 'k-2' },
      { ...shared, question: 'python|inheritance' },
    ];
    const keys = variants.map(cacheKeyHash);
    expect(new Set(keys).size).toBe(variants.length);
  });

  it('keeps a person’s entry apart from the shared one, and refuses to mix the two', () => {
    expect(() =>
      cacheKeyHash({ ...shared, userId: '0190a0e4-7c1d-7b9e-8f00-0000000000b1' }),
    ).toThrow();
    expect(() => cacheKeyHash({ ...shared, scope: 'user', userId: null })).toThrow();
  });
});
