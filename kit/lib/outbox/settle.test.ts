import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, assert, describe, expect, it } from 'vitest';
import { makeMarkers } from '../markers.ts';
import { makeRepo } from '../../test/fixture.ts';
import { flatCtx } from '../../test/flat-layout.ts';
import { parseOutboxItem } from './outbox.ts';
import {
  ADOPTED_VERDICT,
  AnswerSchema,
  CHANNEL_KINDS,
  VERDICTS,
  adoptItem,
  channelLabel,
  judgeAnswer,
  parseSettledEntries,
  renderAdoptedEntry,
  renderSettledEntry,
  settleItem,
  settledHeader,
} from './settle.ts';
import type { AnswerChannel } from './settle.ts';

/** The markers every ported test below renders and parses through — `vertuo-outbox`, matching
 * `flatCtx`'s own configured prefix (`kit/test/flat-layout.ts`). */
const markers = makeMarkers('vertuo-outbox');

/**
 * The item every settling test starts from. Written out in full, and asserted byte-for-byte later:
 * the point of the slice is that settling never rewrites a single character of the question.
 */
const ITEM_TEXT = [
  '---',
  'id: s5-01-default-country',
  'prd: 985',
  'slice: s5',
  'rank: high',
  'bears-on: none',
  'raised: 2026-09-22',
  'wave: 3',
  '---',
  '',
  '## What I had to decide',
  '',
  'Which country a contact created without one is given.',
  '',
  '## What I did meanwhile',
  '',
  "I default to the tenant's own country, because a constant is the most reversible option.",
  '',
  '## What it costs to change later',
  '',
  'One constant, and a migration over contacts already created with the default.',
  '',
  '## What I could not know',
  '',
  '(author) The PRD, the registers and the glossary do not say which country a foreign contact',
  'should get.',
  '',
].join('\n');

const CHOICE =
  "I default to the tenant's own country, because a constant is the most reversible option.";

const ISSUE_CHANNEL: AnswerChannel = { kind: 'prd-issue', number: 985, url: 'https://github.com/o/r/issues/985' };
const PR_CHANNEL: AnswerChannel = { kind: 'feature-pull-request', number: 986 };

const roots: string[] = [];

function makeRoot({ item = ITEM_TEXT, settled = null }: { item?: string; settled?: string | null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'outbox-settle-'));
  roots.push(root);
  const dir = join(root, 'docs/outbox/985');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 's5-01-default-country.md'), item);
  if (settled !== null) writeFileSync(join(dir, 'settled.md'), settled);
  return root;
}

function answer(overrides: Record<string, unknown> = {}) {
  return {
    text: 'Yes, keep it as is.',
    approvedBy: 'pierrederval',
    approvedAt: '2026-09-22T09:30:00Z',
    channel: ISSUE_CHANNEL,
    ...overrides,
  };
}

function settle(
  overrides: Record<string, unknown> = {},
  rootOptions: { root?: string; item?: string; settled?: string | null } = {},
) {
  const root = rootOptions.root ?? makeRoot(rootOptions);
  const result = settleItem({
    ctx: flatCtx(root),
    file: 'docs/outbox/985/s5-01-default-country.md',
    answer: answer(overrides),
  });
  return { root, result, settledPath: join(root, 'docs/outbox/985/settled.md') };
}

/** A well-formed `medium` item — the shape a slice raises when it meets a decision the PRD does
 * not settle and judges it a call that could go the other way for a constant, not a stored shape
 * (PRD #1166, slice s5). */
const MEDIUM_ITEM_TEXT = [
  '---',
  'id: s7-01-default-timeout',
  'prd: 985',
  'slice: s7',
  'rank: medium',
  'bears-on: none',
  'raised: 2026-09-22',
  'wave: 4',
  '---',
  '',
  '## The question, in plain words',
  '',
  'How long should we wait before giving up on a slow call?',
  '',
  '## The decision, in plain words',
  '',
  'We wait five seconds, which is generous without being unbounded.',
  '',
  '## The options, in plain words',
  '',
  'A. Wait five seconds, the option built.',
  'B. Wait one second, so a stuck call is caught sooner.',
  '',
  '## What I had to decide',
  '',
  'How long a slow call gets before it is treated as stuck.',
  '',
  '## What I did meanwhile',
  '',
  'Five seconds, a constant with no migration to undo it.',
  '',
  '## What it costs to change later',
  '',
  'One constant.',
  '',
  '## What I could not know',
  '',
  '(author) Whether five seconds is measured against a real incident.',
  '',
].join('\n');

