// `omni kb next-id <prefix>` (PRD 3015, s1), through `main()` on a temporary git repository whose
// `origin/main` is a local ref, with a fake `exec` answering `gh` and the fetch of a pull request's head.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec, type FakeExec } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const RULES = '.omni-loop/knowledge/domains/pipeline/rules.md';

function rule(id: string, words = 'A provable statement.'): string {
  return [`## ${id}`, '', words, '', 'Source: PRD #1081', 'Enforced by: unenforced', 'Stated: 2026-09-23', ''].join('\n');
}

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' }).trim();
}

/** A repository whose `origin/main` holds `base`, whose tree holds `tree`, and one branch holding `pull`. */
function repoWith({ base, tree = base, pull }: { base: string[]; tree?: string[]; pull?: string[] }) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, [RULES]: base.map((id) => rule(id)).join('\n') } });
  git(repo.root, 'update-ref', 'refs/remotes/origin/main', 'main');
  let sha = '';
  if (pull) {
    git(repo.root, 'switch', '-q', '-c', 'pull');
    repo.write(RULES, pull.map((id) => rule(id)).join('\n'));
    git(repo.root, 'commit', '-q', '-am', 'pull');
    sha = git(repo.root, 'rev-parse', 'HEAD');
    git(repo.root, 'switch', '-q', 'main');
  }
  repo.write(RULES, tree.map((id) => rule(id)).join('\n'));
  return { ...repo, sha };
}

/** `omni kb next-id …` with `gh` listing `pulls` (each fetched head being `sha`), or failing when `pulls` is null. */
async function nextId(root: string, args: string[], { pulls, sha = '' }: { pulls: number[] | null; sha?: string }) {
  const out: string[] = [];
  const err: string[] = [];
  const calls: string[] = [];
  const exec: FakeExec = (file, argv, options) => {
    if (file === 'gh') {
      calls.push(`gh ${argv.join(' ')}`);
      if (pulls === null) throw new Error('gh: not signed in');
      return JSON.stringify(pulls.map((number) => ({ number })));
    }
    if (argv[0] === 'fetch') {
      calls.push(`git ${argv.join(' ')}`);
      return '';
    }
    if (argv[0] === 'rev-parse' && argv[1] === 'FETCH_HEAD') return `${sha}\n`;
    return realExec(file, argv, options);
  };
  const code = await main(['kb', 'next-id', ...args], { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) }, exec });
  return { code, out: out.join(''), err: err.join(''), calls };
}

describe('omni kb next-id', () => {
  it('AC-1: numbers past an open pull request', async () => {
    const { root, sha } = repoWith({ base: ['BR-PIPELINE-46'], pull: ['BR-PIPELINE-46', 'BR-PIPELINE-47'] });
    const answer = await nextId(root, ['BR-PIPELINE'], { pulls: [51], sha });
    expect(answer).toMatchObject({ code: 0, out: 'BR-PIPELINE-48\n', err: '' });
    expect(answer.calls).toEqual(['gh pr list --base main --state open --json number --limit 200', 'git fetch --quiet origin pull/51/head']);
  });

  it('prints, with --json, the id and where the highest number came from', async () => {
    const { root, sha } = repoWith({ base: ['BR-PIPELINE-46'], pull: ['BR-PIPELINE-47'] });
    const answer = await nextId(root, ['BR-PIPELINE', '--json'], { pulls: [51], sha });
    expect(JSON.parse(answer.out)).toEqual({ id: 'BR-PIPELINE-48', past: [{ where: '#51', id: 'BR-PIPELINE-47' }] });
  });

  it('numbers past the tree when it is ahead of the base and the pull requests', async () => {
    const { root } = repoWith({ base: ['BR-PIPELINE-46'], tree: ['BR-PIPELINE-46', 'BR-PIPELINE-47'] });
    const answer = await nextId(root, ['BR-PIPELINE', '--json'], { pulls: [] });
    expect(JSON.parse(answer.out)).toEqual({ id: 'BR-PIPELINE-48', past: [{ where: 'tree', id: 'BR-PIPELINE-47' }] });
  });

  it('AC-2: still answers when the pull requests cannot be read', async () => {
    const { root } = repoWith({ base: ['BR-PIPELINE-46'] });
    const answer = await nextId(root, ['BR-PIPELINE'], { pulls: null });
    expect(answer.code).toBe(0);
    expect(answer.out).toBe('BR-PIPELINE-47\n');
    expect(answer.err).toBe('open pull requests not read: gh: not signed in; the id may still be taken by one\n');
  });

  it('says on the same line that the base could not be read either, and numbers past the tree', async () => {
    const { root } = repoWith({ base: ['BR-PIPELINE-46'] });
    git(root, 'update-ref', '-d', 'refs/remotes/origin/main');
    const answer = await nextId(root, ['BR-PIPELINE'], { pulls: null });
    expect(answer.code).toBe(0);
    expect(answer.out).toBe('BR-PIPELINE-47\n');
    expect(answer.err.trim().split('\n')).toHaveLength(1);
    expect(answer.err).toMatch(/^open pull requests not read: gh: not signed in; origin\/main not read: .*; the id may still be taken by one\n$/);
  });

  it('names a pull request whose head could not be fetched, and uses the rest', async () => {
    const { root } = repoWith({ base: ['BR-PIPELINE-46'] });
    const exec: FakeExec = (file, argv, options) => {
      if (file === 'gh') return JSON.stringify([{ number: 9 }]);
      if (argv[0] === 'fetch') throw new Error('fatal: no such ref');
      return realExec(file, argv, options);
    };
    const err: string[] = [];
    const out: string[] = [];
    const code = await main(['kb', 'next-id', 'BR-PIPELINE'], { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) }, exec });
    expect(code).toBe(0);
    expect(out.join('')).toBe('BR-PIPELINE-47\n');
    expect(err.join('')).toBe('open pull requests not read: #9: fatal: no such ref; the id may still be taken by one\n');
  });

  it('starts a prefix nobody holds at 1', async () => {
    const { root } = repoWith({ base: ['BR-PIPELINE-46'] });
    expect((await nextId(root, ['P-GATE'], { pulls: [] })).out).toBe('P-GATE-1\n');
  });

  it.each([[[]], [['pipeline']], [['BR-PIPELINE-4']], [['BR-PIPELINE', 'extra']]])('is a usage error (exit 2) for %j', async (args) => {
    const { root } = repoWith({ base: ['BR-PIPELINE-46'] });
    const answer = await nextId(root, args, { pulls: [] });
    expect(answer.code).toBe(2);
    expect(answer.out).toBe('');
    expect(answer.err).toContain('usage: omni kb next-id');
  });

  it('is listed by omni help kb', async () => {
    const out: string[] = [];
    const code = await main(['help', 'kb'], { cwd: repoWith({ base: [] }).root, stdout: { write: (s) => out.push(s) }, stderr: { write: () => 0 } });
    expect(code).toBe(0);
    expect(out.join('')).toContain('omni kb next-id <prefix> [--json]');
  });
});
