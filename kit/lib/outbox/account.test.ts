import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../../test/flat-layout.ts';
import { ACCOUNTS_DIR, compare, parseAccount, readAccounts } from './account.ts';
import type { Account, AccountEntry, ParsedAccount } from './account.ts';
import { settleItem } from './settle.ts';
import { parsePrd, parseWorkSliceId } from '../ids.ts';

/** A parse result read either way: a test checks `ok` first, then reads the side it expects. */
type EitherSide = { ok: boolean; account: Account; errors: string[] };
const view = (result: ParsedAccount | undefined) => result as EitherSide;

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'outbox-account-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function accountText({ frontMatter = {}, body }: { frontMatter?: Record<string, string | undefined>; body?: string } = {}) {
  const fm: Record<string, string | undefined> = { prd: '1044', slice: 's2', graded: '2026-09-23', ...frontMatter };
  const fmLines = Object.entries(fm)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value ?? ''}`);
  const defaultBody = [
    '## Risky changes',
    '',
    '- `libs/vertuo-ai-credit/src/server/migrations.ts`',
    '  stored-shape',
    '  item s3-01-credit-ledger-shape',
    '',
  ].join('\n');
  return ['---', ...fmLines, '---', '', body ?? defaultBody].join('\n');
}

/** A minimal outbox item file, valid enough for `outboxItemFiles` to see it — content is not read. */
function seedItem(prd: number, id: string, rank = 'high') {
  mkdirSync(join(root, 'docs/outbox', String(prd)), { recursive: true });
  writeFileSync(
    join(root, 'docs/outbox', String(prd), `${id}.md`),
    [
      '---',
      `id: ${id}`,
      `prd: ${prd}`,
      'slice: s3',
      `rank: ${rank}`,
      'bears-on: none',
      'raised: 2026-09-23',
      'wave: 1',
      '---',
      '',
      '## The question, in plain words',
      '',
      'Does this need a decision at all?',
      '',
      '## The decision, in plain words',
      '',
      'Yes, and this is the fixture that records it.',
      '',
      '## What I had to decide',
      '',
      'Something.',
      '',
      '## What I did meanwhile',
      '',
      'Something.',
      '',
      '## What it costs to change later',
      '',
      'Something.',
      '',
      '## What I could not know',
      '',
      '(author) Something.',
      '',
    ].join('\n'),
  );
}

function seedAccount(prd: number, slice: string, text: string) {
  const dir = join(root, 'docs/outbox', String(prd), ACCOUNTS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slice}.md`), text);
}

describe('parseAccount — the happy path', () => {
  it('parses a well-formed account into a typed object', () => {
    const result = parseAccount(accountText(), { file: 'docs/outbox/1044/accounts/s2.md' });
    expect(result.ok).toBe(true);
    expect(view(result).account).toEqual({
      prd: 1044,
      slice: 's2',
      graded: '2026-09-23',
      entries: [
        {
          path: 'libs/vertuo-ai-credit/src/server/migrations.ts',
          rule: 'stored-shape',
          account: { kind: 'item', id: 's3-01-credit-ledger-shape' },
        },
      ],
      file: 'docs/outbox/1044/accounts/s2.md',
    });
  });

  it('parses a spec account', () => {
    const body = [
      '## Risky changes',
      '',
      '- `docs/knowledge/product/invariants.md`',
      '  law-text',
      '  spec Solution, §2 — The account.',
      '',
    ].join('\n');
    const result = parseAccount(accountText({ body }));
    expect(result.ok).toBe(true);
    expect(view(result).account.entries).toEqual([
      {
        path: 'docs/knowledge/product/invariants.md',
        rule: 'law-text',
        account: { kind: 'spec', where: 'Solution, §2 — The account.' },
      },
    ]);
  });

  it('parses several entries in one file', () => {
    const body = [
      '## Risky changes',
      '',
      '- `a/migrations.ts`',
      '  stored-shape',
      '  item s2-01-a',
      '',
      '- `docs/adr/0069-example.md`',
      '  law-text',
      '  spec the plan says so',
      '',
    ].join('\n');
    const result = parseAccount(accountText({ body }));
    expect(result.ok).toBe(true);
    expect(view(result).account.entries).toHaveLength(2);
  });
});