/** A fresh, empty temp root — no item, no settled.md — for tests that build their own trees. */
function makeEmptyRoot() {
  const root = mkdtempSync(join(tmpdir(), 'outbox-settle-adopt-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('the settled shapes', () => {
  it('knows exactly two verdicts and exactly two answer channels', () => {
    expect(VERDICTS).toEqual(['agreed', 'drifted']);
    expect(CHANNEL_KINDS).toEqual(['prd-issue', 'feature-pull-request']);
  });

  it('names each channel the way a human would say it', () => {
    expect(channelLabel(ISSUE_CHANNEL)).toBe('PRD issue #985');
    expect(channelLabel(PR_CHANNEL)).toBe('feature pull request #986');
  });

  it('refuses an answer with no approver', () => {
    expect(AnswerSchema.safeParse(answer({ approvedBy: '  ' })).success).toBe(false);
  });

  it('refuses an answer whose channel is neither of the two', () => {
    expect(AnswerSchema.safeParse(answer({ channel: { kind: 'slack', number: 1 } })).success).toBe(
      false,
    );
  });
});

describe('judgeAnswer — the pure drift comparison', () => {
  it('takes a stated verdict over anything it could read itself', () => {
    const judgement = judgeAnswer({
      choice: CHOICE,
      answer: 'Yes, exactly that.',
      statedVerdict: 'drifted',
    });
    expect(judgement).toMatchObject({ verdict: 'drifted', basis: 'stated' });
  });

  it('reads a "Verdict:" line in the answer itself as the stated verdict', () => {
    const judgement = judgeAnswer({
      choice: CHOICE,
      answer: 'Some prose the comparison could never read.\nVerdict: drifted',
    });
    expect(judgement).toMatchObject({ verdict: 'drifted', basis: 'stated' });
  });

  it('settles agreed when the answer restates the choice word for word', () => {
    const judgement = judgeAnswer({ choice: CHOICE, answer: `  ${CHOICE}  ` });
    expect(judgement).toMatchObject({ verdict: 'agreed', basis: 'restates-the-choice' });
  });

  it('settles agreed on a plain affirmation', () => {
    for (const text of ['Yes', 'yes, keep it as is.', 'Agreed.', 'LGTM', 'Confirmed — go ahead.']) {
      expect(judgeAnswer({ choice: CHOICE, answer: text })).toMatchObject({ verdict: 'agreed' });
    }
  });

  it('settles drifted when the answer carries a contradiction marker', () => {
    for (const text of [
      "No — use the contact's own country.",
      'It should be the country on the quote instead.',
      "Don't default at all; leave it empty.",
    ]) {
      expect(judgeAnswer({ choice: CHOICE, answer: text })).toMatchObject({ verdict: 'drifted' });
    }
  });

  it('reads a contradiction before an affirmation, because a false agreed ships the wrong build', () => {
    const judgement = judgeAnswer({
      choice: CHOICE,
      answer: 'Yes, I see why — but it should be the country on the quote instead.',
    });
    expect(judgement).toMatchObject({ verdict: 'drifted', basis: 'contradiction-marker' });
    expect(judgement.reason).toContain('instead');
  });

  it('says undetermined rather than guessing at prose it cannot read', () => {
    const judgement = judgeAnswer({
      choice: CHOICE,
      answer: 'Ask Sophie about the Belgian entities before this ships.',
    });
    expect(judgement).toMatchObject({ verdict: null, basis: 'undetermined' });
  });
});

describe('an answer is transcribed, not merged into the question', () => {
  it('holds the original question unchanged, and names who approved it, when, and where', () => {
    const { result, settledPath } = settle();

    assert(result.ok);
    const settled = readFileSync(settledPath, 'utf8');
    expect(settled).toContain(ITEM_TEXT);
    expect(settled).toContain('- Approved by: pierrederval');
    expect(settled).toContain('- Approved at: 2026-09-22T09:30:00Z');
    expect(settled).toContain('- Channel: PRD issue #985');
    expect(settled).toContain('https://github.com/o/r/issues/985');
  });

  it('keeps the four sections byte-identical through a round trip', () => {
    const { settledPath } = settle();

    const entries = parseSettledEntries(readFileSync(settledPath, 'utf8'), markers);
    expect(entries).toHaveLength(1);

    const roundTripped = parseOutboxItem(entries[0]!.itemText);
    const original = parseOutboxItem(ITEM_TEXT);
    assert(roundTripped.ok);
    assert(original.ok);
    expect(roundTripped.item!.sections).toEqual(original.item!.sections);
    expect(entries[0]!.itemText).toBe(ITEM_TEXT);
  });

  it('records the answer exactly as it was given', () => {
    const text =
      'No.\n\n  Two spaces, a blank line, and a ``` fence inside:\n```js\nconst a = 1;\n```';
    const { settledPath } = settle({ text });

    expect(parseSettledEntries(readFileSync(settledPath, 'utf8'), markers)[0]!.answerText).toBe(
      text,
    );
  });

  it('deletes the open file in the same breath', () => {
    const { root, result } = settle();

    expect(existsSync(join(root, 'docs/outbox/985/s5-01-default-country.md'))).toBe(false);
    assert(result.ok);
    expect(result.removedFile).toBe('docs/outbox/985/s5-01-default-country.md');
  });

  it('appends to settled.md, never rewrites it', () => {
    const before = [
      '# Settled outbox items — PRD 985',
      '',
      'An earlier entry, untouched.',
      '',
    ].join('\n');
    const { settledPath } = settle({}, { settled: before });

    const after = readFileSync(settledPath, 'utf8');
    expect(after.startsWith(before)).toBe(true);
    expect(after.length).toBeGreaterThan(before.length);
  });
});

describe('an answer given on the pull request', () => {
  it('records the pull request as the channel', () => {
    const { settledPath } = settle({ channel: PR_CHANNEL });

    const entries = parseSettledEntries(readFileSync(settledPath, 'utf8'), markers);
    expect(entries[0]!.fields.Channel).toBe('feature pull request #986');
  });
});

describe('an answer that agrees with what was built', () => {
  it('settles as agreed, and nothing is reworked', () => {
    const { result, settledPath } = settle({ text: 'Yes, keep it as is.' });

    assert(result.ok);
    expect(result.verdict).toBe('agreed');
    const entry = parseSettledEntries(readFileSync(settledPath, 'utf8'), markers)[0];
    expect(entry!.verdict).toBe('agreed');
    expect(entry!.closed).toBe(true);
    expect(entry!.fields.Closed).toMatch(/^yes\b/);
    expect(entry!.fields.Closed).toContain('nothing to rework');
  });
});

describe('an answer that contradicts what was built', () => {
  it('is marked drifted, and is not closed', () => {
    const { result, settledPath } = settle({
      text: "No — use the contact's own country instead.",
    });

    assert(result.ok);
    expect(result.verdict).toBe('drifted');
    const entry = parseSettledEntries(readFileSync(settledPath, 'utf8'), markers)[0];
    expect(entry!.verdict).toBe('drifted');
    expect(entry!.closed).toBe(false);
    expect(entry!.fields.Closed).toMatch(/^no\b/);
  });

  it('keeps what a different answer would cost addressable, for the rework to be derived from', () => {
    const { settledPath } = settle({ text: "No — use the contact's own country instead." });

    const entry = parseSettledEntries(readFileSync(settledPath, 'utf8'), markers)[0];
    const item = parseOutboxItem(entry!.itemText);
    expect(item.item!.sections.whatItCostsToChangeLater).toBe(
      'One constant, and a migration over contacts already created with the default.',
    );
  });
});

describe('what settling refuses', () => {
  it('refuses an answer it cannot read, and touches nothing', () => {
    const root = makeRoot();
    const { result } = settle({ text: 'Ask Sophie about the Belgian entities.' }, { root });

    assert(!result.ok);
    expect(result.errors.join(' ')).toMatch(/undetermined/);
    expect(existsSync(join(root, 'docs/outbox/985/s5-01-default-country.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/outbox/985/settled.md'))).toBe(false);
  });

  it('refuses a malformed item, and touches nothing', () => {
    const root = makeRoot({
      item: '---\nid: broken\n---\n\n## What I had to decide\n\nNothing.\n',
    });
    const { result } = settle({}, { root });

    assert(!result.ok);
    expect(result.errors.join(' ')).toMatch(/missing section/);
    expect(existsSync(join(root, 'docs/outbox/985/settled.md'))).toBe(false);
  });

  it('refuses an item file that is not there', () => {
    const root = makeRoot();
    const result = settleItem({
      ctx: flatCtx(root),
      file: 'docs/outbox/985/s5-99-absent.md',
      answer: answer(),
    });

    assert(!result.ok);
    expect(result.errors.join(' ')).toMatch(/no such open item/);
  });

  it('refuses an answer that is not a well-formed answer', () => {
    const root = makeRoot();
    const result = settleItem({
      ctx: flatCtx(root),
      file: 'docs/outbox/985/s5-01-default-country.md',
      answer: answer({ approvedAt: 'yesterday' }),
    });

    assert(!result.ok);
    expect(result.errors.join(' ')).toMatch(/approvedAt/);
  });
});

describe('settled.md as a ledger', () => {
  it('starts the file with a header, and a second settling appends under it', () => {
    const root = makeRoot();
    settle({ text: 'Yes.' }, { root });

    const dir = join(root, 'docs/outbox/985');
    writeFileSync(
      join(dir, 's5-02-second.md'),
      ITEM_TEXT.replace('id: s5-01-default-country', 'id: s5-02-second'),
    );
    const second = settleItem({
      ctx: flatCtx(root),
      file: 'docs/outbox/985/s5-02-second.md',
      answer: answer({ text: 'No, it should be the quote instead.', channel: PR_CHANNEL }),
    });

    assert(second.ok);
    const settled = readFileSync(join(dir, 'settled.md'), 'utf8');
    expect(settled.split('\n')[0]).toBe('# Settled outbox items — PRD 985');
    const entries = parseSettledEntries(settled, markers);
    expect(entries.map((entry) => [entry.id, entry.verdict])).toEqual([
      ['s5-01-default-country', 'agreed'],
      ['s5-02-second', 'drifted'],
    ]);
  });
});

// PRD #1166, slice s5 — "A medium item is adopted when it is raised".
describe('a medium item is adopted the moment it is raised', () => {
  it('is not one of the two answer verdicts — nobody answers an adopted item', () => {
    expect(VERDICTS).toEqual(['agreed', 'drifted']);
    expect(ADOPTED_VERDICT).toBe('adopted');
    expect(VERDICTS).not.toContain(ADOPTED_VERDICT);
  });

  it('settles straight to settled.md, approved by nobody, at the time it was raised', () => {
    const root = makeEmptyRoot();
    const result = adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });

    assert(result.ok);
    expect(result.item.rank).toBe('medium');
    expect(result.settledFile).toBe('docs/outbox/985/settled.md');

    const settled = readFileSync(join(root, result.settledFile), 'utf8');
    expect(settled).toContain('## s7-01-default-timeout — adopted');
    expect(settled).toContain('- Verdict: adopted');
    expect(settled).toContain('- Approved by: nobody');
    expect(settled).toContain('- Approved at: 2026-09-22');
    expect(settled).toContain(MEDIUM_ITEM_TEXT);
  });

  it('writes no Channel line — nobody answered it on either channel', () => {
    const root = makeEmptyRoot();
    const result = adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });

    assert(result.ok);
    const settled = readFileSync(join(root, result.settledFile), 'utf8');
    expect(settled).not.toContain('- Channel:');
    expect(settled).not.toContain('- Channel URL:');
  });

  it('counts as settled and kept, like an agreed answer — closed, and there is nothing to rework', () => {
    const root = makeEmptyRoot();
    const result = adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });

    assert(result.ok);
    const entries = parseSettledEntries(
      readFileSync(join(root, result.settledFile), 'utf8'),
      markers,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 's7-01-default-timeout',
      verdict: 'adopted',
      closed: true,
    });
  });

  it('leaves no open item file — it never reads or writes one at all', () => {
    const root = makeEmptyRoot();
    adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });

    // The only item text this test ever had was the in-memory string above — proving the whole
    // adoption needed no file under docs/outbox/985 beyond settled.md itself.
    expect(existsSync(join(root, 'docs/outbox/985/s7-01-default-timeout.md'))).toBe(false);
  });

  it('refuses an item that is not medium — a high or human-action item still gets an open file', () => {
    const root = makeEmptyRoot();
    const highItem = MEDIUM_ITEM_TEXT.replace('rank: medium', 'rank: high');
    const result = adoptItem({ ctx: flatCtx(root), itemText: highItem });

    assert(!result.ok);
    expect(result.errors.join(' ')).toMatch(/only a "medium" item is adopted/);
    expect(existsSync(join(root, 'docs/outbox/985/settled.md'))).toBe(false);
  });

  it('refuses a malformed item, and writes nothing', () => {
    const root = makeEmptyRoot();
    const result = adoptItem({
      ctx: flatCtx(root),
      itemText: '---\nid: broken\n---\n\nnothing here\n',
    });

    assert(!result.ok);
    expect(existsSync(join(root, 'docs/outbox/985/settled.md'))).toBe(false);
  });

  it('appends, never rewrites — a second adoption for another PRD item lands after the first', () => {
    const root = makeEmptyRoot();
    adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });

    const second = MEDIUM_ITEM_TEXT.replace('id: s7-01-default-timeout', 'id: s7-02-retry-count');
    const result = adoptItem({ ctx: flatCtx(root), itemText: second });

    assert(result.ok);
    const entries = parseSettledEntries(
      readFileSync(join(root, result.settledFile), 'utf8'),
      markers,
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      's7-01-default-timeout',
      's7-02-retry-count',
    ]);
  });
});

