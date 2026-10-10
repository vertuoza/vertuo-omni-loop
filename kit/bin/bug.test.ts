import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const CONFIG_TEXT = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const ISSUE = 12;
const DIR = '.omni-loop/delivery/bugs/0012-double-save';
const RECORD = `${DIR}/bug.md`;
const REPRO = 'app/save.test.mjs';
const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const CLAUDE = 'Co-Authored-By: Claude <noreply@anthropic.com>';

const SECTIONS = {
  Triage: [
    '- **Domain:** saving',
    '- **Risk:** high — every user who saves twice gets a duplicate row; no workaround',
    '- **Regression:** new bug — no evidence this ever worked',
  ].join('\n'),
  Reproduction: [`- **File:** \`${REPRO}\``, '- **Red:** AssertionError: expected 2 to be 1'].join('\n'),
  Fix: 'The save handler did not check for an existing row. It now updates the row it finds.',
  Guard: 'none — the reproduction is the cheapest check that catches it',
  Mutation: 'not set here',
};

/** A `bug.md`, built from `SECTIONS` with any section replaced (a string) or left out (`null`). */
function record(overrides: Record<string, string | null> = {}) {
  const sections = { ...SECTIONS, ...overrides };
  const parts = ['# Bug 12: saving twice duplicates the row', ''];
  for (const [name, body] of Object.entries<string | null>(sections)) {
    if (body === null) continue;
    parts.push(`## ${name}`, '', body, '');
  }
  return parts.join('\n');
}

