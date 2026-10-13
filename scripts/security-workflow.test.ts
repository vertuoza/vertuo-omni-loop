// The daily `security` workflow (PRD 1717, s3), read from .github/workflows/security.yml: once a day
// and by hand, off until the repository secret SECURITY_READ_TOKEN is set, it runs
// `node scripts/security-settings.ts` with that token, then opens one `omni:security` issue on red (or
// comments on the open one) and closes it on green. The issue step's shell runs here against a `gh`
// stub on PATH that logs every call: nothing here runs the workflow or calls GitHub.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  id?: string;
  name?: string;
  uses?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}

interface Job {
  if?: string;
  needs?: string | string[];
  permissions?: unknown;
  outputs?: Record<string, string>;
  steps?: Step[];
}

const path = fileURLToPath(new URL('../.github/workflows/security.yml', import.meta.url));
const source = readFileSync(path, 'utf8');
const workflow = parse(source) as {
  on: Record<string, unknown>;
  permissions: unknown;
  jobs: Record<string, Job>;
};

/** The job of that id; a missing one fails the test that asked for it. */
function job(id: string): Job {
  const found = workflow.jobs[id];
  if (!found) throw new Error(`security.yml has no job ${id}`);
  return found;
}

/** The step of that id in the watch job; a missing one fails the test that asked for it. */
function step(id: string): Step {
  const found = (job('watch').steps ?? []).find((s) => s.id === id);
  if (!found) throw new Error(`the watch job has no step ${id}`);
  return found;
}

/** Every `${{ secrets.X }}` the workflow names, anywhere. */
function secretsNamed(): string[] {
  return [...new Set([...source.matchAll(/secrets\.(\w+)/g)].map((match) => match[1] ?? ''))];
}

describe('the security workflow, when it runs', () => {
  it('runs once a day and by hand, nothing else', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
    const schedule = workflow.on.schedule as { cron: string }[];
    expect(schedule).toHaveLength(1);
    // minute hour * * *: one run a day.
    expect(schedule[0]?.cron).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });

  it('is off until SECURITY_READ_TOKEN is set: the watch job runs only when the token job saw it', () => {
    const token = job('token');
    const tokenStep = (token.steps ?? [])[0];
    expect(tokenStep?.env).toEqual({ SECURITY_READ_TOKEN: '${{ secrets.SECURITY_READ_TOKEN }}' });
    expect(tokenStep?.run).toContain('[ -n "$SECURITY_READ_TOKEN" ]');
    expect(token.outputs?.set).toBe(`\${{ steps.${tokenStep?.id ?? ''}.outputs.set }}`);
    expect([job('watch').needs].flat()).toEqual(['token']);
    expect(job('watch').if).toBe("needs.token.outputs.set == 'true'");
    expect(Object.keys(workflow.jobs).sort()).toEqual(['token', 'watch']);
  });
});

describe('the security workflow, what it may do', () => {
  it('reads the repository and writes issues, nothing else', () => {
    expect(workflow.permissions).toEqual({ contents: 'read', issues: 'write' });
    for (const id of Object.keys(workflow.jobs)) expect(job(id).permissions).toBeUndefined();
  });

  it('checks out without keeping a credential, and pushes nothing', () => {
    const checkout = (job('watch').steps ?? []).find((s) => s.uses?.startsWith('actions/checkout'));
    expect(checkout?.with?.['persist-credentials']).toBe(false);
    expect(source).not.toMatch(/git push/);
  });

  it('runs the script with GH_TOKEN from SECURITY_READ_TOKEN, before any install, and keeps its exit code', () => {
    const report = step('report');
    expect(report.env).toEqual({ GH_TOKEN: '${{ secrets.SECURITY_READ_TOKEN }}' });
    expect(report.run).toContain('node scripts/security-settings.ts');
    expect(report.run).not.toContain('--apply');
    expect(report.run).toContain('echo "code=$code" >> "$GITHUB_OUTPUT"');
    expect(source).not.toMatch(/pnpm install|npm (ci|install)/);
  });

  it('names no secret but SECURITY_READ_TOKEN, and writes issues with its own token', () => {
    expect(secretsNamed()).toEqual(['SECURITY_READ_TOKEN']);
    expect(step('issue').env?.GH_TOKEN).toBe('${{ github.token }}');
  });

  it('fails the run on red, so a red day shows in Actions too', () => {
    const steps = job('watch').steps ?? [];
    const last = steps[steps.length - 1];
    expect(last?.env?.CODE).toBe('${{ steps.report.outputs.code }}');
    expect(last?.run?.trim()).toBe('exit "$CODE"');
  });
});

