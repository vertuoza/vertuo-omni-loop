// @ts-nocheck
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { SETTLED_FILE } from './outbox.ts';
import { adoptItem, parseSettledEntries, renderSettledEntry } from './settle.ts';
import { MERGED_OVER_RED_BASIS, settleAtMerge } from './settle-merge.ts';
import { gateResult } from './status.ts';

const D = '.omni-loop/delivery';
const INBOX = `${D}/inbox/0042-widgets`;
const OUTBOX = `${D}/outbox/0042-widgets`;
const LEDGER = `${OUTBOX}/${SETTLED_FILE}`;

const MERGE = {
  by: 'octocat',
  at: '2026-09-26T10:30:00Z',
  pr: 43,
  url: 'https://github.com/acme/widgets/pull/43',
};

function itemText({ id, rank, slice = 's1', personSteps = false }) {
  const fm = [
    `id: ${id}`,
    'prd: 42',
    `slice: ${slice}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-24',
    'wave: 1',
  ];
  const last = personSteps
    ? ['## What a person must do', '', '1. Set the secret in the console.', '']
    : ['## The options, in plain words', '', 'A. Keep what was built.', 'B. Change it.', ''];
  return [
    '---',
    ...fm,
    '---',
    '',
    '## The question, in plain words',
    '',
    'Should this ship as it is?',
    '',
    '## The decision, in plain words',
    '',
    'Yes, this is the fixture answer.',
    '',
    ...last,
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

const HIGH = itemText({ id: 's1-01-high-one', rank: 'high' });
const HUMAN = itemText({ id: 's1-02-set-secret', rank: 'human-action', personSteps: true });
const MEDIUM = itemText({ id: 's2-01-medium-one', rank: 'medium', slice: 's2' });

const repos = [];
afterEach(() => {
  while (repos.length) rmSync(repos.pop().root, { recursive: true, force: true });
});

function repo(files = {}) {
  const r = makeRepo({ files: { [`${INBOX}/spec.md`]: '# Widgets\n', ...files } });
  repos.push(r);
  return r;
}

/** Writes what settleAtMerge returned, as a caller would: the ledger text, then the deletions. */
function apply(r, result) {
  if (result.text !== null) r.write(result.settledFile, result.text);
  for (const file of result.deletes) rmSync(join(r.root, file));
}

describe('settleAtMerge — open items', () => {
  it('adopts every open item, whatever its rank, in the merger’s name, and lists the files to delete', () => {
    const r = repo({
      [`${OUTBOX}/s1-01-high-one.md`]: HIGH,
      [`${OUTBOX}/s1-02-set-secret.md`]: HUMAN,
      [`${OUTBOX}/s2-01-medium-one.md`]: MEDIUM,
    });
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });

    expect(result.ok).toBe(true);
    expect(result.settledFile).toBe(LEDGER);
    expect(result.deletes).toEqual([
      `${OUTBOX}/s1-01-high-one.md`,
      `${OUTBOX}/s1-02-set-secret.md`,
      `${OUTBOX}/s2-01-medium-one.md`,
    ]);
    expect(result.entries.map((e) => [e.id, e.from])).toEqual([
      ['s1-01-high-one', 'open'],
      ['s1-02-set-secret', 'open'],
      ['s2-01-medium-one', 'open'],
    ]);

    for (const { entry } of result.entries) {
      expect(entry).toContain('- Verdict: adopted\n');
      expect(entry).toContain('- Approved by: @octocat\n');
      expect(entry).toContain('- Approved at: 2026-09-26T10:30:00Z\n');
      expect(entry).toContain('- Channel: feature pull request #43\n');
      expect(entry).toContain('- Channel URL: https://github.com/acme/widgets/pull/43\n');
      expect(entry).toContain(
        '- Basis: merged-over-red — the feature pull request merged while this item was open; merging adopts what was built\n',
      );
      expect(entry).toContain('- Closed: yes — adopted at the merge by @octocat\n');
      expect(entry).toContain(
        'Adopted when @octocat merged feature pull request #43 while this item was open.',
      );
    }
    expect(MERGED_OVER_RED_BASIS).toBe('merged-over-red');
  });

  it('keeps each item’s text verbatim in its entry', () => {
    const r = repo({ [`${OUTBOX}/s1-01-high-one.md`]: HIGH });
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    const [parsed] = parseSettledEntries(result.text, r.ctx.markers);
    expect(parsed.itemText).toBe(HIGH);
    expect(parsed.verdict).toBe('adopted');
    expect(parsed.closed).toBe(true);
  });

  it('starts a fresh ledger with its header when there is none', () => {
    const r = repo({ [`${OUTBOX}/s1-01-high-one.md`]: HIGH });
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    expect(result.text.startsWith('# Settled outbox items — PRD 42\n')).toBe(true);
  });

  it('appends to an existing ledger, leaving every byte already in it untouched', () => {
    const r = repo({ [`${OUTBOX}/s1-01-high-one.md`]: HIGH });
    const adopted = adoptItem({ ctx: r.ctx, itemText: MEDIUM });
    expect(adopted.ok).toBe(true);
    const before = r.read(LEDGER);

    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    expect(result.text.startsWith(before)).toBe(true);
    expect(result.text.slice(before.length)).toBe(result.append);
    expect(result.entries.map((e) => e.id)).toEqual(['s1-01-high-one']);
  });

  it('touches no file', () => {
    const r = repo({ [`${OUTBOX}/s1-01-high-one.md`]: HIGH });
    settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    expect(existsSync(join(r.root, LEDGER))).toBe(false);
    expect(existsSync(join(r.root, `${OUTBOX}/s1-01-high-one.md`))).toBe(true);
  });

  it('turns a red gate green once applied', () => {
    const r = repo({
      [`${OUTBOX}/s1-01-high-one.md`]: HIGH,
      [`${OUTBOX}/s1-02-set-secret.md`]: HUMAN,
    });
    expect(gateResult(42, { ctx: r.ctx }).ok).toBe(false);
    apply(r, settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE }));
    expect(gateResult(42, { ctx: r.ctx }).ok).toBe(true);
  });

  it('accepts the merger with or without a leading @', () => {
    const r = repo({ [`${OUTBOX}/s1-01-high-one.md`]: HIGH });
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: { ...MERGE, by: '@octocat' } });
    expect(result.entries[0].entry).toContain('- Approved by: @octocat\n');
  });

  it('refuses, writing nothing, an open item that does not parse', () => {
    const r = repo({ [`${OUTBOX}/s1-01-broken.md`]: 'no front matter here\n' });
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('s1-01-broken.md');
  });

  it('refuses a malformed merge', () => {
    const r = repo();
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: { by: '', at: 'yesterday', pr: 0 } });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('has nothing to settle for a PRD with no open item and no ledger', () => {
    const r = repo();
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    expect(result).toMatchObject({ ok: true, entries: [], deletes: [], text: null, append: '' });
  });

  it('refuses a PRD with no folder', () => {
    const r = repo();
    const result = settleAtMerge({ ctx: r.ctx, prd: 99, merge: MERGE });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('99');
  });
});

/** A settled entry, rendered by the kit itself, for a drift fixture. */
function settledEntry(r, text, verdict, closed) {
  return renderSettledEntry({
    item: {
      id: 's1-01-high-one',
      rank: 'high',
      bearsOn: 'none',
      raised: '2026-09-24',
      slice: 's1',
      wave: 1,
    },
    itemText: text,
    answer: {
      approvedBy: 'pierrederval',
      approvedAt: '2026-09-25',
      channel: { kind: 'feature-pull-request', number: 43 },
      text: 'No, change it.',
    },
    judgement: { verdict, basis: 'stated', reason: 'the answer says so' },
    markers: r.ctx.markers,
    closed,
  });
}

function ledgerWith(r, ...entries) {
  return ['# Settled outbox items — PRD 42', '', ...entries].join('\n');
}

describe('settleAtMerge — drift never reworked', () => {
  it('appends an adopted entry that wins, and the gate reads green on the result', () => {
    const r = repo();
    r.write(LEDGER, ledgerWith(r, settledEntry(r, HIGH, 'drifted')));
    expect(gateResult(42, { ctx: r.ctx }).ok).toBe(false);

    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    expect(result.entries.map((e) => [e.id, e.from])).toEqual([['s1-01-high-one', 'drift']]);
    expect(result.deletes).toEqual([]);
    const [entry] = result.entries;
    expect(entry.entry).toContain('- Verdict: adopted\n');
    expect(entry.entry).toContain('- Approved by: @octocat\n');
    expect(entry.entry).toContain('- Closed: yes — merged without rework, by @octocat\n');
    expect(entry.entry).toContain('- Basis: merged-over-red — ');
    expect(entry.entry).toContain('- Rank: high\n');

    apply(r, result);
    const [latest] = parseSettledEntries(r.read(LEDGER), r.ctx.markers);
    expect(latest.verdict).toBe('adopted');
    expect(latest.itemText).toBe(HIGH);
    expect(gateResult(42, { ctx: r.ctx }).ok).toBe(true);
    // The answer that asked for something else stays in the ledger, above the adoption.
    expect(r.read(LEDGER)).toContain('No, change it.');
  });

  it('adds nothing for reworked drift or for an entry already adopted or agreed', () => {
    const r = repo();
    r.write(
      LEDGER,
      ledgerWith(
        r,
        settledEntry(r, HIGH, 'drifted', 'yes — reworked by #50, the sub-pull request that brought the build back in line'),
      ),
    );
    const result = settleAtMerge({ ctx: r.ctx, prd: 42, merge: MERGE });
    expect(result).toMatchObject({ ok: true, entries: [], deletes: [], text: null });

    const adopted = repo();
    adoptItem({ ctx: adopted.ctx, itemText: MEDIUM });
    expect(settleAtMerge({ ctx: adopted.ctx, prd: 42, merge: MERGE }).entries).toEqual([]);
  });
});

describe('renderSettledEntry — the Closed: line', () => {
  it('writes the Closed: line it is given', () => {
    const r = repo();
    expect(settledEntry(r, HIGH, 'agreed', 'yes — something else')).toContain(
      '- Closed: yes — something else\n',
    );
  });

  it('renders exactly as before without one', () => {
    const r = repo();
    expect(settledEntry(r, HIGH, 'agreed')).toContain(
      '- Closed: yes — the answer matches what was built, so there is nothing to rework\n',
    );
  });
});
