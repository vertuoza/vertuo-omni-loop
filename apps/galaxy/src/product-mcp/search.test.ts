import { describe, expect, it } from 'vitest';
import type { KnowledgeEntry } from './product-mcp.contract';
import { rankByMeaning, searchKnowledge, type Nearness } from './search';

// The search (PRD 2707 s3): words, with no model, over a fictional product's entries.

const entry = (id: string, over: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  id, kind: 'rule', title: '', repo: null, domain: null, body: '', file: null, status: null, ...over,
});

const ENTRIES: KnowledgeEntry[] = [
  entry('widgets/ADR-0067', { kind: 'adr', repo: 'acme/widgets', domain: 'access', title: 'A bad key still connects', body: 'The client connects. Each call answers the key line.' }),
  entry('term:API key', { kind: 'term', title: 'API key', body: 'A secret a program sends.' }),
  entry('api/BR-PRODUCT-3', { repo: 'acme/api', domain: 'product', title: 'A quote shows its total.', body: 'A quote shows its total. Why: the API key holder pays.' }),
  entry('BL-QUOTES-1', { kind: 'business-law', domain: 'quotes', title: 'A quote is sent only above zero.', body: 'A quote is sent only above zero. Why: trust.' }),
  entry('L-GDPR-2', { kind: 'legal', title: 'Credentials are never stored in clear.', body: 'Credentials are never stored in clear. Source: GDPR art. 32 on the Mise à jour of keys.' }),
];

