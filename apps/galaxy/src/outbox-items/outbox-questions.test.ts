import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { outboxViewOf, type OutboxRows } from './outbox-questions';
import type { StoredItemPrd, StoredOpenItem } from './outbox-questions.repository';

// Work › Questions › Outbox's rows (PRD 2011 s14): every open item of every product, the viewer's first,
// the worst rank first inside each group, each saying whom it waits on and its product, narrowed by
// `?product=`. A settled item is not listed.

const body = (id: string, prd: string, rank: string, question: string) => `---
id: ${id}
prd: ${prd}
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

const MOBILE = '11111111-1111-4111-8111-111111111111';
const OMNI = '22222222-2222-4222-8222-222222222222';
const ME = 'u-me';
const PAUL = 'u-paul';

const item = (dossier: string, id: string, rank: StoredOpenItem['rank'], over: Partial<StoredOpenItem> = {}): StoredOpenItem => ({
  dossier_id: dossier, item: id, rank, repository: 'acme/app', body: body(id, dossier === 'd-m12' ? 'mobile-12' : 'omni-7', rank, `Question of ${id}?`),
  outbox_settlements: [], ...over,
});
const prd = (id: string, over: Partial<StoredItemPrd>): StoredItemPrd =>
  ({ id, title: 'A PRD', workspace_id: 'w', product_id: null, product_seq: null, opened_by: null, ...over });

const ROWS: OutboxRows = {
  me: ME,
  items: [
    item('d-m12', 's2-01-medium-mine', 'medium'),
    item('d-m12', 's2-02-high-mine', 'high'),
    item('d-o7', 's2-01-high-paul', 'high'),
    item('d-o7', 's2-02-act', 'human-action'),
    item('d-m12', 's2-03-settled', 'high', { outbox_settlements: [{ id: 'x' }] }),
    item('d-none', 's1-01-no-product', 'medium'),
  ],
  prds: [
    prd('d-m12', { title: 'Quotes', product_id: MOBILE, product_seq: 12, opened_by: ME }),
    prd('d-o7', { title: 'Outbox', product_id: OMNI, product_seq: 7, opened_by: PAUL }),
    prd('d-none', { title: 'Loose', opened_by: null }),
  ],
  products: [{ id: MOBILE, name: 'Mobile', key: 'mobile' }, { id: OMNI, name: 'Omni', key: 'omni' }],
  authors: [{ user_id: PAUL, github_login: 'paul' }],
  repoPrds: [], repoWaiting: [], repoLinks: [],
};

// PRD 2124: repository PRDs' waiting items, from prd_outbox, join the list.
const REPO = 'acme/api';
const WITH_REPO: OutboxRows = {
  ...ROWS,
  repoPrds: [
    { id: 'd-r912', title: 'Rounding', workspace_id: 'w', home_repo: 'Acme/API', prd: parsePrd(912), opened_by: ME },
    { id: 'd-r5', title: 'Loose repo PRD', workspace_id: 'w', home_repo: 'acme/other', prd: parsePrd(5), opened_by: PAUL },
  ],
  repoWaiting: [
    { workspace_id: 'w', repository: REPO, prd: parsePrd(912), waiting: [{ id: 's1-01-round', rank: 'high', question: 'Round up?' }], synced_at: '2026-10-16T14:05:30Z' },
    { workspace_id: 'w', repository: 'acme/other', prd: parsePrd(5), waiting: [{ id: 's1-01-act', rank: 'human-action', question: 'Grant access?' }], synced_at: '2026-10-16T14:00:00Z' },
    { workspace_id: 'w', repository: 'acme/ghost', prd: parsePrd(9), waiting: [{ id: 's1-01-x', rank: 'high', question: 'No dossier?' }], synced_at: '2026-10-16T14:00:00Z' },
  ],
  repoLinks: [{ product_id: OMNI, workspace_id: 'w', repository: REPO }],
};

describe('the Outbox rows with repository PRDs', () => {
  it('list a repository PRD\'s waiting item beside the product items, the viewer\'s first, with its link and as-of time', () => {
    const view = outboxViewOf(WITH_REPO);
    expect(view.questions.map((q) => q.id)).toEqual(['s1-01-round', 's2-02-high-mine', 's2-01-medium-mine', 's1-01-act', 's2-02-act', 's2-01-high-paul', 's1-01-no-product']);
    const repo = view.questions[0];
    expect(repo).toMatchObject({
      title: 'Omni · Rounding', prdLabel: '912', rank: 'high', question: 'Round up?', answerOn: null, outboxHref: '/prd/d-r912?tab=outbox',
      forWhom: 'waits on you · as of 2026-10-16 14:05 UTC',
    });
    expect(view.questions.find((q) => q.id === 's2-02-high-mine')?.forWhom).toBe('waits on you');
    expect(view.open).toBe(7);
    expect(view.mine).toBe(3);
  });

  it('skip a stored outbox whose PRD has no dossier here', () => {
    expect(outboxViewOf(WITH_REPO).questions.map((q) => q.id)).not.toContain('s1-01-x');
  });

  it('narrow both sources by product, and list the repositories in no product under No product', () => {
    expect(outboxViewOf(WITH_REPO, { product: OMNI }).questions.map((q) => q.id)).toEqual(['s1-01-round', 's2-02-act', 's2-01-high-paul']);
    expect(outboxViewOf(WITH_REPO, { product: MOBILE }).questions.map((q) => q.id)).toEqual(['s2-02-high-mine', 's2-01-medium-mine']);
    expect(outboxViewOf(WITH_REPO, { product: 'none' }).questions.map((q) => q.id)).toEqual(['s1-01-act', 's1-01-no-product']);
  });
});

describe('the Outbox rows', () => {
  it('list every open item, the viewer\'s first, the worst rank first inside each group', () => {
    const view = outboxViewOf(ROWS);
    expect(view.questions.map((q) => q.id)).toEqual(['s2-02-high-mine', 's2-01-medium-mine', 's2-02-act', 's2-01-high-paul', 's1-01-no-product']);
    expect(view.questions.map((q) => q.forWhom)).toEqual([
      'waits on you', 'waits on you', 'waits on a person who can do it', 'waits on paul', 'waits on its author',
    ]);
    expect(view.open).toBe(5);
    expect(view.mine).toBe(2);
  });

  it('never list a settled item', () => {
    expect(outboxViewOf(ROWS).questions.map((q) => q.id)).not.toContain('s2-03-settled');
  });

  it('name the product in the PRD\'s title, and answer a product PRD\'s item in place', () => {
    const [first, , , third] = outboxViewOf(ROWS).questions;
    expect(first).toMatchObject({ title: 'Mobile · Quotes', prdLabel: 'mobile-12', answerOn: 'mobile-12', question: 'Question of s2-02-high-mine?' });
    expect(first?.options.map((o) => o.letter)).toEqual(['A', 'B']);
    expect(third).toMatchObject({ title: 'Omni · Outbox', answerOn: 'omni-7' });
  });

  it('leave a PRD with no product key to its Outbox tab', () => {
    const last = outboxViewOf(ROWS).questions.at(-1);
    expect(last).toMatchObject({ answerOn: null, title: 'Loose' });
  });

  it('narrow to one product, or to none, and count every open item whatever the filter', () => {
    expect(outboxViewOf(ROWS, { product: MOBILE }).questions.map((q) => q.id)).toEqual(['s2-02-high-mine', 's2-01-medium-mine']);
    expect(outboxViewOf(ROWS, { product: 'none' }).questions.map((q) => q.id)).toEqual(['s1-01-no-product']);
    expect(outboxViewOf(ROWS, { product: MOBILE }).open).toBe(5);
  });

  it('draw a filter of All, each product and No product, the chosen one current', () => {
    const { filter } = outboxViewOf(ROWS, { product: OMNI });
    expect(filter?.options.map((o) => [o.label, o.current])).toEqual([['All', false], ['Mobile', false], ['Omni', true], ['No product', false]]);
    expect(filter?.options[1]?.href).toBe(`/ask/outbox?product=${MOBILE}`);
  });

  it('draw no filter when the workspaces hold no product', () => {
    expect(outboxViewOf({ ...ROWS, products: [] }).filter).toBeNull();
  });

  it('say so when nothing is open', () => {
    const view = outboxViewOf({ ...ROWS, items: [] });
    expect(view).toMatchObject({ questions: [], open: 0, mine: 0 });
  });
});
