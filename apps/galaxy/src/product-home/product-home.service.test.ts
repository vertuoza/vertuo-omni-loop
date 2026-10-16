import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { productHomeOf, productHomeService, type ProductHomeRows } from './product-home.service';
import type { ProductHomeRepository, StoredHomePrd, StoredItem, StoredProductPrd } from './product-home.repository';

// The product home's rules (PRD 1364 s9), on fixture rows: which lane each PRD of the product is on, its
// state word, its seal and its PR chips, the summary, and the PRDs tab, newest first.

const ME = 'u-irisa';
const prd = (id: string, n: number, over: Partial<StoredHomePrd> = {}): StoredHomePrd => ({
  id, home_repo: 'vertuo/api', prd: parsePrd(n), title: `PRD ${String(n)}`, birthplace: 'server', opened_by: 'u-paul',
  created_at: '2026-10-01T00:00:00Z', ...over,
});
const stage = (n: number, s: 'prd' | 'inbox' | 'building' | 'outbox' | 'shipped' | 'retro', repository = 'vertuo/api') =>
  ({ repository, prd: parsePrd(n), stage: s });

const base = (over: Partial<ProductHomeRows> = {}): ProductHomeRows => ({
  product: { id: 'p-mobile', name: 'Mobile' },
  prds: [], stages: [], outbox: [], approvals: [], voids: [], waitingOnMe: [], topics: [], pulls: [], ideas: [], roadmaps: [], fixes: [],
  key: 'mobile', productPrds: [], items: [], players: [], links: [], otherLinks: [], phase0: [], me: ME,
  ...over,
});

const productPrd = (id: string, seq: number, over: Partial<StoredProductPrd> = {}): StoredProductPrd => ({
  id, product_seq: seq, title: `Mobile ${String(seq)}`, opened_by: null, created_at: `2026-10-${String(10 + (seq % 10)).padStart(2, '0')}T00:00:00Z`, ...over,
});

/** An outbox item of a product PRD, as its row holds it: its body a well-formed item whose question names it. */
const item = (dossier: string, id: string, rank: StoredItem['rank'], repository: string | null, settlements: { id: string }[] = []): StoredItem => ({
  dossier_id: dossier, item: id, rank, repository, raised_at: '2026-10-11T09:00:00Z', outbox_settlements: settlements,
  body: [
    '---', `id: ${id}`, 'prd: mobile-12', `slice: ${id.split('-')[0] ?? 's1'}`, `rank: ${rank}`, 'bears-on: none', 'raised: 2026-10-11', 'wave: 1', '---', '',
    '## The question, in plain words', '', `Is ${id} settled?`, '',
    '## The decision, in plain words', '', 'It is kept.', '',
    '## The intro, for fun', '', 'A question walks in.', '',
    '## The punchline, for fun', '', 'It walks out answered.', '',
    '## The options, in plain words', '', 'A. Keep it (built).', 'B. Change it.', '',
    '## What I had to decide', '', 'Whether to keep it.', '',
    '## What I did meanwhile', '', 'Kept it.', '',
    '## What it costs to change later', '', 'Little.', '',
    '## What I could not know', '', '(author) Nothing more.', '',
  ].join('\n'),
});

const lane = (rows: ProductHomeRows, id: 'on-you' | 'on-review' | 'on-agent') =>
  productHomeOf(rows).ledger.lanes[id].map((r) => [r.prd, r.state]);

