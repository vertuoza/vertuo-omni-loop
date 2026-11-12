import { describe, expect, it } from 'vitest';
import { embedText, knowledgeEntries, type EntrySources } from './entries.ts';

// The pure entry builder (PRD 2707 s3), over the fixture packs of a fictional product, Acme: acme/widgets
// (the law home) and acme/api, each with its own ADRs and registers.

const ADR_67 = [
  '# ADR-0067 — A bad key still connects',
  '',
  '**Status:** adopted · **Date:** 2026-10-01 · **PRD:** #855 · **Layers:** api · **Domain:** access',
  '',
  '## Decision',
  '',
  'The client connects and lists the tools.',
].join('\n');

const RULES = [
  '# Rules',
  '',
  '## BR-PRODUCT-3',
  'A quote shows its total.',
  'Why: the customer must see what they pay.',
  'Enforced by: kit/quote.test.ts',
  'Locked: @anna, 2026-10-01',
  '',
  '## BR-PRODUCT-4',
  'A quote names its customer.',
  'Enforced by: kit/name.test.ts',
].join('\n');

const QUOTES_LAWS = [
  '## BL-QUOTES-1',
  'A quote can be sent only when its total including tax is above zero.',
  'Why: A customer who receives an empty quote stops trusting the contractor.',
  'Also: invoicing',
].join('\n');

const PRODUCT_LAWS = ['## BL-PRODUCT-1', 'Every price is shown with its tax.', 'Why: customers compare totals.'].join('\n');

const CONFIG = ['kit: 1', 'laws:', '  owners: [anna]'].join('\n');

