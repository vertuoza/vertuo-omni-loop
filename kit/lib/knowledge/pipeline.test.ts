import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { makeMarkers } from '../markers.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import { renderAdoptedEntry, settledHeader } from '../outbox/settle.ts';
import type { ClassificationReply } from './classify.ts';
import { PullFilesSchema, finishHarvest, keptPaths, noEdits, prepareHarvest, type Prepared } from './pipeline.ts';
import { assertDefined } from '../../test/assert.ts';
import { parsePr, parsePrd } from '../ids.ts';

/** The fixture's parsed item: every fixture here parses, so a miss is a broken fixture. */
function itemOf(text: string) {
  const parsed = parseOutboxItem(text);
  if (!parsed.ok) throw new Error('fixture outbox item does not parse');
  return parsed.item;
}

const markers = makeMarkers('omni-outbox');
const K = '.omni-loop/knowledge';
const D = '.omni-loop/delivery';
const INBOX = `${D}/inbox/0042-widgets`;
const SHIPPED = `${D}/shipped/0042-widgets`;
const MERGE = { by: 'octocat', at: '2026-09-26T10:30:00Z', pr: parsePr(43), url: 'https://github.com/acme/widgets/pull/43' };

function adopted(id: string): string {
  const text = [
    '---',
    `id: ${id}`,
    'prd: 42',
    'slice: s1',
    'rank: medium',
    'bears-on: none',
    'raised: 2026-09-24',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    `Should ${id} ship as it is?`,
    '',
    '## The decision, in plain words',
    '',
    'Yes, this is the fixture answer.',
    '',
    '## The options, in plain words',
    '',
    'A. Keep what was built.',
    'B. Change it.',
    '',
    '## What I had to decide',
    '',
    `How ${id} is built.`,
    '',
    '## What I did meanwhile',
    '',
    'Built the simple way.',
    '',
    '## What it costs to change later',
    '',
    'One constant.',
    '',
    '## What I could not know',
    '',
    '(author) Nothing settles it.',
    '',
  ].join('\n');
  return renderAdoptedEntry({ item: itemOf(text), itemText: text, markers });
}

const IDS = ['s1-01-local-name', 's1-02-button-colour', 's1-03-covered', 's1-04-unasked'];

/** A PRD already shipped by its feature branch, whose ledger holds four adopted decisions. */
function files(prdDir: string): Record<string, string> {
  const ledger = `${prdDir}/outbox/settled.md`;
  return {
    '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n',
    [`${K}/README.md`]: '# Knowledge\n',
    [`${K}/product/principles.md`]: '# Product principles\n\nNone yet.\n',
    [`${K}/product/rules.md`]: '# Product rules\n\nNone yet.\n',
    [`${K}/product/invariants.md`]: '# Product invariants\n\nNone yet.\n',
    [`${K}/adr/README.md`]: '# Decisions\n',
    [`${K}/adr/0001-outbox-check-as-app.md`]: '# ADR-0001 — The outbox check runs as an app\n\nBody.\n',
    [`${prdDir}/spec.md`]: '# Widgets\n',
    [`${prdDir}/plan.md`]: '# Plan\n',
    [ledger]: [settledHeader(parsePrd(42), { ctx: { config: { paths: { delivery: D } } } }), ...IDS.map(adopted)].join('\n'),
  };
}

const STAYS: ClassificationReply = { kind: 'stays-here', statement: 'A local choice.', reason: 'nothing lasting' };
const COVERED: ClassificationReply = { kind: 'covered', covers: 'ADR-0001', reason: 'the record says it' };
const ADR: ClassificationReply = { kind: 'adr', title: 'Widgets are built the simple way', statement: 'Widgets are built the simple way.', reason: 'how it is built' };

const repos: { root: string }[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) rmSync(repo.root, { recursive: true, force: true });
});

function harvest(prdDir: string, replies: Record<string, ClassificationReply>) {
  const r = makeRepo({ files: files(prdDir), git: true });
  repos.push(r);
  const prepared = prepareHarvest({ ctx: r.ctx, prd: parsePrd(42), merge: MERGE }) as Extract<Prepared, { ok: true }>;
  const classified = prepared.candidates.map((c) => {
    const reply = replies[c.id];
    return reply ? { id: c.id, reply } : { id: c.id, reply: null, reason: 'not asked' };
  });
  return { prepared, finished: finishHarvest({ ctx: r.ctx, prepared, classified, merge: MERGE, date: '2026-09-27' }) };
}

