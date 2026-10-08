// `omni e2e status` (PRD 1233, s2), through `main()` on a fixture repository with small trace-1 files.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const trace = (testId: string, version = 'trace-1') =>
  JSON.stringify({ schemaVersion: version, payload: { summary: 's', recordedFor: { testId, callIndex: 0 }, actions: [{ name: 'click', target: 'Rank' }] } });
const ON = 'kit: 1\ne2e:\n  enabled: true\n';

async function run(args: string[], config: string, files: Record<string, string> = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['e2e', ...args], { cwd: root, exec: realExec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const TEST = { 'e2e/rank.spec.ts': "test('rank', { tag: 'prd-7' }, () => {})" };

describe('omni e2e status', () => {
  it('prints the tagged tests with their recordings and exits 0 when all have one', async () => {
    const { code, out } = await run(['status', '7'], ON, { ...TEST, 'e2e/.e2e/cache/a.json': trace('rank.spec.ts') });
    expect(JSON.parse(out)).toEqual({
      prd: 7, dir: 'e2e', tests: [{ id: 'rank.spec.ts', file: 'e2e/rank.spec.ts', recording: true, recordings: ['e2e/.e2e/cache/a.json'] }],
    });
    expect(code).toBe(0);
  });

  it('exits 1 when a test has no recording, still printing the JSON', async () => {
    const { code, out } = await run(['status', '7'], ON, TEST);
    expect(JSON.parse(out)).toMatchObject({ tests: [{ recording: false }] });
    expect(code).toBe(1);
  });

  it('fails naming a recording that is not trace-1 or does not read', async () => {
    const stale = await run(['status', '7'], ON, { ...TEST, 'e2e/.e2e/cache/a.json': trace('rank.spec.ts', 'trace-2') });
    expect(stale.code).toBe(1);
    expect(stale.err).toContain('e2e/.e2e/cache/a.json');
    const bad = await run(['status', '7'], ON, { ...TEST, 'e2e/.e2e/cache/b.json': '{' });
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('e2e/.e2e/cache/b.json');
    expect(bad.out).toBe('');
  });

  it('says so in one line, reading no file, when e2e is off', async () => {
    const { code, out, err } = await run(['status', '7'], 'kit: 1\n', { ...TEST, 'e2e/.e2e/cache/b.json': '{' });
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err.trim().split('\n')).toHaveLength(1);
    expect(err).toContain('e2e.enabled');
  });

  it('is a usage error without a PRD or with an unknown subcommand', async () => {
    expect((await run(['status'], ON)).code).toBe(2);
    expect((await run(['heal'], ON)).code).toBe(2);
  });
});

describe('omni e2e heals', () => {
  const git = (root: string, ...args: string[]) => realExec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
  const step = (target: string, callIndex = 0, version = 'trace-1') =>
    JSON.stringify({ schemaVersion: version, payload: { summary: `clicks ${target}`, recordedFor: { testId: 'rank.spec.ts', callIndex }, actions: [{ name: 'click', target }] } });
  const SPEC = { '.omni-loop/delivery/inbox/1233-rank/spec.md': '# spec\n' };

  /** main holds `base`; feat/rank adds `head` on top. */
  async function heals(base: Record<string, string>, head: Record<string, string>, config = ON) {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, ...SPEC, ...base } });
    git(root, 'checkout', '-q', '-b', 'feat/rank');
    for (const [path, text] of Object.entries(head)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '--allow-empty', '-m', 'head');
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(['e2e', 'heals', '1233'], { cwd: root, exec: realExec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
    return { code, out: out.join(''), err: err.join('') };
  }

  it('lists healed, new and removed steps between the merge-base and the head', async () => {
    const { code, out, err } = await heals(
      { 'e2e/.e2e/cache/a.json': step('Rank'), 'e2e/.e2e/cache/gone.json': step('Gone', 1) },
      { 'e2e/.e2e/cache/b.json': step('Position'), 'e2e/.e2e/cache/gone.json': step('Gone', 1), 'e2e/.e2e/cache/new.json': step('Fresh', 2) },
    );
    expect(out || err).not.toContain('omni e2e heals:');
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({
      prd: 1233,
      healed: [
        { testId: 'rank.spec.ts', callIndex: 0, summary: 'clicks Position', old: [{ name: 'click', target: 'Rank' }], new: [{ name: 'click', target: 'Position' }] },
      ],
      new: [{ callIndex: 2 }],
      removed: [],
    });
  });

  it('gives each healed step its before and after screenshots, or why none was kept', async () => {
    const { out } = await heals({ 'e2e/.e2e/cache/a.json': step('Rank') }, { 'e2e/.e2e/cache/a.json': step('Position') });
    const [healed] = JSON.parse(out).healed;
    expect(healed.screenshots.before).toMatchObject({ kept: false, reason: expect.stringContaining('merge-base') });
    expect(healed.screenshots.after).toMatchObject({ kept: false, reason: expect.stringContaining('no artifacts') });
  });

  it('fails naming a recording that is not trace-1 or does not read, at either side', async () => {
    const head = await heals({}, { 'e2e/.e2e/cache/old.json': step('Rank', 0, 'trace-2') });
    expect(head.code).toBe(1);
    expect(head.err).toContain('e2e/.e2e/cache/old.json');
    const base = await heals({ 'e2e/.e2e/cache/b.json': '{' }, {});
    expect(base.code).toBe(1);
    expect(base.err).toContain('e2e/.e2e/cache/b.json');
  });

  it('says so in one line when e2e is off', async () => {
    const { code, err } = await heals({}, {}, 'kit: 1\n');
    expect(code).toBe(1);
    expect(err.trim().split('\n')).toHaveLength(1);
  });
});

