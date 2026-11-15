// The runner's e2e fallback (PRD 2898 s8): the line the App queues, the result line the job ends its log on, and
// the run itself in a fixture worktree, every program it calls (git, pnpm, gh) a fake script on its PATH that
// records what it was given. Nothing reaches GitHub, a preview or a model.
import { parsePr, parsePrd } from '../ids.ts';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ACCEPTANCE_REPORT_FORMAT } from '../ready/report.ts';
import { makeRepo } from '../../test/fixture.ts';
import { e2eResultsOf, runAcceptance, secretsOf } from './acceptance.ts';
import { acceptanceLine, acceptanceOfLog, parseAcceptanceLine } from './acceptance-line.ts';
import { APP_SKILLS, checkRunnerLine, RUNNABLE_SKILLS } from './line.ts';

const SHA = 'c3'.repeat(20);
const KEY = `sk-or-${'k'.repeat(24)}`;
const BYPASS = `bp${'x'.repeat(30)}`;

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** The e2e run's report.json: AC-9 of PRD 2898 passed, AC-2 failed, a test of another PRD and one with no AC title. */
const E2E_REPORT = JSON.stringify({
  schemaVersion: 'report-1',
  run: {
    results: [
      { titlePath: ['ready.e2e.ts', 'AC-9: The PRD page shows what ready proves'], status: 'passed', tags: ['prd-2898'], file: 'tests/ready.e2e.ts' },
      { titlePath: ['AC-2: A loosened test keeps the pull request a draft'], status: 'timed-out', tags: ['prd-2898'], file: 'tests/loose.e2e.ts' },
      { titlePath: ['AC-1: Another PRD'], status: 'passed', tags: ['prd-12'], file: 'tests/other.e2e.ts' },
      { titlePath: ['opens the arcade'], status: 'passed', tags: ['prd-2898'], file: 'tests/smoke.e2e.ts' },
    ],
  },
});

/** Why the log's result line says nothing was proven; empty when it proved something, or says nothing. */
function whyOf(log: string): string {
  const read = acceptanceOfLog(log);
  return read === null || read.ok ? '' : read.why;
}

describe('the acceptance line', () => {
  it('names the PRD, its feature PR and the commit, and is a line a runner takes', () => {
    const line = acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA });
    expect(line).toBe(`/omni:acceptance 2898 --pr 2927 --sha ${SHA}`);
    expect(parseAcceptanceLine(line)).toEqual({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA });
    expect(checkRunnerLine(line)).toMatchObject({ ok: true, kind: 'omni', skill: 'acceptance' });
  });

  it('is an app\'s line, no skill a person sends', () => {
    expect([...APP_SKILLS]).toEqual(['acceptance']);
    expect(RUNNABLE_SKILLS).not.toContain('acceptance');
  });

  it('reads nothing from any other line, nor from one out of shape', () => {
    for (const line of ['/omni:yolo 2898', '/omni:acceptance 2898', `/omni:acceptance 2898 --pr 0 --sha ${SHA}`, '/omni:acceptance 2898 --pr 2927 --sha abc', `/omni:acceptance 2898 --pr 2927 --sha ${SHA} --url x`]) {
      expect(parseAcceptanceLine(line), line).toBeNull();
    }
  });
});