describe('finishHarvest without a promotion', () => {
  it('returns no edits when every candidate stays here, is covered or is not placed', () => {
    const { prepared, finished } = harvest(SHIPPED, {
      's1-01-local-name': STAYS,
      's1-02-button-colour': STAYS,
      's1-03-covered': COVERED,
    });
    expect(prepared.candidates.map((c) => c.id).sort()).toEqual(IDS);
    expect(noEdits(finished.edits)).toBe(true);
    expect(finished.placed.map((p) => [p.id, p.kind]).sort()).toEqual([
      ['s1-01-local-name', 'stays-here'],
      ['s1-02-button-colour', 'stays-here'],
      ['s1-03-covered', 'covered'],
    ]);
    expect(finished.notPlaced).toEqual([{ id: 's1-04-unasked', reason: 'not asked' }]);
  });

  it('keeps what prepare planned (the ship out of the inbox) and adds nothing of its own', () => {
    const { prepared, finished } = harvest(INBOX, { 's1-01-local-name': STAYS });
    expect(prepared.edits.moves).toEqual([{ from: INBOX, to: SHIPPED }]);
    expect(finished.edits).toEqual(prepared.edits);
    expect(finished.edits.writes.some((w) => w.text.includes('Stays here'))).toBe(false);
  });
});

describe('the files the feature pull request changed (PRD 1171)', () => {
  const RULE: ClassificationReply = {
    kind: 'rule',
    place: 'product',
    statement: 'A widget is built the simple way.',
    serves: 'new',
    principle: { statement: 'Widgets stay simple.', why: 'simple widgets are easy to change.' },
    enforcedBy: ['kit/lib/foo.test.ts', 'kit/lib/gone.test.ts'],
    reason: 'a provable rule',
  };

  it('reads GitHub\'s list of a pull request\'s files: a rename by its new path, a removal kept as removed', () => {
    expect(
      PullFilesSchema.parse([
        { filename: 'a.ts', status: 'added', additions: 3 },
        { filename: 'new.ts', previous_filename: 'old.ts', status: 'renamed' },
        { filename: 'b.ts', status: 'removed' },
      ]),
    ).toEqual([
      { path: 'a.ts', status: 'added' },
      { path: 'new.ts', status: 'renamed' },
      { path: 'b.ts', status: 'removed' },
    ]);
    expect(keptPaths([{ path: 'a.ts', status: 'added' }, { path: 'b.ts', status: 'removed' }, { path: 'c.ts', status: 'modified' }])).toEqual([
      'a.ts',
      'c.ts',
    ]);
  });

  it('a harvest given the changed files writes a kept proof that passes the knowledge check, still proposed', () => {
    const r = makeRepo({ files: { ...files(SHIPPED), 'kit/lib/foo.test.ts': 'test\n' }, git: true });
    repos.push(r);
    const changed = [
      { path: 'kit/lib/foo.test.ts', status: 'added' },
      { path: 'kit/lib/gone.test.ts', status: 'removed' },
    ];
    const prepared = prepareHarvest({ ctx: r.ctx, prd: parsePrd(42), merge: MERGE, changed }) as Extract<Prepared, { ok: true }>;
    expect(prepared.changed).toEqual(changed);
    const classified = prepared.candidates.map((c) => (c.id === 's1-02-button-colour' ? { id: c.id, reply: RULE } : { id: c.id, reply: null, reason: 'not asked' }));
    const finished = finishHarvest({ ctx: r.ctx, prepared, classified, merge: MERGE, date: '2026-09-27' });
    expect(finished.checks.knowledge).toEqual([]);
    const rules = finished.edits.writes.find((w) => w.path === `${K}/product/rules.md`);
    assertDefined(rules, 'the rules written');
    expect(rules.text).toContain('Enforced by: kit/lib/foo.test.ts\n');
    expect(rules.text).toContain('Proposed: harvest 2026-09-27');
    const placed = finished.placed.find((p) => p.id === 's1-02-button-colour');
    expect(placed?.dropped).toEqual([{ path: 'kit/lib/gone.test.ts', reason: 'removed by #43' }]);
  });

  it('without the changed files, writes unenforced as before', () => {
    const { finished } = harvest(SHIPPED, { 's1-02-button-colour': RULE });
    const rules = finished.edits.writes.find((w) => w.path === `${K}/product/rules.md`);
    expect(rules?.text).toContain('Enforced by: unenforced\n');
  });
});

describe('finishHarvest with a promotion', () => {
  it('writes every note, "Stays here" included, beside the new record', () => {
    const { finished } = harvest(SHIPPED, {
      's1-01-local-name': STAYS,
      's1-02-button-colour': ADR,
      's1-03-covered': COVERED,
    });
    expect(noEdits(finished.edits)).toBe(false);
    const paths = finished.edits.writes.map((w) => w.path);
    expect(paths).toContain(`${K}/adr/0002-widgets-are-built-the-simple-way.md`);
    const ledgerWrite = finished.edits.writes.find((w) => w.path === `${SHIPPED}/outbox/settled.md`);
    assertDefined(ledgerWrite, 'the ledger written');
    const ledger = ledgerWrite.text;
    expect(ledger).toContain('- Stays here: nothing lasting');
    expect(ledger).toContain('- Became: ADR-0002');
    expect(ledger).toContain('- Became: ADR-0001');
  });
});