describe('the Ledger\'s lanes', () => {
  it('puts a ◆ PRD with no approval on you when its request asks you, and on no lane when it asks another', () => {
    const rows = base({ prds: [prd('d-1', 918), prd('d-2', 919)], stages: [stage(918, 'prd'), stage(919, 'prd')], waitingOnMe: ['d-1'] });
    expect(lane(rows, 'on-you')).toEqual([[918, 'approval']]);
    expect(lane(rows, 'on-review')).toEqual([]);
    expect(lane(rows, 'on-agent')).toEqual([]);
    expect(productHomeOf(rows).ledger.summary).toEqual({ building: 0, waitingOnPerson: 2, drifted: 0 });
  });

  it('reads a ◆ PRD whose approval a push voided as drifted, and counts it', () => {
    const rows = base({
      prds: [prd('d-1', 918)], stages: [stage(918, 'inbox')],
      approvals: [{ id: 'a-1', dossier_id: 'd-1', approved_at: '2026-10-02T00:00:00Z' }],
      voids: [{ approval_id: 'a-1', dossier_id: 'd-1' }], waitingOnMe: ['d-1'],
    });
    expect(lane(rows, 'on-you')).toEqual([[918, 'drifted']]);
    expect(productHomeOf(rows).ledger.summary).toEqual({ building: 0, waitingOnPerson: 1, drifted: 1 });
  });

  it('keeps an approval in force when a void names an older one, and seals the row', () => {
    const rows = base({
      prds: [prd('d-1', 905)], stages: [stage(905, 'inbox'), stage(905, 'building')],
      approvals: [{ id: 'a-1', dossier_id: 'd-1', approved_at: '2026-10-01T00:00:00Z' }, { id: 'a-2', dossier_id: 'd-1', approved_at: '2026-10-03T00:00:00Z' }],
      voids: [{ approval_id: 'a-1', dossier_id: 'd-1' }],
    });
    const [row] = productHomeOf(rows).ledger.lanes['on-agent'];
    expect(row).toMatchObject({ prd: 905, state: 'building', sealed: true, birthplace: 'server' });
    expect(productHomeOf(rows).ledger.summary).toEqual({ building: 1, waitingOnPerson: 0, drifted: 0 });
  });

  it('puts a PRD whose outbox waits on a person on you when you opened it, with its first question', () => {
    const waiting = [{ id: 's2-01', rank: 'high', question: 'Round per line or on the total?' }, { id: 's2-02', rank: 'high', question: 'Second?' }];
    const rows = base({
      prds: [prd('d-1', 912, { birthplace: 'repo', opened_by: ME }), prd('d-2', 913, { birthplace: 'repo' })],
      stages: [stage(912, 'building'), stage(913, 'building')],
      outbox: [{ repository: 'vertuo/api', prd: parsePrd(912), waiting }, { repository: 'vertuo/api', prd: parsePrd(913), waiting }],
    });
    const home = productHomeOf(rows);
    expect(home.ledger.lanes['on-you']).toMatchObject([{ prd: 912, state: 'question', question: 'Round per line or on the total?', questions: 2, sealed: false }]);
    expect(home.ledger.summary).toEqual({ building: 2, waitingOnPerson: 2, drifted: 0 });
  });

  it('puts a PRD at outbox, and a ◇ PRD at PRD, on GitHub review', () => {
    const rows = base({
      prds: [prd('d-1', 920, { birthplace: 'repo' }), prd('d-2', 921, { birthplace: null }), prd('d-3', 922, { birthplace: 'repo' })],
      stages: [stage(920, 'outbox'), stage(921, 'prd')],
      approvals: [],
    });
    expect(lane(rows, 'on-review')).toEqual([[920, 'review'], [921, 'review'], [922, 'review']]);
  });

  it('puts a PRD at inbox or building on the agent, an approved ◆ PRD not yet synced past PRD at inbox', () => {
    const rows = base({
      prds: [prd('d-1', 930, { birthplace: 'repo' }), prd('d-2', 931), prd('d-3', 932, { birthplace: 'repo' })],
      stages: [stage(930, 'inbox'), stage(931, 'prd'), stage(932, 'building')],
      approvals: [{ id: 'a-1', dossier_id: 'd-2', approved_at: '2026-10-01T00:00:00Z' }],
    });
    expect(lane(rows, 'on-agent')).toEqual([[930, 'inbox'], [931, 'inbox'], [932, 'building']]);
  });

  it('leaves a shipped PRD, and one at retro, off every lane and out of the summary', () => {
    const rows = base({
      prds: [prd('d-1', 940, { birthplace: 'repo' }), prd('d-2', 941)],
      stages: [stage(940, 'shipped'), stage(941, 'building'), stage(941, 'retro')],
    });
    const home = productHomeOf(rows);
    expect(Object.values(home.ledger.lanes).flat()).toEqual([]);
    expect(home.ledger.summary).toEqual({ building: 0, waitingOnPerson: 0, drifted: 0 });
  });

  it('chips the open pull requests of the PRD\'s feature branch and its landings, in any repository', () => {
    const rows = base({
      prds: [prd('d-1', 905, { birthplace: 'repo' })], stages: [stage(905, 'building')],
      topics: [{ repository: 'vertuo/api', prd: parsePrd(905), topic: 'invoice-reminders' }],
      pulls: [
        { repo: 'vertuo/api', number: parsePr(447), head: 'feat/invoice-reminders' },
        { repo: 'vertuo/mobile', number: parsePr(94), head: 'feat/invoice-reminders-2of3-code' },
        { repo: 'vertuo/api', number: parsePr(448), head: 'feat/invoice-reminders--s3' },
        { repo: 'vertuo/api', number: parsePr(449), head: 'feat/invoice-reminders-two' },
      ],
    });
    expect(productHomeOf(rows).ledger.lanes['on-agent'][0]?.prs).toEqual([{ repo: 'vertuo/api', pr: 447 }, { repo: 'vertuo/mobile', pr: 94 }]);
  });

  it('matches a repository case-insensitively between the dossier and the stored stages', () => {
    const rows = base({ prds: [prd('d-1', 950, { birthplace: 'repo', home_repo: 'Vertuo/API' })], stages: [stage(950, 'building', 'vertuo/api')] });
    expect(lane(rows, 'on-agent')).toEqual([[950, 'building']]);
  });
});

