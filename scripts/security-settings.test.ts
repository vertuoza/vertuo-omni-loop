// The security settings script (PRD 1717, s2): it reads the repository's secret scanning and push
// protection settings and its open secret scanning alerts through `gh api`, exits 0 only when both
// settings are enabled and no alert is open, and names each fix otherwise; `--apply` switches both on
// with one PATCH, then reads back. `gh` is a stub on PATH that answers from files and logs every call:
// no test calls GitHub.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parseArgs, render, slugFromConfig } from './security-settings.ts';

const script = join(dirname(fileURLToPath(import.meta.url)), 'security-settings.ts');
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

type Status = 'enabled' | 'disabled';

interface Fake {
  /** The repository's two settings; null leaves `security_and_analysis` out, as GitHub does for a reader without admin. */
  settings?: { scanning: Status; push: Status } | null;
  /** The open alerts; 404 answers as GitHub does when secret scanning is disabled. */
  alerts?: { number: number; secret_type_display_name: string; html_url: string }[] | 404;
  /** Fail the repository read with this HTTP status. */
  repoStatus?: number;
  /** Whether a PATCH switches the settings on (an admin) or is refused (HTTP 403). */
  patch?: 'ok' | 403;
  slug?: string;
}

const ON = { scanning: 'enabled', push: 'enabled' } as const;

/** The repository as `gh api repos/<slug>` answers it. */
function repoJson(slug: string, settings: Fake['settings']): object {
  if (settings === null) return { full_name: slug };
  const { scanning, push } = settings ?? ON;
  return {
    full_name: slug,
    security_and_analysis: {
      secret_scanning: { status: scanning },
      secret_scanning_push_protection: { status: push },
      secret_scanning_validity_checks: { status: 'disabled' },
    },
  };
}

// A PATCH merges its body into repo.json, and marks scanning on so the alerts call stops answering 404.
const PATCH_OK =
  `    node -e 'const fs=require("fs");const d=process.argv[1];const r=JSON.parse(fs.readFileSync(d+"/repo.json","utf8"));` +
  `const p=JSON.parse(fs.readFileSync(d+"/patch.json","utf8"));r.security_and_analysis={...r.security_and_analysis,...p.security_and_analysis};` +
  `fs.writeFileSync(d+"/repo.json",JSON.stringify(r));fs.writeFileSync(d+"/scanning-on","")' "$dir"; cat "$dir/repo.json"; exit 0 ;;`;
const PATCH_REFUSED = '    echo "gh: Must have admin rights to Repository. (HTTP 403)" >&2; exit 1 ;;';
const ALERTS_DISABLED = '    if [ -e "$dir/scanning-on" ]; then exit 0; fi; echo "gh: Secret scanning is disabled on this repository. (HTTP 404)" >&2; exit 1 ;;';
const ALERTS_FILE = '    cat "$dir/alerts.jsonl"; exit 0 ;;';
const REPO_FILE = '    cat "$dir/repo.json"; exit 0 ;;';

function ghScript(dir: string, fake: Fake): string {
  const repoAnswer = fake.repoStatus ? `    echo "gh: Bad credentials (HTTP ${String(fake.repoStatus)})" >&2; exit 1 ;;` : REPO_FILE;
  return [
    '#!/usr/bin/env bash',
    `dir='${dir}'`,
    'printf "%s\\n" "$*" >> "$dir/gh.log"',
    'case "$*" in',
    '  *"-X PATCH"*)',
    '    cat > "$dir/patch.json"',
    fake.patch === 403 ? PATCH_REFUSED : PATCH_OK,
    '  *secret-scanning/alerts*)',
    fake.alerts === 404 ? ALERTS_DISABLED : ALERTS_FILE,
    '  *)',
    repoAnswer,
    'esac',
    '',
  ].join('\n');
}

