import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OutboxPaneProduct } from './OutboxPaneProduct';
import { PRODUCT_OUTBOX_EMPTY, productOutboxView, type ProductOutboxRows, type StoredProductItem } from './outbox-product';

// A product PRD's Outbox tab (PRD 2011 s15): its items from the server's rows, open and settled; the open
// ones drawn as the Questions tab draws them, answerable in place; the settled ones with their answer.

const body = (id: string, rank: string, question: string) => `---
id: ${id}
prd: mobile-12
slice: s2
rank: ${rank}
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

${question}

## The decision, in plain words

Built it one way.

## The intro, for fun

Pennies add up.

## The punchline, for fun

So do the lines.

## The options, in plain words

A. As built.
B. The other way.

## What I had to decide

Something.

## What I did meanwhile

Built it one way.

## What it costs to change later

One function.

## What I could not know

(author) The spec says nothing.
`;

type Settled = Partial<StoredProductItem['outbox_settlements'][number]>;

const item = (id: string, rank: StoredProductItem['rank'], question: string, settled?: Settled): StoredProductItem => ({
  item: id, rank, repository: 'acme/app', body: body(id, rank, question), raised_at: '2026-10-11T10:00:00Z',
  outbox_settlements: settled === undefined ? [] : [{
    verdict: 'agreed', basis: 'stated', answer: 'A', channel: 'questions', settler_login: 'irisa', settled_at: '2026-10-12T09:00:00Z', ...settled,
  }],
});

const rows = (items: StoredProductItem[]): ProductOutboxRows => ({ dossier: 'd-m12', prdId: 'mobile-12', title: 'Quotes', items });
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const render = (input: ProductOutboxRows) => renderToStaticMarkup(createElement(OutboxPaneProduct, { outbox: productOutboxView(input) }));

describe('a product PRD’s outbox view', () => {
  it('lists the open items worst rank first, answerable on the PRD, and the settled ones apart', () => {
    const view = productOutboxView(rows([
      item('s2-01-low', 'medium', 'Low?'),
      item('s2-02-high', 'high', 'High?'),
      item('s2-03-done', 'high', 'Done?', {}),
    ]));
    expect(view.open.map((q) => q.id)).toEqual(['s2-02-high', 's2-01-low']);
    expect(view.open[0]).toMatchObject({ answerOn: 'mobile-12', prdLabel: 'mobile-12', question: 'High?', repo: 'acme/app', prdHref: '/prd/d-m12' });
    expect(view.open[0]?.options.map((o) => o.letter)).toEqual(['A', 'B']);
    expect(view.settled).toEqual([{ id: 's2-03-done', question: 'Done?', verdict: 'keeps what was built', answer: 'A', by: 'irisa', at: '2026-10-12T09:00:00Z' }]);
  });

  it('puts the latest settled first and words an adoption as adopted when raised, with no answer', () => {
    const view = productOutboxView(rows([
      item('s1-01-old', 'medium', 'Old?', { settled_at: '2026-10-11T12:00:00Z' }),
      item('s1-02-adopted', 'medium', 'Adopted?', { verdict: 'adopted', answer: null, channel: null, settled_at: '2026-10-13T12:00:00Z' }),
    ]));
    expect(view.settled.map((s) => s.id)).toEqual(['s1-02-adopted', 's1-01-old']);
    expect(view.settled[0]).toMatchObject({ verdict: 'adopted when raised', answer: null });
  });
});

describe('a product PRD’s Outbox pane', () => {
  it('draws the open item with its answer buttons and the settled one with its answer', () => {
    const html = render(rows([item('s2-02-high', 'high', 'High?'), item('s2-03-done', 'high', 'Done?', { answer: 'B, please', verdict: 'drifted' })]));
    expect(html).toContain('aria-label="Answer s2-02-high"');
    expect(text(html)).toContain('mobile-12 Done? s2-03-done irisa · 2026-10-12T09:00:00Z B, please changes what was built');
  });

  it('says so when the PRD has raised nothing', () => {
    expect(text(render(rows([])))).toBe(PRODUCT_OUTBOX_EMPTY);
  });
});
