import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { release } from './release.ts';
import { dig } from '../bin/dig.ts';

/** A JSON file the release wrote, as `unknown`. */
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const TRAILER = 'Co-authored-by: Omni-man <1+omni[bot]@users.noreply.github.com>';
const PLUGIN = 'kit/plugin/.claude-plugin/plugin.json';
const BUNDLE = 'kit/dist/omni.mjs';

/** A kit checkout with its two manifests and its bundle, as the release reads them. */
function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'omni-release-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write('package.json', `${JSON.stringify({ name: 'kit', private: true, type: 'module', scripts: { test: 'vitest run' } }, null, 2)}\n`);
  write(PLUGIN, `${JSON.stringify({ name: 'omni', description: 'The loop.', version: '0.1.0' }, null, 2)}\n`);
  write(BUNDLE, '// bundle\n');
  return root;
}

/**
 * A fake `exec`: every call is recorded as `cmd args…`; `answers` maps the start of a call to its
 * stdout, or to a function that returns it or throws. Unmatched calls print nothing.
 */
/** What a fake call answers: its stdout, or a function that returns it or throws. */
type Answer = string | ((line: string, calls: string[]) => string);

function fakeExec(answers: Record<string, Answer> = {}) {
  const calls: string[] = [];
  const exec = (cmd: string, args: string[]) => {
    const line = [cmd, ...args].join(' ');
    calls.push(line);
    const key = Object.keys(answers).find((start) => line.startsWith(start));
    const answer = key === undefined ? '' : answers[key];
    return typeof answer === 'function' ? answer(line, calls) : (answer ?? '');
  };
  return { exec, calls };
}

const rejected = () => {
  throw new Error('! [rejected] HEAD -> main (fetch first)');
};

function run(answers: Record<string, Answer> = {}) {
  const root = fixtureRepo();
  const { exec, calls } = fakeExec({
    'git log -1 --format=%s': 'feat(kit): omni version (#351)\n',
    'git tag --list': 'v0.0.8\nv0.0.9\nrelease-3\nv1.2\n',
    'node .omni-loop/bin/omni.mjs sign trailer': `${TRAILER}\n`,
    ...answers,
  });
  const out: string[] = [];
  const code = release({ root, exec, log: (line) => out.push(line) });
  return { root, calls, out, code };
}

