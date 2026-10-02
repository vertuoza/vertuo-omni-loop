import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { makeMarkers } from '../markers.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import { renderAdoptedEntry, settledHeader } from '../outbox/settle.ts';
import type { ClassificationReply } from './classify.ts';
import { finishHarvest, noEdits, prepareHarvest, type Prepared } from './pipeline.ts';

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
const MERGE = { by: 'octocat', at: '2026-09-26T10:30:00Z', pr: 43, url: 'https://github.com/acme/widgets/pull/43' };

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
    [ledger]: [settledHeader(42, { ctx: { config: { paths: { delivery: D } } } }), ...IDS.map(adopted)].join('\n'),
  };
}

const STAYS: ClassificationReply = { kind: 'stays-here', statement: 'A local choice.', reason: 'nothing lasting' };
const COVERED: ClassificationReply = { kind: 'covered', covers: 'ADR-0001', reason: 'the record says it' };
const ADR: ClassificationReply = { kind: 'adr', title: 'Widgets are built the simple way', statement: 'Widgets are built the simple way.', reason: 'how it is built' };

const repos: { root: string }[] = [];
afterEach(() => {
  while (repos.length) rmSync(repos.pop()!.root, { recursive: true, force: true });
});

function harvest(prdDir: string, replies: Record<string, ClassificationReply>) {
  const r = makeRepo({ files: files(prdDir), git: true });
  repos.push(r);
  const prepared = prepareHarvest({ ctx: r.ctx, prd: 42, merge: MERGE }) as Extract<Prepared, { ok: true }>;
  const classified = prepared.candidates.map((c) =>
    replies[c.id] ? { id: c.id, reply: replies[c.id]! } : { id: c.id, reply: null, reason: 'not asked' },
  );
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
    const ledger = finished.edits.writes.find((w) => w.path === `${SHIPPED}/outbox/settled.md`)!.text;
    expect(ledger).toContain('- Stays here: nothing lasting');
    expect(ledger).toContain('- Became: ADR-0002');
    expect(ledger).toContain('- Became: ADR-0001');
  });
});
