// What `omni runner` does with the Omni plugin (PRD 2100, s4): before a job it brings the plugin up to
// the job repository's pinned omni, once, whatever the slots do; at start and every hour its sweep
// updates it. A fake `claude` stands in for the plugin: nothing here runs Claude, GitHub or the network.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readSkills } from '../agents/skills.ts';
import type { ExecText } from '../context.ts';
import { pinnedOmni, pluginKeeper, prepareInstanceSkills, readPlugin } from './plugin.ts';

const ID = 'omni@omni-loop';
const BIN = join('.omni-loop', 'bin', 'omni.mjs');

/** A worktree whose bin carries `version` (as a built bundle does), or a shim with `null`, or no bin at all with `false`. */
function worktree(version: string | null | false): string {
  const dir = mkdtempSync(join(tmpdir(), 'omni-runner-plugin-'));
  if (version === false) return dir;
  mkdirSync(join(dir, '.omni-loop', 'bin'), { recursive: true });
  const marker = version === null ? '#!/usr/bin/env node\nimport "../../kit/bin/omni.ts";\n' : `define_OMNI_BUNDLE_default = { home: "acme/kit", version: "${version}" };\n`;
  writeFileSync(join(dir, BIN), marker);
  return dir;
}

type Entry = { id: string; version?: string; scope?: string };
type Update = 'succeeds' | 'fails' | 'changes nothing';

/**
 * A fake `claude`: `plugin list --json` answers `list` (a function of the state, so an update can change
 * it), `plugin update` moves the omni plugin to `latest` unless it `fails` or `changes nothing`.
 */
function fakeClaude({ plugins, latest = '0.0.450', update = 'succeeds', list }: { plugins: Entry[]; latest?: string; update?: Update; list?: () => string }) {
  const calls: string[] = [];
  const runUpdate = (): string => {
    if (update === 'fails') throw Object.assign(new Error('Command failed'), { stderr: 'could not reach the marketplace\n' });
    if (update === 'succeeds') plugins.filter((plugin) => plugin.id === ID).forEach((plugin) => { plugin.version = latest; });
    return 'omni is up to date\n';
  };
  const answers: Record<string, () => string> = {
    'plugin list --json': () => (list ? list() : JSON.stringify(plugins)),
    'plugin marketplace update omni-loop': () => '',
    [`plugin update ${ID}`]: runUpdate,
  };
  const exec: ExecText = (file, args) => {
    expect(file).toBe('claude');
    const call = args.join(' ');
    calls.push(call);
    const answer = answers[call];
    if (!answer) throw new Error(`unexpected claude ${call}`);
    return answer();
  };
  const updates = () => calls.filter((call) => call === `plugin update ${ID}`).length;
  return { exec, calls, updates };
}

function keeper(claude: { exec: ExecText }, { running = null, bundle = null }: { running?: string | null; bundle?: string | null } = {}) {
  const printed: string[] = [];
  return { printed, keeper: pluginKeeper({ exec: claude.exec, running: { version: running }, bundle, print: (line) => printed.push(line) }) };
}

describe('pinnedOmni', () => {
  it('is the version the repository bin carries', () => {
    expect(pinnedOmni({ root: worktree('0.0.450'), running: { version: '0.0.1' }, bundle: null })).toBe('0.0.450');
  });

  it('is the running kit for a shim bin, and nothing for a repository with no bin', () => {
    expect(pinnedOmni({ root: worktree(null), running: { version: '0.0.443' }, bundle: null })).toBe('0.0.443');
    expect(pinnedOmni({ root: worktree(null), running: { version: null }, bundle: null })).toBeNull();
    expect(pinnedOmni({ root: worktree(false), running: { version: '0.0.443' }, bundle: null })).toBeNull();
  });
});

