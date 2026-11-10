import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { KeptVerdict } from '../../business-laws/verdicts.repository';
import { BusinessLawsVerdict } from './BusinessLawsVerdict';

// A red finding on the approve screen says what the judge found broken, under the spec's words (bug #2696).
// A verdict kept before the judge kept its why shows none. Every law and spec is fictional.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const FINDING = {
  law: 'BL-QUOTES-1', statement: 'A quote can be sent only when its total including tax is above zero.',
  why: 'A customer who receives an empty quote stops trusting the contractor.', quote: 'a template can be sent with a zero total',
  domain: 'quotes', file: '.omni-loop/knowledge/domains/quotes/business-laws.md', owners: ['ana'],
};
const JUDGED = { ...FINDING, broken: 'The design sends a quote whose total is zero.' };
const red = (finding: KeptVerdict['findings'][number]): KeptVerdict => ({
  specVersion: 'v-1', lawHome: 'acme/plan', packSha: 'c'.repeat(40), state: 'red', reason: '1 law broken',
  laws: ['BL-QUOTES-1'], domains: [], findings: [finding], judgedAt: '2026-12-01T09:00:00Z',
});
const textOf = (verdict: KeptVerdict) =>
  renderToStaticMarkup(createElement(BusinessLawsVerdict, { laws: { show: 'verdict', verdict } })).replace(/<[^>]+>/g, '');

describe('a red finding on the approve screen', () => {
  it('says what the judge found broken, right under the spec\'s words', () => {
    const text = textOf(red(JUDGED));
    expect(text).toContain('The spec says: a template can be sent with a zero totalThe judge says: The design sends a quote whose total is zero.');
  });

  it('says nothing of the judge for a verdict kept without its why', () => {
    expect(textOf(red(FINDING))).not.toContain('The judge says');
  });
});