function setup(fake: Fake) {
  const dir = mkdtempSync(join(tmpdir(), 'security-settings-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  const repo = join(dir, 'repo');
  const slug = fake.slug ?? 'acme/widgets';
  mkdirSync(bin);
  mkdirSync(join(repo, '.omni-loop'), { recursive: true });
  writeFileSync(join(repo, '.omni-loop', 'config.yml'), `# a config\nkit: 1\nrepo:\n  slug: ${slug}\n  defaultBranch: main\n`);
  writeFileSync(join(dir, 'repo.json'), JSON.stringify(repoJson(slug, fake.settings)));
  const alerts = fake.alerts === 404 ? [] : (fake.alerts ?? []);
  writeFileSync(join(dir, 'alerts.jsonl'), alerts.map((alert) => `${JSON.stringify(alert)}\n`).join(''));
  const log = join(dir, 'gh.log');
  const gh = join(bin, 'gh');
  writeFileSync(gh, ghScript(dir, fake));
  chmodSync(gh, 0o755);
  return {
    run(args: string[] = []) {
      const run = spawnSync(process.execPath, [script, ...args], {
        cwd: repo,
        encoding: 'utf8',
        env: { PATH: `${bin}:${process.env.PATH ?? ''}` },
      });
      return { ...run, out: run.stdout + run.stderr };
    },
    calls(): string[] {
      return existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
    },
    patchBody(): unknown {
      return JSON.parse(readFileSync(join(dir, 'patch.json'), 'utf8'));
    },
  };
}

const APPLY = '→ node scripts/security-settings.ts --apply';

describe('node scripts/security-settings.ts', () => {
  it('exits 0 when both settings are enabled and no alert is open', () => {
    const fake = setup({});
    const run = fake.run();
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('secret_scanning: enabled');
    expect(run.stdout).toContain('secret_scanning_push_protection: enabled');
    expect(run.stdout).toContain('open secret scanning alerts: none');
    expect(run.out).not.toContain('→');
    expect(fake.calls().every((call) => call.includes('repos/acme/widgets'))).toBe(true);
    expect(fake.calls().some((call) => call.includes('PATCH'))).toBe(false);
  });

  it('exits 1 and names the --apply fix on the line of each setting not enabled', () => {
    const run = setup({ settings: { scanning: 'enabled', push: 'disabled' } }).run();
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('secret_scanning: enabled\n');
    expect(run.stdout).toContain(`secret_scanning_push_protection: disabled ${APPLY}\n`);

    const both = setup({ settings: { scanning: 'disabled', push: 'disabled' }, alerts: 404 }).run();
    expect(both.status).toBe(1);
    expect(both.stdout).toContain(`secret_scanning: disabled ${APPLY}\n`);
    expect(both.stdout).toContain(`secret_scanning_push_protection: disabled ${APPLY}\n`);
  });

  it('exits 1 and names each open alert by its number, its secret type and its link', () => {
    const run = setup({
      alerts: [
        { number: 3, secret_type_display_name: 'GitHub Personal Access Token', html_url: 'https://github.com/acme/widgets/security/secret-scanning/3' },
        { number: 7, secret_type_display_name: 'Anthropic API Key', html_url: 'https://github.com/acme/widgets/security/secret-scanning/7' },
      ],
    }).run();
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('open secret scanning alerts: 2');
    expect(run.stdout).toContain('alert #3: GitHub Personal Access Token → https://github.com/acme/widgets/security/secret-scanning/3');
    expect(run.stdout).toContain('alert #7: Anthropic API Key → https://github.com/acme/widgets/security/secret-scanning/7');
  });

  it('exits 1 naming the setting, without crashing, when the alerts call answers 404 because scanning is disabled', () => {
    const run = setup({ settings: { scanning: 'disabled', push: 'disabled' }, alerts: 404 }).run();
    expect(run.status).toBe(1);
    expect(run.stdout).toContain(`open secret scanning alerts: unreadable, secret_scanning is disabled ${APPLY}`);
    expect(run.stderr).not.toMatch(/at .*security-settings\.ts/);
  });

  it('exits 1 with the HTTP status when the repository cannot be read', () => {
    const run = setup({ repoStatus: 401 }).run();
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('repository acme/widgets: unreadable (HTTP 401)');
    expect(run.stderr).not.toMatch(/at .*security-settings\.ts/);
  });

  it('exits 1 when the token cannot see the settings', () => {
    const run = setup({ settings: null }).run();
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('security_and_analysis: unreadable, the token needs Administration: read');
  });

  it('ends on one summary line naming what is wrong', () => {
    expect(setup({}).run().stdout.trimEnd().split('\n').at(-1)).toBe('security settings: green');
    const red = setup({
      settings: { scanning: 'enabled', push: 'disabled' },
      alerts: [{ number: 3, secret_type_display_name: 'Slack Bot Token', html_url: 'https://github.com/acme/widgets/security/secret-scanning/3' }],
    }).run();
    expect(red.stdout.trimEnd().split('\n').at(-1)).toBe('security settings: red: secret_scanning_push_protection disabled, 1 open alert');
  });

  it('--apply sends exactly one PATCH switching both settings on, then reads back and exits 0', () => {
    const fake = setup({ settings: { scanning: 'disabled', push: 'disabled' }, alerts: 404 });
    const run = fake.run(['--apply']);
    expect(run.status).toBe(0);
    const patches = fake.calls().filter((call) => call.includes('-X PATCH'));
    expect(patches).toEqual(['api -X PATCH repos/acme/widgets --input -']);
    expect(fake.patchBody()).toEqual({
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: 'enabled' },
      },
    });
    const patchAt = fake.calls().findIndex((call) => call.includes('-X PATCH'));
    expect(fake.calls().slice(patchAt + 1).some((call) => call === 'api repos/acme/widgets')).toBe(true);
    expect(run.stdout).toContain('secret_scanning: enabled');
    expect(run.stdout).toContain('secret_scanning_push_protection: enabled');
  });

  it('--apply reads back and exits 1 when an open alert remains', () => {
    const fake = setup({
      settings: { scanning: 'disabled', push: 'disabled' },
      alerts: [{ number: 1, secret_type_display_name: 'Amazon AWS Access Key ID', html_url: 'https://github.com/acme/widgets/security/secret-scanning/1' }],
    });
    const run = fake.run(['--apply']);
    expect(run.status).toBe(1);
    expect(fake.calls().filter((call) => call.includes('-X PATCH'))).toHaveLength(1);
    expect(run.stdout).toContain('alert #1: Amazon AWS Access Key ID →');
  });

  it('--apply refused (no admin) says so, reads back, and exits 1', () => {
    const fake = setup({ settings: { scanning: 'disabled', push: 'disabled' }, alerts: 404, patch: 403 });
    const run = fake.run(['--apply']);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('--apply: refused (HTTP 403), it needs an admin of acme/widgets');
    expect(run.stdout).toContain(`secret_scanning: disabled ${APPLY}`);
  });

  it('--repo names another repository, and the fix command carries it', () => {
    const fake = setup({ settings: { scanning: 'disabled', push: 'enabled' } });
    const run = fake.run(['--repo', 'other/place']);
    expect(run.status).toBe(1);
    expect(fake.calls().length).toBeGreaterThan(0);
    expect(fake.calls().every((call) => call.includes('repos/other/place'))).toBe(true);
    expect(run.stdout).toContain('secret_scanning: disabled → node scripts/security-settings.ts --apply --repo other/place');
  });

  it('exits 1 asking for --repo, calling nothing, when the config names no repository', () => {
    const fake = setup({ slug: '' });
    const run = fake.run();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('no repository: .omni-loop/config.yml has no repo.slug here; pass --repo <owner/name>');
    expect(fake.calls()).toEqual([]);
  });

  it('refuses an unknown argument with its usage and exit 1, calling nothing', () => {
    const fake = setup({});
    const run = fake.run(['--fix']);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('usage: node scripts/security-settings.ts [--apply] [--repo <owner/name>]');
    expect(fake.calls()).toEqual([]);
  });
});

