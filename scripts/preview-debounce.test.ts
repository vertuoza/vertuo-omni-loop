// The preview gate of the `preview-debounce` workflow (PRD 1646 s3). `gh` and `curl` are stubs on PATH
// that log every call: no test calls GitHub or Vercel. The wait is 0.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { digText } from '../kit/bin/dig.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEAD = 'a'.repeat(40);
const MOVED = 'b'.repeat(40);
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() ?? '', { recursive: true, force: true });
});

interface Case {
  /** The pull request as read first, then after the wait: `<draft> <base> <ref> <sha>`. */
  first?: string;
  second?: string;
  files?: string[];
  packagePatch?: string;
  curlExit?: number;
  statusExit?: number;
  env?: Record<string, string>;
}

const READY = `false main feat/topic ${HEAD}`;

/** Writes the `gh` and `curl` stubs into `dir`, each logging its call to `log`. */
function stubs(dir: string, log: string, c: Required<Omit<Case, 'env'>>) {
  writeFileSync(join(dir, 'files'), `${c.files.join('\n')}\n`);
  writeFileSync(join(dir, 'patch'), c.packagePatch);
  const stub = (name: string, lines: string[]) => {
    writeFileSync(join(dir, name), ['#!/usr/bin/env bash', `echo "${name} $*" >> '${log}'`, ...lines, ''].join('\n'));
    chmodSync(join(dir, name), 0o755);
  };
  const read = join(dir, 'read');
  stub('gh', [
    'case "$*" in',
    `  *statuses/*) exit ${c.statusExit} ;;`,
    `  *'.patch'*) cat '${join(dir, 'patch')}' ;;`,
    `  */files*) cat '${join(dir, 'files')}' ;;`,
    `  *) if [ -f '${read}' ]; then echo '${c.second}'; else touch '${read}'; echo '${c.first}'; fi ;;`,
    'esac',
  ]);
  stub('curl', [`[ "${c.curlExit}" = 0 ] || exit ${c.curlExit}`, 'echo \'{"url":"x-galaxy.vercel.app"}\'']);
}

