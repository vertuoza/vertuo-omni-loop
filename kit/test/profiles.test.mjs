// Task 16: the acceptance test for phase 1 — the whole loop (check → red gate → settle → green
// gate → ship → prd) through the CLI's `main()`, under three law profiles: knowledge,
// claudeMdInvariants, none. Every fixture below is copied, not imported from another test file.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../bin/omni.mjs';
import { makeRepo } from './fixture.mjs';

const quiet = () => ({ stdout: { write() {} }, stderr: { write() {} } });
const D = '.omni-loop/delivery';

/** A well-formed inbox spec for PRD 42, per Task 12's schema: no `plan:` field. */
const SPEC_42 = [
  '---',
  'prd: 42',
  'title: Three law profiles, end to end',
  'blocked-by: none',
  'spec: file',
  '---',
  '',
  '## Problem',
  '',
  'Prove the loop holds under three different sources of law.',
  '',
].join('\n');

/** The knowledge fixture (Task 4's principle shape): field lines with no leading dash, a
 * `Source:` that leads somewhere. */
const PRINCIPLE_P_PRODUCT_1 =
  '# Principles\n\n## P-PRODUCT-1\n\nThe AI proposes; a person accepts.\n\nWhy: trust\nDecided: owner, 2026-09-24\nSource: PRD #42\n';

/** `check knowledge` also grades product/rules.md and product/invariants.md as part of the
 * layout — minimal, entry-free stubs so the knowledge profile's `product/` folder is complete. */
const EMPTY_RULES = '# Rules\n';
const EMPTY_INVARIANTS = '# Invariants\n';

/** The valid outbox item fixture (Task 5's parser, ported test), parameterised on prd, bears-on
 * and rank — every required section, plain words, two options in order. */
function itemText({ prd, bearsOn, rank }) {
  return [
    '---',
    'id: s1-01-x',
    `prd: ${prd}`,
    'slice: s1',
    `rank: ${rank}`,
    `bears-on: ${bearsOn}`,
    'raised: 2026-09-22',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    'Should we ship this feature now, or wait for the next release?',
    '',
    '## The decision, in plain words',
    '',
    'We ship it now, because the risk is small and easy to reverse.',
    '',
    '## The options, in plain words',
    '',
    'A. Ship it now, the option built.',
    'B. Wait for the next release.',
    '',
    '## What I had to decide',
    '',
    'Whether to ship now or wait for the next release.',
    '',
    '## What I did meanwhile',
    '',
    'Shipped now, the option built.',
    '',
    '## What it costs to change later',
    '',
    'Reverting would be a small, mechanical change.',
    '',
    '## What I could not know',
    '',
    '(author) Whether shipping now surprises anyone downstream.',
    '',
  ].join('\n');
}

const PROFILES = [
  {
    name: 'knowledge',
    config: 'kit: 1\nrepo:\n  slug: acme/a\nlaws:\n  source: knowledge\n',
    extra: {
      '.omni-loop/knowledge/product/principles.md': PRINCIPLE_P_PRODUCT_1,
      '.omni-loop/knowledge/product/rules.md': EMPTY_RULES,
      '.omni-loop/knowledge/product/invariants.md': EMPTY_INVARIANTS,
    },
    bearsOn: 'P-PRODUCT-1',
    floors: true,
  },
  {
    name: 'claudeMdInvariants',
    config: 'kit: 1\nrepo:\n  slug: acme/b\npaths:\n  adr: docs/adr\nlaws:\n  source: claudeMdInvariants\n',
    extra: { 'CLAUDE.md': '## Invariants\n\n- x (ADR-0004)\n', 'docs/adr/0004-tenants.md': '# 4\n' },
    bearsOn: 'ADR-0004',
    floors: true,
  },
  { name: 'none', config: 'kit: 1\nrepo:\n  slug: acme/c\n', extra: {}, bearsOn: 'none', floors: false },
];

describe.each(PROFILES)('profile $name', ({ config, extra, bearsOn, floors }) => {
  it('checks clean, goes red on an item, settles, goes green, ships', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': config,
        [`${D}/inbox/0042-a/spec.md`]: SPEC_42,
        [`${D}/outbox/0042-a/s1-01-x.md`]: itemText({ prd: 42, bearsOn, rank: 'high' }),
        ...extra,
      },
    });

    expect(await main(['check', 'all'], { cwd: root, ...quiet() })).toBe(0);
    expect(await main(['status', '42'], { cwd: root, ...quiet() })).toBe(1);
    expect(
      await main(
        [
          'settle',
          `${D}/outbox/0042-a/s1-01-x.md`,
          '--by', 'pm',
          '--at', '2026-09-24',
          '--channel', 'feature-pull-request',
          '--number', '7',
          '--answer', 'Yes, keep it.',
        ],
        { cwd: root, ...quiet() },
      ),
    ).toBe(0);
    expect(await main(['status', '42'], { cwd: root, ...quiet() })).toBe(0);

    // yolo-fix commits the settle sub-PR before shipping, so ship runs on a committed tree.
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'settle'], {
      cwd: root,
    });

    expect(await main(['ship', '42'], { cwd: root, ...quiet() })).toBe(0);

    expect(existsSync(join(root, `${D}/inbox/0042-a`))).toBe(false);
    expect(existsSync(join(root, `${D}/shipped/0042-a/spec.md`))).toBe(true);
    expect(existsSync(join(root, `${D}/shipped/0042-a/outbox/settled.md`))).toBe(true);

    const prdOut = [];
    expect(
      await main(['prd', '42'], {
        cwd: root,
        stdout: { write: (s) => prdOut.push(s) },
        stderr: { write() {} },
      }),
    ).toBe(0);
    expect(prdOut.join('')).toMatch(/state: shipped/);
  });

  it(`floors a medium item bearing on "${bearsOn}" to high when floors is ${floors}`, async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': config,
        [`${D}/outbox/0042-a/s1-01-x.md`]: itemText({ prd: 42, bearsOn, rank: 'medium' }),
        ...extra,
      },
    });

    expect(await main(['check', 'outbox'], { cwd: root, ...quiet() })).toBe(floors ? 1 : 0);
  });
});
