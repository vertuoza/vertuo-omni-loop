// The kit check's facts (PRD 1990), with `gh` and `claude` replaced by fakes: the repository's kit
// against the latest release, the plugins, each target's kit read through its `sha` first, the
// product's other repositories, and every way a call fails, a timeout included. No test calls GitHub.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import type { RunningKit } from '../init/bundle.ts';
import type { GatherIo } from './facts.ts';
import { kitFactsOf, TARGET_KITS_FILE } from './kit.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const RUNNING: RunningKit = { home: 'demo-org/omni-kit', version: '0.0.423', source: false };
const stamp = (version: string): string => `var define_OMNI_BUNDLE_default = { home: "demo-org/omni-kit", version: "${version}" };\n`;
const PLUGINS = JSON.stringify([{ id: 'omni@omni-loop', version: '0.0.423' }, { id: 'omni-hud@omni-loop', version: '0.0.420' }]);
const BIN = '.omni-loop/bin/omni.mjs';

type Call = { file: string; args: string; options: ExecFileSyncOptionsWithStringEncoding };
type Answer = string | Error | undefined;

/** A fake `gh` and `claude`: each answer keyed by the command and its arguments; a key it lacks fails. */
function fake(answers: Record<string, Answer>) {
  const calls: Call[] = [];
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding): string => {
    const key = `${file} ${args.join(' ')}`;
    calls.push({ file, args: args.join(' '), options });
    const answer = Object.hasOwn(answers, key) ? answers[key] : new Error('no such answer');
    if (answer instanceof Error) throw answer;
    return answer ?? '';
  };
  return { exec, calls };
}

const failure = (code: string, stderr = ''): Error => Object.assign(new Error('failed'), { code, stderr });
const API = (repo: string): string => `gh api repos/${repo}/contents/${BIN}`;
const RAW = (repo: string): string => `gh api -H Accept: application/vnd.github.raw repos/${repo}/contents/${BIN}`;
const RELEASE = 'gh release view --repo demo-org/omni-kit --json tagName --jq .tagName';
const BASE: Record<string, Answer> = { [RELEASE]: 'v0.0.423\n', 'claude plugin list --json': PLUGINS };

/** A repository with `files` and `config`, gathering with `answers`. */
function gather(answers: Record<string, Answer>, { files = {}, config = {} }: { files?: Record<string, string>; config?: Record<string, unknown> } = {}) {
  const { root, ctx } = makeRepo({ files, config });
  const { exec, calls } = fake(answers);
  const io: GatherIo = { cwd: root, root, config: ctx.config, exec, now: NOW };
  return { io, calls, root, facts: () => kitFactsOf(io, { running: RUNNING, bundle: null }) };
}

const TARGETS = { plan: { targets: [{ repo: 'acme/api', role: 'back-end', knowledge: 'own' }, { repo: 'acme/web', role: 'front-end', knowledge: 'none' }] } };

describe('kitFactsOf: the repository and the plugins', () => {
  it('reads the latest release within 5 s, the repository kit its bin carries and the two plugins', () => {
    const { facts, calls } = gather(BASE, { files: { [BIN]: stamp('0.0.418') } });
    expect(facts()).toEqual({
      latest: '0.0.423',
      repo: '0.0.418',
      plugins: [
        { name: 'omni@omni-loop', label: 'plugin', version: '0.0.423', fix: '/plugin install omni@omni-loop' },
        { name: 'omni-hud@omni-loop', label: 'HUD plugin', version: '0.0.420', fix: '/plugin install omni-hud@omni-loop' },
      ],
      targets: [],
    });
    expect(calls.find((call) => call.args.startsWith('release'))?.options.timeout).toBe(5_000);
  });

  it("reads the running kit's version when the bin carries none: a shim, or no bin at all", () => {
    expect(gather(BASE, { files: { [BIN]: 'console.log("shim")\n' } }).facts()).toMatchObject({ repo: '0.0.423' });
    expect(gather(BASE).facts()).toMatchObject({ repo: '0.0.423' });
  });

  it('names a plugin that is not installed, and leaves out one the list gives no version for', () => {
    const missing = gather({ ...BASE, 'claude plugin list --json': JSON.stringify([{ id: 'omni@omni-loop', version: '0.0.423' }]) }).facts();
    expect(missing).toMatchObject({ plugins: [{ name: 'omni@omni-loop' }, { name: 'omni-hud@omni-loop', version: null, fix: '/plugin install omni-hud@omni-loop' }] });
    const unversioned = gather({ ...BASE, 'claude plugin list --json': JSON.stringify([{ id: 'omni@omni-loop' }, { id: 'omni-hud@omni-loop', version: '0.0.423' }]) }).facts();
    expect(unversioned).toMatchObject({ plugins: [{ name: 'omni-hud@omni-loop' }] });
  });

  it('skips the plugins without a claude command, and says why when the list fails', () => {
    expect(gather({ ...BASE, 'claude plugin list --json': failure('ENOENT') }).facts()).toMatchObject({ plugins: null });
    expect(gather({ ...BASE, 'claude plugin list --json': failure('ETIMEDOUT') }).facts()).toMatchObject({ plugins: { notChecked: 'timed out' } });
  });

  it('says why the latest release was not read, still reading the versions it can', () => {
    const { 'claude plugin list --json': list } = BASE;
    expect(gather({ [RELEASE]: failure('ENOENT'), 'claude plugin list --json': list }).facts()).toMatchObject({ latest: { notChecked: 'no gh' }, plugins: expect.any(Array) as unknown });
    expect(gather({ [RELEASE]: failure('ETIMEDOUT') }).facts()).toMatchObject({ latest: { notChecked: 'timed out' } });
    expect(gather({ [RELEASE]: new Error('boom') }).facts()).toMatchObject({ latest: { notChecked: 'offline' } });
    expect(gather({ [RELEASE]: 'not a version' }).facts()).toMatchObject({ latest: { notChecked: 'no release' } });
  });

  it('has no latest release to read without a kit home', () => {
    const { io } = gather(BASE);
    expect(kitFactsOf(io, { running: { ...RUNNING, home: null }, bundle: null })).toMatchObject({ latest: { notChecked: 'no kit home' } });
  });
});

