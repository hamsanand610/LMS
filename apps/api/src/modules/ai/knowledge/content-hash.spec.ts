import { describe, expect, it } from 'vitest';
import { knowledgeContentHash, normaliseKnowledgeText } from './content-hash.js';

describe('knowledge content and its hash (Phase 8A)', () => {
  const text = '# Inheritance\n\nA child class extends its parent.\n';

  it('is the same hash for the same content in another form', () => {
    const forms = [
      text,
      '# Inheritance\r\n\r\nA child class extends its parent.\r\n',
      '\n\n# Inheritance   \n\nA child class extends its parent.\t\n\n\n',
      // A precomposed é and its decomposed form are one character to a reader.
    ];
    const hashes = new Set(forms.map(knowledgeContentHash));
    expect(hashes.size).toBe(1);
    expect(knowledgeContentHash('caf\u00e9')).toBe(knowledgeContentHash('cafe\u0301'));
    expect(knowledgeContentHash(text)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is another hash for any change of the words, blank lines inside included', () => {
    const base = knowledgeContentHash(text);
    expect(knowledgeContentHash('# Inheritance\n\nA child class extends its parent!')).not.toBe(
      base,
    );
    expect(knowledgeContentHash('# Inheritance\nA child class extends its parent.')).not.toBe(base);
    expect(knowledgeContentHash('# inheritance\n\nA child class extends its parent.')).not.toBe(
      base,
    );
  });

  it('keeps the text itself, and is deterministic', () => {
    expect(normaliseKnowledgeText('  indented\r\nline  \r\n')).toBe('  indented\nline');
    expect(knowledgeContentHash(text)).toBe(knowledgeContentHash(text));
    // SHA-256 of the normalised text, so the stored file's checksum and the hash agree.
    expect(knowledgeContentHash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