describe('parseAccount — refusals, by name', () => {
  it('refuses malformed front matter', () => {
    const result = parseAccount(accountText({ frontMatter: { graded: 'not-a-date' } }));
    expect(result.ok).toBe(false);
    expect(view(result).errors).toEqual([expect.stringContaining('graded must be a YYYY-MM-DD date')]);
  });

  it('refuses a missing front-matter block entirely', () => {
    const result = parseAccount('## Risky changes\n\nnothing here\n');
    expect(result.ok).toBe(false);
    expect(view(result).errors).toEqual([expect.stringContaining('missing a front-matter block')]);
  });

  it('refuses an unknown front-matter field (strict schema)', () => {
    const result = parseAccount(accountText({ frontMatter: { extra: 'nope' } }));
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((message) => message.includes('extra'))).toBe(true);
  });

  it('refuses a missing "## Risky changes" section', () => {
    const result = parseAccount(accountText({ body: 'Just some prose, no heading.\n' }));
    expect(result.ok).toBe(false);
    expect(view(result).errors).toEqual([expect.stringContaining('missing section: "## Risky changes"')]);
  });

  it('refuses an unexpected extra heading', () => {
    const body = [
      '## Risky changes',
      '',
      '- `a/migrations.ts`',
      '  stored-shape',
      '  item s2-01-a',
      '',
      '## Extra section',
      '',
      'not allowed',
      '',
    ].join('\n');
    const result = parseAccount(accountText({ body }));
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((message) => message.includes('Extra section'))).toBe(true);
  });

  it('refuses an account that is neither "item" nor "spec"', () => {
    const body = [
      '## Risky changes',
      '',
      '- `a/migrations.ts`',
      '  stored-shape',
      "  it's fine, trust me",
      '',
    ].join('\n');
    const result = parseAccount(accountText({ body }));
    expect(result.ok).toBe(false);
    expect(view(result).errors).toEqual([
      expect.stringContaining('account must be "item <id>" or "spec <where>"'),
    ]);
  });

  it('refuses an entry that is not in groups of three lines', () => {
    const body = ['## Risky changes', '', '- `a/migrations.ts`', '  stored-shape', ''].join('\n');
    const result = parseAccount(accountText({ body }));
    expect(result.ok).toBe(false);
    expect(view(result).errors).toEqual([expect.stringContaining('groups of three lines')]);
  });
});

describe('readAccounts', () => {
  it('reads a well-formed account whose item exists', () => {
    seedItem(1044, 's3-01-credit-ledger-shape');
    seedAccount(1044, 's2', accountText());

    const results = readAccounts(parsePrd(1044), { ctx: flatCtx(root) });
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    expect(view(results[0]).account.slice).toBe('s2');
  });

  it('refuses an item account naming an id no outbox file carries', () => {
    // No item file seeded at all — s3-01-credit-ledger-shape does not exist.
    seedAccount(1044, 's2', accountText());

    const results = readAccounts(parsePrd(1044), { ctx: flatCtx(root) });
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(false);
    expect(view(results[0]).errors).toEqual([
      expect.stringContaining(
        'item account names an id no outbox file carries: "s3-01-credit-ledger-shape"',
      ),
    ]);
  });

  it('reads an account whose item was settled since — the record still carries the decision', () => {
    seedItem(1044, 's3-01-credit-ledger-shape');
    seedAccount(1044, 's2', accountText());
    const ctx = flatCtx(root);
    const settled = settleItem({
      ctx,
      file: 'docs/outbox/1044/s3-01-credit-ledger-shape.md',
      answer: {
        text: 'Yes, keep it as is.',
        approvedBy: 'pierrederval',
        approvedAt: '2026-09-23T09:30:00Z',
        channel: { kind: 'prd-issue', number: 1044 },
        statedVerdict: 'agreed',
      },
    });
    expect(settled.ok).toBe(true);

    const results = readAccounts(parsePrd(1044), { ctx });
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
  });

  it('returns [] when the PRD has no accounts directory at all', () => {
    expect(readAccounts(parsePrd(1044), { ctx: flatCtx(root) })).toEqual([]);
  });

  it('reads two slices of one PRD separately, neither writing into the other', () => {
    seedItem(1044, 's3-01-credit-ledger-shape');
    seedAccount(1044, 's2', accountText());

    const s4Body = [
      '## Risky changes',
      '',
      '- `docs/knowledge/domains/extraction/rules.md`',
      '  law-text',
      '  spec the spec already asks for this',
      '',
    ].join('\n');
    seedAccount(1044, 's4', accountText({ frontMatter: { slice: 's4' }, body: s4Body }));

    const results = readAccounts(parsePrd(1044), { ctx: flatCtx(root) });
    expect(results).toHaveLength(2);

    const s2Result = results.find((result) => result.ok && view(result).account.slice === 's2');
    const s4Result = results.find((result) => result.ok && view(result).account.slice === 's4');

    expect(view(s2Result).account.entries).toEqual([
      {
        path: 'libs/vertuo-ai-credit/src/server/migrations.ts',
        rule: 'stored-shape',
        account: { kind: 'item', id: 's3-01-credit-ledger-shape', rank: 'high' },
      },
    ]);
    expect(view(s4Result).account.entries).toEqual([
      {
        path: 'docs/knowledge/domains/extraction/rules.md',
        rule: 'law-text',
        account: { kind: 'spec', where: 'the spec already asks for this' },
      },
    ]);
  });

  it('scopes to the given PRD only, never reading a sibling PRD directory', () => {
    seedItem(1044, 's3-01-credit-ledger-shape');
    seedAccount(1044, 's2', accountText());
    seedAccount(985, 's7', accountText({ frontMatter: { prd: '985', slice: 's7' } }));

    const ctx = flatCtx(root);
    expect(readAccounts(parsePrd(1044), { ctx })).toHaveLength(1);
    // The 985 account names an item id that does not exist under 985 either, so it refuses —
    // but the point here is isolation: it must not even be considered by the 1044 read.
    expect(readAccounts(parsePrd(985), { ctx })[0]?.ok).toBe(false);
  });
});