describe('readPlugin', () => {
  const read = (output: string | Error) =>
    readPlugin(() => {
      if (output instanceof Error) throw output;
      return output;
    });

  it('reads the installed version, and says not installed when the list has no omni plugin', () => {
    expect(read(JSON.stringify([{ id: ID, version: '0.0.431' }, { id: 'omni-hud@omni-loop', version: '9.9.9' }]))).toEqual({ kind: 'version', version: '0.0.431' });
    expect(read(JSON.stringify([{ id: 'omni-hud@omni-loop', version: '0.0.1' }]))).toEqual({ kind: 'missing' });
    expect(read('[]')).toEqual({ kind: 'missing' });
  });

  it('reads the user scope when the list has several entries of the plugin, the oldest of them', () => {
    const entries = [
      { id: ID, version: '0.0.408', scope: 'user' },
      { id: ID, version: '0.0.255', scope: 'project' },
      { id: ID, version: '0.0.431', scope: 'project' },
    ];
    expect(read(JSON.stringify(entries))).toEqual({ kind: 'version', version: '0.0.408' });
    expect(read(JSON.stringify([{ id: ID, version: '0.0.410', scope: 'user' }, { id: ID, version: '0.0.408' }]))).toEqual({ kind: 'version', version: '0.0.408' });
  });

  it('reads the newest project entry when the plugin is installed for no user', () => {
    const entries = [
      { id: ID, version: '0.0.255', scope: 'project' },
      { id: ID, version: '0.0.431', scope: 'project' },
    ];
    expect(read(JSON.stringify(entries))).toEqual({ kind: 'version', version: '0.0.431' });
  });

  it('says why it did not read: no claude, a timeout, a failed list, unreadable output, an entry with no version', () => {
    expect(read(Object.assign(new Error('x'), { code: 'ENOENT' }))).toEqual({ kind: 'unread', why: 'claude not found' });
    expect(read(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toEqual({ kind: 'unread', why: 'timed out' });
    expect(read(new Error('exit 1'))).toEqual({ kind: 'unread', why: 'claude plugin list failed' });
    expect(read('2.0.0 (Claude Code)')).toEqual({ kind: 'unread', why: 'claude plugin list was unreadable' });
    expect(read('{"id": "omni@omni-loop"}')).toEqual({ kind: 'unread', why: 'claude plugin list was unreadable' });
    expect(read(JSON.stringify([{ id: ID }]))).toEqual({ kind: 'unread', why: `${ID} has no version in claude plugin list` });
    expect(read(JSON.stringify([{ id: ID, version: 'main' }]))).toEqual({ kind: 'unread', why: `${ID} has no version in claude plugin list` });
  });

  it('skips an entry that is no object', () => {
    expect(read(JSON.stringify([null, 3, { id: ID, version: '0.0.5' }]))).toEqual({ kind: 'version', version: '0.0.5' });
  });
});

describe('before a job', () => {
  it('a repository with no pinned omni starts no claude call at all', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.1' }] });
    const k = keeper(claude);
    expect(await k.keeper.forJob(worktree(false), 'acme/widgets')).toEqual({ note: null });
    expect(claude.calls).toEqual([]);
  });

  it.each(['0.0.450', '0.0.460'])('a plugin as new as the pinned omni, or newer (%s), starts no update', async (version) => {
    const claude = fakeClaude({ plugins: [{ id: ID, version }] });
    const k = keeper(claude);
    expect(await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({ note: null });
    expect(claude.calls).toEqual(['plugin list --json']);
    expect(k.printed).toEqual([]);
  });

  it('an older plugin is updated once, then read again, and the runner prints the change', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }] });
    const k = keeper(claude);
    expect(await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({ note: null });
    expect(claude.calls).toEqual(['plugin list --json', 'plugin list --json', 'plugin marketplace update omni-loop', `plugin update ${ID}`, 'plugin list --json']);
    expect(k.printed).toEqual(['omni plugin v0.0.440 → v0.0.450']);
  });

  it('two slots starting together on an older plugin update it once', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }] });
    const k = keeper(claude);
    const checks = await Promise.all([k.keeper.forJob(worktree('0.0.450'), 'acme/widgets'), k.keeper.forJob(worktree('0.0.450'), 'acme/gadgets')]);
    expect(checks).toEqual([{ note: null }, { note: null }]);
    expect(claude.updates()).toBe(1);
    expect(k.printed).toEqual(['omni plugin v0.0.440 → v0.0.450']);
  });

  it('a plugin still older after the update fails the job with its reason, the last line the update said', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }], update: 'changes nothing' });
    const k = keeper(claude);
    expect(await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({
      failed: "omni plugin v0.0.440 is older than acme/widgets's omni v0.0.450: claude plugin update failed: omni is up to date",
    });
    expect(k.printed).toEqual([]);
  });

  it('an update that fails fails the job with the failure line, and the runner prints it', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }], update: 'fails' });
    const k = keeper(claude);
    expect(await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({
      failed: "omni plugin v0.0.440 is older than acme/widgets's omni v0.0.450: claude plugin update failed: could not reach the marketplace",
    });
    expect(k.printed).toEqual(['omni plugin update failed: could not reach the marketplace']);
  });

  it('a plugin that is not installed fails the job with the line to install it, and runs no update', async () => {
    const claude = fakeClaude({ plugins: [] });
    const k = keeper(claude);
    expect(await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({ failed: 'the omni plugin is not installed: claude plugin install omni@omni-loop' });
    expect(claude.updates()).toBe(0);
  });

  it('a plugin that disappears during the update fails the job as not installed', async () => {
    const plugins: Entry[] = [{ id: ID, version: '0.0.440' }];
    const claude = fakeClaude({ plugins, update: 'changes nothing', list: () => JSON.stringify(plugins) });
    const k = keeper({
      exec: (file, args, options) => {
        const out = claude.exec(file, args, options);
        if (args.join(' ') === `plugin update ${ID}`) plugins.length = 0;
        return out;
      },
    });
    expect(await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({ failed: 'the omni plugin is not installed: claude plugin install omni@omni-loop' });
  });

  it('a list that does not read lets the job run, with the line its log starts with', async () => {
    const timedOut = fakeClaude({ plugins: [], list: () => { throw Object.assign(new Error('x'), { code: 'ETIMEDOUT' }); } });
    expect(await keeper(timedOut).keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({ note: 'omni plugin version not read: timed out' });
    expect(timedOut.updates()).toBe(0);
    const garbled = fakeClaude({ plugins: [], list: () => 'not json' });
    expect(await keeper(garbled).keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({ note: 'omni plugin version not read: claude plugin list was unreadable' });
  });

  it('a list that stops reading after the update lets the job run with the line', async () => {
    const plugins: Entry[] = [{ id: ID, version: '0.0.440' }];
    let broken = false;
    const claude = fakeClaude({ plugins, update: 'changes nothing', list: () => { if (broken) throw new Error('exit 1'); return JSON.stringify(plugins); } });
    const k = keeper({
      exec: (file, args, options) => {
        const out = claude.exec(file, args, options);
        if (args.join(' ') === `plugin update ${ID}`) broken = true;
        return out;
      },
    });
    expect(await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets')).toEqual({ note: 'omni plugin version not read: claude plugin list failed' });
  });

  it('a shim bin is compared at the running kit version', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }] });
    const k = keeper(claude, { running: '0.0.450' });
    expect(await k.keeper.forJob(worktree(null), 'acme/widgets')).toEqual({ note: null });
    expect(claude.updates()).toBe(1);
  });

  it('the second job finds the plugin new once the first has updated it: no second update', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }] });
    const k = keeper(claude);
    await k.keeper.forJob(worktree('0.0.450'), 'acme/widgets');
    await k.keeper.forJob(worktree('0.0.450'), 'acme/gadgets');
    expect(claude.updates()).toBe(1);
  });
});

