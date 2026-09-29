import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../../test/flat-layout.mjs';
import { parsePlanSlices } from '../inbox/territory.mjs';
import { appendObjection } from '../outbox/replies.mjs';
import { adoptItem, parseSettledEntries, settleItem } from '../outbox/settle.mjs';
import { parseOutboxItem } from '../outbox/outbox.mjs';
import {
  closeDriftedEntry,
  deriveRework,
  driftedEntries,
  namedPaths,
  planRework,
  renderReworkPlan,
  reworkPullRequest,
} from './rework.mjs';

const PRD = 985;
const FEATURE_BRANCH = 'feat/agent-outbox';

/**
 * One open item, written out in full. Every assertion about byte-identity below compares against
 * this exact text: the point of the slice is that closing a drifted item rewrites one line of the
 * ledger and not one character of the question.
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
  'One constant in `libs/vertuo-domain-contact/src/contact-builder.ts`, and a re-read of the',
  'contacts already saved with the default.',
  '',
  '## What I could not know',
  '',
  '(author) The PRD, the registers and the glossary do not say which country a foreign contact',
  'should get.',
  '',
].join('\n');

const AGREED_ITEM_TEXT = ITEM_TEXT.replace('id: s5-01-default-country', 'id: s5-02-civility-label')
  .replace('rank: high', 'rank: medium')
  .replace(
    'Which country a contact created without one is given.',
    'Which label a civility code with no entry in the table is shown under.',
  );

/** The plan the reworks take their ground from — a slice table `parsePlanSlices` accepts. */
const PLAN = [
  '# Plan: a fixture',
  '',
  '| id  | slice                | territory                                             | wave |',
  '| --- | -------------------- | ----------------------------------------------------- | ---- |',
  '| s5  | The settled item     | `scripts/outbox-settle*`, `docs/outbox/SETTLING.md`  | 3    |',
  '| s9  | The fix command      | `kit/lib/policy/rework.mjs`                           | 5    |',
  '',
].join('\n');

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

/**
 * Builds a real settled ledger the only way one is ever built — by running the settler over an
 * open item. Nothing here hand-writes a ledger, so every assertion below is made against the bytes
 * slice s5 actually produces.
 */
function settledLedger(settlings) {
  const root = mkdtempSync(join(tmpdir(), 'yolo-fix-'));
  roots.push(root);
  const ctx = flatCtx(root);
  const dir = join(root, `docs/outbox/${PRD}`);
  mkdirSync(dir, { recursive: true });

  for (const { text, file, answer, statedVerdict } of settlings) {
    writeFileSync(join(dir, file), text);
    const result = settleItem({
      ctx,
      file: `docs/outbox/${PRD}/${file}`,
      answer: {
        text: answer,
        approvedBy: 'pierrederval',
        approvedAt: '2026-09-22',
        channel: { kind: 'feature-pull-request', number: 986 },
        ...(statedVerdict ? { statedVerdict } : {}),
      },
    });
    expect(result.ok, result.ok ? '' : result.errors.join('\n')).toBe(true);
  }

  return readFileSync(join(dir, 'settled.md'), 'utf8');
}

/** `flatCtx`'s markers never depend on `root` — a fixed placeholder is enough to derive them. */
const MARKERS = flatCtx('/virtual-repo').markers;

const DRIFTED = {
  text: ITEM_TEXT,
  file: 's5-01-default-country.md',
  answer: "No — use the contact's own country instead, and fall back to the tenant's.",
};

const AGREED = {
  text: AGREED_ITEM_TEXT,
  file: 's5-02-civility-label.md',
  answer: 'Yes, keep it as is.',
};

