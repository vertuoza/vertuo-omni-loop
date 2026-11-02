import { describe, expect, it } from 'vitest';
import { BusinessStoreError, businessReader, type BusinessRpc } from '../business-api/read';

// What `GET /api/business?repo=` reads of a product's domains (PRD 2583 s2): business_for_repo() answers
// `domains` (the product's active ones) and each term's `domains`, and the reader carries them on, whole.
// A database from before the migration sends neither, and the read stays as it was. Fictional data.

const READ = {
  state: 'none', business: { name: 'Acme' }, product: null, claims: [], personas: [], legal: [],
  glossary: [{ term: 'Credit note', meaning: 'A document that cancels an invoice.', avoid: ['refund'] }],
};

const reader = (answer: unknown) => {
  const db: BusinessRpc = { rpc: () => Promise.resolve({ data: answer, error: null }) };
  return businessReader(db);
};

describe('the business read and a product\'s domains', () => {
  it('carries the active domains and each term\'s domains, as the database answered them', async () => {
    const domains = [{ key: 'invoicing', name: 'Invoicing', meaning: 'Billing a customer.' }, { key: 'planning', name: 'Planning', meaning: 'Who works where.' }];
    const answer = { ...READ, domains, glossary: [{ ...READ.glossary[0], domains: ['invoicing', 'planning'] }, { term: 'Quote', meaning: 'A priced offer.', avoid: [], domains: [] }] };
    const read = await reader(answer).forRepo('acme/widgets');
    expect(read.domains).toEqual(domains);
    expect(read.glossary.map((t) => t.domains)).toEqual([['invoicing', 'planning'], []]);
  });

  it('reads as it did from a database before the domains: neither field is there', async () => {
    const read = await reader(READ).forRepo('acme/widgets');
    expect(read.domains).toBeUndefined();
    expect(read.glossary[0]?.domains).toBeUndefined();
    expect(read.glossary[0]?.term).toBe('Credit note');
  });

  it('still refuses a domain out of shape, or a field it does not know', async () => {
    await expect(reader({ ...READ, domains: [{ key: '', name: 'n', meaning: 'm' }] }).forRepo('acme/widgets')).rejects.toBeInstanceOf(BusinessStoreError);
    await expect(reader({ ...READ, domains: [{ key: 'a', name: 'n', meaning: 'm', owner: 'x' }] }).forRepo('acme/widgets')).rejects.toBeInstanceOf(BusinessStoreError);
  });
});