const widgets = [
  { path: '.omni-loop/config.yml', content: CONFIG },
  { path: '.omni-loop/knowledge/adr/0067-a-bad-key-still-connects.md', content: ADR_67 },
  { path: '.omni-loop/knowledge/adr/README.md', content: '# Decisions' },
  { path: '.omni-loop/knowledge/product/rules.md', content: RULES },
  { path: '.omni-loop/knowledge/product/business-laws.md', content: PRODUCT_LAWS },
  { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', content: QUOTES_LAWS },
];

const api = [
  { path: '.omni-loop/knowledge/adr/0012-keys-are-hashed.md', content: '# ADR-0012 — Keys are hashed\n\n**Status:** accepted\n\nOnly the hash is kept.' },
  { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', content: '## BL-QUOTES-9\nNever read here.\nWhy: not the law home.' },
];

const sources = (over: Partial<EntrySources> = {}): EntrySources => ({
  repositories: [{ repo: 'acme/api', files: api }, { repo: 'acme/widgets', files: widgets }],
  lawHome: { repo: 'acme/widgets', files: widgets },
  legal: [{ id: 'L-GDPR-2', statement: 'Credentials are never stored in clear.', source: 'https://law.example/gdpr-32', owner: 'anna' }],
  glossary: [{ term: 'API key', meaning: 'A secret a program sends to read the workspace.', avoid: ['token'] }],
  never: [{ seq: 6, body: 'Never locks a workspace in.' }],
  ...over,
});

const byId = (id: string, list = knowledgeEntries(sources())) => list.find((entry) => entry.id === id);

describe('knowledgeEntries', () => {
  it('builds one entry per business law, ADR, rule, Legal entry, term and Never line, in id order', () => {
    const entries = knowledgeEntries(sources());
    expect(entries.map((entry) => `${entry.kind} ${entry.id}`)).toEqual([
      'business-law BL-PRODUCT-1',
      'business-law BL-QUOTES-1',
      'legal L-GDPR-2',
      'adr api/ADR-0012',
      'never never#6',
      'term term:API key',
      'adr widgets/ADR-0067',
      'rule widgets/BR-PRODUCT-3',
      'rule widgets/BR-PRODUCT-4',
    ]);
  });

  it('gives repository ids the repository\'s short name, and keeps the full name in repo', () => {
    const adr = byId('widgets/ADR-0067');
    expect(adr).toMatchObject({ kind: 'adr', repo: 'acme/widgets', domain: 'access', status: 'adopted', title: 'ADR-0067 — A bad key still connects' });
    expect(adr?.file).toBe('.omni-loop/knowledge/adr/0067-a-bad-key-still-connects.md');
    expect(adr?.body).toBe(ADR_67);
  });

  it('reads a rule with its text, its kind and its status', () => {
    const law = byId('widgets/BR-PRODUCT-3');
    expect(law).toMatchObject({ kind: 'rule', repo: 'acme/widgets', domain: 'product', status: 'law', title: 'A quote shows its total.' });
    expect(law?.body).toContain('A quote shows its total.');
    expect(law?.body).toContain('Kind: law');
    expect(law?.body).toContain('Why: the customer must see what they pay.');
    expect(byId('widgets/BR-PRODUCT-4')?.status).toBe('confirmed');
  });

  it('reads business laws from the law home\'s pack only, with their Why, domains and owner', () => {
    const quotes = byId('BL-QUOTES-1');
    expect(quotes).toMatchObject({ kind: 'business-law', repo: null, domain: 'quotes' });
    expect(quotes?.body).toContain('A quote can be sent only when its total including tax is above zero.');
    expect(quotes?.body).toContain('Why: A customer who receives an empty quote stops trusting the contractor.');
    expect(quotes?.body).toContain('Domains: quotes, invoicing');
    expect(quotes?.body).toContain('Owner: anna');
    expect(byId('BL-QUOTES-9')).toBeUndefined();
  });

  it('reads the business laws even when the law home is not among the repositories the key reads', () => {
    const entries = knowledgeEntries(sources({ repositories: [{ repo: 'acme/api', files: api }] }));
    expect(byId('BL-QUOTES-1', entries)).toBeDefined();
    expect(byId('widgets/ADR-0067', entries)).toBeUndefined();
    expect(byId('api/ADR-0012', entries)).toBeDefined();
  });

  it('adds no entry for a repository with no pack, and none for a product with no law home', () => {
    const entries = knowledgeEntries(sources({ repositories: [{ repo: 'acme/api', files: null }], lawHome: null }));
    expect(entries.map((entry) => entry.kind).sort()).toEqual(['legal', 'never', 'term']);
  });

  it('reads the product\'s own rows: Legal, terms and Never lines', () => {
    expect(byId('L-GDPR-2')).toMatchObject({ kind: 'legal', repo: null, file: null, title: 'Credentials are never stored in clear.' });
    expect(byId('L-GDPR-2')?.body).toContain('Source: https://law.example/gdpr-32');
    expect(byId('L-GDPR-2')?.body).toContain('Owner: anna');
    expect(byId('term:API key')).toMatchObject({ kind: 'term', title: 'API key' });
    expect(byId('term:API key')?.body).toContain('Avoid: token');
    expect(byId('never#6')).toMatchObject({ kind: 'never', title: 'Never locks a workspace in.', body: 'Never locks a workspace in.' });
  });

  it('reads a pack whose config moves the knowledge folder', () => {
    const moved = [
      { path: '.omni-loop/config.yml', content: 'kit: 1\npaths:\n  knowledge: docs/knowledge\n  adr: docs/adr' },
      { path: 'docs/adr/0001-first.md', content: '# ADR-0001 — First' },
      { path: 'docs/knowledge/product/rules.md', content: '## BR-PRODUCT-1\nMoved.' },
    ];
    const entries = knowledgeEntries(sources({ repositories: [{ repo: 'acme/moved', files: moved }], lawHome: null }));
    expect(byId('moved/ADR-0001', entries)).toBeDefined();
    expect(byId('moved/BR-PRODUCT-1', entries)?.title).toBe('Moved.');
  });
});

describe('duplicate ADR numbers', () => {
  const twin = (title: string) => `# ADR-0043 — ${title}\n\n**Status:** accepted\n\nText.`;
  const files = [
    { path: '.omni-loop/knowledge/adr/0043-retries.md', content: twin('Retries') },
    { path: '.omni-loop/knowledge/adr/0043-timeouts.md', content: twin('Timeouts') },
    { path: '.omni-loop/knowledge/adr/0044-other.md', content: '# ADR-0044 — Other\n\n**Status:** accepted' },
  ];
  const entries = knowledgeEntries(sources({ repositories: [{ repo: 'acme/gateway', files }], lawHome: null }));

  it('gives each twin its file name, and every other entry its usual id', () => {
    expect(entries.filter((e) => e.kind === 'adr').map((e) => e.id)).toEqual(['gateway/0043-retries', 'gateway/0043-timeouts', 'gateway/ADR-0044']);
  });

  it('does not rename the same number in two repositories', () => {
    const other = [{ path: '.omni-loop/knowledge/adr/0043-retries.md', content: twin('Retries') }];
    const both = knowledgeEntries(sources({ repositories: [{ repo: 'acme/gateway', files }, { repo: 'acme/edge', files: other }], lawHome: null }));
    expect(byId('edge/ADR-0043', both)).toBeDefined();
  });
});

describe('embedText', () => {
  it('is the title, then the body without its Owner line', () => {
    const law = byId('BL-QUOTES-1');
    const text = embedText(law ?? { title: '', body: '' });
    expect(text.startsWith(`${law?.title ?? ''}\n`)).toBe(true);
    expect(text).toContain('Why: A customer who receives an empty quote');
    expect(text).not.toContain('Owner:');
    expect(text).not.toContain('anna');
  });

  it('drops the Owner line of a Legal entry too, and leaves a body with none whole', () => {
    expect(embedText(byId('L-GDPR-2') ?? { title: '', body: '' })).not.toContain('Owner:');
    expect(embedText({ title: 'T', body: 'a\nb' })).toBe('T\na\nb');
  });
});