describe("the security workflow's header", () => {
  const header = source.split('\n').filter((line) => line.startsWith('#')).join('\n');

  it("names the token's two scopes, where to create it, and the secret it goes in", () => {
    expect(header).toContain('SECURITY_READ_TOKEN');
    expect(header).toContain('Administration: read');
    expect(header).toContain('Secret scanning alerts: read');
    expect(header).toContain('Fine-grained tokens');
  });

  it('says the admin creates the omni:security label', () => {
    expect(header).toMatch(/admin[\s\S]*gh label create omni:security/);
  });
});

// The issue step's shell, run with bash against a `gh` stub.
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

const RED = [
  'secret_scanning: disabled → node scripts/security-settings.ts --apply',
  'secret_scanning_push_protection: disabled → node scripts/security-settings.ts --apply',
  'open secret scanning alerts: unreadable, secret_scanning is disabled → node scripts/security-settings.ts --apply',
  'security settings: red: secret_scanning disabled, secret_scanning_push_protection disabled',
].join('\n');
const GREEN = [
  'secret_scanning: enabled',
  'secret_scanning_push_protection: enabled',
  'open secret scanning alerts: none',
  'security settings: green',
].join('\n');

/** Runs the issue step with the report and the exit code, `open` the number of the open issue (or none); the `gh` calls it made, and what it sent. */
function runIssueStep({ report, code, open }: { report: string; code: number; open?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'security-workflow-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'security.txt'), `${report}\n`);
  const gh = [
    '#!/usr/bin/env bash',
    `dir='${dir}'`,
    'printf "%s\\n" "$*" >> "$dir/gh.log"',
    'prev=""; for arg in "$@"; do if [ "$prev" = "--body-file" ]; then cat "$arg" >> "$dir/bodies"; fi; prev="$arg"; done',
    'case "$1 $2" in',
    `  "issue list") echo '${open === undefined ? '' : String(open)}' ;;`,
    'esac',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'gh'), gh);
  chmodSync(join(dir, 'gh'), 0o755);
  const issue = step('issue');
  const run = spawnSync('bash', ['-e', '-c', issue.run ?? ''], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH ?? ''}`,
      RUNNER_TEMP: dir,
      CODE: String(code),
      REPORT: join(dir, 'security.txt'),
      RUN_URL: 'https://github.com/acme/widgets/actions/runs/7',
    },
  });
  const read = (name: string) => {
    try {
      return readFileSync(join(dir, name), 'utf8');
    } catch {
      return '';
    }
  };
  return { status: run.status, stderr: run.stderr, calls: read('gh.log').split('\n').filter(Boolean), bodies: read('bodies') };
}

describe('the issue step', () => {
  it('hands the step the report, the exit code and the run link', () => {
    const env = step('issue').env ?? {};
    expect(env.CODE).toBe('${{ steps.report.outputs.code }}');
    expect(env.REPORT).toBe('${{ runner.temp }}/security.txt');
    expect(env.RUN_URL).toBe('${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}');
    expect(env.GH_REPO).toBe('${{ github.repository }}');
    expect(step('report').run).toContain('"$RUNNER_TEMP/security.txt"');
  });

  it('on red with no issue open, opens one labelled omni:security, titled with what is wrong, whose body is the output', () => {
    const { status, calls, bodies } = runIssueStep({ report: RED, code: 1 });
    expect(status).toBe(0);
    expect(calls[0]).toBe('issue list --label omni:security --state open --json number --jq .[0].number // empty');
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/^issue create --title Security settings: secret_scanning disabled, secret_scanning_push_protection disabled --label omni:security --body-file /);
    expect(bodies).toContain(RED);
    expect(bodies).toContain('https://github.com/acme/widgets/actions/runs/7');
  });

  it('on red with the issue already open, comments the new output on it and opens no other', () => {
    const { status, calls, bodies } = runIssueStep({ report: RED, code: 1, open: 42 });
    expect(status).toBe(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/^issue comment 42 --body-file /);
    expect(bodies).toContain(RED);
  });

  it('on green, closes the open issue with a comment', () => {
    const { status, calls, bodies } = runIssueStep({ report: GREEN, code: 0, open: 42 });
    expect(status).toBe(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/^issue close 42 --comment /);
    expect(calls[1]).toContain('security settings: green');
    expect(bodies).toBe('');
  });

  it('on green with no issue open, does nothing more', () => {
    const { status, calls } = runIssueStep({ report: GREEN, code: 0 });
    expect(status).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('on red with no summary line (the script did not finish), still opens an issue that says so', () => {
    const { status, calls, bodies } = runIssueStep({ report: 'node: something broke', code: 1 });
    expect(status).toBe(0);
    expect(calls[1]).toMatch(/^issue create --title Security settings: the check did not finish --label omni:security /);
    expect(bodies).toContain('node: something broke');
  });
});
