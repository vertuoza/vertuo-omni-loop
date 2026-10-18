// A product's knowledge (PRD 1795, s4): the business read's `legal` and `glossary`, kept as the last
// read for when the page cannot be reached. The server is a stub: nothing here calls the network.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AskCallError } from '../ask/client.ts';
import { glossaryLines, knowledgeOfReply, legalLines, NOTHING_READ, PRODUCT_KNOWLEDGE_FILE, productKnowledge, readCachedKnowledge, unreachableLine } from './knowledge.ts';

const LEGAL = [{ id: 'L-INVOICING-1', statement: 'Kept ten years.', source: 'Code de commerce', owner: 'jane' }];
const GLOSSARY = [{ term: 'Credit note', meaning: 'Cancels an invoice.', avoid: [] }];
const REPLY = { product: { name: 'Invoicing' }, legal: LEGAL, glossary: GLOSSARY };
const NOW = new Date('2026-10-15T08:00:00Z');
const root = () => mkdtempSync(join(tmpdir(), 'product-knowledge-'));
const fail = (status: number | null, reason: string | null = null) => () => Promise.reject(new AskCallError('GET /api/business: failed', { status, reason }));
const message = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('it did not fail');
};

describe('knowledgeOfReply', () => {
  it('reads both lists, and [] for a server from before the page', () => {
    expect(knowledgeOfReply(REPLY, 'acme/api')).toEqual({ product: 'Invoicing', legal: LEGAL, glossary: GLOSSARY });
    expect(knowledgeOfReply({ product: { name: 'Invoicing' } }, 'acme/api')).toEqual({ product: 'Invoicing', legal: [], glossary: [] });
  });

  it('refuses a reply out of shape, and a repository of no product', () => {
    expect(() => knowledgeOfReply({ product: { name: 'P' }, legal: [{ id: 1 }] }, 'acme/api')).toThrow(/^the Omni page answered no product knowledge for acme\/api: /);
    expect(() => knowledgeOfReply({ product: null }, 'acme/api')).toThrow('acme/api belongs to no product');
  });
});

describe('productKnowledge', () => {
  it('keeps a fresh read, then prints it from the copy when the page answers 5xx or never', async () => {
    const dir = root();
    const fresh = await productKnowledge({ repo: 'acme/api', root: dir, now: () => NOW, fetchBusiness: () => Promise.resolve(REPLY) });
    expect(fresh).toEqual({ from: 'server', product: 'Invoicing', legal: LEGAL, glossary: GLOSSARY });
    expect(JSON.parse(readFileSync(join(dir, PRODUCT_KNOWLEDGE_FILE), 'utf8'))).toEqual({ product: 'Invoicing', readAt: NOW.toISOString(), legal: LEGAL, glossary: GLOSSARY });
    for (const status of [503, null]) {
      const copy = await productKnowledge({ repo: 'acme/api', root: dir, now: () => NOW, fetchBusiness: fail(status) });
      expect(copy).toEqual({ from: 'copy', readAt: NOW.toISOString(), product: 'Invoicing', legal: LEGAL, glossary: GLOSSARY });
    }
  });

  it('stops with the nothing-read line with no copy, and with the server reason on a 4xx', async () => {
    const dir = root();
    expect(await message(productKnowledge({ repo: 'acme/api', root: dir, now: () => NOW, fetchBusiness: fail(null) }))).toBe(NOTHING_READ);
    await productKnowledge({ repo: 'acme/api', root: dir, now: () => NOW, fetchBusiness: () => Promise.resolve(REPLY) });
    const refused = await message(productKnowledge({ repo: 'acme/api', root: dir, now: () => NOW, fetchBusiness: fail(403, 'not a member') }));
    expect(refused).toBe('the Omni page refused the product knowledge of acme/api (403): not a member');
  });

  it("lets an error that is not the page's through", async () => {
    expect(await message(productKnowledge({ repo: 'acme/api', root: root(), now: () => NOW, fetchBusiness: () => Promise.reject(new Error('boom')) }))).toBe('boom');
  });
});

describe('the lines', () => {
  it('prints an entry and a term on one line each', () => {
    expect(legalLines(LEGAL)).toEqual(['L-INVOICING-1  Kept ten years.  (source: Code de commerce; owner: @jane)']);
    expect(glossaryLines(GLOSSARY)).toEqual(['Credit note: Cancels an invoice.  (avoid: none)']);
    expect(unreachableLine('2026-10-15T08:00:00.000Z')).toBe('last read 2026-10-15: the Omni page is unreachable');
  });
});

describe('readCachedKnowledge (PRD 1797): the copy on disk, never the server', () => {
  it('reads absent with no copy, the copy once kept, and unreadable for a file that is not one', async () => {
    const dir = root();
    expect(readCachedKnowledge(dir)).toEqual({ state: 'absent' });
    await productKnowledge({ repo: 'acme/api', root: dir, now: () => NOW, fetchBusiness: () => Promise.resolve(REPLY) });
    expect(readCachedKnowledge(dir)).toEqual({ state: 'cached', product: 'Invoicing', readAt: NOW.toISOString(), legal: LEGAL, glossary: GLOSSARY });
    writeFileSync(join(dir, PRODUCT_KNOWLEDGE_FILE), '{ nope');
    expect(readCachedKnowledge(dir)).toEqual({ state: 'unreadable' });
    writeFileSync(join(dir, PRODUCT_KNOWLEDGE_FILE), '{"product": 3}');
    expect(readCachedKnowledge(dir)).toEqual({ state: 'unreadable' });
  });
});