describe('the result line', () => {
  it('reads the last result line of a log tail: the report, or why there is none', () => {
    const report = { format: ACCEPTANCE_REPORT_FORMAT, commit: SHA, results: [{ ac: 9, kind: 'e2e' as const, state: 'passed' as const, title: 'AC-9: It shows', proof: 'e2e/tests/a.e2e.ts' }] };
    expect(acceptanceOfLog(`$ pnpm exec e2e run\n12:00:01 omni-acceptance: failed — early\nomni-acceptance: ${JSON.stringify(report)}\n`)).toEqual({ ok: true, report });
    expect(acceptanceOfLog('omni-acceptance: failed — no preview of c3c3c3c succeeded within 15 minutes\n')).toEqual({ ok: false, why: 'no preview of c3c3c3c succeeded within 15 minutes' });
    expect(whyOf('omni-acceptance: {"format":"other"}')).toContain('the acceptance report is malformed');
    expect(acceptanceOfLog('$ git fetch\nnothing else\n')).toBeNull();
  });

  it('turns the e2e run\'s tests titled AC-<n> and tagged with the PRD into e2e proofs, a timed-out one failed', () => {
    expect(e2eResultsOf(E2E_REPORT, { prd: parsePrd(2898), dir: 'e2e' })).toEqual([
      { ac: 9, kind: 'e2e', state: 'passed', title: 'AC-9: The PRD page shows what ready proves', proof: 'e2e/tests/ready.e2e.ts' },
      { ac: 2, kind: 'e2e', state: 'failed', title: 'AC-2: A loosened test keeps the pull request a draft', proof: 'e2e/tests/loose.e2e.ts' },
    ]);
  });

  it('masks the preview\'s bypass and every key, token or secret, the longest first', () => {
    expect(secretsOf({ OPENROUTER_API_KEY: KEY, PREVIEW_BYPASS: BYPASS, GH_TOKEN: 'short', PATH: '/usr/bin:/bin:/sbin' }, 'PREVIEW_BYPASS')).toEqual([BYPASS, KEY]);
  });
});

/** A fixture worktree, with fake git, pnpm and gh on its PATH, each appending its arguments to `calls`. */
function worktree({ url, deployment = null }: { url: string; deployment?: string | null }) {
  const config = ['kit: 1', 'repo:', '  slug: acme/widgets', 'e2e:', `  url: ${url}`, '  bypassEnv: PREVIEW_BYPASS', ...(deployment === null ? [] : [`  deployment: ${deployment}`]), ''].join('\n');
  const { root } = makeRepo({ files: { '.omni-loop/config.yml': config, 'pnpm-lock.yaml': 'lockfileVersion: 9.0\n', 'e2e/package.json': '{}\n' } });
  roots.push(root);
  const bin = join(root, '.bin');
  mkdirSync(bin);
  const calls = join(root, '.calls');
  const fake = (name: string, body: string[]) => {
    writeFileSync(join(bin, name), ['#!/bin/sh', `echo "${name} $*" >> "${calls}"`, ...body, ''].join('\n'));
    chmodSync(join(bin, name), 0o755);
  };
  fake('git', ['exit 0']);
  fake('pnpm', [
    'if [ "$2" = "e2e-web" ]; then exit 1; fi',
    'if [ "$2" = "e2e" ]; then',
    '  echo "APP_URL=$APP_URL telemetry=$E2E_TELEMETRY_DISABLED key=$OPENROUTER_API_KEY bypass=$PREVIEW_BYPASS"',
    '  mkdir -p .e2e',
    `  cat > .e2e/report.json <<'EOF'`,
    E2E_REPORT,
    'EOF',
    '  exit 1',
    'fi',
    'exit 0',
  ]);
  const log = join(root, '.job.log');
  writeFileSync(log, '');
  let pane = '';
  const io = {
    cwd: root,
    log,
    out: { write: (text: string) => (pane += text) },
    env: { PATH: `${bin}:/usr/bin:/bin`, OPENROUTER_API_KEY: KEY, PREVIEW_BYPASS: BYPASS },
    sleep: () => Promise.resolve(),
  };
  return { root, bin, io, fake, log: () => readFileSync(log, 'utf8'), pane: () => pane, calls: () => readFileSync(calls, 'utf8').trim().split('\n') };
}