describe('the sweep', () => {
  it('updates the plugin and prints the change', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }], latest: '0.0.451' });
    const k = keeper(claude);
    await k.keeper.sweep();
    expect(claude.calls).toEqual(['plugin list --json', 'plugin marketplace update omni-loop', `plugin update ${ID}`, 'plugin list --json']);
    expect(k.printed).toEqual(['omni plugin v0.0.440 → v0.0.451']);
  });

  it('prints nothing when the version did not change', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.451' }], latest: '0.0.451' });
    const k = keeper(claude);
    await k.keeper.sweep();
    expect(claude.updates()).toBe(1);
    expect(k.printed).toEqual([]);
  });

  it('prints the failure, once per sweep', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }], update: 'fails' });
    const k = keeper(claude);
    await k.keeper.sweep();
    await k.keeper.sweep();
    expect(k.printed).toEqual(['omni plugin update failed: could not reach the marketplace', 'omni plugin update failed: could not reach the marketplace']);
  });

  it('updates even when the list does not read, and prints nothing for it', async () => {
    const claude = fakeClaude({ plugins: [], list: () => 'not json' });
    const k = keeper(claude);
    await k.keeper.sweep();
    expect(claude.updates()).toBe(1);
    expect(k.printed).toEqual([]);
  });

  it('takes its turn after an update a job started: one update at a time', async () => {
    const claude = fakeClaude({ plugins: [{ id: ID, version: '0.0.440' }] });
    const k = keeper(claude);
    const [check] = await Promise.all([k.keeper.forJob(worktree('0.0.450'), 'acme/widgets'), k.keeper.sweep()]);
    expect(check).toEqual({ note: null });
    const updates = claude.calls.flatMap((call, at) => (call === `plugin update ${ID}` ? [at] : []));
    const marketplace = claude.calls.flatMap((call, at) => (call === 'plugin marketplace update omni-loop' ? [at] : []));
    expect(updates).toHaveLength(2);
    expect(marketplace[1]).toBeGreaterThan(updates[0] ?? Number.POSITIVE_INFINITY);
  });
});