function debounce(c: Case) {
  const dir = mkdtempSync(join(tmpdir(), 'preview-debounce-'));
  dirs.push(dir);
  const log = join(dir, 'log');
  const first = c.first ?? READY;
  stubs(dir, log, {
    first,
    second: c.second ?? first,
    files: c.files ?? ['apps/galaxy/src/a.ts'],
    packagePatch: c.packagePatch ?? '',
    curlExit: c.curlExit ?? 0,
    statusExit: c.statusExit ?? 0,
  });
  const run = spawnSync('bash', ['scripts/preview-debounce.sh'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_REPOSITORY: 'acme/widgets',
      DEBOUNCE_PR: '42',
      PREVIEW_DEBOUNCE_SECONDS: '0',
      VERCEL_TOKEN: 'vt',
      VERCEL_TEAM_ID: 'team_1',
      VERCEL_PROJECT_ID_GALAXY: 'prj_galaxy',
      VERCEL_PROJECT_ID_OMNI_APP: 'prj_omni',
      VERCEL_GITHUB_REPO_ID: '123',
      ...c.env,
    },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  return { ...run, calls, deploys: calls.filter((l) => l.startsWith('curl ')), statuses: calls.filter((l) => l.includes('/statuses/')) };
}

describe('preview-debounce.sh', () => {
  it.each([
    ['a draft', `true main feat/topic ${HEAD}`, /a draft/],
    ['a pull request into a feature branch', `false feat/topic feat/topic--s2 ${HEAD}`, /its base is feat\/topic/],
    ['a dependabot branch', `false main dependabot/npm_and_yarn/next ${HEAD}`, /dependabot/],
  ])('builds nothing for %s', (_, first, line) => {
    const run = debounce({ first });
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(line);
    expect(run.deploys).toEqual([]);
    expect(run.statuses).toEqual([]);
  });

  it('builds nothing when the head moved, or the pull request turned draft, while it waited', () => {
    const moved = debounce({ second: `false main feat/topic ${MOVED}` });
    expect(moved.stdout).toMatch(/moved to bbbbbbb/);
    expect(moved.deploys).toEqual([]);
    const drafted = debounce({ second: `true main feat/topic ${HEAD}` });
    expect(drafted.stdout).toMatch(/turned draft/);
    expect(drafted.deploys).toEqual([]);
  });

  it('marks and deploys galaxy alone for a galaxy change, from Git, at the head commit', () => {
    const run = debounce({ files: ['apps/galaxy/src/a.ts', '.omni-loop/delivery/shipped/1/spec.md'] });
    expect(run.status).toBe(0);
    expect(run.statuses).toHaveLength(1);
    expect(run.statuses[0]).toContain(`repos/acme/widgets/statuses/${HEAD}`);
    expect(run.statuses[0]).toContain('context=vercel/preview/galaxy');
    expect(run.deploys).toHaveLength(1);
    expect(run.deploys[0]).toContain('/v13/deployments?teamId=team_1');
    expect(run.deploys[0]).toContain(`"gitSource":{"type":"github","repoId":"123","ref":"feat/topic","sha":"${HEAD}"}`);
    expect(run.deploys[0]).toContain('"project":"prj_galaxy"');
    expect(run.stdout).toMatch(/galaxy: .* → deploying aaaaaaa at https:\/\/x-galaxy\.vercel\.app/);
  });

  it('deploys both projects when the change reaches both', () => {
    const run = debounce({ files: ['apps/galaxy/src/a.ts', 'apps/omni-app/src/b.ts'] });
    expect(run.deploys).toHaveLength(2);
    expect(run.deploys[1]).toContain('"project":"prj_omni"');
  });

  it('builds nothing for a change only under .omni-loop/', () => {
    const run = debounce({ files: ['.omni-loop/delivery/outbox/1/settled.md', '.omni-loop/knowledge/product/rules.md'] });
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/reach neither project/);
    expect(run.deploys).toEqual([]);
  });

  it('reads the package.json change: a version bump alone reaches neither project', () => {
    const run = debounce({ files: ['package.json'], packagePatch: '@@ -1 +1 @@\n-  "version": "1",\n+  "version": "2",\n' });
    expect(run.deploys).toEqual([]);
  });

  it('fails, red on the pull request, when Vercel refuses, the status cannot be set, or a secret is missing', () => {
    expect(debounce({ curlExit: 22 }).status).toBe(1);
    const noStatus = debounce({ statusExit: 1 });
    expect(noStatus.status).toBe(1);
    expect(noStatus.deploys).toEqual([]);
    const noToken = debounce({ env: { VERCEL_TOKEN: '' } });
    expect(noToken.status).toBe(1);
    expect(noToken.stdout).toMatch(/Dashboard steps/);
  });
});

describe('the preview-debounce workflow', () => {
  const workflow: unknown = parse(readFileSync(join(root, '.github/workflows/preview-debounce.yml'), 'utf8'));

  it('runs on ready pull requests into main, one run per branch, a newer push cancelling the wait', () => {
    expect(digText(workflow, 'concurrency', 'group')).toBe('preview-${{ github.head_ref }}');
    expect(JSON.stringify(workflow)).toContain('"cancel-in-progress":true');
    expect(JSON.stringify(workflow)).toContain('"types":["ready_for_review","synchronize"]');
    expect(JSON.stringify(workflow)).toContain('"branches":["main"]');
    expect(digText(workflow, 'jobs', 'preview', 'if')).toContain('github.event.pull_request.draft == false');
    expect(digText(workflow, 'permissions', 'statuses')).toBe('write');
  });

  it('calls the script', () => {
    expect(JSON.stringify(workflow)).toContain('bash scripts/preview-debounce.sh');
  });
});