describe("the ledger's readers take the latest entry for an id", () => {
  it('a later drifted entry for the same id wins over an earlier adopted one', () => {
    const root = makeEmptyRoot();
    const adopted = adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });
    assert(adopted.ok);

    // An objection appends a `drifted` entry for the SAME id, exactly as `/omni:yolo-fix` will do
    // once a later slice wires the reply that reads it — simulated directly here, since reading
    // pull request replies is that slice's own machinery, not this one's.
    const objection = renderSettledEntry({
      item: adopted.item,
      itemText: MEDIUM_ITEM_TEXT,
      answer: {
        text: 'No — we need both the short and the long timeout.',
        approvedBy: 'pierrederval',
        approvedAt: '2026-09-25',
        channel: PR_CHANNEL,
      },
      judgement: {
        verdict: 'drifted',
        basis: 'stated',
        reason: 'a human objected to the adopted choice',
      },
      markers,
    });
    const settledPath = join(root, adopted.settledFile);
    writeFileSync(settledPath, `${readFileSync(settledPath, 'utf8')}\n${objection}`);

    const entries = parseSettledEntries(readFileSync(settledPath, 'utf8'), markers);
    const forThisId = entries.filter((entry) => entry.id === adopted.item.id);
    expect(forThisId).toHaveLength(1);
    expect(forThisId[0]!.verdict).toBe('drifted');
    expect(forThisId[0]!.closed).toBe(false);
  });

  it('keeps an id at its first position, so unrelated entries still read in raised order', () => {
    const root = makeEmptyRoot();
    const first = adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });
    const secondText = MEDIUM_ITEM_TEXT.replace(
      'id: s7-01-default-timeout',
      'id: s7-02-retry-count',
    );
    adoptItem({ ctx: flatCtx(root), itemText: secondText });
    assert(first.ok);

    const objection = renderSettledEntry({
      item: first.item,
      itemText: MEDIUM_ITEM_TEXT,
      answer: {
        text: 'No — reconsider it.',
        approvedBy: 'pierrederval',
        approvedAt: '2026-09-25',
        channel: PR_CHANNEL,
      },
      judgement: { verdict: 'drifted', basis: 'stated', reason: 'objected' },
      markers,
    });
    const settledPath = join(root, first.settledFile);
    writeFileSync(settledPath, `${readFileSync(settledPath, 'utf8')}\n${objection}`);

    const entries = parseSettledEntries(readFileSync(settledPath, 'utf8'), markers);
    expect(entries.map((entry) => entry.id)).toEqual([
      's7-01-default-timeout',
      's7-02-retry-count',
    ]);
    expect(entries[0]!.verdict).toBe('drifted');
  });
});