describe('omni e2e hold, confirm and reject', () => {
  const git = (root: string, ...args: string[]) => realExec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
  const step = (target: string, callIndex = 0) =>
    JSON.stringify({ schemaVersion: 'trace-1', payload: { summary: `clicks ${target}`, recordedFor: { testId: 'rank.spec.ts', callIndex }, actions: [{ name: 'click', target }] } });
  const A = 'e2e/.e2e/cache/a.json';
  const write = (root: string, path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };

  /** main holds a.json (Rank); feat/rank is checked out; the working tree then holds a healed a.json and a new b.json. */
  function repo() {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': ON, '.omni-loop/delivery/inbox/1233-rank/spec.md': '# spec\n', [A]: step('Rank') } });
    git(root, 'checkout', '-q', '-b', 'feat/rank');
    write(root, A, step('Position'));
    write(root, 'e2e/.e2e/cache/b.json', step('Fresh', 1));
    const call = async (...args: string[]) => {
      const out: string[] = [];
      const err: string[] = [];
      const code = await main(['e2e', ...args], { cwd: root, exec: realExec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
      return { code, out: out.join(''), err: err.join('') };
    };
    const read = (path: string) => readFileSync(join(root, path), 'utf8');
    return { root, call, read };
  }

  it('hold lists the healed recordings and moves them out, leaving the committed one and the new ones', async () => {
    const { root, call, read } = repo();
    const { code, out } = await call('hold', '1233');
    expect(code).toBe(0);
    expect(JSON.parse(out).held).toMatchObject([{ testId: 'rank.spec.ts', callIndex: 0, file: A, summary: 'clicks Position' }]);
    expect(read(A)).toBe(step('Rank'));
    expect(read('e2e/.e2e/cache/b.json')).toBe(step('Fresh', 1));
    git(root, 'add', '-A');
    expect(git(root, 'diff', '--cached', '--name-only').trim()).toBe('e2e/.e2e/cache/b.json');
  });

  it('hold twice holds nothing more and keeps the first hold', async () => {
    const { call } = repo();
    await call('hold', '1233');
    const again = await call('hold', '1233');
    expect(again.code).toBe(0);
    expect(JSON.parse(again.out).held).toHaveLength(1);
  });

  it('confirm commits the held recording, then a run with no screen change lists no healed step', async () => {
    const { root, call, read } = repo();
    await call('hold', '1233');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'unchanged and new');
    const confirmed = await call('confirm', '1233');
    expect(confirmed.code).toBe(0);
    expect(read(A)).toBe(step('Position'));
    expect(git(root, 'log', '-1', '--name-only', '--format=%s').trim()).toContain(A);
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
    const heals = await call('heals', '1233');
    expect(JSON.parse(heals.out).healed).toEqual([]);
    expect((await call('hold', '1233')).code).toBe(0);
    expect(read(A)).toBe(step('Position'));
  });

  it('heals lists the step again when the screen changes after a confirmation', async () => {
    const { root, call } = repo();
    await call('hold', '1233');
    await call('confirm', '1233');
    write(root, A, step('Other'));
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'again');
    expect(JSON.parse((await call('heals', '1233')).out).healed).toMatchObject([{ summary: 'clicks Other' }]);
  });

  it('reject leaves the committed recording, drops the held one and exits 1', async () => {
    const { root, call, read } = repo();
    await call('hold', '1233');
    const rejected = await call('reject', '1233');
    expect(rejected.code).toBe(1);
    expect(JSON.parse(rejected.out).rejected).toHaveLength(1);
    expect(read(A)).toBe(step('Rank'));
    expect((await call('confirm', '1233')).out).toContain('"confirmed": []');
    expect(git(root, 'log', '-1', '--format=%s').trim()).toBe('fixture');
  });

  it('say so in one line when e2e is off, and are usage errors without a PRD', async () => {
    const off = await run(['hold', '7'], 'kit: 1\n');
    expect(off.code).toBe(1);
    expect(off.err.trim().split('\n')).toHaveLength(1);
    for (const sub of ['hold', 'confirm', 'reject']) expect((await run([sub], ON)).code).toBe(2);
  });
});