describe('A feature that drifted is brought back in line', () => {
  describe('The fix reworks the feature pull request', () => {
    it('takes the drifted items and leaves the agreed ones alone', () => {
      const drifted = driftedEntries(settledLedger([DRIFTED, AGREED]), MARKERS);

      expect(drifted.map((entry) => entry.id)).toEqual(['s5-01-default-country']);
      expect(drifted[0].verdict).toBe('drifted');
      expect(drifted[0].closed).toBe(false);
    });

    it('derives exactly one rework slice for the one drifted item', () => {
      const result = planRework({
        settledText: settledLedger([DRIFTED, AGREED]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.reworks).toHaveLength(1);
      expect(result.reworks[0].itemId).toBe('s5-01-default-country');
      expect(result.reworks[0].id).toBe('fix-s5-01-default-country');
      expect(result.opensPullRequest).toBe(true);
    });

    it('opens its sub-pull-request into the feature branch, and merges nothing into main', () => {
      const result = planRework({
        settledText: settledLedger([DRIFTED]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.reworks[0].base).toBe(FEATURE_BRANCH);
      expect(result.reworks[0].branch).toBe(`${FEATURE_BRANCH}--fix-s5-01-default-country`);
      expect(result.mergesIntoMain).toBe(false);
      expect(result.report.join('\n')).not.toMatch(/into main/);
    });

    it('names its id and branch from the configured branch templates', () => {
      const result = planRework({
        settledText: settledLedger([DRIFTED]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: 'feature/agent-outbox',
        markers: MARKERS,
        branches: { feature: 'feature/{topic}', slice: 'slice/{topic}/{slice}', rework: 'rework-{item}' },
      });

      expect(result.reworks[0].id).toBe('rework-s5-01-default-country');
      expect(result.reworks[0].base).toBe('feature/agent-outbox');
      expect(result.reworks[0].branch).toBe('slice/agent-outbox/rework-s5-01-default-country');
    });

    it('refuses a feature branch the feature template cannot read a topic from', () => {
      expect(() =>
        planRework({ settledText: settledLedger([DRIFTED]), planMarkdown: PLAN, prd: PRD, featureBranch: 'main', markers: MARKERS }),
      ).toThrow(/does not match branches\.feature "feat\/\{topic\}"/);
    });

    it('raises no item of its own — it acts on answers already given', () => {
      const result = planRework({
        settledText: settledLedger([DRIFTED]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.raisesItems).toBe(false);
    });

    it('takes the answer and the item’s own cost section as the brief, verbatim', () => {
      const [entry] = driftedEntries(settledLedger([DRIFTED]), MARKERS);
      const rework = deriveRework(entry, { planSlices: parsePlanSlices(PLAN) });

      expect(rework.answer).toBe(DRIFTED.answer);
      expect(rework.bound).toBe(
        'One constant in `libs/vertuo-domain-contact/src/contact-builder.ts`, and a re-read of the\ncontacts already saved with the default.',
      );
      expect(rework.choice).toBe(
        "I default to the tenant's own country, because a constant is the most reversible option.",
      );
    });

    it('declares its territory: the ground the slice stood on, plus every path the bound names', () => {
      const [entry] = driftedEntries(settledLedger([DRIFTED]), MARKERS);
      const rework = deriveRework(entry, { planSlices: parsePlanSlices(PLAN) });

      expect(rework.territory).toEqual([
        'scripts/outbox-settle*',
        'docs/outbox/SETTLING.md',
        'libs/vertuo-domain-contact/src/contact-builder.ts',
      ]);
      expect(rework.territoryKnown).toBe(true);
    });

    it('declares nothing it cannot name when the plan holds no such slice', () => {
      const [entry] = driftedEntries(settledLedger([DRIFTED]), MARKERS);
      const rework = deriveRework(entry, { planSlices: [] });

      expect(rework.territory).toEqual(['libs/vertuo-domain-contact/src/contact-builder.ts']);
      expect(rework.unknownPlanSlice).toBe(true);
    });

    it('renders a rework plan the existing territory check reads back unchanged', () => {
      const result = planRework({
        settledText: settledLedger([DRIFTED]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      const [slice] = parsePlanSlices(renderReworkPlan(result));
      expect(slice.id).toBe('fix-s5-01-default-country');
      expect(slice.territory).toEqual(result.reworks[0].territory);
      expect(slice.wave).toBe(1);
    });

    it('keeps two reworks that share ground out of one wave', () => {
      const second = {
        text: ITEM_TEXT.replace('id: s5-01-default-country', 'id: s5-03-second-call'),
        file: 's5-03-second-call.md',
        answer: 'No — the other way round.',
      };
      const result = planRework({
        settledText: settledLedger([DRIFTED, second]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.reworks.map((rework) => rework.wave)).toEqual([1, 2]);
    });

    it('runs two reworks that share no ground in one wave', () => {
      const elsewhere = {
        text: ITEM_TEXT.replace('id: s5-01-default-country', 'id: s9-01-closure-shape')
          .replace('slice: s5', 'slice: s9')
          .replace(
            'One constant in `libs/vertuo-domain-contact/src/contact-builder.ts`, and a re-read of the',
            'One line of `kit/lib/policy/rework.mjs`, and nothing else in the',
          ),
        file: 's9-01-closure-shape.md',
        answer: 'No — append a second entry instead.',
      };
      const result = planRework({
        settledText: settledLedger([DRIFTED, elsewhere]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.reworks.map((rework) => rework.wave)).toEqual([1, 1]);
    });

    it('a bound that names no path declares no ground', () => {
      expect(namedPaths('A constant, and a re-read of what is already `saved`.')).toEqual([]);
      expect(namedPaths('See `https://example.com/a/b` for the shape.')).toEqual([]);
      expect(namedPaths('`scripts/outbox.mjs` and `docs/outbox/README.md`.')).toEqual([
        'scripts/outbox.mjs',
        'docs/outbox/README.md',
      ]);
    });

    it('closes the entry it was named, wherever it sits in the ledger', () => {
      const settled = settledLedger([AGREED, DRIFTED]);
      const closed = closeDriftedEntry(settled, {
        id: 's5-01-default-country',
        pullRequest: '#1001',
        markers: MARKERS,
      });

      const [agreed, drifted] = parseSettledEntries(closed, MARKERS);
      expect(agreed.id).toBe('s5-02-civility-label');
      expect(agreed.fields.Closed).toBe(
        'yes — the answer matches what was built, so there is nothing to rework',
      );
      expect(reworkPullRequest(drifted)).toBe('#1001');
    });

    it('the drifted item names the sub-pull-request that closed it', () => {
      const settled = settledLedger([DRIFTED, AGREED]);
      const closed = closeDriftedEntry(settled, {
        id: 's5-01-default-country',
        pullRequest: '#1001',
        markers: MARKERS,
      });

      const [entry] = parseSettledEntries(closed, MARKERS);
      expect(entry.closed).toBe(true);
      expect(entry.fields.Closed).toContain('#1001');
      expect(reworkPullRequest(entry)).toBe('#1001');
    });

    it('a closed rework keeps the verdict it earned — drift is history, not a mistake', () => {
      const closed = closeDriftedEntry(settledLedger([DRIFTED]), {
        id: 's5-01-default-country',
        pullRequest: 'https://github.com/vertuoza/vertuo-ai-domain/pull/1001',
        markers: MARKERS,
      });

      const [entry] = parseSettledEntries(closed, MARKERS);
      expect(entry.verdict).toBe('drifted');
      expect(reworkPullRequest(entry)).toBe(
        'https://github.com/vertuoza/vertuo-ai-domain/pull/1001',
      );
    });

    it('amends exactly one line of the ledger and nothing else', () => {
      const settled = settledLedger([DRIFTED, AGREED]);
      const closed = closeDriftedEntry(settled, {
        id: 's5-01-default-country',
        pullRequest: '#1001',
        markers: MARKERS,
      });

      const before = settled.split('\n');
      const after = closed.split('\n');
      expect(after).toHaveLength(before.length);
      const changed = before.map((line, index) => index).filter((i) => before[i] !== after[i]);
      expect(changed).toHaveLength(1);
      expect(before[changed[0]]).toMatch(/^- Closed: no\b/);
      expect(after[changed[0]]).toMatch(/^- Closed: yes\b/);
    });

    it('keeps the question byte-identical — the four sections are what a rework is derived from', () => {
      const settled = settledLedger([DRIFTED, AGREED]);
      const closed = closeDriftedEntry(settled, {
        id: 's5-01-default-country',
        pullRequest: '#1001',
        markers: MARKERS,
      });

      const [drifted, agreed] = parseSettledEntries(closed, MARKERS);
      expect(drifted.itemText).toBe(ITEM_TEXT);
      expect(agreed.itemText).toBe(AGREED_ITEM_TEXT);
      expect(drifted.answerText).toBe(DRIFTED.answer);

      const roundTripped = parseOutboxItem(drifted.itemText);
      expect(roundTripped.ok).toBe(true);
      expect(roundTripped.item.sections).toEqual(parseOutboxItem(ITEM_TEXT).item.sections);
    });

    it('refuses to close an item it was not given', () => {
      const settled = settledLedger([AGREED]);

      expect(() =>
        closeDriftedEntry(settled, {
          id: 's5-01-default-country',
          pullRequest: '#1',
          markers: MARKERS,
        }),
      ).toThrow(/s5-01-default-country/);
      expect(() =>
        closeDriftedEntry(settled, {
          id: 's5-02-civility-label',
          pullRequest: '#1',
          markers: MARKERS,
        }),
      ).toThrow(/agreed/);
    });

    it('refuses to close the same item twice', () => {
      const once = closeDriftedEntry(settledLedger([DRIFTED]), {
        id: 's5-01-default-country',
        pullRequest: '#1001',
        markers: MARKERS,
      });

      expect(() =>
        closeDriftedEntry(once, {
          id: 's5-01-default-country',
          pullRequest: '#1002',
          markers: MARKERS,
        }),
      ).toThrow(/already/);
    });

    it('needs a pull request to name — a closure nobody can follow is not a closure', () => {
      const settled = settledLedger([DRIFTED]);

      expect(() =>
        closeDriftedEntry(settled, { id: 's5-01-default-country', pullRequest: '', markers: MARKERS }),
      ).toThrow(/pull request/i);
    });
  });

  describe('Nothing drifted', () => {
    it('says so, and opens no pull request', () => {
      const result = planRework({
        settledText: settledLedger([AGREED]),
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.reworks).toEqual([]);
      expect(result.opensPullRequest).toBe(false);
      expect(result.report.join('\n')).toMatch(/nothing drifted/i);
      expect(result.report.join('\n')).toContain('1 settled item');
    });

    it('says so for a PRD with no settled ledger at all', () => {
      const result = planRework({
        settledText: '',
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.opensPullRequest).toBe(false);
      expect(result.report.join('\n')).toMatch(/nothing drifted/i);
    });

    it('an item already reworked is not drifted work a second time', () => {
      const closed = closeDriftedEntry(settledLedger([DRIFTED]), {
        id: 's5-01-default-country',
        pullRequest: '#1001',
        markers: MARKERS,
      });

      const result = planRework({
        settledText: closed,
        planMarkdown: PLAN,
        prd: PRD,
        featureBranch: FEATURE_BRANCH,
        markers: MARKERS,
      });

      expect(result.opensPullRequest).toBe(false);
      expect(result.report.join('\n')).toMatch(/nothing drifted/i);
    });
  });
});

// ---- The chosen option, and an objection to an adopted item (PRD #1166, slice s6) ----

/** A medium item with options — A the one built — as PRD #1166 s4 shapes every item. */
const OPTIONED_ITEM_TEXT = [
  '---',
  'id: s3-01-components',
  'prd: 985',
  'slice: s5',
  'rank: medium',
  'bears-on: none',
  'raised: 2026-09-22',
  'wave: 3',
  '---',
  '',
  '## The question, in plain words',
  '',
  'Which components does a quote show when none are granted?',
  '',
  '## The decision, in plain words',
  '',
  'None, and the quote says so.',
  '',
  '## The options, in plain words',
  '',
  'A. None, and it says so',
  'B. All of them, costs hidden',
  '',
  '## What I had to decide',
  '',
  'Which components a quote shows when none are granted.',
  '',
  '## What I did meanwhile',
  '',
  'I show none, and say so.',
  '',
  '## What it costs to change later',
  '',
  'One filter in `libs/vertuo-domain-quote/src/components.ts`.',
  '',
  '## What I could not know',
  '',
  '(author) The PRD does not say.',
  '',
].join('\n');

/** A ledger where the item was adopted when raised, then objected to on the pull request — built
 * by the same two functions that build it for real: `adoptItem`, then `readReplies`' own
 * `appendObjection`. */
function adoptedThenObjected({ because = 'we need all of them' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'yolo-fix-adopted-'));
  roots.push(root);
  const ctx = flatCtx(root);
  const adopted = adoptItem({ ctx, itemText: OPTIONED_ITEM_TEXT });
  expect(adopted.ok).toBe(true);
  const ledger = join(root, `docs/outbox/${PRD}/settled.md`);
  const [adoptedEntry] = parseSettledEntries(readFileSync(ledger, 'utf8'), ctx.markers);
  const { item } = parseOutboxItem(OPTIONED_ITEM_TEXT);
  const objected = appendObjection({
    ctx,
    prd: PRD,
    adoptedEntry,
    item,
    answer: {
      text: `B. All of them, costs hidden — because ${because}`,
      approvedBy: 'pierrederval',
      approvedAt: '2026-09-24T10:00:00Z',
      channel: { kind: 'feature-pull-request', number: 1174 },
      statedVerdict: 'drifted',
    },
    judgement: { verdict: 'drifted', basis: 'stated', reason: 'the reply chose option B' },
  });
  expect(objected.ok).toBe(true);
  return { settledText: readFileSync(ledger, 'utf8'), markers: ctx.markers };
}

describe('A rework goes towards the option chosen (PRD #1166 s6)', () => {
  it('an objection to an adopted item is drifted work, read the same way as any other', () => {
    const { settledText, markers } = adoptedThenObjected();

    const [entry] = driftedEntries(settledText, markers);
    expect(entry.id).toBe('s3-01-components');

    const rework = deriveRework(entry, { planSlices: parsePlanSlices(PLAN) });
    expect(rework.chosenOption).toEqual({ letter: 'B', text: 'All of them, costs hidden' });
    expect(rework.reason).toBe('we need all of them');
    expect(rework.answer).toBe('B. All of them, costs hidden — because we need all of them');
    expect(rework.territory).toContain('libs/vertuo-domain-quote/src/components.ts');
  });

  it('a prose answer names no option, and the rework reads the answer itself', () => {
    const [entry] = driftedEntries(settledLedger([DRIFTED]), MARKERS);
    const rework = deriveRework(entry);
    expect(rework.chosenOption).toBeNull();
    expect(rework.reason).toBeNull();
  });

  it('closing an objection amends the drifted entry, never the adopted one before it', () => {
    const { settledText, markers } = adoptedThenObjected();
    const [adoptedBlock] = settledText.split(markers.settledClose('s3-01-components'));

    const closed = closeDriftedEntry(settledText, {
      id: 's3-01-components',
      pullRequest: '#1201',
      markers,
    });

    // The adopted entry — everything up to its own closing marker — is byte-identical.
    expect(closed.startsWith(adoptedBlock)).toBe(true);
    const [entry] = parseSettledEntries(closed, markers);
    expect(entry.verdict).toBe('drifted');
    expect(entry.closed).toBe(true);
    expect(reworkPullRequest(entry)).toBe('#1201');
    expect(
      closed.split('\n').filter((line, index) => line !== settledText.split('\n')[index]),
    ).toHaveLength(1);
  });
});

describe('A rework lands in the repository its decision was taken in (PRD 563, s3)', () => {
  const MULTI_PLAN = [
    '# Plan: a fixture across repositories',
    '',
    '| id  | repo               | slice            | territory       | wave |',
    '| --- | ------------------ | ---------------- | --------------- | ---- |',
    '| s5  | vertuo-backend-php | The settled item | `src/Contact/`  | 3    |',
    '| s9  | vertuo-apps        | The screen       | `apps/contact/` | 5    |',
    '',
  ].join('\n');

  it('names the repo of the slice its item was raised on, in a plan repository', () => {
    const result = planRework({
      settledText: settledLedger([DRIFTED]),
      planMarkdown: MULTI_PLAN,
      prd: PRD,
      featureBranch: FEATURE_BRANCH,
      markers: MARKERS,
      planRepository: true,
    });
    expect(result.reworks[0]).toMatchObject({ slice: 's5', repo: 'vertuo-backend-php' });
  });

  it('names no repo when the plan holds no such slice', () => {
    const result = planRework({
      settledText: settledLedger([DRIFTED]),
      planMarkdown: MULTI_PLAN.replace('| s5  |', '| s6  |'),
      prd: PRD,
      featureBranch: FEATURE_BRANCH,
      markers: MARKERS,
      planRepository: true,
    });
    expect(result.reworks[0].repo).toBeNull();
  });

  it('carries no repo field outside a plan repository, even on a plan with a repo column', () => {
    const result = planRework({
      settledText: settledLedger([DRIFTED]),
      planMarkdown: MULTI_PLAN,
      prd: PRD,
      featureBranch: FEATURE_BRANCH,
      markers: MARKERS,
    });
    expect(result.reworks[0]).not.toHaveProperty('repo');
  });
});
