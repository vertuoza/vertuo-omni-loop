import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { flatCtx } from '../../test/flat-layout.ts';
import { memorySource } from '../knowledge/registers.ts';
import { makeMarkers } from '../markers.ts';
import { adoptItem } from './settle.ts';
import { formatReport, gateResult, openItemFiles, openItems } from './status.ts';
import { parsePrd } from '../ids.ts';

/** One `docs/outbox/<prd>/accounts/<slice>.md` file, minimal but well-formed (PRD #1044, slice s2). */
type FixtureEntry = { path: string; rule: string; account: string };

function accountText({
  prd = '985',
  slice = 's1',
  graded = '2026-09-23',
  entries = [],
}: { prd?: string; slice?: string; graded?: string; entries?: FixtureEntry[] } = {}) {
  const fmLines = [`prd: ${prd}`, `slice: ${slice}`, `graded: ${graded}`];
  const entryLines = entries.flatMap(({ path, rule, account }) => [`- \`${path}\``, rule, account]);
  return ['---', ...fmLines, '---', '', '## Risky changes', '', ...entryLines, ''].join('\n');
}

function writeAccount(root: string, prd: string | number, filename: string, text: string) {
  const dir = join(root, 'docs/outbox', String(prd), 'accounts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), text);
}

function itemText({
  frontMatter = {},
  sections = {},
}: { frontMatter?: Record<string, string | undefined>; sections?: Record<string, string | undefined> } = {}) {
  const fm: Record<string, string | undefined> = {
    id: 's3-01-example',
    prd: '985',
    slice: 's3',
    rank: 'medium',
    'bears-on': 'none',
    raised: '2026-09-22',
    wave: '3',
    ...frontMatter,
  };
  const fmLines = Object.entries(fm)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value ?? ''}`);

  const body: Record<string, string | undefined> = {
    'The question, in plain words': 'Should this ship as it is?',
    'The decision, in plain words': 'Yes, this is the fixture answer.',
    'What I had to decide': 'x',
    'What I did meanwhile': 'y',
    'What it costs to change later': 'z',
    'What I could not know': '(author) w',
    ...sections,
  };
  const bodyText = [
    'The question, in plain words',
    'The decision, in plain words',
    'What I had to decide',
    'What I did meanwhile',
    'What it costs to change later',
    'What I could not know',
  ]
    .filter((heading) => body[heading] !== undefined)
    .map((heading) => `## ${heading}\n\n${body[heading]}\n`)
    .join('\n');

  return ['---', ...fmLines, '---', '', bodyText].join('\n');
}

const dirs: string[] = [];

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'outbox-status-'));
  dirs.push(root);
  return root;
}

/**
 * A fixture root ready for `riskyChanges` too — its `law-proof` rule reads `ctx.layout.knowledgeRoot`
 * off `ctx` on every call (`decision-coverage.mjs`'s `enforcedByPaths`). An empty invariants file
 * parses to no entries, so `law-proof` never fires here unless a test seeds an `Enforced by:`
 * entry itself.
 */
function rangeFixtureRoot() {
  const root = fixtureRoot();
  mkdirSync(join(root, 'docs/knowledge/product'), { recursive: true });
  writeFileSync(join(root, 'docs/knowledge/product/invariants.md'), '');
  return root;
}

/** The two repository-specific risk patterns upstream hard-coded — reproduced here as config, so
 * the range tests below hold their assertions unchanged. */
const RISK = {
  storedShape: ['^libs/[^/]+/src/server/migrations\\.ts$'],
  sharedContract: ['libs/system-api-contract/'],
};

function writeItem(root: string, prd: string | number, filename: string, text: string) {
  const dir = join(root, 'docs/outbox', String(prd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), text);
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() ?? '', { recursive: true, force: true });
  }
});

describe('openItemFiles', () => {
  it('is empty for a PRD with no outbox directory at all', () => {
    const root = fixtureRoot();
    expect(openItemFiles(parsePrd('985'), { ctx: flatCtx(root) })).toEqual([]);
  });

  it('is empty for a PRD directory holding only settled.md', () => {
    const root = fixtureRoot();
    writeItem(root, '985', 'settled.md', '# settled\n');
    expect(openItemFiles(parsePrd('985'), { ctx: flatCtx(root) })).toEqual([]);
  });

  it('never crosses into another PRD’s directory', () => {
    const root = fixtureRoot();
    writeItem(
      root,
      '111',
      's1-01-other.md',
      itemText({ frontMatter: { prd: '111', slice: 's1' } }),
    );
    expect(openItemFiles(parsePrd('985'), { ctx: flatCtx(root) })).toEqual([]);
  });

  it('lists several open items for one PRD, sorted', () => {
    const root = fixtureRoot();
    writeItem(root, '985', 's3-02-second.md', itemText({ frontMatter: { id: 's3-02-second' } }));
    writeItem(root, '985', 's3-01-first.md', itemText({ frontMatter: { id: 's3-01-first' } }));
    expect(openItemFiles(parsePrd('985'), { ctx: flatCtx(root) })).toEqual([
      'docs/outbox/985/s3-01-first.md',
      'docs/outbox/985/s3-02-second.md',
    ]);
  });
});