describe('release', () => {
  it('stamps the next version in both manifests, builds, commits, tags, pushes and publishes', () => {
    const { root, calls, code } = run();

    expect(code).toBe(0);
    const pkg = readJson(join(root, 'package.json'));
    expect(dig(pkg, 'version')).toBe('0.0.10');
    expect(typeof pkg === 'object' && pkg !== null ? Object.keys(pkg).slice(0, 2) : []).toEqual(['name', 'version']);
    expect(dig(pkg, 'scripts')).toEqual({ test: 'vitest run' });
    expect(dig(readJson(join(root, PLUGIN)), 'version')).toBe('0.0.10');
    expect(readFileSync(join(root, PLUGIN), 'utf8').endsWith('}\n')).toBe(true);

    const build = calls.indexOf('pnpm kit:build');
    const add = calls.findIndex((line) => line.startsWith('git add'));
    const commit = calls.findIndex((line) => line.startsWith('git commit'));
    const push = calls.indexOf('git push origin HEAD:main');
    const tag = calls.indexOf('git tag -a v0.0.10 -m v0.0.10');
    const pushTag = calls.indexOf('git push origin v0.0.10');
    const publish = calls.findIndex((line) => line.startsWith('gh release create'));
    expect([build, add, commit, push, tag, pushTag, publish].every((index) => index >= 0)).toBe(true);
    expect(build < add && add < commit && commit < push && push < tag && tag < pushTag && pushTag < publish).toBe(true);

    expect(calls[add]).toBe(`git add -- package.json ${PLUGIN} ${BUNDLE}`);
    expect(calls[commit]).toBe(`git commit -q -m chore(release): v0.0.10\n\n${TRAILER}`);
    expect(calls[publish]).toBe(`gh release create v0.0.10 ${BUNDLE} --title v0.0.10 --generate-notes --verify-tag`);
  });

  it('commits with no trailer line when signing is off', () => {
    const { calls, code } = run({ 'node .omni-loop/bin/omni.mjs sign trailer': '' });
    expect(code).toBe(0);
    expect(calls).toContain('git commit -q -m chore(release): v0.0.10');
  });

  it('starts at v0.0.1 when no release tag exists', () => {
    const { root, calls } = run({ 'git tag --list': 'release-3\nv0.1.0\n' });
    expect(dig(readJson(join(root, 'package.json')), 'version')).toBe('0.0.1');
    expect(calls).toContain('git tag -a v0.0.1 -m v0.0.1');
  });

  it('does nothing when the head commit is a release commit', () => {
    const { root, calls, out, code } = run({ 'git log -1 --format=%s': 'chore(release): v0.0.9\n' });
    expect(code).toBe(0);
    expect(calls).toEqual(['git log -1 --format=%s']);
    expect(dig(readJson(join(root, 'package.json')), 'version')).toBeUndefined();
    expect(out.join('\n')).toMatch(/nothing to release/);
  });

  it('retries a rejected push once, after a rebase onto main', () => {
    let pushes = 0;
    const { calls, code } = run({
      'git push origin HEAD:main': () => {
        pushes += 1;
        if (pushes === 1) rejected();
        return '';
      },
    });
    expect(code).toBe(0);
    const firstPush = calls.indexOf('git push origin HEAD:main');
    const fetch = calls.indexOf('git fetch origin main');
    const rebase = calls.indexOf('git rebase origin/main');
    const secondPush = calls.lastIndexOf('git push origin HEAD:main');
    expect(firstPush < fetch && fetch < rebase && rebase < secondPush).toBe(true);
    expect(calls.lastIndexOf('pnpm kit:build')).toBeGreaterThan(rebase);
    expect(calls).toContain('git tag -a v0.0.10 -m v0.0.10');
  });

  it('amends the release commit when the bundle changed after the rebase', () => {
    let pushes = 0;
    const { calls } = run({
      'git push origin HEAD:main': () => {
        pushes += 1;
        if (pushes === 1) rejected();
        return '';
      },
      [`git status --porcelain -- ${BUNDLE}`]: ` M ${BUNDLE}\n`,
    });
    const amend = calls.indexOf('git commit -q --amend --no-edit');
    expect(amend).toBeGreaterThan(calls.indexOf('git rebase origin/main'));
    expect(calls[amend - 1]).toBe(`git add -- ${BUNDLE}`);
  });

  it('keeps the release commit when the rebuilt bundle is unchanged', () => {
    let pushes = 0;
    const { calls } = run({
      'git push origin HEAD:main': () => {
        pushes += 1;
        if (pushes === 1) rejected();
        return '';
      },
    });
    expect(calls).not.toContain('git commit -q --amend --no-edit');
  });

  it('fails with nothing tagged when the push is rejected twice', () => {
    const { calls, out, code } = run({ 'git push origin HEAD:main': rejected });
    expect(code).toBe(1);
    expect(calls.filter((line) => line === 'git push origin HEAD:main')).toHaveLength(2);
    expect(calls.some((line) => line.startsWith('git tag -a'))).toBe(false);
    expect(calls.some((line) => line.startsWith('gh release'))).toBe(false);
    expect(out.join('\n')).toMatch(/nothing tagged/);
  });

  it('fails with nothing tagged when the rebase does not apply', () => {
    const { calls, code } = run({
      'git push origin HEAD:main': rejected,
      'git rebase origin/main': () => {
        throw new Error('CONFLICT (content): Merge conflict in kit/dist/omni.mjs');
      },
    });
    expect(code).toBe(1);
    expect(calls).toContain('git rebase --abort');
    expect(calls.filter((line) => line === 'git push origin HEAD:main')).toHaveLength(1);
    expect(calls.some((line) => line.startsWith('git tag -a'))).toBe(false);
  });

  it('fails when the build fails, before anything is committed', () => {
    const { calls, code } = run({
      'pnpm kit:build': () => {
        throw new Error('build failed');
      },
    });
    expect(code).toBe(1);
    expect(calls.some((line) => line.startsWith('git commit'))).toBe(false);
    expect(calls.some((line) => line.startsWith('git push'))).toBe(false);
  });
});