describe('renderAdoptedEntry — the pure renderer behind adoptItem', () => {
  it('is what adoptItem appends, byte for byte', () => {
    const parsed = parseOutboxItem(MEDIUM_ITEM_TEXT);
    assert(parsed.ok);

    const rendered = renderAdoptedEntry({ item: parsed.item!, itemText: MEDIUM_ITEM_TEXT, markers });
    const root = makeEmptyRoot();
    const result = adoptItem({ ctx: flatCtx(root), itemText: MEDIUM_ITEM_TEXT });

    assert(result.ok);
    expect(result.entry).toBe(rendered);
  });
});

// Task 6, Step 3 — "Became:" is a new list of ids a settled entry may carry, parsed off it.
describe('Became: is parsed as a list of ids', () => {
  it('reads Became: as a list of ids', () => {
    const markers = makeMarkers('omni-outbox');
    const text = [
      markers.settledOpen('s1-01-x'),
      '## s1-01-x — agreed',
      '- Verdict: agreed',
      '- Closed: yes — agreed',
      '- Became: N-PRODUCT-1, N-PRODUCT-2',
      markers.settledClose('s1-01-x'),
    ].join('\n');
    expect(parseSettledEntries(text, markers)[0]!.became).toEqual(['N-PRODUCT-1', 'N-PRODUCT-2']);
  });

  it('is an empty list when the entry carries no Became: field', () => {
    const { settledPath } = settle();
    expect(parseSettledEntries(readFileSync(settledPath, 'utf8'), markers)[0]!.became).toEqual([]);
  });
});

