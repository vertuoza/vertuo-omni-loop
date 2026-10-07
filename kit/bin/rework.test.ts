import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import type { Files, Repo } from '../test/fixture.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

const PRD = 985;
const DIR = `.omni-loop/delivery/inbox/0985-widgets`;
const OUTBOX = `.omni-loop/delivery/outbox/0985-widgets`;

// A second PRD, used only to prove `omni rework close` never reaches another PRD's ledger even
// when it holds a settled entry with the exact same id (item ids are unique only within one PRD).
const OTHER_PRD = 42;
const OTHER_DIR = `.omni-loop/delivery/inbox/0042-widgets`;
const OTHER_OUTBOX = `.omni-loop/delivery/outbox/0042-widgets`;

const PLAN = [
  '# Plan: widgets',
  '',
  '| id  | slice          | territory | wave |',
  '| --- | -------------- | --------- | ---- |',
  '| s1  | The settled item | `a/` | 1 |',
  '',
].join('\n');

/** One well-formed open item — frontmatter plus the four fixed sections `parseOutboxItem` requires,
 * carrying one backticked path in "What it costs to change later" so a rework's territory can be
 * asserted against it. */
const ITEM_TEXT = [
  '---',
  'id: s1-01-default-country',
  `prd: ${PRD}`,
  'slice: s1',
  'rank: high',
  'bears-on: none',
  'raised: 2026-09-22',
  'wave: 1',
  '---',
  '',
  '## What I had to decide',
  '',
  'Which country a contact created without one is given.',
  '',
  '## What I did meanwhile',
  '',
  "I default to the tenant's own country.",
  '',
  '## What it costs to change later',
  '',
  'One constant in `kit/lib/contact-builder.mjs`.',
  '',
  '## What I could not know',
  '',
  '(author) Nothing.',
  '',
].join('\n');

const AGREED_ITEM_TEXT = ITEM_TEXT.replace('id: s1-01-default-country', 'id: s1-02-civility-label').replace(
  'Which country a contact created without one is given.',
  'Which label an unknown civility code is shown under.',
);

function baseFiles() {
  return {
    ...CONFIG,
    [`${DIR}/spec.md`]: '# spec\n',
    [`${DIR}/plan.md`]: PLAN,
  };
}

async function settle(root: string, file: string, answer: string, extra: Record<string, string> = {}) {
  return main(
    ['settle', file, '--by', 'pierrederval', '--at', '2026-09-22', '--channel', 'prd-issue', '--number', '1', '--answer', answer, ...Object.entries(extra).flatMap(([k, v]) => [`--${k}`, v])],
    { cwd: root, ...io() },
  );
}

/** A repo with one PRD, its plan, and one drifted + one agreed settled entry. */
async function driftedRepo() {
  const { root, read, write } = makeRepo({
    git: true,
    files: { ...baseFiles(), [`${OUTBOX}/s1-01-default-country.md`]: ITEM_TEXT, [`${OUTBOX}/s1-02-civility-label.md`]: AGREED_ITEM_TEXT },
  });
  expect(await settle(root, `${OUTBOX}/s1-01-default-country.md`, "No — use the contact's own country instead.")).toBe(0);
  expect(await settle(root, `${OUTBOX}/s1-02-civility-label.md`, 'Yes, keep it as is.')).toBe(0);
  return { root, read, write };
}

/** Adds a second PRD to `root`, drifted under the exact same item id as `driftedRepo`'s own PRD
 * 985 — the collision `--prd` exists to prevent. */
async function addOtherDriftedPrd(root: string, write: Repo['write']) {
  write(`${OTHER_DIR}/spec.md`, '# spec\n');
  write(`${OTHER_DIR}/plan.md`, PLAN);
  write(`${OTHER_OUTBOX}/s1-01-default-country.md`, ITEM_TEXT.replace(`prd: ${PRD}`, `prd: ${OTHER_PRD}`));
  expect(
    await settle(root, `${OTHER_OUTBOX}/s1-01-default-country.md`, "No — use the contact's own country instead."),
  ).toBe(0);
}