describe('searchKnowledge', () => {
  it('ranks a word in the id over one in the title, and one in the title over one in the body', () => {
    const { hits } = searchKnowledge(ENTRIES, { query: 'key' });
    expect(hits.map((hit) => hit.id)).toEqual(['term:API key', 'widgets/ADR-0067', 'L-GDPR-2', 'api/BR-PRODUCT-3']);
  });

  it('ignores case and accents', () => {
    expect(searchKnowledge(ENTRIES, { query: 'MISE A JOUR' }).hits.map((hit) => hit.id)).toEqual(['L-GDPR-2']);
    expect(searchKnowledge(ENTRIES, { query: 'crédentials' }).hits.map((hit) => hit.id)).toEqual(['L-GDPR-2']);
  });

  it('leaves out an entry missing a word of the query', () => {
    expect(searchKnowledge(ENTRIES, { query: 'api key' }).hits.map((hit) => hit.id)).toEqual(['term:API key', 'api/BR-PRODUCT-3']);
  });

  it('filters by kind, domain and repository', () => {
    expect(searchKnowledge(ENTRIES, { query: 'key', kind: 'adr' }).hits.map((hit) => hit.id)).toEqual(['widgets/ADR-0067']);
    expect(searchKnowledge(ENTRIES, { domain: 'Quotes' }).hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-1']);
    expect(searchKnowledge(ENTRIES, { repo: 'acme/api' }).hits.map((hit) => hit.id)).toEqual(['api/BR-PRODUCT-3']);
    expect(searchKnowledge(ENTRIES, { repo: 'widgets' }).hits.map((hit) => hit.id)).toEqual(['widgets/ADR-0067']);
  });

  it('with no query, lists every entry matching the filters in id order', () => {
    expect(searchKnowledge(ENTRIES, {}).hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-1', 'L-GDPR-2', 'api/BR-PRODUCT-3', 'term:API key', 'widgets/ADR-0067']);
    expect(searchKnowledge(ENTRIES, { query: '  ' }).total).toBe(5);
  });

  it('caps the hits at 20 and says how many there are', () => {
    const many = Array.from({ length: 25 }, (_, n) => entry(`BL-QUOTES-${String(n + 1).padStart(2, '0')}`, { kind: 'business-law', body: 'A quote rule.' }));
    const found = searchKnowledge(many, { query: 'quote' });
    expect(found.total).toBe(25);
    expect(found.hits).toHaveLength(20);
    expect(found.hits[0]?.id).toBe('BL-QUOTES-01');
    expect(searchKnowledge(many, { kind: 'business-law' }).hits).toHaveLength(20);
  });

  it('gives as snippet the body\'s first sentence that holds a word, within 200 characters', () => {
    const [hit] = searchKnowledge(ENTRIES, { query: 'line' }).hits;
    expect(hit).toMatchObject({ id: 'widgets/ADR-0067', snippet: 'Each call answers the key line.' });
    const long = entry('BL-LONG-1', { body: `${'word '.repeat(60)}target.` });
    expect(searchKnowledge([long], { query: 'target' }).hits[0]?.snippet).toHaveLength(200);
    expect(searchKnowledge(ENTRIES, { kind: 'term' }).hits[0]?.snippet).toBe('A secret a program sends.');
  });

  it('never carries the body whole in a hit', () => {
    const [hit] = searchKnowledge(ENTRIES, { query: 'api key' }).hits;
    expect(Object.keys(hit ?? {}).sort()).toEqual(['domain', 'id', 'kind', 'repo', 'snippet', 'title']);
  });
});

// The meaning ranking (PRD 2728 s5), over fake vectors: each entry's hash is its id, and `nearest` plays
// knowledge_nearest()'s order.
const nearness = (nearest: string[]): Nearness => ({ hashOf: (e) => `h:${e.id}`, nearest: nearest.map((id) => `h:${id}`) });
const MORE: KnowledgeEntry[] = [
  ...ENTRIES,
  entry('BL-QUOTES-2', { kind: 'business-law', domain: 'quotes', title: 'A quote names its payment term.', body: 'A quote names its payment term.' }),
  entry('acme-api/0043-retries', { kind: 'adr', repo: 'acme/api', title: 'Retries', body: 'A payment call is retried.' }),
];

describe('rankByMeaning', () => {
  it('puts the entries holding a vector in the nearest order, with mode meaning', () => {
    const answer = rankByMeaning(MORE, { query: 'can a quote go out without a term' }, nearness(['BL-QUOTES-2', 'BL-QUOTES-1', 'L-GDPR-2']));
    expect(answer.mode).toBe('meaning');
    expect(answer.hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-2', 'BL-QUOTES-1', 'L-GDPR-2']);
    expect(answer.total).toBe(3);
  });

  it('puts an exact id, then an exact term, first, whatever the vectors say', () => {
    const byId = rankByMeaning(MORE, { query: 'bl-quotes-1' }, nearness(['BL-QUOTES-2', 'BL-QUOTES-1']));
    expect(byId.hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-1', 'BL-QUOTES-2']);
    const byTerm = rankByMeaning(MORE, { query: 'Api Key' }, nearness(['L-GDPR-2', 'term:API key']));
    expect(byTerm.hits.map((hit) => hit.id).slice(0, 2)).toEqual(['term:API key', 'L-GDPR-2']);
  });

  it('puts the entries with no vector after, by their word match, leaving out those holding no word', () => {
    const answer = rankByMeaning(MORE, { query: 'payment' }, nearness(['L-GDPR-2']));
    expect(answer.hits.map((hit) => hit.id)).toEqual(['L-GDPR-2', 'BL-QUOTES-2', 'acme-api/0043-retries']);
    expect(answer.total).toBe(3);
  });

  it('applies the filters before ranking', () => {
    const answer = rankByMeaning(MORE, { query: 'quote', kind: 'business-law' }, nearness(['L-GDPR-2', 'BL-QUOTES-2', 'widgets/ADR-0067']));
    expect(answer.hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-2', 'BL-QUOTES-1']);
  });

  it('with no vector among the entries, answers the word search with mode words', () => {
    for (const nearest of [[], ['widgets/ADR-0067']]) {
      const answer = rankByMeaning(MORE, { query: 'payment', kind: 'business-law' }, nearness(nearest));
      expect(answer).toEqual({ ...searchKnowledge(MORE, { query: 'payment', kind: 'business-law' }), mode: 'words' });
    }
  });

  it('with no query, answers the listing with no mode', () => {
    const answer = rankByMeaning(MORE, { query: ' ' }, nearness(['BL-QUOTES-2']));
    expect(answer).toEqual(searchKnowledge(MORE, {}));
    expect('mode' in answer).toBe(false);
  });

  it('caps the hits at 20, total counting every entry ranked', () => {
    const many = Array.from({ length: 25 }, (_, n) => entry(`BL-QUOTES-${String(n + 1).padStart(2, '0')}`, { kind: 'business-law', body: 'A quote rule.' }));
    const answer = rankByMeaning(many, { query: 'anything' }, nearness(many.map((e) => e.id).reverse()));
    expect(answer.hits).toHaveLength(20);
    expect(answer.hits[0]?.id).toBe('BL-QUOTES-25');
    expect(answer.total).toBe(25);
  });
});
