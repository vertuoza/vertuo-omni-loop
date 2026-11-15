// A job that runs as a GitHub App, started under a login shell (bug 2914): macOS's `path_helper -s` and `brew
// shellenv` put the machine's own folders back ahead of the shim, so a bare `gh` in a skill is the machine's own.
// That `gh` still signs in as the app, never as the person signed in to `gh` on the machine: the job's
// `GH_CONFIG_DIR` is a sign-in of its own, holding the app's token, and it goes once the job is reported.
//
// `runRunner()` runs one job on a fake app and a fake terminal; the machine's `gh` is a fake that finds its token
// as the real one does. No test holds a real token and none calls GitHub.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { JobUpdate, RunnerApi, RunnerJob } from './api.ts';
import type { MachineReads } from './health.ts';
import { runRunner } from './runner.ts';
import type { JobSession, Terminal } from './terminal.ts';

const APP = ['ghs', 'fakeLoginShellTokenOfTheJob0123456789A'].join('_');
/** The token of the person signed in to `gh` on the runner machine: a fake, built here. */
const PERSON = ['gho', 'personSignedInOnTheRunnerMachine'].join('_');
const NOW = Date.parse('2026-11-15T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const asTheApp: RunnerJob = {
  id: '7',
  line: '/omni:yolo 7',
  repo: 'acme/widgets',
  sentBy: null,
  sentByKey: null,
  github: { token: APP, expiresAt: new Date(NOW + HOUR).toISOString(), login: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' },
  allowedSkills: [],
};

/** A machine at rest: each read of its cores finds them a little busier, never loaded. */
function restingMachine(): MachineReads {
  let reads = 0;
  const gib = 1024 ** 3;
  return {
    cpus: () => {
      reads += 1;
      return [{ times: { user: reads, nice: 0, sys: 0, idle: 9 * reads, irq: 0 } }];
    },
    loadavg: () => [0, 0, 0],
    cores: () => 1,
    totalmem: () => 16 * gib,
    freemem: () => 12 * gib,
    meminfo: () => null,
    statfs: () => ({ bsize: 4096, blocks: (200 * gib) / 4096, bavail: (150 * gib) / 4096 }),
  };
}

/**
 * The runner machine: its own `gh`, in the folder a login shell puts first, signed in as a person. The fake finds
 * its token as `gh` does: `GH_TOKEN` or `GITHUB_TOKEN`, then the `hosts.yml` of `GH_CONFIG_DIR` (else
 * `~/.config/gh`), then the keychain, which holds the person's.
 */
function runnerMachine(): { brewBin: string; machineHome: string } {
  const root = mkdtempSync(join(tmpdir(), 'omni-login-shell-'));
  const brewBin = join(root, 'opt-homebrew-bin');
  const machineHome = join(root, 'person');
  mkdirSync(brewBin);
  mkdirSync(join(machineHome, '.config', 'gh'), { recursive: true });
  writeFileSync(join(machineHome, '.config', 'gh', 'hosts.yml'), `github.com:\n    user: ada\n    oauth_token: ${PERSON}\n`);
  const gh = join(brewBin, 'gh');
  writeFileSync(gh, [
    '#!/bin/sh',
    'token="${GH_TOKEN:-$GITHUB_TOKEN}"',
    `[ -n "$token" ] || token=$(sed -n 's/^ *oauth_token: *//p' "\${GH_CONFIG_DIR:-$HOME/.config/gh}/hosts.yml" 2>/dev/null | head -n 1 | tr -d '"')`,
    `[ -n "$token" ] || token=${PERSON}`,
    'echo "gh $* as $token"',
    '',
  ].join('\n'));
  chmodSync(gh, 0o755);
  return { brewBin, machineHome };
}

/**
 * Runs `asTheApp` once. Its session runs `command` the way a login shell would: the machine's `gh` folder first
 * on its `PATH` and the person's home as `HOME`. Answers what the command printed, the session's variables, and
 * the runner's home.
 */
async function underALoginShell(command: string) {
  const { brewBin, machineHome } = runnerMachine();
  const home = mkdtempSync(join(tmpdir(), 'omni-login-shell-runner-'));
  const stop = new AbortController();
  const ran: { printed: string; env: Readonly<Record<string, string>> | null } = { printed: '', env: null };
  let given = false;
  const api: RunnerApi = {
    register: () => Promise.resolve({ id: 'r1' }),
    next: (_runner, signal) => {
      if (!given) {
        given = true;
        return Promise.resolve(asTheApp);
      }
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve(null);
        }, { once: true });
      });
    },
    update: (_job, update: JobUpdate) => {
      if (update.status !== 'running') stop.abort();
      return Promise.resolve({ cancel: false });
    },
    health: () => Promise.resolve(),
    githubToken: () => Promise.reject(new Error('no fresh token in this test')),
  };
  const argument = (session: JobSession, flag: string): string => session.argv[session.argv.indexOf(flag) + 1] ?? '';
  const terminal: Terminal = {
    start: (session) => {
      ran.env = session.env;
      const loginShell = { ...session.env, HOME: machineHome, PATH: `${brewBin}:${session.env.PATH ?? ''}` };
      ran.printed = spawnSync('/bin/sh', ['-c', command], { env: loginShell, encoding: 'utf8' }).stdout;
      writeFileSync(argument(session, '--log'), '');
      writeFileSync(argument(session, '--exit'), '0\n');
    },
    stop: () => undefined,
    alive: () => true,
  };
  await runRunner({
    name: 'box-1', slots: 1, timeoutMs: 60_000, version: '0.0.643', checkouts: new Map([['acme/widgets', join(home, 'widgets')]]),
    api, terminal, exec: () => '', home, wrapper: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'job'], env: { PATH: '/usr/bin:/bin' },
    githubToken: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'],
    print: () => undefined, stop: stop.signal, now: () => NOW, machine: restingMachine(), tickMs: 1000,
    sleep: (ms, signal) => {
      if (signal?.aborted === true) return Promise.resolve();
      if (ms < HOUR) return new Promise((resolve) => setImmediate(resolve));
      return new Promise((resolve) => signal?.addEventListener('abort', () => { resolve(); }, { once: true }));
    },
  });
  return { ...ran, home };
}

describe('a job running as the app, under a login shell (bug 2914)', () => {
  it('opens its pull request as the app when the machine’s gh comes before the shim on PATH', async () => {
    const { printed } = await underALoginShell('gh pr create --fill');
    expect(printed).toBe(`gh pr create --fill as ${APP}\n`);
  });

  it('starts with a gh sign-in of its own, job-<id>.gh beside its token file, as GH_CONFIG_DIR', async () => {
    const { env, home } = await underALoginShell('true');
    expect(env?.GH_CONFIG_DIR).toBe(join(home, 'logs', 'job-7.gh'));
  });

  it('leaves no sign-in behind once the job is reported', async () => {
    const { home } = await underALoginShell('true');
    expect(existsSync(join(home, 'logs', 'job-7.gh'))).toBe(false);
  });
});