describe('parseArgs', () => {
  it('reads --apply and --repo, and refuses anything else', () => {
    expect(parseArgs([])).toEqual({ apply: false, repo: null });
    expect(parseArgs(['--apply', '--repo', 'a/b'])).toEqual({ apply: true, repo: 'a/b' });
    expect(parseArgs(['--repo'])).toBeNull();
    expect(parseArgs(['--repo', 'nope'])).toBeNull();
    expect(parseArgs(['--apply', '--apply'])).toBeNull();
    expect(parseArgs(['extra'])).toBeNull();
  });
});

describe('slugFromConfig', () => {
  it('reads repo.slug from the config, and nothing else named slug', () => {
    expect(slugFromConfig('kit: 1\nrepo:\n  slug: vertuoza/vertuo-omni-loop\n  defaultBranch: main\n')).toBe('vertuoza/vertuo-omni-loop');
    expect(slugFromConfig("repo:\n  defaultBranch: main\n  slug: 'a/b' # quoted\n")).toBe('a/b');
    expect(slugFromConfig('other:\n  slug: x/y\nrepo:\n  defaultBranch: main\n')).toBeNull();
    expect(slugFromConfig('kit: 1\n')).toBeNull();
  });
});

describe('render', () => {
  it('counts alerts in the summary in the singular and the plural', () => {
    const lines = render({
      repo: 'a/b',
      fix: 'x',
      read: { kind: 'ok', settings: { secret_scanning: 'enabled', secret_scanning_push_protection: 'enabled' } },
      alerts: {
        kind: 'ok',
        alerts: [
          { number: 1, type: 'T', url: 'u1' },
          { number: 2, type: 'T', url: 'u2' },
        ],
      },
    });
    expect(lines.ok).toBe(false);
    expect(lines.text.at(-1)).toBe('security settings: red: 2 open alerts');
  });
});
