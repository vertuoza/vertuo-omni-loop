import { describe, expect, it } from 'vitest';
import { parsePr } from '../ids.ts';
import { ghBoardReads } from './gh-bridge.ts';

// The board's reads through `gh` (PRD 1665, s3): the bridge `omni next`, `omni care` and the status
// line read through until their own slices move them to the Omni page. It runs the very `gh` calls
// the board ran, and says what it read in the loop's words.

type Call = { file: string; args: readonly string[]; options: unknown };

function fakeGh(answer: (args: readonly string[]) => unknown) {
  const calls: Call[] = [];
  const exec = (file: string, args: readonly string[], options: unknown) => {
    calls.push({ file, args, options });
    return JSON.stringify(answer(args));
  };
  return { exec, calls };
}

const LIST_FIELDS = 'number,title,headRefName,baseRefName,state,isDraft,mergedAt,body,labels,updatedAt,createdAt';

describe('the gh bridge', () => {
  it('lists with `gh pr list`, never asking for commits, narrowed as asked, with the gh environment', async () => {
    const { exec, calls } = fakeGh(() => []);
    const reads = ghBoardReads({ exec, env: { GH_TOKEN: 'x' } });
    await reads.changes({ repo: 'acme/widgets', state: 'all', base: 'feat/widgets' });
    await reads.changes({ repo: 'acme/widgets', state: 'all', label: 'omni:sub' });
    await reads.changes({ repo: 'acme/widgets', state: 'all', head: 'feat/widgets-1of2-a' });

    const list = ['pr', 'list', '--repo', 'acme/widgets', '--json', LIST_FIELDS, '--state', 'all', '--limit', '200'];
    expect(calls.map((call) => call.args)).toEqual([
      [...list, '--base', 'feat/widgets'],
      [...list, '--label', 'omni:sub'],
      [...list, '--head', 'feat/widgets-1of2-a'],
    ]);
    expect(calls[0]?.file).toBe('gh');
    expect(calls[0]?.options).toEqual({ encoding: 'utf8', env: { GH_TOKEN: 'x' } });
  });

  it('says each pull request in the loop\'s words: merged, draft, open or closed, labels by name', async () => {
    const { exec } = fakeGh(() => [
      { number: 1, headRefName: 'a', state: 'MERGED', mergedAt: '2026-10-12T00:00:00Z', labels: [{ name: 'omni:sub' }, 'bug', { name: null }] },
      { number: 2, headRefName: 'b', state: 'OPEN', isDraft: true },
      { number: 3, headRefName: 'c', state: 'OPEN', isDraft: false },
      { number: 4, headRefName: 'd', state: 'CLOSED' },
      { headRefName: 'e', state: 'OPEN' },
    ]);
    const changes = await ghBoardReads({ exec, env: undefined }).changes({ repo: 'acme/widgets' });
    expect(changes.map(({ number, state }) => `${number} ${state}`)).toEqual(['1 merged', '2 draft', '3 open', '4 closed']);
    expect(changes[0]).toMatchObject({ head: 'a', base: '', labels: ['omni:sub', 'bug'], url: 'https://github.com/acme/widgets/pull/1', author: null });
  });

  it('reads a head commit date with `gh pr view --json commits`: the last commit\'s, or none', async () => {
    const { exec, calls } = fakeGh((args) => (args[2] === '42' ? { commits: [{ committedDate: '2026-10-01T00:00:00Z' }, { authoredDate: '2026-10-02T00:00:00Z' }] } : {}));
    const reads = ghBoardReads({ exec, env: undefined });
    expect(await reads.lastCommitAt('acme/widgets', parsePr(42))).toBe('2026-10-02T00:00:00Z');
    expect(await reads.lastCommitAt('acme/widgets', parsePr(7))).toBeNull();
    expect(calls[0]?.args).toEqual(['pr', 'view', '42', '--repo', 'acme/widgets', '--json', 'commits']);
  });

  it('holds only the repository gh cannot read, with the first line gh said', async () => {
    const exec = () => {
      throw Object.assign(new Error('Command failed: gh pr list'), { stderr: 'GraphQL: Could not resolve to a Repository\nmore' });
    };
    await expect(ghBoardReads({ exec, env: undefined }).changes({ repo: 'acme/gone' })).rejects.toMatchObject({
      line: 'GraphQL: Could not resolve to a Repository',
      scope: 'repository',
    });
  });
});
