// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
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
function record(overrides = {}) {
  const sections = { ...SECTIONS, ...overrides };
  const parts = ['# Bug 12: saving twice duplicates the row', ''];
  for (const [name, body] of Object.entries(sections)) {
    if (body === null) continue;
    parts.push(`## ${name}`, '', body, '');
  }
  return parts.join('\n');
}

/** Commits everything, signed as a skill signs it unless `signed` is false. Returns the short sha. */
function commit(root, message, { signed = true } = {}) {
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
function fixBranch({ bug = record(), configText, signed } = {}) {
  const repo = setup(configText);
  repo.write(REPRO, "it('saves once', () => {});\n");
  repo.write(RECORD, bug);
  const sha = commit(repo.root, 'fix(app): saving twice keeps one row (#12)', { signed });
  return { ...repo, sha };
}

async function run(root, base, issue = ISSUE) {
  const s = io();
  const code = await main(['bug', String(issue), '--base', base], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

/** The lines after `not ok` that name a failed check. */
function failures(out) {
  return out.split('\n').filter((line) => line.startsWith('- '));
}

/** Runs `omni bug` and expects `not ok`, exit 1, with exactly one failure line; returns it. */
async function onlyFailure(root, base) {
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

  it.each(['Triage', 'Reproduction', 'Fix', 'Guard', 'Mutation'])('is not ok when the %s section is missing', async (name) => {
    const { root, base } = fixBranch({ bug: record({ [name]: null }) });
    expect(await onlyFailure(root, base)).toBe(`- ${RECORD}: no "## ${name}" section.`);
  });

  it.each(['Triage', 'Reproduction', 'Fix', 'Guard', 'Mutation'])('is not ok when the %s section is empty', async (name) => {
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