describe('the PRDs tab', () => {
  it('lists every PRD in the order read, newest first, each with its birthplace and state word', () => {
    const rows = base({
      prds: [prd('d-2', 2), prd('d-1', 1, { birthplace: 'repo' }), prd('d-0', 3, { birthplace: null })],
      stages: [stage(2, 'building'), stage(1, 'prd'), stage(1, 'shipped')],
    });
    expect(productHomeOf(rows).prds.map((p) => [p.prd, p.birthplace, p.state])).toEqual([
      [2, 'server', 'building'], [1, 'repo', 'shipped'], [3, 'repo', 'syncing'],
    ]);
  });

  it('is empty for a product with no PRD', () => {
    const home = productHomeOf(base());
    expect(home.prds).toEqual([]);
    expect(home.ledger).toEqual({ lanes: { 'on-you': [], 'on-review': [], 'on-agent': [] }, summary: { building: 0, waitingOnPerson: 0, drifted: 0 } });
  });
});

describe('the Ideas, Roadmap, Bug fixes, Visual fixes and Questions tabs (s10)', () => {
  it('lists the product\'s ideas in the order read, each with its board\'s lane and PRD', () => {
    const rows = base({
      ideas: [
        { id: 'i-2', repo: 'vertuo/api', title: 'Calmer gate', pitch: 'Fewer pings.', lane: 'next', prd: parsePrd(12), created_at: '2026-10-02T00:00:00Z' },
        { id: 'i-1', repo: 'vertuo/web', title: 'Dark mode', pitch: 'Easier at night.', lane: 'now', prd: null, created_at: '2026-10-01T00:00:00Z' },
      ],
    });
    expect(productHomeOf(rows).ideas).toEqual([
      { id: 'i-2', repo: 'vertuo/api', title: 'Calmer gate', pitch: 'Fewer pings.', lane: 'next', prd: 12 },
      { id: 'i-1', repo: 'vertuo/web', title: 'Dark mode', pitch: 'Easier at night.', lane: 'now', prd: null },
    ]);
  });

  it('lists the product\'s roadmaps, each with its milestone and target date', () => {
    const rows = base({ roadmaps: [{ id: 'r-1', number: 3, repo: 'vertuo/api', title: 'Spring', milestone: 'Beta', target_date: null, created_at: '2026-10-01T00:00:00Z' }] });
    expect(productHomeOf(rows).roadmaps).toEqual([{ id: 'r-1', number: 3, repo: 'vertuo/api', title: 'Spring', milestone: 'Beta', targetDate: null }]);
  });

  it('splits the product\'s fixes into bug fixes and visual fixes, each in the order read', () => {
    const fix = (id: string, kind: 'bug' | 'visual', title: string) => ({ id, kind, home_repo: 'vertuo/api', title, created_at: '2026-10-01T00:00:00Z' });
    const home = productHomeOf(base({ fixes: [fix('d-b2', 'bug', 'Crash'), fix('d-v1', 'visual', 'Darker'), fix('d-b1', 'bug', 'Typo')] }));
    expect(home.bugs).toEqual([
      { dossier: 'd-b2', repo: 'vertuo/api', title: 'Crash', created: '2026-10-01T00:00:00Z' },
      { dossier: 'd-b1', repo: 'vertuo/api', title: 'Typo', created: '2026-10-01T00:00:00Z' },
    ]);
    expect(home.visuals).toEqual([{ dossier: 'd-v1', repo: 'vertuo/api', title: 'Darker', created: '2026-10-01T00:00:00Z' }]);
  });

  it('lists every question waiting on a person of the product\'s PRDs, newest PRD first, none of a shipped one or of another PRD', () => {
    const rows = base({
      prds: [prd('d-2', 913, { title: 'Quotes' }), prd('d-1', 912, { title: 'Search' }), prd('d-0', 900)],
      stages: [stage(913, 'building'), stage(912, 'outbox'), stage(900, 'shipped')],
      outbox: [
        { repository: 'vertuo/api', prd: parsePrd(912), waiting: [{ id: 's2-01', rank: 'high', question: 'Round per line?' }] },
        { repository: 'vertuo/api', prd: parsePrd(913), waiting: [{ id: 's1-01', rank: 'human-action', question: 'Add the secret?' }, { id: 's1-02', rank: 'high', question: 'Keep the cache?' }] },
        { repository: 'vertuo/api', prd: parsePrd(900), waiting: [{ id: 's1-01', rank: 'high', question: 'Stale?' }] },
        { repository: 'vertuo/api', prd: parsePrd(999), waiting: [{ id: 's1-01', rank: 'high', question: 'Not ours?' }] },
      ],
    });
    const on = { options: [], answerOn: null };
    expect(productHomeOf(rows).questions).toEqual([
      { dossier: 'd-2', repo: 'vertuo/api', prdLabel: '913', title: 'Quotes', id: 's1-01', rank: 'human-action', question: 'Add the secret?', forWhom: 'for a person who can do it', ...on },
      { dossier: 'd-2', repo: 'vertuo/api', prdLabel: '913', title: 'Quotes', id: 's1-02', rank: 'high', question: 'Keep the cache?', forWhom: 'for its author', ...on },
      { dossier: 'd-1', repo: 'vertuo/api', prdLabel: '912', title: 'Search', id: 's2-01', rank: 'high', question: 'Round per line?', forWhom: 'for its author', ...on },
    ]);
  });

  it('lists the open questions of the product PRDs, worst first, with their repository, options and who each is for (PRD 1548 s9)', () => {
    const rows = base({
      key: 'mobile',
      productPrds: [productPrd('d-m12', 12, { title: 'Quotes on the phone', opened_by: 'u-paul' }), productPrd('d-m11', 11, { opened_by: ME })],
      items: [
        item('d-m12', 's2-01-quote-totals', 'medium', 'vertuoza/vertuo-api'),
        item('d-m12', 's3-02-vat-number', 'high', 'vertuoza/vertuo-mobile'),
        item('d-m12', 's1-01-settled-one', 'high', null, [{ id: 'st-1' }]),
        item('d-m11', 's1-01-add-the-secret', 'human-action', null),
        item('d-m11', 's1-02-keep-the-cache', 'high', null),
      ],
      players: [{ user_id: 'u-paul', github_login: 'paul' }, { user_id: ME, github_login: null }],
    });
    const questions = productHomeOf(rows).questions;
    expect(questions.map((q) => [q.prdLabel, q.id, q.repo, q.rank, q.forWhom, q.answerOn])).toEqual([
      ['mobile-12', 's3-02-vat-number', 'vertuoza/vertuo-mobile', 'high', 'for paul', 'mobile-12'],
      ['mobile-12', 's2-01-quote-totals', 'vertuoza/vertuo-api', 'medium', 'for paul', 'mobile-12'],
      ['mobile-11', 's1-01-add-the-secret', null, 'human-action', 'for a person who can do it', 'mobile-11'],
      ['mobile-11', 's1-02-keep-the-cache', null, 'high', 'for you', 'mobile-11'],
    ]);
    expect(questions[0]).toMatchObject({
      dossier: 'd-m12', title: 'Quotes on the phone', question: 'Is s3-02-vat-number settled?',
      options: [{ letter: 'A', text: 'Keep it (built).' }, { letter: 'B', text: 'Change it.' }],
    });
  });

  it('orders product PRDs and repository PRDs together, newest first, and reads a question whose body no longer parses by its id', () => {
    const rows = base({
      key: null,
      prds: [prd('d-1', 912, { created_at: '2026-10-02T00:00:00Z' })],
      stages: [stage(912, 'building')],
      outbox: [{ repository: 'vertuo/api', prd: parsePrd(912), waiting: [{ id: 's2-01', rank: 'high', question: 'Round per line?' }] }],
      productPrds: [productPrd('d-m3', 3, { created_at: '2026-10-03T00:00:00Z' }), productPrd('d-m1', 1, { created_at: '2026-10-01T00:00:00Z' })],
      items: [{ ...item('d-m3', 's1-01-broken', 'high', null), body: 'not an item' }, item('d-m1', 's1-01-old', 'high', null)],
    });
    expect(productHomeOf(rows).questions.map((q) => [q.prdLabel, q.id, q.question, q.options.length, q.answerOn])).toEqual([
      ['3', 's1-01-broken', 's1-01-broken', 0, null],
      ['912', 's2-01', 'Round per line?', 0, null],
      ['1', 's1-01-old', 'Is s1-01-old settled?', 2, null],
    ]);
  });

  it('is empty on every tab for a product with nothing', () => {
    const home = productHomeOf(base());
    expect([home.ideas, home.roadmaps, home.bugs, home.visuals, home.questions]).toEqual([[], [], [], [], []]);
  });
});