describe('the kit skills of a Codex or OpenCode instance', () => {
  const skills = readSkills(fileURLToPath(new URL('./fixtures/skills/', import.meta.url)));
  const prepare = (overrides: { agent?: string; dir?: string | null; home: string; worktree: string; running?: string | null; skills?: Record<string, string> }) =>
    prepareInstanceSkills({
      instance: { agent: overrides.agent ?? 'codex', dir: overrides.dir ?? null, home: overrides.home },
      worktree: overrides.worktree,
      running: { version: overrides.running === undefined ? '0.0.450' : overrides.running },
      bundle: null,
      skills: overrides.skills ?? skills,
    });
  const home = () => mkdtempSync(join(tmpdir(), 'omni-runner-home-'));

  it('writes them in CODEX_HOME at the version, named omni-*, and nothing in the worktree', () => {
    const h = home();
    const wt = worktree('0.0.450');
    const codexHome = join(h, 'codex-1');
    expect(prepare({ home: h, dir: codexHome, worktree: wt })).toEqual({ ready: '0.0.450' });
    const skill = readFileSync(join(codexHome, 'skills', 'omni-yolo', 'SKILL.md'), 'utf8');
    expect(skill).toContain('name: omni-yolo');
    expect(skill).toContain('generated by omni 0.0.450');
    expect(readFileSync(join(codexHome, 'skills', 'omni-pr', 'reference', 'status.md'), 'utf8')).toBe(skills['pr/reference/status.md']);
    expect(existsSync(join(wt, '.agents'))).toBe(false);
    expect(readdirSync(wt)).toEqual(['.omni-loop']);
  });

  it('writes them in OpenCode global skills folder, under the home by default', () => {
    const h = home();
    expect(prepare({ agent: 'opencode', home: h, worktree: worktree('0.0.450') })).toEqual({ ready: '0.0.450' });
    expect(existsSync(join(h, '.config', 'opencode', 'skills', 'omni-yolo', 'SKILL.md'))).toBe(true);
  });

  it('is unusable with no skills for an agent that reads no skills folder, and for a folder inside the worktree', () => {
    const h = home();
    const wt = worktree('0.0.450');
    expect(prepare({ agent: 'gemini', home: h, worktree: wt })).toEqual({ unusable: 'no skills' });
    expect(prepare({ home: h, worktree: wt, dir: join(wt, 'codex') })).toEqual({ unusable: 'no skills' });
    expect(existsSync(join(wt, 'codex'))).toBe(false);
  });

  it('is unusable when the runner omni is older than the repository pin', () => {
    const h = home();
    const result = prepare({ home: h, worktree: worktree('0.0.460'), running: '0.0.450' });
    expect('unusable' in result && result.unusable.startsWith('no skills')).toBe(true);
    expect(existsSync(join(h, '.codex'))).toBe(false);
  });

  it('is unusable when the folder cannot be written', () => {
    const h = home();
    writeFileSync(join(h, '.codex'), 'a file, not a folder');
    expect(prepare({ home: h, worktree: worktree('0.0.450') })).toEqual({ unusable: 'no skills' });
  });

  it('rewrites a changed skill, drops one the kit dropped, and leaves a skill of the person alone', () => {
    const h = home();
    const wt = worktree('0.0.450');
    prepare({ home: h, worktree: wt });
    const folder = join(h, '.codex', 'skills');
    mkdirSync(join(folder, 'mine'), { recursive: true });
    writeFileSync(join(folder, 'mine', 'SKILL.md'), 'mine');
    const next = { 'yolo/SKILL.md': (skills['yolo/SKILL.md'] ?? '').replace('Run the PRD', 'Run the next PRD') };
    expect(prepare({ home: h, worktree: wt, skills: next })).toEqual({ ready: '0.0.450' });
    expect(readFileSync(join(folder, 'omni-yolo', 'SKILL.md'), 'utf8')).toContain('Run the next PRD');
    expect(existsSync(join(folder, 'omni-pr'))).toBe(false);
    expect(readFileSync(join(folder, 'mine', 'SKILL.md'), 'utf8')).toBe('mine');
  });
});
