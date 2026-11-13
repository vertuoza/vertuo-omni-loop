import { describe, expect, it } from 'vitest';
import { OTHER, searchCategory, searchCategoryFor } from './search-category';
import { JEV_DECISIONS, jevEntry } from './index';

// The search category's entry (PRD omni-loop-7 s2): a Choice over the product's domains and `other`,
// the question alone as its state, and an answer outside the options keeping no category.

const TUNING = { threshold: 0.5 };
const DOMAINS = [{ key: 'quotes', name: 'Quotes' }, { key: 'crm', name: 'CRM' }];

describe('search-category', () => {
  it('asks a Choice whose options are the product\'s domains, then other', () => {
    const q = searchCategoryFor(DOMAINS).question;
    expect(q.type).toBe('choice');
    if (q.type !== 'choice') return;
    expect(q.options.map((o) => o.key)).toEqual(['quotes', 'crm', 'other']);
    expect(q.options.map((o) => o.description)).toContain('Quotes');
  });

  it('never offers other twice, even for a domain called other', () => {
    const q = searchCategoryFor([{ key: 'other', name: 'Other' }, ...DOMAINS]).question;
    if (q.type !== 'choice') throw new Error('not a choice');
    expect(q.options.map((o) => o.key)).toEqual(['quotes', 'crm', 'other']);
  });

  it('gives Jev the question alone', () => {
    expect(searchCategoryFor(DOMAINS).state({ question: 'can a quote go out with no payment term' })).toBe('can a quote go out with no payment term');
  });

  it('maps each option to itself, and refuses a key outside the options or a number', () => {
    const entry = searchCategoryFor(DOMAINS);
    for (const key of ['quotes', 'crm', OTHER]) expect(entry.value(key, TUNING)).toBe(key);
    expect(entry.value('invoicing', TUNING)).toBeNull();
    expect(entry.value('Quotes', TUNING)).toBeNull();
    expect(entry.value(0.7, TUNING)).toBeNull();
    expect(entry.show('crm')).toBe('crm');
  });

  it('is registered, listed for Settings › Jev with what it sends', () => {
    expect(jevEntry('search-category')).toBe(searchCategory);
    const row = JEV_DECISIONS.find((d) => d.name === 'search-category');
    expect(row?.title).toBeTruthy();
    expect(row?.sends).toMatch(/question/i);
    expect(row?.sends).toMatch(/domain/i);
  });
});