describe('the product\'s repositories (PRD 2129)', () => {
  it('names each linked repository with its role, consumes, phase 0 (pr by default) and the other products it is in, sorted', () => {
    const home = productHomeOf(base({
      links: [{ repository: 'a/web', role: 'web', consumes: ['a/api'] }, { repository: 'a/api', role: null, consumes: [] }],
      otherLinks: [
        { repository: 'a/api', products: { name: 'Zeta' } }, { repository: 'a/api', products: { name: 'Alpha' } }, { repository: 'a/api', products: { name: 'Alpha' } },
      ],
      phase0: [{ full_name: 'a/web', phase0: 'server' }],
    }));
    expect(home.repositories).toEqual([
      { repository: 'a/api', role: null, consumes: [], phase0: 'pr', alsoIn: ['Alpha', 'Zeta'] },
      { repository: 'a/web', role: 'web', consumes: ['a/api'], phase0: 'server', alsoIn: [] },
    ]);
  });
});

describe('the PRDs in flight, as the Constellation reads them (PRD 2129 s2)', () => {
  it('gives every PRD its stage, its Ledger state and lane, the repositories of its stage rows and its open feature pull requests', () => {
    const home = productHomeOf(base({
      prds: [prd('d-2', 906, { birthplace: 'repo' }), prd('d-1', 905, { birthplace: 'repo' }), prd('d-0', 900)],
      stages: [stage(906, 'building'), stage(905, 'outbox'), stage(900, 'shipped')],
      topics: [{ repository: 'vertuo/api', prd: parsePrd(906), topic: 'reminders' }],
      pulls: [{ repo: 'vertuo/mobile', number: parsePr(94), head: 'feat/reminders-2of3-code' }],
    }));
    expect(home.flights.map((f) => [f.dossier, f.stage, f.ledger, f.stageRepos, f.prs])).toEqual([
      ['d-2', 'building', { state: 'building', lane: 'on-agent' }, ['vertuo/api'], [{ repo: 'vertuo/mobile', pr: 94 }]],
      ['d-1', 'outbox', { state: 'review', lane: 'on-review' }, ['vertuo/api'], []],
      ['d-0', 'shipped', null, ['vertuo/api'], []],
    ]);
  });

  it('keeps a PRD waiting on another person, with no lane, and one not yet synced, with no stage row', () => {
    const home = productHomeOf(base({ prds: [prd('d-1', 918), prd('d-2', 919, { birthplace: 'repo' })], stages: [stage(918, 'prd')] }));
    expect(home.flights.map((f) => [f.dossier, f.ledger, f.stageRepos])).toEqual([
      ['d-1', { state: 'approval', lane: null }, ['vertuo/api']],
      ['d-2', { state: 'review', lane: 'on-review' }, []],
    ]);
  });
});