describe('runAcceptance — a runner runs the e2e scenarios against the preview (PRD 2898 s8)', () => {
  it('checks the commit out, installs, runs the PRD\'s scenarios with telemetry off on the target, and ends on the report', async () => {
    const tree = worktree({ url: 'https://preview.example.test' });
    expect(await runAcceptance(acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA }), tree.io)).toBe(0);
    expect(tree.calls()).toEqual([
      `git fetch origin ${SHA}`,
      `git checkout --detach ${SHA}`,
      'pnpm install --frozen-lockfile',
      'pnpm exec e2e-web install chromium',
      'pnpm exec e2e run --tag prd-2898 --pass-with-no-tests',
    ]);
    const log = tree.log();
    expect(log).toContain('APP_URL=https://preview.example.test telemetry=1 key=*** bypass=***');
    expect(log).toContain('the browser could not be installed here');
    expect(log).not.toContain(KEY);
    expect(log).not.toContain(BYPASS);
    expect(tree.pane()).toBe(log);
    expect(acceptanceOfLog(log)).toEqual({
      ok: true,
      report: { format: ACCEPTANCE_REPORT_FORMAT, commit: SHA, results: e2eResultsOf(E2E_REPORT, { prd: parsePrd(2898), dir: 'e2e' }) },
    });
  });

  it('waits for the preview of the commit with github-deployment, only the deployment e2e.deployment names', async () => {
    const tree = worktree({ url: 'github-deployment', deployment: 'Preview – galaxy' });
    const state = join(tree.root, '.polls');
    tree.fake('gh', [
      'case "$2" in',
      `  *deployments\\?sha=${SHA}*) echo '[{"id":2,"environment":"Preview – docs"},{"id":1,"environment":"Preview – galaxy"}]' ;;`,
      `  *deployments/1/statuses*) if [ -f "${state}" ]; then echo '[{"state":"success","environment_url":"https://galaxy-git-ready.example.test"}]'; else touch "${state}"; echo '[{"state":"in_progress"}]'; fi ;;`,
      '  *) exit 9 ;;',
      'esac',
    ]);
    expect(await runAcceptance(acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA }), tree.io)).toBe(0);
    expect(tree.calls().filter((call) => call.startsWith('gh '))).toHaveLength(4);
    expect(tree.log()).toContain('APP_URL=https://galaxy-git-ready.example.test');
  });

  it('ends failed, naming why, when the preview\'s address cannot be read, and runs no scenario', async () => {
    const tree = worktree({ url: 'github-deployment' });
    tree.fake('gh', ['echo "HTTP 403: Resource not accessible by integration" >&2', 'exit 1']);
    expect(await runAcceptance(acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA }), tree.io)).toBe(1);
    expect(acceptanceOfLog(tree.log())).toEqual({ ok: false, why: "the preview's address could not be read: gh api repos/acme/widgets/deployments exited 1" });
    expect(tree.calls().some((call) => call.includes('e2e run'))).toBe(false);
  });

  it('ends failed on a line out of shape, a checkout that fails, an unset e2e.url, or a run that wrote no report', async () => {
    const bad = worktree({ url: 'https://preview.example.test' });
    expect(await runAcceptance('/omni:acceptance 2898', bad.io)).toBe(1);
    expect(whyOf(bad.log())).toContain('/omni:acceptance <prd> --pr <n> --sha');

    const noCheckout = worktree({ url: 'https://preview.example.test' });
    noCheckout.fake('git', ['exit 128']);
    expect(await runAcceptance(acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA }), noCheckout.io)).toBe(1);
    expect(acceptanceOfLog(noCheckout.log())).toEqual({ ok: false, why: 'git fetch exited 128' });

    const noUrl = worktree({ url: 'null' });
    expect(await runAcceptance(acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA }), noUrl.io)).toBe(1);
    expect(acceptanceOfLog(noUrl.log())).toEqual({ ok: false, why: 'e2e.url is not set: there is no address to run the scenarios on' });

    const noReport = worktree({ url: 'https://preview.example.test' });
    noReport.fake('pnpm', ['exit 2']);
    rmSync(join(noReport.root, 'pnpm-lock.yaml'));
    expect(await runAcceptance(acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA }), noReport.io)).toBe(1);
    expect(acceptanceOfLog(noReport.log())).toEqual({ ok: false, why: 'the e2e run wrote no report (it exited 2)' });
    expect(noReport.calls()).not.toContain('pnpm install --frozen-lockfile');
  });
});