describe('omni rework plan', () => {
  it('prints nothing drifted, exit 0, when every settled item agreed', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...baseFiles(), [`${OUTBOX}/s1-02-civility-label.md`]: AGREED_ITEM_TEXT },
    });
    expect(await settle(root, `${OUTBOX}/s1-02-civility-label.md`, 'Yes, keep it as is.')).toBe(0);

    const s = io();
    expect(await main(['rework', 'plan', String(PRD)], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toMatch(/nothing drifted/i);
  });

  it('prints the drifted rework slice — id, drifted item, branch, territory, wave', async () => {
    const { root } = await driftedRepo();

    const s = io();
    expect(await main(['rework', 'plan', String(PRD)], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out).toMatch(/fix-s1-01-default-country/);
    expect(out).toMatch(/reworks s1-01-default-country/);
    expect(out).toMatch(/feat\/widgets--fix-s1-01-default-country/);
    expect(out).toMatch(/kit\/lib\/contact-builder\.mjs/);
    expect(out).toMatch(/wave 1/);
    // the agreed item is left alone
    expect(out).not.toMatch(/s1-02-civility-label/);
  });

  it('--json prints the full rework derivation', async () => {
    const { root } = await driftedRepo();

    const s = io();
    expect(await main(['rework', 'plan', String(PRD), '--json'], { cwd: root, ...s })).toBe(0);
    const result = JSON.parse(s.out.join('')) as { reworks: unknown[]; opensPullRequest: boolean; mergesIntoMain: boolean };
    expect(result.reworks).toHaveLength(1);
    expect(result.reworks[0]).toMatchObject({
      id: 'fix-s1-01-default-country',
      itemId: 's1-01-default-country',
      branch: 'feat/widgets--fix-s1-01-default-country',
      wave: 1,
      territory: ['a/', 'kit/lib/contact-builder.mjs'],
    });
    expect(result.opensPullRequest).toBe(true);
    expect(result.mergesIntoMain).toBe(false);
  });

  it('refuses a PRD with no inbox or shipped folder, one line, exit 2', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['rework', 'plan', '9'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/PRD 9/);
  });

  it('rejects an unknown flag, exit 2', async () => {
    const { root } = makeRepo({ git: true, files: baseFiles() });
    const s = io();
    expect(await main(['rework', 'plan', String(PRD), '--nope'], { cwd: root, ...s })).toBe(2);
  });
});