describe('the product home\'s service', () => {
  function store(over: Partial<ProductHomeRepository> = {}) {
    const calls: string[] = [];
    const s: ProductHomeRepository = {
      product: (ws, id) => { calls.push(`product ${ws} ${id}`); return Promise.resolve({ id, name: 'Mobile', key: 'mobile' }); },
      prds: (ws, id) => { calls.push(`prds ${ws} ${id}`); return Promise.resolve([prd('d-1', 7, { home_repo: 'vertuo/api' })]); },
      productPrds: (ws, id) => { calls.push(`product prds ${ws} ${id}`); return Promise.resolve([productPrd('d-m12', 12, { opened_by: 'u-paul' })]); },
      items: (ids) => { calls.push(`items ${ids.join()}`); return Promise.resolve([item('d-m12', 's2-01-quote-totals', 'high', 'vertuoza/vertuo-api')]); },
      players: (ws, users) => { calls.push(`players ${ws} ${users.join()}`); return Promise.resolve([{ user_id: 'u-paul', github_login: 'paul' }]); },
      links: (ws, id) => { calls.push(`links ${ws} ${id}`); return Promise.resolve([{ repository: 'vertuo/api', role: 'api', consumes: [] }, { repository: 'vertuo/app', role: null, consumes: ['vertuo/api'] }]); },
      otherLinks: (_ws, _id, repos) => { calls.push(`other links ${repos.join()}`); return Promise.resolve([{ repository: 'vertuo/api', products: { name: 'Web' } }]); },
      phase0: (_ws, repos) => { calls.push(`phase0 ${repos.join()}`); return Promise.resolve([{ full_name: 'vertuo/app', phase0: 'server' as const }]); },
      stages: (_ws, repos) => { calls.push(`stages ${repos.join()}`); return Promise.resolve([stage(7, 'building')]); },
      outbox: (_ws, repos) => { calls.push(`outbox ${repos.join()}`); return Promise.resolve([]); },
      topics: (_ws, repos) => { calls.push(`topics ${repos.join()}`); return Promise.resolve([]); },
      approvals: (ids) => { calls.push(`approvals ${ids.join()}`); return Promise.resolve([{ id: 'a', dossier_id: 'd-1', approved_at: '2026-10-01T00:00:00Z' }]); },
      voids: (ids) => { calls.push(`voids ${ids.join()}`); return Promise.resolve([]); },
      waitingOnMe: () => { calls.push('waiting'); return Promise.resolve([]); },
      featurePulls: (ws) => { calls.push(`pulls ${ws}`); return Promise.resolve([]); },
      ideas: (ws, id) => { calls.push(`ideas ${ws} ${id}`); return Promise.resolve([]); },
      roadmaps: (ws, id) => { calls.push(`roadmaps ${ws} ${id}`); return Promise.resolve([]); },
      fixes: (ws, id) => { calls.push(`fixes ${ws} ${id}`); return Promise.resolve([{ id: 'd-v', kind: 'visual', home_repo: 'vertuo/web', title: 'Darker', created_at: '2026-10-01T00:00:00Z' }]); },
      ...over,
    };
    return { calls, s };
  }

  it('reads the product, its PRDs, then what each PRD needs', async () => {
    const { calls, s } = store();
    const home = await productHomeService(s).home({ product: 'p-1', workspace: 'ws-1', me: ME });
    expect(home?.product).toEqual({ id: 'p-1', name: 'Mobile' });
    expect(home?.ledger.lanes['on-agent'].map((r) => r.prd)).toEqual([7]);
    expect(home?.visuals.map((f) => f.dossier)).toEqual(['d-v']);
    expect(home?.questions.map((q) => [q.prdLabel, q.id, q.forWhom])).toEqual([['mobile-12', 's2-01-quote-totals', 'for paul']]);
    expect(calls).toEqual([
      'product ws-1 p-1', 'prds ws-1 p-1', 'product prds ws-1 p-1', 'links ws-1 p-1', 'stages vertuo/api', 'outbox vertuo/api', 'topics vertuo/api', 'approvals d-1', 'voids d-1', 'waiting',
      'pulls ws-1', 'ideas ws-1 p-1', 'roadmaps ws-1 p-1', 'fixes ws-1 p-1', 'items d-m12', 'players ws-1 u-paul',
      'other links vertuo/api,vertuo/app', 'phase0 vertuo/api,vertuo/app',
    ]);
    expect(home?.repositories).toEqual([
      { repository: 'vertuo/api', role: 'api', consumes: [], phase0: 'pr', alsoIn: ['Web'] },
      { repository: 'vertuo/app', role: null, consumes: ['vertuo/api'], phase0: 'server', alsoIn: [] },
    ]);
  });

  it('answers null for a product the workspace does not hold, and reads nothing more', async () => {
    const { calls, s } = store({ product: () => Promise.resolve(null) });
    expect(await productHomeService(s).home({ product: 'p-x', workspace: 'ws-1', me: ME })).toBeNull();
    expect(calls).toEqual([]);
  });

  it('reads no pull request for a product with no PRD', async () => {
    const { calls, s } = store({ prds: () => Promise.resolve([]) });
    await productHomeService(s).home({ product: 'p-1', workspace: 'ws-1', me: ME });
    expect(calls.some((c) => c.startsWith('pulls'))).toBe(false);
  });
});