/** Commits everything, signed as a skill signs it unless `signed` is false. Returns the short sha. */
function commit(root: string, message: string, { signed = true } = {}) {
  const text = signed ? `${message}\n\n${CLAUDE}\n${TRAILER}\n` : message;
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', text], { cwd: root, stdio: 'ignore' });
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

/** A repository whose config is already committed (`base`), standing in for the default branch. */
function setup(configText = CONFIG_TEXT, files = {}) {
  const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': configText, ...files } });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, write, base };
}

/** A fix branch: the reproduction added and a record, both committed. */
function fixBranch({ bug = record(), configText, signed }: { bug?: string; configText?: string; signed?: boolean } = {}) {
  const repo = setup(configText);
  repo.write(REPRO, "it('saves once', () => {});\n");
  repo.write(RECORD, bug);
  const sha = commit(repo.root, 'fix(app): saving twice keeps one row (#12)', { signed });
  return { ...repo, sha };
}

async function run(root: string, base: string, issue: number | string = ISSUE) {
  const s = io();
  const code = await main(['bug', String(issue), '--base', base], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

/** The lines after `not ok` that name a failed check. */
function failures(out: string) {
  return out.split('\n').filter((line: string) => line.startsWith('- '));
}

/** Runs `omni bug` and expects `not ok`, exit 1, with exactly one failure line; returns it. */
async function onlyFailure(root: string, base: string) {
  const { code, out } = await run(root, base);
  expect(code).toBe(1);
  expect(out).toMatch(/^not ok$/m);
  expect(failures(out)).toHaveLength(1);
  return failures(out)[0];
}

describe('omni bug', () => {
  it('is ok, exit 0, for one folder holding a complete bug.md whose reproduction the branch adds, every commit signed', async () => {
    const { root, base } = fixBranch();
    const { code, out } = await run(root, base);
    expect(code).toBe(0);
    expect(out).toMatch(/^ok$/m);
    expect(out).not.toMatch(/not ok/);
    expect(failures(out)).toEqual([]);
  });

  it('passes the guard and mutation lines a repository without either writes', async () => {
    const { root, base } = fixBranch({ bug: record({ Guard: 'none — no cheaper check fits', Mutation: 'not set here' }) });
    expect((await run(root, base)).code).toBe(0);
  });

  it('passes a red line that says red was not proven here', async () => {
    const reproduction = `- **File:** \`${REPRO}\`\n- **Red:** Red not proven here — the test needs a database; CI is the proof`;
    const { root, base } = fixBranch({ bug: record({ Reproduction: reproduction }) });
    expect((await run(root, base)).code).toBe(0);
  });

  it('passes a reproduction the branch changes rather than adds', async () => {
    const { root, write, base } = setup(CONFIG_TEXT, { [REPRO]: "it('old', () => {});\n" });
    write(REPRO, "it('saves once', () => {});\n");
    write(RECORD, record());
    commit(root, 'fix(app): saving twice keeps one row (#12)');
    expect((await run(root, base)).code).toBe(0);
  });

  it('is not ok when no folder is there for the issue', async () => {
    const { root, write, base } = setup();
    write('.omni-loop/delivery/bugs/0013-other/bug.md', record());
    commit(root, 'fix(app): other');
    expect(await onlyFailure(root, base)).toMatch(/no folder .*\.omni-loop\/delivery\/bugs\/0012-/);
  });

  it('is not ok when two folders are there for the issue', async () => {
    const { root, write, base } = fixBranch();
    write('.omni-loop/delivery/bugs/0012-other/bug.md', record());
    commit(root, 'docs: another record (#12)');
    const line = await onlyFailure(root, base);
    expect(line).toMatch(/2 folders/);
    expect(line).toContain('0012-other');
    expect(line).toContain('0012-double-save');
  });

  it('is not ok when the folder holds no bug.md', async () => {
    const { root, write, base } = setup();
    write(REPRO, "it('saves once', () => {});\n");
    write(`${DIR}/notes.md`, 'notes\n');
    commit(root, 'fix(app): saving twice keeps one row (#12)');
    expect(await onlyFailure(root, base)).toBe(`- ${RECORD}: missing.`);
  });

  it.each(['Triage', 'Reproduction', 'Fix', 'Guard', 'Mutation'])('is not ok when the %s section is missing', async (name: string) => {
    const { root, base } = fixBranch({ bug: record({ [name]: null }) });
    expect(await onlyFailure(root, base)).toBe(`- ${RECORD}: no "## ${name}" section.`);
  });

  it.each(['Triage', 'Reproduction', 'Fix', 'Guard', 'Mutation'])('is not ok when the %s section is empty', async (name: string) => {
    const { root, base } = fixBranch({ bug: record({ [name]: '' }) });
    expect(await onlyFailure(root, base)).toBe(`- ${RECORD}: the "## ${name}" section is empty.`);
  });

  it('is not ok when the risk is not one of the four levels', async () => {
    const triage = SECTIONS.Triage.replace('**Risk:** high', '**Risk:** severe');
    const { root, base } = fixBranch({ bug: record({ Triage: triage }) });
    const line = await onlyFailure(root, base);
    expect(line).toMatch(/risk "severe"/);
    expect(line).toMatch(/critical, high, medium or low/);
  });

  it('is not ok when the triage names no risk', async () => {
    const triage = SECTIONS.Triage.split('\n').filter((l) => !l.includes('Risk')).join('\n');
    const { root, base } = fixBranch({ bug: record({ Triage: triage }) });
    expect(await onlyFailure(root, base)).toMatch(/no \*\*Risk:\*\* line/);
  });

  it('is not ok when the reproduction has no File: line', async () => {
    const { root, base } = fixBranch({ bug: record({ Reproduction: '- **Red:** AssertionError: expected 2 to be 1' }) });
    expect(await onlyFailure(root, base)).toMatch(/no \*\*File:\*\* line/);
  });

  it('is not ok when the reproduction file does not exist', async () => {
    const reproduction = SECTIONS.Reproduction.replace(REPRO, 'app/gone.test.mjs');
    const { root, base } = fixBranch({ bug: record({ Reproduction: reproduction }) });
    expect(await onlyFailure(root, base)).toBe(`- ${RECORD}: the reproduction app/gone.test.mjs does not exist.`);
  });

  it('is not ok when the branch does not change the reproduction file', async () => {
    const { root, write, base } = setup(CONFIG_TEXT, { [REPRO]: "it('saves once', () => {});\n" });
    write(RECORD, record());
    commit(root, 'fix(app): saving twice keeps one row (#12)');
    expect(await onlyFailure(root, base)).toMatch(new RegExp(`the reproduction ${REPRO} is not changed on this branch`));
  });

  it('is not ok when the Red: line is empty', async () => {
    const { root, base } = fixBranch({ bug: record({ Reproduction: `- **File:** \`${REPRO}\`\n- **Red:**` }) });
    expect(await onlyFailure(root, base)).toMatch(/empty \*\*Red:\*\* line/);
  });

  it('is not ok when the reproduction has no Red: line', async () => {
    const { root, base } = fixBranch({ bug: record({ Reproduction: `- **File:** \`${REPRO}\`` }) });
    expect(await onlyFailure(root, base)).toMatch(/no \*\*Red:\*\* line/);
  });

  it('is not ok, naming the unsigned commit', async () => {
    const { root, base, sha } = fixBranch({ signed: false });
    expect(await onlyFailure(root, base)).toBe(`- unsigned: ${sha} fix(app): saving twice keeps one row (#12) has no "${TRAILER}" line.`);
  });

  it('does not check the signature with signature: null', async () => {
    const { root, base } = fixBranch({ configText: `${CONFIG_TEXT}signature: null\n`, signed: false });
    expect((await run(root, base)).code).toBe(0);
  });

  it('reads the delivery folder the config names', async () => {
    const { root, write, base } = setup(`${CONFIG_TEXT}paths:\n  delivery: work\n`);
    write(REPRO, "it('saves once', () => {});\n");
    write('work/bugs/0012-double-save/bug.md', record());
    commit(root, 'fix(app): saving twice keeps one row (#12)');
    expect((await run(root, base)).code).toBe(0);
  });

  it('refuses a --base that does not resolve, exit 2', async () => {
    const { root } = setup();
    const { code, err } = await run(root, 'nope-ref');
    expect(code).toBe(2);
    expect(err).toMatch(/nope-ref/);
  });

  it('refuses an issue that is not a positive integer, exit 2', async () => {
    const { root, base } = setup();
    expect((await run(root, base, 'twelve')).code).toBe(2);
  });

  it('exits 2 outside an installed repository', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-bare-'));
    const s = io();
    expect(await main(['bug', String(ISSUE)], { cwd: root, ...s })).toBe(2);
  });
});

const PLAN_CONFIG = [
  'kit: 1',
  'repo:',
  '  slug: acme/plan',
  'plan:',
  '  targets:',
  '    - repo: acme/backend',
  '      role: back-end',
  '      knowledge: own',
  '    - repo: acme/frontend',
  '      role: front-end',
  '      knowledge: none',
  '',
].join('\n');

const FIXES_HEADER = ['| order | repository | pull request | what changes |', '| --- | --- | --- | --- |'];
const BACKEND_ROW = '| 1 | backend | acme/backend#41 | restore the total field |';
const FRONTEND_ROW = '| 2 | frontend | https://github.com/acme/frontend/pull/7 | read the total again |';

/** A multi-target record (PRD 1118): `## Fixes` and one line per target, any section replaced or left out. */
function multiRecord(rows: string[] = [BACKEND_ROW, FRONTEND_ROW], overrides: Record<string, string | null> = {}) {
  return record({
    Reproduction: [
      '- **backend:** `tests/TotalTest.php` — red: Failed asserting that null is 120',
      '- **frontend:** CI run https://github.com/acme/frontend/actions/runs/9 — red: total is undefined',
    ].join('\n'),
    Guard: ['- **backend:** none — the reproduction is the guard', '- **frontend:** a contract test on the total'].join('\n'),
    Mutation: ['- **backend:** Mutation: not run in a target', '- **frontend:** Mutation: not run in a target'].join('\n'),
    Fixes: [...FIXES_HEADER, ...rows].join('\n'),
    ...overrides,
  });
}

/** A plan repository's record branch: only bug.md, committed, no reproduction file here. */
function recordBranch(bug = multiRecord(), configText = PLAN_CONFIG) {
  const repo = setup(configText);
  repo.write(RECORD, bug);
  commit(repo.root, 'docs(delivery): the record of bug #12 across the targets (#12)');
  return repo;
}

/** Runs `omni bug` and expects `not ok`, exit 1; returns every failure line. */
async function allFailures(root: string, base: string) {
  const { code, out } = await run(root, base);
  expect(code).toBe(1);
  expect(out).toMatch(/^not ok$/m);
  return failures(out);
}

describe('omni bug, a record with ## Fixes (PRD 1118)', () => {
  it('is ok for rows in order 1..k naming plan.targets repositories and their PRs, one line per target, no reproduction on the branch', async () => {
    const { root, base } = recordBranch();
    const { code, out } = await run(root, base);
    expect(out).toMatch(/^ok$/m);
    expect(code).toBe(0);
  });

  it('reads a row naming the repository by its full slug and its PR as #n, and a line keyed by the slug', async () => {
    const bug = multiRecord(['| 1 | `acme/backend` | #41 | restore the total |'], {
      Reproduction: '- **acme/backend:** `tests/TotalTest.php` — red: null is 120',
      Guard: '- **acme/backend:** none',
    });
    const { root, base } = recordBranch(bug);
    expect((await run(root, base)).code).toBe(0);
  });

  it('is not ok, naming the row, for a repository not in plan.targets', async () => {
    const { root, base } = recordBranch(multiRecord([BACKEND_ROW, '| 2 | mobile | acme/mobile#3 | x |']));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: Fixes row 2: mobile is not a repository of plan.targets.`]);
  });

  it('is not ok, naming the row, for a row without a pull request', async () => {
    const { root, base } = recordBranch(multiRecord([BACKEND_ROW, '| 2 | frontend | — | read the total |']));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: Fixes row 2 (acme/frontend): no pull request.`]);
  });

  it('is not ok, naming the row, for a pull request in another repository', async () => {
    const { root, base } = recordBranch(multiRecord([BACKEND_ROW, '| 2 | frontend | acme/backend#42 | x |']));
    expect(await allFailures(root, base)).toEqual([
      `- ${RECORD}: Fixes row 2 (acme/frontend): the pull request acme/backend#42 is not in acme/frontend.`,
    ]);
  });

  it('is not ok, naming the row, for a gap in the order', async () => {
    const { root, base } = recordBranch(multiRecord([BACKEND_ROW, FRONTEND_ROW.replace('| 2 |', '| 3 |')]));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: Fixes row 2 (acme/frontend): order 3, where 2 is next.`]);
  });

  it('is not ok, naming the row, for a repeat in the order', async () => {
    const { root, base } = recordBranch(multiRecord([BACKEND_ROW, FRONTEND_ROW.replace('| 2 |', '| 1 |')]));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: Fixes row 2 (acme/frontend): order 1 repeats an earlier row; 2 is next.`]);
  });

  it('is not ok, naming the row, for an order that is not a number', async () => {
    const { root, base } = recordBranch(multiRecord([BACKEND_ROW.replace('| 1 |', '| first |'), FRONTEND_ROW]));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: Fixes row 1 (acme/backend): order "first", where 1 is next.`]);
  });

  it.each([
    ['Reproduction', '- **backend:** `tests/TotalTest.php` — red: null is 120'],
    ['Guard', '- **backend:** none'],
  ])('is not ok, naming the row, for a target missing its %s line', async (name: string, lines: string) => {
    const { root, base } = recordBranch(multiRecord(undefined, { [name]: lines }));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: Fixes row 2 (acme/frontend): the ${name} has no **frontend:** line.`]);
  });

  it('is not ok for an empty per-target line', async () => {
    const { root, base } = recordBranch(multiRecord(undefined, { Guard: '- **backend:** none\n- **frontend:**' }));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: Fixes row 2 (acme/frontend): the Guard has no **frontend:** line.`]);
  });

  it('is not ok for a Fixes section with no rows', async () => {
    const { root, base } = recordBranch(multiRecord([]));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: the "## Fixes" table has no rows.`]);
  });

  it('is not ok, naming every row, in a repository without a plan section', async () => {
    const { root, base } = recordBranch(multiRecord(), CONFIG_TEXT);
    expect(await allFailures(root, base)).toEqual([
      `- ${RECORD}: Fixes row 1: backend is not a repository of plan.targets.`,
      `- ${RECORD}: Fixes row 2: frontend is not a repository of plan.targets.`,
    ]);
  });

  it('still grades the five sections of a multi-target record', async () => {
    const { root, base } = recordBranch(multiRecord(undefined, { Fix: null }));
    expect(await allFailures(root, base)).toEqual([`- ${RECORD}: no "## Fix" section.`]);
  });
});

