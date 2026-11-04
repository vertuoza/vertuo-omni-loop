// The law home of the business read (PRD 2632, s2): `lawHome` is the repository its product's business laws
// live in. A reply without the key, or with one out of shape, reads as none, and the copy keeps what the server said.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { knowledgeOfReply, productKnowledge, PRODUCT_KNOWLEDGE_FILE, readCachedKnowledge } from './knowledge.ts';

const BASE = { product: { name: 'Builder' }, legal: [], glossary: [] };

describe('the law home of a reply', () => {
  it('is the repository the reply names, in lower case', () => {
    expect(knowledgeOfReply({ ...BASE, lawHome: 'Acme/Plan' }, 'acme/api').lawHome).toBe('acme/plan');
  });

  it.each([
    ['no key (an older server)', {}],
    ['null (no home)', { lawHome: null }],
    ['an empty word', { lawHome: '' }],
    ['a value out of shape', { lawHome: 7 }],
  ])('is none for %s', (_, extra) => {
    expect(knowledgeOfReply({ ...BASE, ...extra }, 'acme/api').lawHome).toBeUndefined();
  });
});

describe('the law home of the copy', () => {
  it('is kept with the read, and a copy from before it still reads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'law-home-'));
    const now = () => new Date('2026-11-04T08:00:00Z');
    await productKnowledge({ repo: 'acme/api', root, now, fetchBusiness: () => Promise.resolve({ ...BASE, lawHome: 'acme/plan' }) });
    expect(readFileSync(join(root, PRODUCT_KNOWLEDGE_FILE), 'utf8')).toContain('"lawHome": "acme/plan"');
    expect(readCachedKnowledge(root)).toMatchObject({ state: 'cached', lawHome: 'acme/plan' });
    await productKnowledge({ repo: 'acme/api', root, now, fetchBusiness: () => Promise.resolve(BASE) });
    expect(readCachedKnowledge(root)).toMatchObject({ state: 'cached' });
    expect(readCachedKnowledge(root)).not.toHaveProperty('lawHome');
  });
});