describe('kitFactsOf: the target repositories', () => {
  it('reads each target bin: the sha first, then the raw file, keeping the version beside the sha', () => {
    const answers = {
      ...BASE,
      [`${API('acme/api')} --jq .sha`]: 'sha-api\n',
      [RAW('acme/api')]: stamp('0.0.400'),
      [`${API('acme/web')} --jq .sha`]: 'sha-web\n',
      [RAW('acme/web')]: stamp('0.0.423'),
    };
    const { facts, calls, root } = gather(answers, { config: TARGETS });
    expect(facts()).toMatchObject({ targets: [{ repo: 'acme/api', version: '0.0.400' }, { repo: 'acme/web', version: '0.0.423' }] });
    expect(calls.filter((call) => call.args.includes(`repos/acme/api/contents/${BIN}`)).map((call) => call.options.timeout)).toEqual([5_000, 5_000]);
    expect(JSON.parse(readFileSync(join(root, TARGET_KITS_FILE), 'utf8'))).toEqual({
      'acme/api': { sha: 'sha-api', version: '0.0.400' },
      'acme/web': { sha: 'sha-web', version: '0.0.423' },
    });
  });

  it('reads the raw file only when the sha changed from the one cached beside its version', () => {
    const answers = {
      ...BASE,
      [`${API('acme/api')} --jq .sha`]: 'sha-api\n',
      [RAW('acme/api')]: stamp('0.0.400'),
      [`${API('acme/web')} --jq .sha`]: 'sha-web\n',
      [RAW('acme/web')]: stamp('0.0.423'),
    };
    const first = gather(answers, { config: TARGETS });
    first.facts();
    const cached = readFileSync(join(first.root, TARGET_KITS_FILE), 'utf8');
    const again = gather(
      { ...answers, [`${API('acme/web')} --jq .sha`]: 'sha-web-2\n', [RAW('acme/web')]: stamp('0.0.422') },
      { config: TARGETS, files: { [TARGET_KITS_FILE]: cached } },
    );
    expect(again.facts()).toMatchObject({ targets: [{ repo: 'acme/api', version: '0.0.400' }, { repo: 'acme/web', version: '0.0.422' }] });
    expect(again.calls.map((call) => call.args)).not.toContain(RAW('acme/api').slice(3));
    expect(again.calls.filter((call) => call.args.startsWith('api -H'))).toHaveLength(1);
  });

  it('says a target has no kit when its bin is not there, or carries no version', () => {
    const answers = {
      ...BASE,
      [`${API('acme/api')} --jq .sha`]: failure('1', 'gh: Not Found (HTTP 404)'),
      [`${API('acme/web')} --jq .sha`]: 'sha-web\n',
      [RAW('acme/web')]: 'console.log("old")\n',
    };
    expect(gather(answers, { config: TARGETS }).facts()).toMatchObject({ targets: [{ repo: 'acme/api', version: null }, { repo: 'acme/web', version: null }] });
  });

  it('says why a target was not read: no gh, no sign-in, a timeout or offline', () => {
    const answers = {
      ...BASE,
      [`${API('acme/api')} --jq .sha`]: failure('ENOENT'),
      [`${API('acme/web')} --jq .sha`]: failure('ETIMEDOUT'),
    };
    expect(gather(answers, { config: TARGETS }).facts()).toMatchObject({ targets: [{ repo: 'acme/api', notChecked: 'no gh' }, { repo: 'acme/web', notChecked: 'timed out' }] });
    const signedOut = { ...BASE, [`${API('acme/api')} --jq .sha`]: failure('4', 'To get started with GitHub CLI, please run: gh auth login') };
    expect(gather(signedOut, { config: { plan: { targets: [TARGETS.plan.targets[0]] } } }).facts()).toMatchObject({ targets: [{ notChecked: 'no gh sign-in' }] });
    const down = { ...BASE, [`${API('acme/api')} --jq .sha`]: failure('1', 'dial tcp: no route to host') };
    expect(gather(down, { config: { plan: { targets: [TARGETS.plan.targets[0]] } } }).facts()).toMatchObject({ targets: [{ notChecked: 'offline' }] });
  });

  it("reads a product's other repositories from the product targets cache, never this one", () => {
    const copy = JSON.stringify({ product: 'p', readAt: '2026-10-15T00:00:00.000Z', targets: [{ repo: 'acme/widgets', role: 'x' }, { repo: 'acme/api', role: 'back-end' }] });
    const answers = { ...BASE, [`${API('acme/api')} --jq .sha`]: 'sha-api\n', [RAW('acme/api')]: stamp('0.0.423') };
    const { facts, calls } = gather(answers, { files: { '.omni-loop/local/product-targets.json': copy } });
    expect(facts()).toMatchObject({ targets: [{ repo: 'acme/api', version: '0.0.423' }] });
    expect(calls.some((call) => call.args.includes('acme/widgets'))).toBe(false);
  });

  it('has no targets in a repository that has neither a plan nor a product cache, or one that does not read', () => {
    expect(gather(BASE).facts()).toMatchObject({ targets: [] });
    expect(gather(BASE, { files: { '.omni-loop/local/product-targets.json': '{not json' } }).facts()).toMatchObject({ targets: [] });
  });
});
