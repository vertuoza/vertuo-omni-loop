import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readRun } from '../lib/proof/run.ts';
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

const GIF_LINK = 'https://omni.example/api/proofs/9f0c1d2e-0000-4000-8000-000000000001/preview.gif';
const PROOF = [
  `![Before and after the fix](${GIF_LINK})`,
  '',
  '- **Before the fix** (red): `AssertionError: expected 2 to be 1`',
  '- **After the fix** (green, `a1b2c3d`): `✓ saves once`',
].join('\n');

/** A pull request body in the skill's shape, its `## Proof` section replaced (a string) or left out (`null`). */
function prBody(proof: string | null = PROOF) {
  const proofSection = proof === null ? [] : ['## Proof', '', proof, ''];
  return ['Closes #12', '', '## What was wrong', '', 'Saving twice wrote two rows.', '', ...proofSection, '## Bug', '', '- **Issue:** #12', ''].join('\n');
}

const bodies = mkdtempSync(join(tmpdir(), 'omni-bug-body-'));
afterAll(() => {
  rmSync(bodies, { recursive: true, force: true });
});

/** A file holding `text`, outside every repository: what `--body-file` names. */
function bodyFile(text: string) {
  const path = join(bodies, `body-${readdirSync(bodies).length}.md`);
  writeFileSync(path, text);
  return path;
}

/** The body most tests hand `--body-file`, so that they grade the branch and not the proof. */
const PASSING_BODY = bodyFile(prBody());

