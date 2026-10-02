import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { makeMarkers } from '../markers.ts';
import { renderAdoptedEntry, renderSettledEntry, settledHeader } from '../outbox/settle.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import { candidatesFromLedger, harvestCandidates, writtenBack, type Candidate } from './harvest.ts';
import { assertDefined } from '../../test/assert.ts';

/** The fixture's parsed item: every fixture here parses, so a miss is a broken fixture. */
function itemOf(text: string) {
  const parsed = parseOutboxItem(text);
  if (!parsed.ok) throw new Error('fixture outbox item does not parse');
  return parsed.item;
}

const markers = makeMarkers('omni-outbox');

/** One item's text, as a slice raised it. */
function itemText({ id, rank = 'medium', slice = 's1', prd = 7 }: { id: string; rank?: string; slice?: string; prd?: number }): string {
  return [
    '---',
    `id: ${id}`,
    `prd: ${prd}`,
    `slice: ${slice}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-20',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    `Which way should ${id} go?`,
    '',
    '## The decision, in plain words',
    '',
    `It goes the simple way for ${id}.`,
    '',
    '## The options, in plain words',
    '',
    'A. The simple way, the option built.',
    'B. The other way.',
    '',
    '## What I had to decide',
    '',
    `Whether ${id} reads one file or two.`,
    '',
    '## What I did meanwhile',
    '',
    `${id} reads one file.`,
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
}

function adopted(id: string): string {
  const text = itemText({ id });
  const item = itemOf(text);
  return renderAdoptedEntry({ item, itemText: text, markers });
}

function drifted(id: string, { answer = 'No, it should read two files instead.' }: { answer?: string } = {}): string {
  const text = itemText({ id });
  const item = itemOf(text);
  return renderSettledEntry({
    item,
    itemText: text,
    answer: {
      text: answer,
      approvedBy: '@ada',
      approvedAt: '2026-09-22T10:00:00Z',
      channel: { kind: 'feature-pull-request', number: 12, url: 'https://github.com/acme/widgets/pull/12' },
    },
    judgement: { verdict: 'drifted', basis: 'stated', reason: 'a human said so' },
    markers,
  });
}

/** Adds a ledger line to a rendered entry, right after its `- Wave:` line, as write-back does. */
function withLine(entry: string, line: string): string {
  return entry.replace(/^(- Wave: .*)$/m, `$1\n${line}`);
}

function ledger(...entries: string[]): string {
  const ctx = { config: { paths: { delivery: '.omni-loop/delivery' } } };
  return [settledHeader(7, { ctx }), ...entries].join('\n');
}

const LEDGER = ledger(
  withLine(adopted('s1-01-became'), '- Became: ADR-0001'),
  withLine(adopted('s1-02-stays'), '- Stays here: a local choice, nothing lasting'),
  adopted('s1-03-twice'),
  adopted('s1-04-plain'),
  drifted('s1-03-twice'),
);

describe('candidatesFromLedger', () => {
  it('lists the latest entry per id carrying neither Became: nor Stays here:', () => {
    const candidates = candidatesFromLedger(LEDGER, { markers, ledgerFile: 'x/settled.md' });
    expect(candidates.map((candidate) => [candidate.id, candidate.verdict])).toEqual([
      ['s1-03-twice', 'drifted'],
      ['s1-04-plain', 'adopted'],
    ]);
  });

  it('carries the item text, the answer, the verdict, the approver, the time and the channel', () => {
    const [twice, plain] = candidatesFromLedger(LEDGER, { markers, ledgerFile: 'x/settled.md' }) as [Candidate, Candidate];
    expect(twice).toMatchObject({
      id: 's1-03-twice',
      ledgerFile: 'x/settled.md',
      itemText: itemText({ id: 's1-03-twice' }),
      answer: 'No, it should read two files instead.',
      verdict: 'drifted',
      approvedBy: '@ada',
      approvedAt: '2026-09-22T10:00:00Z',
      channel: 'feature pull request #12',
      channelUrl: 'https://github.com/acme/widgets/pull/12',
      rank: 'medium',
    });
    assertDefined(twice.item, 'twice.item');
    expect(twice.item.sections.whatIHadToDecide).toBe('Whether s1-03-twice reads one file or two.');
    expect(plain).toMatchObject({
      verdict: 'adopted',
      approvedBy: 'nobody',
      approvedAt: '2026-09-20',
      channel: null,
      channelUrl: null,
    });
    expect(plain.answer).toMatch(/^Adopted the moment it was raised/);
  });

  it('skips an id whose latest entry was written back, even when an earlier one was not', () => {
    const text = ledger(adopted('s1-05-late'), withLine(drifted('s1-05-late'), '- Became: BR-PRODUCT-1'));
    expect(candidatesFromLedger(text, { markers })).toEqual([]);
  });

  it('reads an empty ledger as nothing to harvest', () => {
    expect(candidatesFromLedger(ledger(), { markers })).toEqual([]);
  });
});

describe('writtenBack', () => {
  it('is true for Became: or a non-empty Stays here:, false otherwise', () => {
    expect(writtenBack({ became: ['ADR-0001'], fields: {} })).toBe(true);
    expect(writtenBack({ became: [], fields: { 'Stays here': 'local' } })).toBe(true);
    expect(writtenBack({ became: [], fields: { 'Stays here': ' ' } })).toBe(false);
    expect(writtenBack({ became: [], fields: {} })).toBe(false);
  });
});

describe('harvestCandidates', () => {
  it('reads the PRD ledger from the working tree, naming it on every candidate', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/delivery/shipped/0007-widgets/spec.md': '# spec\n',
        '.omni-loop/delivery/shipped/0007-widgets/outbox/settled.md': LEDGER,
      },
    });
    const candidates = harvestCandidates({ ctx, prd: 7 });
    expect(candidates.map((candidate) => candidate.id)).toEqual(['s1-03-twice', 's1-04-plain']);
    assertDefined(candidates[0], 'candidates[0]');
    expect(candidates[0].ledgerFile).toBe('.omni-loop/delivery/shipped/0007-widgets/outbox/settled.md');
  });

  it('is empty for a PRD with no folder or no ledger', () => {
    const { ctx } = makeRepo({ files: { '.omni-loop/delivery/inbox/0007-widgets/spec.md': '# spec\n' } });
    expect(harvestCandidates({ ctx, prd: 7 })).toEqual([]);
    expect(harvestCandidates({ ctx, prd: 8 })).toEqual([]);
  });
});