describe('compare', () => {
  const risky = [
    { path: 'libs/vertuo-ai-credit/src/server/migrations.ts', status: 'M', rule: 'stored-shape' },
  ];

  function account(entries: AccountEntry[], overrides: Partial<Account> = {}) {
    return { slice: parseWorkSliceId('s2'), file: 'docs/outbox/1044/accounts/s2.md', entries, ...overrides };
  }

  it('an exact match: the one risky change is accounted for, nothing unaccounted, nothing stale', () => {
    const accounts = [
      account([
        {
          path: 'libs/vertuo-ai-credit/src/server/migrations.ts',
          rule: 'stored-shape',
          account: { kind: 'item', id: 's3-01-credit-ledger-shape' },
        },
      ]),
    ];

    const result = compare(risky, accounts);
    expect(result.accounted).toEqual(risky);
    expect(result.unaccounted).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('an unaccounted change: no entry names it', () => {
    const result = compare(risky, []);
    expect(result.accounted).toEqual([]);
    expect(result.unaccounted).toEqual(risky);
    expect(result.stale).toEqual([]);
  });

  it('a stale entry: it names a path/rule pair the risky list never held', () => {
    const accounts = [
      account([
        {
          path: 'some/other/path.ts',
          rule: 'stored-shape',
          account: { kind: 'spec', where: 'no longer touched after a rebase' },
        },
      ]),
    ];

    const result = compare(risky, accounts);
    expect(result.accounted).toEqual([]);
    expect(result.unaccounted).toEqual(risky);
    expect(result.stale).toEqual([
      {
        path: 'some/other/path.ts',
        rule: 'stored-shape',
        account: { kind: 'spec', where: 'no longer touched after a rebase' },
        slice: 's2',
        file: 'docs/outbox/1044/accounts/s2.md',
      },
    ]);
  });

  it('one path firing two rules needs two separate entries', () => {
    const twoRuleRisky = [
      { path: 'docs/knowledge/product/invariants.md', status: 'M', rule: 'law-text' },
      { path: 'docs/knowledge/product/invariants.md', status: 'M', rule: 'law-proof' },
    ];
    const accounts = [
      account([
        {
          path: 'docs/knowledge/product/invariants.md',
          rule: 'law-text',
          account: { kind: 'item', id: 's2-01-a', rank: 'high' },
        },
      ]),
    ];

    const result = compare(twoRuleRisky, accounts);
    expect(result.accounted).toEqual([twoRuleRisky[0]]);
    expect(result.unaccounted).toEqual([twoRuleRisky[1]]);
    expect(result.stale).toEqual([]);
  });
});

describe('compare — a law change is accounted only by an item ranked high (PRD 1342)', () => {
  const PATH = 'docs/knowledge/product/invariants.md';

  function oneEntry(rule: string, account: AccountEntry['account']) {
    return [{ slice: parseWorkSliceId('s2'), file: 'docs/outbox/1342/accounts/s2.md', entries: [{ path: PATH, rule, account }] }];
  }

  it.each(['law-proof', 'law-text', 'test-removed', 'law-demoted'])('refuses spec <where> for %s', (rule) => {
    const risky = [{ path: PATH, status: 'M', rule }];
    const result = compare(risky, oneEntry(rule, { kind: 'spec', where: 'Solution, §2' }));
    expect(result.accounted).toEqual([]);
    expect(result.unaccounted).toEqual([
      { ...risky[0], refused: 'its account "spec Solution, §2" is refused: a change to a law is accounted only by an item ranked high' },
    ]);
    expect(result.stale).toEqual([]);
  });

  it.each(['stored-shape', 'shared-contract'])('still accepts spec <where> for %s', (rule) => {
    const risky = [{ path: PATH, status: 'M', rule }];
    expect(compare(risky, oneEntry(rule, { kind: 'spec', where: 'Solution' })).accounted).toEqual(risky);
  });

  it('refuses an item ranked medium for a law change, naming the item and its rank', () => {
    const risky = [{ path: PATH, status: 'M', rule: 'law-proof' }];
    const result = compare(risky, oneEntry('law-proof', { kind: 'item', id: 's2-01-a', rank: 'medium' }));
    expect(result.accounted).toEqual([]);
    expect(result.unaccounted).toEqual([
      { ...risky[0], refused: 'its account names item s2-01-a, ranked medium: a change to a law needs an item ranked high' },
    ]);
  });

  it('refuses an item whose rank was never read', () => {
    const risky = [{ path: PATH, status: 'M', rule: 'law-text' }];
    const result = compare(risky, oneEntry('law-text', { kind: 'item', id: 's2-01-a' }));
    expect(result.unaccounted).toEqual([
      { ...risky[0], refused: 'its account names item s2-01-a, ranked unknown: a change to a law needs an item ranked high' },
    ]);
  });

  it.each(['high', 'human-action'])('accepts an item ranked %s for a law change', (rank) => {
    const risky = [{ path: PATH, status: 'M', rule: 'law-demoted' }];
    const result = compare(risky, oneEntry('law-demoted', { kind: 'item', id: 's2-01-a', rank }));
    expect(result.accounted).toEqual(risky);
    expect(result.unaccounted).toEqual([]);
  });

  it('carries no refused reason on a change no entry names', () => {
    const risky = [{ path: PATH, status: 'M', rule: 'law-text' }];
    expect(compare(risky, []).unaccounted[0]).not.toHaveProperty('refused');
  });

  it('still accepts a medium item for a rule that is not a law rule', () => {
    const risky = [{ path: PATH, status: 'M', rule: 'stored-shape' }];
    expect(compare(risky, oneEntry('stored-shape', { kind: 'item', id: 's2-01-a', rank: 'medium' })).accounted).toEqual(risky);
  });

  it('an accepted entry beside a refused one accounts for the change', () => {
    const risky = [{ path: PATH, status: 'M', rule: 'law-text' }];
    const accounts = [
      ...oneEntry('law-text', { kind: 'spec', where: 'Solution' }),
      ...oneEntry('law-text', { kind: 'item', id: 's2-02-b', rank: 'high' }),
    ];
    const result = compare(risky, accounts);
    expect(result.accounted).toEqual(risky);
    expect(result.unaccounted).toEqual([]);
  });
});

describe('readAccounts — the rank of the item an account names (PRD 1342)', () => {
  const lawBody = ['## Risky changes', '', '- `docs/knowledge/product/invariants.md`', '  law-text', '  item s3-01-credit-ledger-shape', ''].join('\n');

  function rankRead(ctx = flatCtx(root)) {
    const [result] = readAccounts(parsePrd(1044), { ctx });
    return view(result).account.entries[0]?.account;
  }

  it('reads the rank of an open item', () => {
    seedItem(1044, 's3-01-credit-ledger-shape', 'medium');
    seedAccount(1044, 's2', accountText({ body: lawBody }));
    expect(rankRead()).toEqual({ kind: 'item', id: 's3-01-credit-ledger-shape', rank: 'medium' });
  });

  it('reads the rank a settled item was raised with', () => {
    seedItem(1044, 's3-01-credit-ledger-shape', 'high');
    seedAccount(1044, 's2', accountText({ body: lawBody }));
    const ctx = flatCtx(root);
    const settled = settleItem({
      ctx,
      file: 'docs/outbox/1044/s3-01-credit-ledger-shape.md',
      answer: {
        text: 'Yes, keep it as is.',
        approvedBy: 'pierrederval',
        approvedAt: '2026-09-23T09:30:00Z',
        channel: { kind: 'prd-issue', number: 1044 },
        statedVerdict: 'agreed',
      },
    });
    expect(settled.ok).toBe(true);
    expect(rankRead(ctx)).toEqual({ kind: 'item', id: 's3-01-credit-ledger-shape', rank: 'high' });
  });

  it('reads a null rank for an open item file that does not parse', () => {
    mkdirSync(join(root, 'docs/outbox/1044'), { recursive: true });
    writeFileSync(join(root, 'docs/outbox/1044/s3-01-credit-ledger-shape.md'), 'not an item\n');
    seedAccount(1044, 's2', accountText({ body: lawBody }));
    expect(rankRead()).toEqual({ kind: 'item', id: 's3-01-credit-ledger-shape', rank: null });
  });

  it('leaves a spec account as it was written', () => {
    const body = ['## Risky changes', '', '- `a/migrations.ts`', '  stored-shape', '  spec Solution', ''].join('\n');
    seedAccount(1044, 's2', accountText({ body }));
    expect(rankRead()).toEqual({ kind: 'spec', where: 'Solution' });
  });
});
