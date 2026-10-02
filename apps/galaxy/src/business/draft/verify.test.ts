import { describe, expect, it } from 'vitest';
import { quoted, verified, type Candidate } from './verify';

// The quote check (PRD 774, spec step 3): a candidate is kept only when its quote appears word for word
// in the text of its source, whitespace and case aside. An invented receipt is dropped, never shown.

const TEXT = `# Vertuo\n\nVertuo is the ERP   for construction\nfirms in Belgium.\n\nWe compete with Acme Build.`;

const candidate = (over: Partial<Candidate> = {}): Candidate => ({ kind: 'offering', value: 'ERP', quote: 'Vertuo is the ERP for construction firms', ...over });

describe('quoted', () => {
  it('finds a quote that is in the text word for word', () => {
    expect(quoted(TEXT, 'We compete with Acme Build.')).toBe(true);
  });

  it('lets whitespace and line breaks differ', () => {
    expect(quoted(TEXT, 'the ERP for construction firms in Belgium')).toBe(true);
  });

  it('lets case differ', () => {
    expect(quoted(TEXT, 'VERTUO IS THE erp')).toBe(true);
  });

  it('refuses a quote the text does not hold', () => {
    expect(quoted(TEXT, 'Vertuo is the CRM for construction firms')).toBe(false);
  });

  it('refuses an empty quote', () => {
    expect(quoted(TEXT, '   ')).toBe(false);
  });
});

describe('verified', () => {
  it('keeps the candidates whose quote is in the text and drops the invented ones', () => {
    const kept = candidate();
    const invented = candidate({ value: 'CRM', quote: 'Vertuo is the best CRM in France' });
    expect(verified(TEXT, [kept, invented])).toEqual([kept]);
  });

  it('drops a quote longer than a receipt holds', () => {
    const long = 'word '.repeat(80).trim();
    expect(verified(long, [candidate({ quote: long })])).toEqual([]);
  });
});
