// PRD 2896 s10: a high item the fleet's committee answered. Settled in the ledger as `answered by fleet <key>`, with the
// option chosen and each member's verdict, so the merge gate into the mission branch reads it as answered; the gate of a pull
// request into the default branch holds it, since no person answered it (BR-PRODUCT-5).
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, assert, describe, expect, it } from 'vitest';
import { makeRepo, type Repo } from '../../test/fixture.ts';
import { parsePr, parsePrd } from '../ids.ts';
import { fleetAnswered, fleetHeldLines, settleByFleet, type FleetAnswer } from './fleet.ts';
import { SETTLED_FILE } from './outbox.ts';
import { parseSettledEntries, settleItem } from './settle.ts';
import { gateResult, openItems } from './status.ts';

const D = '.omni-loop/delivery';
const INBOX = `${D}/inbox/0042-widgets`;
const OUTBOX = `${D}/outbox/0042-widgets`;
const LEDGER = `${OUTBOX}/${SETTLED_FILE}`;
const prd = parsePrd(42);

function itemText({ id, rank }: { id: string; rank: string }): string {
  return [
    '---',
    `id: ${id}`,
    'prd: 42',
    'slice: s1',
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-11-16',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    'Should the cap stay at five?',
    '',
    '## The decision, in plain words',
    '',
    'It stays at five.',
    '',
    '## The options, in plain words',
    '',
    'A. Keep the cap at five (built).',
    'B. Raise it to ten.',
    '',
    '## What I had to decide',
    '',
    'x',
    '',
    '## What I did meanwhile',
    '',
    'y',
    '',
    '## What it costs to change later',
    '',
    'z',
    '',
    '## What I could not know',
    '',
    '(author) w',
    '',
  ].join('\n');
}

const HIGH = `${OUTBOX}/s1-01-keep-the-cap.md`;

const answer = (over: Partial<FleetAnswer> = {}): FleetAnswer => ({
  fleet: 'blue',
  option: 'A',
  branch: 'mission/12-faster-quotes',
  at: '2026-11-16T09:00:00Z',
  pr: parsePr(43),
  url: 'https://github.com/acme/widgets/pull/43',
  verdicts: [
    { role: 'pm', answer: 'yes', sentence: 'In scope.' },
    { role: 'architect', answer: 'yes', sentence: 'Reversible.' },
    { role: 'reviewer', answer: 'yes', sentence: 'Tested.' },
  ],
  ...over,
});

const repos: Repo[] = [];
afterEach(() => {
  for (const one of repos.splice(0)) rmSync(one.root, { recursive: true, force: true });
});

function repo(files: Record<string, string> = {}): Repo {
  const made = makeRepo({ files: { [`${INBOX}/spec.md`]: '# Widgets\n', ...files } });
  repos.push(made);
  return made;
}

/** Writes what settleByFleet returned, as the App's commit does: the ledger, then the deletions. */
function apply(r: Repo, result: ReturnType<typeof settleByFleet>): void {
  assert(result.ok);
  r.write(result.settledFile, result.text);
  for (const file of result.deletes) rmSync(join(r.root, file));
}

