import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OutboxView } from '../../outbox-items/outbox-questions';
import type { QuestionView } from '../../questions/questions.contract';
import { EMPTY_OUTBOX, Outbox } from './Outbox';

// Work › Questions › Outbox, drawn (PRD 2011 s14): the product filter, then the product's own Questions
// rows, a product PRD's item answered in place with its options as buttons; nothing open says so.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();

const Q: QuestionView = {
  dossier: 'd-m12', prdHref: '/prd/d-m12', outboxHref: '/prd/d-m12?tab=outbox', prdLabel: 'mobile-12', title: 'Mobile · Quotes', repo: 'acme/app',
  id: 's2-01-quote-totals', rank: 'high', question: 'Round per line?', forWhom: 'waits on you',
  options: [{ letter: 'A', text: 'Per line (built).' }, { letter: 'B', text: 'On the total.' }], answerOn: 'mobile-12',
};
const view = (over: Partial<OutboxView> = {}): OutboxView => ({
  questions: [Q], open: 1, mine: 1,
  filter: { options: [{ label: 'All', href: '/ask/outbox', current: true }, { label: 'Mobile', href: '/ask/outbox?product=p', current: false }] }, ...over,
});
const render = (v: OutboxView) => renderToStaticMarkup(createElement(Outbox, { view: v }));

describe('the Outbox page', () => {
  it('draws the product filter, then each item with whom it waits on and its answer buttons', () => {
    const html = render(view());
    expect(html).toContain('aria-label="Product"');
    expect(text(html)).toContain('mobile-12 Round per line? acme/app s2-01-quote-totals waits on you Mobile · Quotes A · Per line (built). B · On the total. other… high');
    expect(html).toContain('aria-label="Answer s2-01-quote-totals"');
  });

  it('says so when no decision is open', () => {
    expect(text(render(view({ questions: [], open: 0, mine: 0 })))).toContain(EMPTY_OUTBOX);
  });

  it('draws no filter when there is none', () => {
    expect(render(view({ filter: null }))).not.toContain('aria-label="Product"');
  });
});