describe('omni bug — a change to a law needs the fix\'s outbox (PRD 1342)', () => {
  const LAWS_CONFIG = `${CONFIG_TEXT}laws:\n  source: knowledge\n`;
  const PROOF = 'app/proof.test.mjs';
  const INVARIANTS = '.omni-loop/knowledge/product/invariants.md';
  const OUTBOX = `${DIR}/outbox`;
  const LAW = `# Product invariants\n\n## N-PRODUCT-1\n\nA save writes one row.\n\nEnforced by: ${PROOF}\n`;
  const ITEM = [
    '---', 'id: s1-01-proof', 'prd: 12', 'slice: s1', 'rank: high', 'bears-on: N-PRODUCT-1', 'raised: 2026-10-10', 'wave: 1', '---', '',
    '## The question, in plain words', '', 'The fix removes the old test of saving. Is that all right?', '',
    '## The decision, in plain words', '', 'Yes, the new reproduction covers it.', '',
    '## The options, in plain words', '', 'A. Remove it, as built.', 'B. Keep it.', '',
    '## What I had to decide', '', 'x', '', '## What I did meanwhile', '', 'Removed it.', '',
    '## What it costs to change later', '', 'One file.', '', '## What I could not know', '', '(author) w', '',
  ].join('\n');
  const ACCOUNT = ['---', 'prd: 12', 'slice: s1', 'graded: 2026-10-10', '---', '', '## Risky changes', '', `- \`${PROOF}\``, 'law-proof', 'item s1-01-proof', '', `- \`${PROOF}\``, 'test-removed', 'item s1-01-proof', ''].join('\n');

  /** A fix branch that removes the law's proof, with `extra` files written beside the record. */
  function removesProof(configText: string, extra: Record<string, string> = {}) {
    const repo = setup(configText, { [INVARIANTS]: LAW, [PROOF]: "it('writes one row', () => {});\n" });
    execFileSync('git', ['rm', '-q', PROOF], { cwd: repo.root });
    repo.write(REPRO, "it('saves once', () => {});\n");
    repo.write(RECORD, record());
    for (const [path, text] of Object.entries(extra)) repo.write(path, text);
    commit(repo.root, 'fix(app): saving twice keeps one row (#12)');
    return repo;
  }

  it('is not ok when the range removes a law\'s test and the folder holds no outbox, naming where it goes', async () => {
    const { root, base } = removesProof(LAWS_CONFIG);
    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    const need = `a change to a law needs an item ranked high in ${OUTBOX}/ and an account naming it in ${OUTBOX}/accounts/.`;
    expect(failures(out)).toEqual([`- ${PROOF} (law-proof): ${need}`, `- ${PROOF} (test-removed): ${need}`]);
  });

  it('is ok once the outbox holds a high item and an account naming it, still open for a person', async () => {
    const { root, base } = removesProof(LAWS_CONFIG, { [`${OUTBOX}/s1-01-proof.md`]: ITEM, [`${OUTBOX}/accounts/s1.md`]: ACCOUNT });
    const { code, out } = await run(root, base);
    expect(failures(out)).toEqual([]);
    expect(code).toBe(0);
  });

  it('is not ok when the base\'s law loses its proof, even with the test kept (law-demoted)', async () => {
    const repo = setup(LAWS_CONFIG, { [INVARIANTS]: LAW, [PROOF]: "it('writes one row', () => {});\n" });
    repo.write(INVARIANTS, LAW.replace(`Enforced by: ${PROOF}`, 'Enforced by: unenforced'));
    repo.write(REPRO, "it('saves once', () => {});\n");
    repo.write(RECORD, record());
    commit(repo.root, 'fix(app): saving twice keeps one row (#12)');
    const { out } = await run(repo.root, repo.base);
    expect(failures(out)).toEqual([
      expect.stringMatching(new RegExp(`^- ${INVARIANTS} \\(law-text\\): `)),
      expect.stringMatching(new RegExp(`^- ${INVARIANTS} \\(law-demoted\\): `)),
    ]);
  });

  it('asks nothing when laws.source is not knowledge', async () => {
    const { root, base } = removesProof(CONFIG_TEXT);
    const { code, out } = await run(root, base);
    expect(failures(out)).toEqual([]);
    expect(code).toBe(0);
  });
});