describe('openItems', () => {
  it('reads a well-formed item’s id and rank', () => {
    const root = fixtureRoot();
    writeItem(
      root,
      '985',
      's3-01-example.md',
      itemText({ frontMatter: { id: 's3-01-example', rank: 'high' } }),
    );
    expect(openItems(parsePrd('985'), { ctx: flatCtx(root) })).toEqual([
      { file: 'docs/outbox/985/s3-01-example.md', id: 's3-01-example', rank: 'high' },
    ]);
  });

  it('still counts a malformed item as open, with a null id and rank', () => {
    const root = fixtureRoot();
    writeItem(root, '985', 's3-01-broken.md', 'not an outbox item at all\n');
    expect(openItems(parsePrd('985'), { ctx: flatCtx(root) })).toEqual([
      { file: 'docs/outbox/985/s3-01-broken.md', id: null, rank: null },
    ]);
  });
});

describe('gateResult', () => {
  it('is green on an empty tree', () => {
    const root = fixtureRoot();
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root) });
    expect(result).toEqual({
      ok: true,
      items: [],
      overridden: false,
      unreworked: [],
      overrideLabel: 'omni:outbox-go',
    });
  });

  it('is red with one open item', () => {
    const root = fixtureRoot();
    writeItem(root, '985', 's3-01-one.md', itemText());
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root) });
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.overridden).toBe(false);
  });

  it('is red with several open items', () => {
    const root = fixtureRoot();
    writeItem(root, '985', 's3-01-one.md', itemText({ frontMatter: { id: 's3-01-one' } }));
    writeItem(root, '985', 's3-02-two.md', itemText({ frontMatter: { id: 's3-02-two' } }));
    writeItem(root, '985', 's3-03-three.md', itemText({ frontMatter: { id: 's3-03-three' } }));
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root) });
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(3);
  });

  it('goes green under the omni:outbox-go label, however many items are open', () => {
    const root = fixtureRoot();
    const ctx = flatCtx(root);
    writeItem(root, '985', 's3-01-one.md', itemText({ frontMatter: { id: 's3-01-one' } }));
    writeItem(root, '985', 's3-02-two.md', itemText({ frontMatter: { id: 's3-02-two' } }));
    const result = gateResult(parsePrd('985'), { ctx, labels: ['omni:feature', ctx.config.labels.outboxGo] });
    expect(result.ok).toBe(true);
    expect(result.overridden).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('an unrelated label never overrides', () => {
    const root = fixtureRoot();
    writeItem(root, '985', 's3-01-one.md', itemText());
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root), labels: ['omni:feature'] });
    expect(result.ok).toBe(false);
  });
});

// PRD #1166, slice s5: a medium item is adopted straight to settled.md, so it never becomes an
// open item file — this guard reads only open files, and needs no rule change to stay green.
describe('gateResult — a medium item adopted at raise time', () => {
  it('is green for a PRD whose only outbox activity is adopted medium entries', () => {
    const root = fixtureRoot();
    const ctx = flatCtx(root);
    const adopted = adoptItem({
      ctx,
      itemText: itemText({ frontMatter: { rank: 'medium' } }),
    });
    expect(adopted.ok).toBe(true);

    const result = gateResult(parsePrd('985'), { ctx });
    expect(result).toEqual({
      ok: true,
      items: [],
      overridden: false,
      unreworked: [],
      overrideLabel: 'omni:outbox-go',
    });
  });
});