// Task 6, Step 5 — settleItem against the folders layout, resolving the item's PRD to its own
// outbox directory through ctx.layout.outboxDir, not through the settled item file's own path.
describe('settleItem against the folders layout', () => {
  const FOLDERS_ITEM_TEXT = ITEM_TEXT.replace('id: s5-01-default-country', 'id: s1-01-x')
    .replace('prd: 985', 'prd: 42')
    .replace('slice: s5', 'slice: s1');

  it("appends to the PRD outbox directory's settled.md and removes the open item", () => {
    const { ctx, root } = makeRepo({
      files: {
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/s1-01-x.md': FOLDERS_ITEM_TEXT,
      },
    });

    const result = settleItem({
      ctx,
      file: '.omni-loop/delivery/outbox/0042-a/s1-01-x.md',
      answer: answer(),
    });

    assert(result.ok);
    expect(result.settledFile).toBe('.omni-loop/delivery/outbox/0042-a/settled.md');
    expect(result.entry.startsWith('<!-- omni-outbox-settled: s1-01-x -->')).toBe(true);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a/s1-01-x.md'))).toBe(false);

    const settled = readFileSync(join(root, result.settledFile), 'utf8');
    expect(settled).toContain('<!-- omni-outbox-settled: s1-01-x -->');
    expect(settled).toContain(FOLDERS_ITEM_TEXT);
  });

  it('throws when the item PRD has no inbox or shipped folder, and writes nothing', () => {
    const strayItemText = FOLDERS_ITEM_TEXT.replace('prd: 42', 'prd: 999');
    const { ctx, root } = makeRepo({
      files: { 'stray-item.md': strayItemText },
    });

    expect(() => settleItem({ ctx, file: 'stray-item.md', answer: answer() })).toThrow(
      'PRD 999 has no inbox or shipped folder',
    );
    expect(existsSync(join(root, 'stray-item.md'))).toBe(true);
  });

  it('adoptItem throws the same way for a medium item with no inbox or shipped folder', () => {
    const { ctx } = makeRepo({ files: {} });
    const strayMedium = MEDIUM_ITEM_TEXT.replace('prd: 985', 'prd: 999');

    expect(() => adoptItem({ ctx, itemText: strayMedium })).toThrow(
      'PRD 999 has no inbox or shipped folder',
    );
  });
});

describe('settledHeader (final review)', () => {
  it('points at the delivery folder\'s README, which is where the format lives', () => {
    const { ctx } = makeRepo();
    const header = settledHeader(42, { ctx });
    expect(header).toContain('`.omni-loop/delivery/README.md`');
    expect(header).not.toContain('delivery/outbox/README.md');
  });
});