async function run(root: string, base: string, issue: number | string = ISSUE, extra: string[] = ['--body-file', PASSING_BODY]) {
  const s = io();
  const code = await main(['bug', String(issue), '--base', base, ...extra], { cwd: root, ...s });
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

describe('omni bug — the pull request carries its proof (PRD 2100)', () => {
  const NO_PROOF = '- no ## Proof section';
  const NO_IMAGE = '- ## Proof has no image and no "GIF not produced - <reason>" line';
  const NO_LINES = '- ## Proof\'s image has no "Before the fix" or "After the fix" line';
  const HOW_TO_PROCEED =
    '- no pull request body to check: make the GIF (omni bug film 12 --before <red> --after <green>, then omni proof push --kind bug 12 <folder>), ' +
    'write the body with its ## Proof section to a file, and rerun omni bug 12 --body-file <file>; ' +
    'with no GIF, ## Proof is the line GIF not produced - <reason> and the pull request opens as a draft';
  const NOT_PRODUCED = prBody('GIF not produced - ffmpeg not found');

  /** A fake process runner: git is real; `gh` answers as told, and its calls are recorded. */
  function withGh(answer: string | Error) {
    const calls: { args: string[]; cwd: unknown }[] = [];
    const exec = ((file: string, args: readonly string[], options?: { cwd?: unknown }) => {
      if (file !== 'gh') return execFileSync(file, args, options as never);
      calls.push({ args: [...args], cwd: options?.cwd });
      if (answer instanceof Error) throw answer;
      return answer;
    }) as never;
    return { exec, calls };
  }

  /** `omni bug 12` on a branch with `extra` arguments, `gh` answering as told (by default it must not be asked). */
  async function check(extra: string[], gh: string | Error = new Error('gh must not be asked'), branch: { root: string; base: string } = fixBranch()) {
    const s = io();
    const fake = withGh(gh);
    const code = await main(['bug', String(ISSUE), '--base', branch.base, ...extra], { cwd: branch.root, exec: fake.exec, ...s });
    return { code, out: s.out.join(''), err: s.err.join(''), calls: fake.calls, root: branch.root };
  }

  const fromFile = (text: string, branch?: { root: string; base: string }) => check(['--body-file', bodyFile(text)], undefined, branch);
  const viewed = (over: Record<string, unknown> = {}) => JSON.stringify({ body: prBody(), isDraft: false, state: 'OPEN', number: 34, ...over });
  const noPullRequest = () => Object.assign(new Error('no pull requests found for branch "fix/saving"'), { status: 1 });

  describe('with --body-file', () => {
    it('is ok for a ## Proof holding an https image and its Before and After lines, and asks gh nothing', async () => {
      const { code, out, calls } = await fromFile(prBody());
      expect(out).toBe('ok\n');
      expect(code).toBe(0);
      expect(calls).toEqual([]);
    });

    it('is ok for the line GIF not produced - <reason>', async () => {
      const { code, out } = await fromFile(NOT_PRODUCED);
      expect(out).toBe('ok\n');
      expect(code).toBe(0);
    });

    it('reads a relative path against the repository root', async () => {
      const branch = fixBranch();
      writeFileSync(join(branch.root, 'body.md'), prBody());
      expect((await check(['--body-file', 'body.md'], undefined, branch)).code).toBe(0);
    });

    it.each([
      ['has no ## Proof section', prBody(null), NO_PROOF],
      ['has a ## Proof of prose only', prBody('The fix is in the handler.'), NO_IMAGE],
      ['has a not-produced line with no reason', prBody('GIF not produced -'), NO_IMAGE],
      ['has a not-produced line whose reason is blanks', prBody('GIF not produced -   '), NO_IMAGE],
      ['has a not-produced line with a colon for its dash', prBody('GIF not produced: ffmpeg not found'), NO_IMAGE],
      ['has an image that is not https', prBody(PROOF.replace('https://', 'http://')), NO_IMAGE],
      ['has a link that is not an image', prBody(PROOF.replace('![', '[')), NO_IMAGE],
      ['has an image and neither line', prBody(`![x](${GIF_LINK})`), NO_LINES],
      ['has an image without its Before line', prBody(PROOF.replace('- **Before the fix**', '- Before the fix')), NO_LINES],
      ['has an image without its After line', prBody(PROOF.replace('- **After the fix**', '- After the fix')), NO_LINES],
    ])('is not ok when the body %s, with that one line', async (_name: string, text: string, line: string) => {
      const { code, out } = await fromFile(text);
      expect(out).toBe(`not ok\n${line}\n`);
      expect(code).toBe(1);
    });

    it('reads only the ## Proof section: a not-produced line or an image under another heading does not count', async () => {
      const elsewhere = `${prBody('The fix is in the handler.')}\nGIF not produced - ffmpeg not found\n![x](${GIF_LINK})\n`;
      expect(failures((await fromFile(elsewhere)).out)).toEqual([NO_IMAGE]);
    });

    it('reads a ## Proof that runs to the end of the body, with CRLF line ends and a ### inside it', async () => {
      const crlf = ['Closes #12', '', '## Proof', '', '### The GIF', '', PROOF, ''].join('\r\n');
      expect((await fromFile(crlf)).code).toBe(0);
      expect((await fromFile(['## Proof', 'GIF not produced - no ffmpeg', ''].join('\r\n'))).code).toBe(0);
    });

    it('grades the first ## Proof when the body has two', async () => {
      const twice = `${prBody('The fix is in the handler.')}\n## Proof\n\n${PROOF}\n`;
      expect(failures((await fromFile(twice)).out)).toEqual([NO_IMAGE]);
    });

    it('adds the proof fault to the faults of the branch, one line each', async () => {
      const { code, out } = await fromFile(prBody(null), fixBranch({ signed: false }));
      expect(code).toBe(1);
      expect(failures(out)).toEqual([expect.stringMatching(/^- unsigned: /), NO_PROOF]);
    });

    it('is exit 2 for a file that cannot be read, and for a flag with no file', async () => {
      const missing = await check(['--body-file', join(bodies, 'nope.md')]);
      expect(missing.code).toBe(2);
      expect(missing.err).toMatch(/omni bug: cannot read .*nope\.md \(ENOENT\)/);
      expect(missing.out).toBe('');
      const bare = await check(['--body-file']);
      expect(bare.code).toBe(2);
      expect(bare.err).toMatch(/--body-file needs a value/);
    });

    it('names the flag in its usage, exit 2, for no number or two', async () => {
      const { root } = fixBranch();
      for (const args of [['bug'], ['bug', '12', '13']]) {
        const s = io();
        expect(await main(args, { cwd: root, ...s })).toBe(2);
        expect(s.err.join('')).toContain('usage: omni bug <n> [--base <ref>] [--body-file <file>]');
      }
    });
  });

  describe('with no flag, reading the open pull request of the branch', () => {
    it('asks gh for the branch\'s pull request, in the repository root, and checks its body', async () => {
      const { code, out, calls, root } = await check([], viewed());
      expect(calls).toEqual([{ args: ['pr', 'view', '--json', 'body,isDraft,state,number'], cwd: realpathSync(root) }]);
      expect(out).toBe('ok\n');
      expect(code).toBe(0);
    });

    it('is not ok when the pull request\'s body has no proof, with the fault a file has', async () => {
      const { code, out } = await check([], viewed({ body: prBody(null) }));
      expect(out).toBe(`not ok\n${NO_PROOF}\n`);
      expect(code).toBe(1);
    });

    it('reads a pull request with no body as one with no ## Proof', async () => {
      expect(failures((await check([], viewed({ body: null }))).out)).toEqual([NO_PROOF]);
      expect(failures((await check([], viewed({ body: '' }))).out)).toEqual([NO_PROOF]);
    });

    it('is not ok, asking for a draft, for a proof not produced on a pull request that is not one', async () => {
      const { code, out } = await check([], viewed({ body: NOT_PRODUCED, isDraft: false, number: 34 }));
      expect(out).toBe('not ok\n- the proof was not produced but #34 is not a draft: gh pr ready 34 --undo\n');
      expect(code).toBe(1);
    });

    it('is ok for a proof not produced on a draft', async () => {
      const { code, out } = await check([], viewed({ body: NOT_PRODUCED, isDraft: true }));
      expect(out).toBe('ok\n');
      expect(code).toBe(0);
    });

    it('asks for no draft when the proof has a fault of its own: an empty reason is no not-produced proof', async () => {
      const { out } = await check([], viewed({ body: prBody('GIF not produced -'), isDraft: false }));
      expect(failures(out)).toEqual([NO_IMAGE]);
    });

    it('asks for no draft when the proof was produced', async () => {
      expect((await check([], viewed({ body: prBody(PROOF), isDraft: false }))).code).toBe(0);
    });

    it.each([
      ['no open pull request, gh failing', noPullRequest()],
      ['gh not installed', Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' })],
      ['a pull request that was closed', viewed({ state: 'CLOSED' })],
      ['a pull request that was merged', viewed({ state: 'MERGED' })],
      ['an answer that is not JSON', 'to get started with GitHub CLI, please run: gh auth login'],
      ['an answer that is no pull request', '{"body":"x"}'],
      ['a pull request whose number is not one', viewed({ number: 0 })],
    ])('prints the way to proceed, exit 1, for %s', async (_name: string, gh: string | Error) => {
      const { code, out } = await check([], gh);
      expect(out).toBe(`not ok\n${HOW_TO_PROCEED}\n`);
      expect(code).toBe(1);
    });

    it('prints the way to proceed beside the faults of the record', async () => {
      const { out } = await check([], noPullRequest(), fixBranch({ bug: record({ Fix: null }) }));
      expect(failures(out)).toEqual([`- ${RECORD}: no "## Fix" section.`, HOW_TO_PROCEED]);
    });

    it('prints the way to proceed beside a folder that is missing', async () => {
      const { out } = await check([], noPullRequest(), setup());
      expect(failures(out)).toEqual([expect.stringMatching(/^- no folder /), HOW_TO_PROCEED]);
    });

    it('is exit 2 for a --base that does not resolve, before gh is asked', async () => {
      const { code, calls } = await check(['--base', 'nope-ref'], viewed());
      expect(code).toBe(2);
      expect(calls).toEqual([]);
    });
  });

  describe('a record with ## Fixes (PRD 1118)', () => {
    it('passes with no ## Proof, with the flag or without it, and asks gh nothing', async () => {
      const flagged = await fromFile(prBody(null), recordBranch());
      expect(flagged.out).toBe('ok\n');
      expect(flagged.code).toBe(0);
      const bare = await check([], undefined, recordBranch());
      expect(bare.out).toBe('ok\n');
      expect(bare.code).toBe(0);
      expect(bare.calls).toEqual([]);
    });

    it('is still graded by its own rows', async () => {
      const { out } = await check([], undefined, recordBranch(multiRecord([])));
      expect(failures(out)).toEqual([`- ${RECORD}: the "## Fixes" table has no rows.`]);
    });

    it('is no exemption for a folder with no bug.md', async () => {
      const branch = setup(PLAN_CONFIG);
      branch.write(`${DIR}/notes.md`, 'notes\n');
      commit(branch.root, 'docs(delivery): notes (#12)');
      expect(failures((await fromFile(prBody(null), branch)).out)).toEqual([`- ${RECORD}: missing.`, NO_PROOF]);
    });
  });
});

describe('omni bug film (PRD 1972, PRD 2100)', () => {
  const SLUG_CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
  type Mode = 'ok' | 'missing' | 'fails';

  /** A fake process runner: git is real; ffmpeg writes its last argument, or fails as told. */
  function fake(mode: Mode) {
    const calls: string[][] = [];
    const exec = ((file: string, args: readonly string[], options?: unknown) => {
      if (file !== 'ffmpeg') return execFileSync(file, args, options as never);
      calls.push([...args]);
      if (mode === 'missing') throw new Error('spawn ffmpeg ENOENT');
      if (args[0] === '-version') return '';
      if (mode === 'fails') throw Object.assign(new Error('x'), { stderr: 'banner\nInvalid filtergraph\n' });
      writeFileSync(args.at(-1) ?? '', 'GIF89a');
      return '';
    }) as never;
    return { exec, calls };
  }

  async function film(root: string, args: string[], mode: Mode = 'ok') {
    const s = io();
    const { exec, calls } = fake(mode);
    const code = await main(['bug', 'film', ...args], { cwd: root, exec, ...s });
    return { code, out: s.out.join('').trim(), err: s.err.join('').trim(), calls };
  }

  function inputs(ext: 'txt' | 'webm' = 'txt') {
    const { root, write } = setup(SLUG_CONFIG);
    write(`red.${ext}`, 'run\nAssertionError: expected 2 to be 1\n');
    write(`green.${ext}`, 'run\n✓ saves once\n');
    return root;
  }

  it('writes the folder from two outputs: the gif, the inputs and a run.json readRun accepts, with no ffmpeg call', async () => {
    const root = inputs();
    const out = join(root, 'proof-out');
    const { code, out: printed, calls } = await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', out]);
    expect(code).toBe(0);
    expect(printed).toBe(out);
    expect(calls).toEqual([]);
    for (const name of ['preview.gif', 'red.txt', 'green.txt', 'run.json']) expect(existsSync(join(out, name))).toBe(true);
    expect(readFileSync(join(out, 'red.txt'), 'utf8')).toBe('run\nAssertionError: expected 2 to be 1\n');
    const run = readRun(out);
    expect(run?.url).toBe('https://github.com/acme/widgets/issues/12');
    expect(run?.criteria.map((c) => c.verdict)).toEqual(['pass', 'pass']);
    expect(run?.criteria[0]?.note).toBe('AssertionError: expected 2 to be 1');
    expect(run?.criteria[1]?.note).toBe('✓ saves once');
  });

  it('draws a looping GIF of two 640x360 frames held 3 seconds each', async () => {
    const root = inputs();
    const out = join(root, 'proof-out');
    await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', out]);
    const bytes = readFileSync(join(out, 'preview.gif'));
    expect(bytes.subarray(0, 6).toString('latin1')).toBe('GIF89a');
    expect([bytes.readUInt16LE(6), bytes.readUInt16LE(8)]).toEqual([640, 360]);
    const hex = bytes.toString('hex');
    expect(hex.includes(`${Buffer.from('NETSCAPE2.0').toString('hex')}0301000000`)).toBe(true);
    expect(hex.match(/21f904042c010000/g)).toHaveLength(2);
    expect(bytes.at(-1)).toBe(0x3b);
  });

  it('writes the same preview.gif, byte for byte, for the same two files', async () => {
    const root = inputs();
    const first = join(root, 'out-1');
    const second = join(root, 'out-2');
    await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', first]);
    await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', second]);
    expect(readFileSync(join(first, 'preview.gif')).equals(readFileSync(join(second, 'preview.gif')))).toBe(true);
    writeFileSync(join(root, 'green.txt'), 'run\n✓ saves once\n✓ and again\n');
    const third = join(root, 'out-3');
    await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', third]);
    expect(readFileSync(join(first, 'preview.gif')).equals(readFileSync(join(third, 'preview.gif')))).toBe(false);
  });

  it('draws the cards on a machine with no ffmpeg: exit 0, ffmpeg never asked for', async () => {
    const root = inputs();
    const out = join(root, 'proof-out');
    const { code, err, calls } = await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', out], 'missing');
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(calls).toEqual([]);
    expect(existsSync(join(out, 'preview.gif'))).toBe(true);
    // and with an ffmpeg that would fail, a text pair still passes
    expect((await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', join(root, 'o2')], 'fails')).code).toBe(0);
  });

  it('stitches two clips as before.webm and after.webm, through ffmpeg', async () => {
    const root = inputs('webm');
    const out = join(root, 'proof-out');
    const { code, calls } = await film(root, ['12', '--before', 'red.webm', '--after', 'green.webm', '--out', out]);
    expect(code).toBe(0);
    expect(calls.some((c) => c.includes('-filter_complex'))).toBe(true);
    for (const name of ['preview.gif', 'before.webm', 'after.webm', 'run.json']) expect(existsSync(join(out, name))).toBe(true);
    expect(readRun(out)?.criteria.map((c) => c.video)).toEqual(['before.webm', 'after.webm']);
  });

  it('defaults the folder under <worktrees>/proof-bug-<n>/', async () => {
    const root = inputs();
    const { code, out } = await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt']);
    expect(code).toBe(0);
    expect(out).toMatch(/\/\.claude\/worktrees\/proof-bug-12\/\d{8}-\d{6}$/);
    rmSync(join(root, '.claude'), { recursive: true, force: true });
  });

  it('is exit 1 with ffmpeg not found for two clips', async () => {
    const root = inputs('webm');
    const { code, err } = await film(root, ['12', '--before', 'red.webm', '--after', 'green.webm', '--out', join(root, 'o')], 'missing');
    expect(code).toBe(1);
    expect(err).toBe('ffmpeg not found');
    expect(existsSync(join(root, 'o'))).toBe(false);
  });

  it('is exit 1 with the last line of a failing ffmpeg for two clips', async () => {
    const root = inputs('webm');
    const { code, err } = await film(root, ['12', '--before', 'red.webm', '--after', 'green.webm', '--out', join(root, 'o')], 'fails');
    expect(code).toBe(1);
    expect(err).toBe('ffmpeg failed: Invalid filtergraph');
  });

  it('is exit 1 with could not write <path> for a folder it cannot write, and for nothing else of a text pair', async () => {
    const root = inputs();
    writeFileSync(join(root, 'a-file'), 'x');
    const blocked = join(root, 'a-file', 'proof-out');
    const folder = await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', blocked]);
    expect(folder.code).toBe(1);
    expect(folder.err).toBe(`could not write ${blocked}`);
    expect(folder.out).toBe('');
    expect(folder.calls).toEqual([]);

    // the folder is there but its GIF cannot be written: a directory sits where the file goes
    const out = join(root, 'proof-out');
    mkdirSync(join(out, 'preview.gif'), { recursive: true });
    const gif = await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', out]);
    expect(gif.code).toBe(1);
    expect(gif.err).toBe(`could not write ${join(out, 'preview.gif')}`);

    // and a folder whose copy of the input cannot be written
    const copy = join(root, 'proof-copy');
    mkdirSync(join(copy, 'red.txt'), { recursive: true });
    const copied = await film(root, ['12', '--before', 'red.txt', '--after', 'green.txt', '--out', copy]);
    expect(copied.code).toBe(1);
    expect(copied.err).toBe(`could not write ${join(copy, 'red.txt')}`);
  });

  it('is exit 2 for a missing file, a .txt beside a .webm, and a number that is not one', async () => {
    const root = inputs();
    writeFileSync(join(root, 'clip.webm'), 'x');
    expect((await film(root, ['12', '--before', 'red.txt', '--after', 'nope.txt'])).code).toBe(2);
    expect((await film(root, ['12', '--before', 'red.txt', '--after', 'clip.webm'])).code).toBe(2);
    expect((await film(root, ['twelve', '--before', 'red.txt', '--after', 'green.txt'])).code).toBe(2);
  });
});