describe('formatReport', () => {
  it('says plainly that there is no open item', () => {
    const report = formatReport(parsePrd('985'), { ok: true, items: [], overridden: false });
    expect(report).toBe('outbox-status — PRD #985: no open item.');
  });

  it('lists every open item with its rank', () => {
    const result = {
      ok: false,
      overridden: false,
      items: [
        { file: 'docs/outbox/985/s3-01-one.md', id: 's3-01-one', rank: 'high' },
        { file: 'docs/outbox/985/s3-02-two.md', id: null, rank: null },
      ],
    };
    const report = formatReport(parsePrd('985'), result);
    expect(report).toContain('2 open item(s)');
    expect(report).toContain('docs/outbox/985/s3-01-one.md (high)');
    expect(report).toContain('docs/outbox/985/s3-02-two.md');
    expect(report).not.toContain('s3-02-two.md (');
  });

  it('names the override when it waved the gate through', () => {
    const result = {
      ok: true,
      overridden: true,
      overrideLabel: 'omni:outbox-go',
      items: [{ file: 'docs/outbox/985/s3-01-one.md', id: 's3-01-one', rank: 'high' }],
    };
    expect(formatReport(parsePrd('985'), result)).toContain('omni:outbox-go — override in effect');
  });

  it('names both the open item and the unaccounted change when both are present', () => {
    const result = {
      ok: false,
      overridden: false,
      items: [{ file: 'docs/outbox/985/s3-01-one.md', id: 's3-01-one', rank: 'high' }],
      unaccounted: [
        {
          path: 'libs/vertuo-ai-credit/src/server/migrations.ts',
          status: 'M',
          rule: 'stored-shape',
        },
      ],
    };
    const report = formatReport(parsePrd('985'), result);
    expect(report).toContain('1 open item(s)');
    expect(report).toContain('unaccounted risky change');
    expect(report.split('\n')).toContain('  - libs/vertuo-ai-credit/src/server/migrations.ts (stored-shape)');
  });
});

// PRD #1044, slice s4 — a second reason for the gate to be red: the range holds a risky change no
// account names. `gateResult`'s existing tests above are untouched; `changes` is a new, optional
// argument, and every scenario here passes it explicitly.
describe('gateResult — the range (PRD #1044, slice s4)', () => {
  const RISKY_CHANGE = { path: 'libs/vertuo-ai-credit/src/server/migrations.ts', status: 'M' };

  it('is red when the range holds one risky change no account names', () => {
    const root = rangeFixtureRoot();
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root, { risk: RISK }), changes: [RISKY_CHANGE] });
    expect(result.ok).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.unaccounted).toHaveLength(1);
    expect(result.unaccounted?.[0]).toMatchObject({
      path: RISKY_CHANGE.path,
      rule: 'stored-shape',
    });
  });

  it('is green when there is no open item and the range holds nothing risky', () => {
    const root = rangeFixtureRoot();
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root, { risk: RISK }), changes: [] });
    expect(result).toEqual({
      ok: true,
      items: [],
      overridden: false,
      unreworked: [],
      unaccounted: [],
      overrideLabel: 'omni:outbox-go',
    });
  });

  it('stays red with an open item even when the range has nothing unaccounted, as it does today', () => {
    const root = rangeFixtureRoot();
    writeItem(root, '985', 's3-01-one.md', itemText());
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root, { risk: RISK }), changes: [] });
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.unaccounted).toEqual([]);
  });

  it('goes green under omni:outbox-go with both an open item and an unaccounted change', () => {
    const root = rangeFixtureRoot();
    const ctx = flatCtx(root, { risk: RISK });
    writeItem(root, '985', 's3-01-one.md', itemText());
    const result = gateResult(parsePrd('985'), {
      ctx,
      changes: [RISKY_CHANGE],
      labels: ['omni:feature', ctx.config.labels.outboxGo],
    });
    expect(result.ok).toBe(true);
    expect(result.overridden).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.unaccounted).toHaveLength(1);
  });

  it('an unrelated label never overrides an unaccounted change', () => {
    const root = rangeFixtureRoot();
    const result = gateResult(parsePrd('985'), {
      ctx: flatCtx(root, { risk: RISK }),
      changes: [RISKY_CHANGE],
      labels: ['omni:feature'],
    });
    expect(result.ok).toBe(false);
  });

  it('is green when the risky change is accounted for', () => {
    const root = rangeFixtureRoot();
    writeAccount(
      root,
      '985',
      's1.md',
      accountText({
        entries: [
          {
            path: RISKY_CHANGE.path,
            rule: 'stored-shape',
            account: 'spec docs/inbox/985-example.md#risky',
          },
        ],
      }),
    );
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root, { risk: RISK }), changes: [RISKY_CHANGE] });
    expect(result.ok).toBe(true);
    expect(result.unaccounted).toEqual([]);
  });

  it('is green when the only account entry is stale — it does not hold the gate', () => {
    const root = rangeFixtureRoot();
    writeAccount(
      root,
      '985',
      's1.md',
      accountText({
        entries: [
          {
            // The range below never touches this path — the account is stale.
            path: 'libs/vertuo-ai-other/src/server/migrations.ts',
            rule: 'stored-shape',
            account: 'spec docs/inbox/985-example.md#risky',
          },
        ],
      }),
    );
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root, { risk: RISK }), changes: [] });
    expect(result.ok).toBe(true);
    expect(result.unaccounted).toEqual([]);
  });
});