describe('omni rework plan — in a plan repository (PRD 563, s3)', () => {
  const PLAN_REPO_CONFIG = {
    '.omni-loop/config.yml': [
      'kit: 1',
      'repo:',
      '  slug: acme/widgets-plan',
      'plan:',
      '  targets:',
      '    - repo: acme/widgets-api',
      '      role: back-end',
      '      knowledge: own',
      '',
    ].join('\n'),
  };
  const MULTI_PLAN = [
    '# Plan: widgets',
    '',
    '| id  | repo        | slice            | territory | wave |',
    '| --- | ----------- | ---------------- | --------- | ---- |',
    '| s1  | widgets-api | The settled item | `a/`      | 1    |',
    '',
  ].join('\n');

  async function multiRepo(config: Files) {
    const { root } = makeRepo({
      git: true,
      files: { ...config, [`${DIR}/spec.md`]: '# spec\n', [`${DIR}/plan.md`]: MULTI_PLAN, [`${OUTBOX}/s1-01-default-country.md`]: ITEM_TEXT },
    });
    expect(await settle(root, `${OUTBOX}/s1-01-default-country.md`, "No — use the contact's own country instead.")).toBe(0);
    return root;
  }

  it('gives each rework the repo of the slice its item names, plain and --json', async () => {
    const root = await multiRepo(PLAN_REPO_CONFIG);

    const s = io();
    expect(await main(['rework', 'plan', String(PRD)], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toMatch(/^ {2}repo: widgets-api$/m);

    const j = io();
    expect(await main(['rework', 'plan', String(PRD), '--json'], { cwd: root, ...j })).toBe(0);
    expect(dig(JSON.parse(j.out.join('')), 'reworks', 0)).toMatchObject({ id: 'fix-s1-01-default-country', repo: 'widgets-api' });
  });

  it('outside a plan repository prints what it prints today, with no repo', async () => {
    const root = await multiRepo(CONFIG);

    const s = io();
    expect(await main(['rework', 'plan', String(PRD)], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).not.toMatch(/repo:/);

    const j = io();
    expect(await main(['rework', 'plan', String(PRD), '--json'], { cwd: root, ...j })).toBe(0);
    expect(dig(JSON.parse(j.out.join('')), 'reworks', 0)).not.toHaveProperty('repo');
  });
});

describe('omni rework close', () => {
  it('amends only the Closed: line, and omni status goes green for that drift afterwards', async () => {
    const { root, read } = await driftedRepo();
    const before = read(`${OUTBOX}/settled.md`);

    const s = io();
    expect(await main(['rework', 'close', 's1-01-default-country', '--prd', String(PRD), '--pr', '42'], { cwd: root, ...s })).toBe(0);

    const after = read(`${OUTBOX}/settled.md`);
    expect(after).toMatch(/- Closed: yes — reworked by #42/);
    // the drifted entry's own question and answer are untouched — only its Closed: line changed
    expect(after).toMatch(/Which country a contact created without one is given\./);
    expect(after).toMatch(/No — use the contact's own country instead\./);
    // the agreed entry is untouched byte for byte
    const agreedBefore = before.slice(before.indexOf('s1-02-civility-label'));
    const agreedAfter = after.slice(after.indexOf('s1-02-civility-label'));
    expect(agreedAfter).toBe(agreedBefore);

    expect(await main(['status', String(PRD)], { cwd: root, ...io() })).toBe(0);
  });

  it('closes only the named PRD\'s ledger when another PRD holds a settled entry with the same id', async () => {
    const { root, read, write } = await driftedRepo();
    await addOtherDriftedPrd(root, write);
    const otherBefore = read(`${OTHER_OUTBOX}/settled.md`);

    const s = io();
    expect(
      await main(['rework', 'close', 's1-01-default-country', '--prd', String(PRD), '--pr', '42'], { cwd: root, ...s }),
    ).toBe(0);

    expect(read(`${OUTBOX}/settled.md`)).toMatch(/- Closed: yes — reworked by #42/);
    // the other PRD's ledger, holding the exact same id, is untouched byte for byte
    expect(read(`${OTHER_OUTBOX}/settled.md`)).toBe(otherBefore);
    expect(await main(['status', String(OTHER_PRD)], { cwd: root, ...io() })).toBe(1);
  });

  it('refuses an id no ledger holds, one line, exit 2', async () => {
    const { root } = await driftedRepo();
    const s = io();
    expect(await main(['rework', 'close', 'nope-01-x', '--prd', String(PRD), '--pr', '1'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('').split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('refuses a PRD with no inbox or shipped folder, one line, exit 2', async () => {
    const { root } = await driftedRepo();
    const s = io();
    expect(await main(['rework', 'close', 's1-01-default-country', '--prd', '9', '--pr', '1'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/PRD 9/);
  });

  it('refuses an already-closed id, one line, exit 2', async () => {
    const { root } = await driftedRepo();
    expect(
      await main(['rework', 'close', 's1-01-default-country', '--prd', String(PRD), '--pr', '42'], { cwd: root, ...io() }),
    ).toBe(0);

    const s = io();
    expect(
      await main(['rework', 'close', 's1-01-default-country', '--prd', String(PRD), '--pr', '43'], { cwd: root, ...s }),
    ).toBe(2);
    expect(s.err.join('')).toMatch(/already closed/);
  });

  it('refuses an agreed (non-drifted) id, one line, exit 2', async () => {
    const { root } = await driftedRepo();
    const s = io();
    expect(
      await main(['rework', 'close', 's1-02-civility-label', '--prd', String(PRD), '--pr', '1'], { cwd: root, ...s }),
    ).toBe(2);
    expect(s.err.join('')).toMatch(/only a drifted item is ever reworked/);
  });

  it('requires --pr, exit 2', async () => {
    const { root } = await driftedRepo();
    const s = io();
    expect(await main(['rework', 'close', 's1-01-default-country', '--prd', String(PRD)], { cwd: root, ...s })).toBe(2);
  });

  it('requires --prd, exit 2', async () => {
    const { root } = await driftedRepo();
    const s = io();
    expect(await main(['rework', 'close', 's1-01-default-country', '--pr', '42'], { cwd: root, ...s })).toBe(2);
  });
});