describe('settleByFleet', () => {
  it('settles a high item with option A as answered by the fleet, its verdicts kept, and deletes the item', () => {
    const r = repo({ [HIGH]: itemText({ id: 's1-01-keep-the-cap', rank: 'high' }) });
    const result = settleByFleet({ ctx: r.ctx, prd, item: 's1-01-keep-the-cap', answer: answer() });
    assert(result.ok);
    expect(result.settledFile).toBe(LEDGER);
    expect(result.deletes).toEqual([HIGH]);
    apply(r, result);

    expect(existsSync(join(r.root, HIGH))).toBe(false);
    const [entry] = parseSettledEntries(r.read(LEDGER), r.ctx.markers);
    expect(entry?.id).toBe('s1-01-keep-the-cap');
    expect(entry?.verdict).toBe('agreed');
    expect(entry?.fields['Approved by']).toBe('fleet blue');
    expect(entry?.fields.Channel).toBe('feature pull request #43');
    expect(entry?.answerText).toContain('A. Keep the cap at five (built).');
    expect(entry?.answerText).toContain('Answered by fleet blue for mission/12-faster-quotes');
    expect(entry?.answerText).toContain('the Architect: yes — Reversible.');
    expect(entry?.itemText).toBe(itemText({ id: 's1-01-keep-the-cap', rank: 'high' }));
    // Nothing is open any more: the merge gate into the mission branch reads it as answered.
    expect(openItems(prd, { ctx: r.ctx })).toEqual([]);
  });

  it('appends to a ledger that already holds entries, never rewriting them', () => {
    const r = repo({
      [HIGH]: itemText({ id: 's1-01-keep-the-cap', rank: 'high' }),
      [`${OUTBOX}/s1-02-other.md`]: itemText({ id: 's1-02-other', rank: 'high' }),
    });
    const first = settleItem({
      ctx: r.ctx,
      file: `${OUTBOX}/s1-02-other.md`,
      answer: { text: 'yes', approvedBy: 'octocat', approvedAt: '2026-11-15', channel: { kind: 'feature-pull-request', number: 43 } },
    });
    assert(first.ok);
    const before = r.read(LEDGER);
    const result = settleByFleet({ ctx: r.ctx, prd, item: 's1-01-keep-the-cap', answer: answer() });
    assert(result.ok);
    expect(result.text.startsWith(before)).toBe(true);
  });

  it('refuses an item that is not open, one not ranked high, an option it does not offer, and any option but A', () => {
    const r = repo({
      [HIGH]: itemText({ id: 's1-01-keep-the-cap', rank: 'high' }),
      [`${OUTBOX}/s1-03-set-secret.md`]: itemText({ id: 's1-03-set-secret', rank: 'human-action' }),
    });
    const refused = (item: string, over: Partial<FleetAnswer> = {}): string[] => {
      const result = settleByFleet({ ctx: r.ctx, prd, item, answer: answer(over) });
      return result.ok ? [] : result.errors;
    };
    expect(refused('s1-09-gone')).toEqual(['s1-09-gone: no such open item of PRD 42.']);
    expect(refused('s1-03-set-secret')).toEqual(['s1-03-set-secret: the fleet answers a high item only, not a human-action one.']);
    expect(refused('s1-01-keep-the-cap', { option: 'C' })).toEqual(['s1-01-keep-the-cap: it offers no option C.']);
    expect(refused('s1-01-keep-the-cap', { option: 'B' })).toEqual(['s1-01-keep-the-cap: the fleet settles an item with option A, as built, only: B goes to a person.']);
    expect(refused('s1-01-keep-the-cap', { verdicts: [] })).toEqual(['s1-01-keep-the-cap: the fleet answers with the verdicts of the members who sat.']);
  });
});

describe('fleetAnswered', () => {
  it('lists each item whose latest entry the fleet answered, and none a person answered after it', () => {
    const r = repo({ [HIGH]: itemText({ id: 's1-01-keep-the-cap', rank: 'high' }) });
    expect(fleetAnswered(prd, { ctx: r.ctx })).toEqual([]);
    apply(r, settleByFleet({ ctx: r.ctx, prd, item: 's1-01-keep-the-cap', answer: answer() }));
    expect(fleetAnswered(prd, { ctx: r.ctx })).toEqual([{ id: 's1-01-keep-the-cap', by: 'fleet blue' }]);
    // The kit's own gate reads it as settled: a terminal does not know the pull request's base.
    expect(gateResult(prd, { ctx: r.ctx }).ok).toBe(true);
  });

  it('says, one line each, why a pull request into the default branch holds them', () => {
    expect(fleetHeldLines([{ id: 's1-01-keep-the-cap', by: 'fleet blue' }])).toEqual([
      'outbox-status — 1 item answered by a fleet, not by a person: it holds a pull request into the default branch (BR-PRODUCT-5):',
      '  - s1-01-keep-the-cap (fleet blue)',
    ]);
    expect(fleetHeldLines([])).toEqual([]);
  });
});