// This task: a third reason for the gate to be red — a drifted decision nobody reworked yet, even
// when the outbox itself carries no open item. Uses the default folders layout (`makeRepo`) rather
// than `flatCtx`, exactly as the task's own new cases are written.
function drifted(markers: ReturnType<typeof makeMarkers>, id: string, closed: string) {
  return [
    markers.settledOpen(id),
    `## ${id} — drifted`,
    '- Verdict: drifted',
    `- Closed: ${closed}`,
    markers.settledClose(id),
    '',
  ].join('\n');
}

describe('gateResult — unreworked drift (this task)', () => {
  it('stays red while a drifted entry is not reworked, even with nothing open', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/settled.md': drifted(
          makeMarkers('omni-outbox'),
          's1-01-x',
          'no — the build and the decision disagree (/omni:yolo-fix)',
        ),
      },
    });
    const result = gateResult(parsePrd(42), { ctx });
    expect(result.ok).toBe(false);
    expect(result.unreworked.map((e) => e.id)).toEqual(['s1-01-x']);
    expect(formatReport(parsePrd(42), result)).toMatch(/1 drifted decision not yet reworked/);
  });

  it('goes green once the drifted entry is closed by a rework', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/settled.md': drifted(
          makeMarkers('omni-outbox'),
          's1-01-x',
          'yes — reworked by #12',
        ),
      },
    });
    expect(gateResult(parsePrd(42), { ctx }).ok).toBe(true);
  });

  it('the override label still waves everything through', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/settled.md': drifted(
          makeMarkers('omni-outbox'),
          's1-01-x',
          'no — x',
        ),
      },
    });
    expect(gateResult(parsePrd(42), { ctx, labels: ['omni:outbox-go'] }).ok).toBe(true);
  });
});

// PRD 1342, slice s2: a person answers every change to a law — the four law rules are accounted
// only by an item ranked high, and the report says why an account was refused.
describe('gateResult — a change to a law (PRD 1342)', () => {
  const REMOVED_TEST = { path: 'kit/lib/proof.test.ts', status: 'D' };

  function lawAccount(root: string, account: string) {
    writeAccount(root, '985', 's1.md', accountText({ entries: [{ path: REMOVED_TEST.path, rule: 'test-removed', account }] }));
  }

  it('stays red while the account is spec <where>, and its report says why', () => {
    const root = rangeFixtureRoot();
    lawAccount(root, 'spec Solution, §2');
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root), changes: [REMOVED_TEST] });
    expect(result.ok).toBe(false);
    expect(formatReport(parsePrd('985'), result)).toContain(
      '  - kit/lib/proof.test.ts (test-removed) — its account "spec Solution, §2" is refused: a change to a law is accounted only by an item ranked high',
    );
  });

  it('stays red while the account names a medium item, even adopted', () => {
    const root = rangeFixtureRoot();
    const ctx = flatCtx(root);
    expect(adoptItem({ ctx, itemText: itemText({ frontMatter: { slice: 's1', id: 's1-01-example' } }) }).ok).toBe(true);
    lawAccount(root, 'item s1-01-example');
    const result = gateResult(parsePrd('985'), { ctx, changes: [REMOVED_TEST] });
    expect(result.ok).toBe(false);
    expect(result.unaccounted).toEqual([
      { ...REMOVED_TEST, rule: 'test-removed', refused: expect.stringContaining('ranked medium') },
    ]);
  });

  it('accounts for the change once the account names an item ranked high', () => {
    const root = rangeFixtureRoot();
    writeItem(root, '985', 's1-01-example.md', itemText({ frontMatter: { slice: 's1', id: 's1-01-example', rank: 'high' } }));
    lawAccount(root, 'item s1-01-example');
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root), changes: [REMOVED_TEST] });
    expect(result.unaccounted).toEqual([]);
    // Still red: the high item is open until a person answers it.
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(1);
  });

  it('grades law-demoted when the caller gives the base knowledge folder', () => {
    const root = rangeFixtureRoot();
    const INVARIANTS = 'docs/knowledge/product/invariants.md';
    const base = memorySource({ [INVARIANTS]: ['## N1', '', 'An invariant.', '', 'Enforced by: kit/lib/proof.test.ts', ''].join('\n') });
    const changes = [{ path: INVARIANTS, status: 'M' }];
    const result = gateResult(parsePrd('985'), { ctx: flatCtx(root), changes, base });
    expect(result.unaccounted?.map((change) => change.rule)).toEqual(['law-text', 'law-demoted']);
    const without = gateResult(parsePrd('985'), { ctx: flatCtx(root), changes });
    expect(without.unaccounted?.map((change) => change.rule)).toEqual(['law-text']);
  });
});
