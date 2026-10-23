// The runner's release of a dead job's claims (PRD 2175 s2): `release()` on a fake `gh` that answers
// from a list of pull requests and their comments, and records every call. Nothing here calls GitHub.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alarmText, MAX_RELEASED, MAX_RELEASE_ERROR, namesJob, notReleased, release, releaser } from './release.ts';
import type { ClaimsRepo, Gh } from './release.ts';

const REPO: ClaimsRepo = { slug: 'acme/widgets', inProgress: 'omni:in-progress', released: 'omni:released', statusMarker: '<!-- omni-outbox-status -->' };
const JOB = { id: 'a8a6bf82', runner: 'box-1' };

/** A status comment, as `/omni:pr` keeps it, naming `job` when given. */
const status = (job?: string): string =>
  ['<!-- omni-outbox-status -->', '**Status:** in-progress', '- claimed: s2', ...(job === undefined ? [] : [`- job: ${job} · runner box-1`])].join('\n');

type Pr = { number: number; isDraft?: boolean; labels?: string[]; comments?: string[] };

/** The failure `execFileSync` throws: its message, and `gh`'s standard error. */
const ghError = (stderr: string) => Object.assign(new Error('Command failed: gh'), { stderr });

/**
 * A fake `gh`: `pr list` answers `prs` (drafts carrying `omni:in-progress` unless they say otherwise;
 * only the drafts when asked for `--draft`, as `gh` does),
 * `api …/comments` their comments, one page per two, and `pr edit` and `pr comment` succeed unless
 * `fail` names the call. Every call is kept.
 */
function fakeGh(prs: Pr[], fail: (call: string) => string | null = () => null) {
  const calls: string[] = [];
  const gh: Gh = (args) => {
    const call = args.join(' ');
    calls.push(call);
    const refused = fail(call);
    if (refused !== null) throw ghError(refused);
    if (args[0] === 'pr' && args[1] === 'list') {
      const listed = prs.map((pr) => ({ number: pr.number, isDraft: pr.isDraft ?? true, labels: (pr.labels ?? ['omni:in-progress']).map((name) => ({ name })) }));
      return JSON.stringify(args.includes('--draft') ? listed.filter((pr) => pr.isDraft) : listed);
    }
    const comments = /^api repos\/acme\/widgets\/issues\/(\d+)\/comments/.exec(call);
    if (comments) {
      const bodies = prs.find((pr) => pr.number === Number(comments[1]))?.comments ?? [];
      const pages = [];
      for (let i = 0; i < bodies.length; i += 2) pages.push(JSON.stringify(bodies.slice(i, i + 2)));
      return `${pages.join('\n')}\n`;
    }
    return '';
  };
  return { gh, calls };
}

const edits = (calls: string[]) => calls.filter((call) => call.startsWith('pr edit'));
const posted = (calls: string[]) => calls.filter((call) => call.startsWith('pr comment'));

describe('release()', () => {
  it('lists the open pull requests that carry inProgress, draft or ready, in the repository the job ran in', () => {
    const { gh, calls } = fakeGh([]);
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [], releaseError: null });
    expect(calls[0]).toBe('pr list --repo acme/widgets --state open --label omni:in-progress --limit 100 --json number,labels');
    expect(calls).toHaveLength(1);
  });

  it('releases the drafts whose status comment names this job: the label swapped, the alarm posted', () => {
    const { gh, calls } = fakeGh([
      { number: 1908, comments: ['Looks good', status('a8a6bf82')] },
      { number: 1909, comments: [status('a8a6bf82')] },
    ]);
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [1908, 1909], releaseError: null });
    expect(edits(calls)).toEqual([
      'pr edit 1908 --repo acme/widgets --remove-label omni:in-progress --add-label omni:released',
      'pr edit 1909 --repo acme/widgets --remove-label omni:in-progress --add-label omni:released',
    ]);
    expect(posted(calls)).toEqual([
      `pr comment 1908 --repo acme/widgets --body ${alarmText(JOB, 'exit code 3')}`,
      `pr comment 1909 --repo acme/widgets --body ${alarmText(JOB, 'exit code 3')}`,
    ]);
  });

  it('reads every page of a pull request\'s comments', () => {
    const { gh, calls } = fakeGh([{ number: 7, comments: ['one', 'two', 'three', status('a8a6bf82')] }]);
    expect(release(JOB, REPO, 'timeout', gh).released).toEqual([7]);
    expect(calls).toContain('api repos/acme/widgets/issues/7/comments --paginate --jq [.[].body]');
  });

  it('leaves another job\'s claim, a claim with no job line, and a job line outside the status comment alone', () => {
    const { gh, calls } = fakeGh([
      { number: 1, comments: [status('ffff0000')] },
      { number: 2, comments: [status()] },
      { number: 3, comments: ['- job: a8a6bf82 · runner box-1'] },
      { number: 4, comments: [status('a8a6bf82-2')] },
    ]);
    expect(release(JOB, REPO, 'cancelled', gh)).toEqual({ released: [], releaseError: null });
    expect(edits(calls)).toEqual([]);
    expect(posted(calls)).toEqual([]);
  });

  it('leaves a pull request without inProgress alone, draft or ready, whatever gh lists', () => {
    const { gh, calls } = fakeGh([
      { number: 1, isDraft: false, labels: ['omni:sub'], comments: [status('a8a6bf82')] },
      { number: 2, labels: ['omni:sub'], comments: [status('a8a6bf82')] },
    ]);
    expect(release(JOB, REPO, 'done', gh)).toEqual({ released: [], releaseError: null });
    expect(calls.filter((call) => call.startsWith('api'))).toEqual([]);
    expect(edits(calls)).toEqual([]);
  });

  it('releases a ready pull request still on inProgress whose status comment names this job (#2366)', () => {
    // Job 93914438 (`/omni:yolo 2338`) ended with sub-PR #2345 ready, on `omni:in-progress`, its status
    // comment naming the job: the release took the drafts #2344 and #2339 only, and #2345 kept its claim.
    const { gh, calls } = fakeGh([
      { number: 2339, comments: [status('a8a6bf82')] },
      { number: 2344, comments: [status('a8a6bf82')] },
      { number: 2345, isDraft: false, comments: [status('a8a6bf82')] },
    ]);
    expect(release(JOB, REPO, 'done', gh)).toEqual({ released: [2339, 2344, 2345], releaseError: null });
    expect(edits(calls)).toContain('pr edit 2345 --repo acme/widgets --remove-label omni:in-progress --add-label omni:released');
  });

  it('still removes inProgress when the released label is missing, and reports it', () => {
    const { gh, calls } = fakeGh([{ number: 1908, comments: [status('a8a6bf82')] }], (call) =>
      call.includes('--add-label') ? "could not add label: 'omni:released' not found\n" : null);
    const result = release(JOB, REPO, 'exit code 3', gh);
    expect(result.released).toEqual([1908]);
    expect(result.releaseError).toBe("#1908: omni:released could not be added (could not add label: 'omni:released' not found)");
    expect(edits(calls)).toEqual([
      'pr edit 1908 --repo acme/widgets --remove-label omni:in-progress --add-label omni:released',
      'pr edit 1908 --repo acme/widgets --remove-label omni:in-progress',
    ]);
    expect(posted(calls)).toHaveLength(1);
  });

  it('does not count a claim whose label could not be changed at all, and goes on with the next', () => {
    const { gh, calls } = fakeGh([{ number: 1, comments: [status('a8a6bf82')] }, { number: 2, comments: [status('a8a6bf82')] }], (call) =>
      call.startsWith('pr edit 1 ') ? 'HTTP 403: Resource not accessible by integration\n' : null);
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [2], releaseError: '#1: HTTP 403: Resource not accessible by integration' });
    expect(posted(calls)).toEqual([`pr comment 2 --repo acme/widgets --body ${alarmText(JOB, 'exit code 3')}`]);
  });

  it('counts a released claim whose alarm could not be posted, and reports it', () => {
    const { gh } = fakeGh([{ number: 5, comments: [status('a8a6bf82')] }], (call) => (call.startsWith('pr comment') ? 'HTTP 502\n' : null));
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [5], releaseError: '#5: the alarm could not be posted (HTTP 502)' });
  });

  it('reports a pull request whose comments could not be read, and goes on', () => {
    const { gh } = fakeGh([{ number: 1, comments: [status('a8a6bf82')] }, { number: 2, comments: [status('a8a6bf82')] }], (call) =>
      call.startsWith('api repos/acme/widgets/issues/1/') ? 'HTTP 500\n' : null);
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [2], releaseError: '#1: HTTP 500' });
  });

  it('turns a gh failure into no release and a releaseError', () => {
    const { gh } = fakeGh([], () => 'gh: To get started with GitHub CLI, please run:  gh auth login\nmore\n');
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [], releaseError: 'gh: To get started with GitHub CLI, please run:  gh auth login' });
  });

  it('turns an answer it cannot read into no release and a releaseError', () => {
    const gh: Gh = () => 'not json';
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [], releaseError: 'gh pr list answered something unreadable' });
  });

  it('names the failure by its message when gh wrote nothing on its standard error', () => {
    const gh: Gh = () => {
      throw new Error('spawnSync gh ENOENT');
    };
    expect(release(JOB, REPO, 'exit code 3', gh)).toEqual({ released: [], releaseError: 'spawnSync gh ENOENT' });
  });

  it('keeps its report within what the app stores: 50 numbers, 200 characters', () => {
    const prs = Array.from({ length: 60 }, (_, i) => ({ number: i + 1, comments: [status('a8a6bf82')] }));
    const { gh } = fakeGh(prs, (call) => (call.startsWith('pr comment') ? `HTTP 502 ${'x'.repeat(50)}\n` : null));
    const result = release(JOB, REPO, 'exit code 3', gh);
    expect(result.released).toHaveLength(MAX_RELEASED);
    expect(result.releaseError?.length).toBe(MAX_RELEASE_ERROR);
    expect(result.releaseError?.endsWith('…')).toBe(true);
  });
});

describe('the alarm and the job line', () => {
  it('names the job, its runner and why it ended, and what the next run does', () => {
    expect(alarmText(JOB, 'exit code 3')).toBe(
      'Released: runner job `a8a6bf82` on `box-1` ended (`exit code 3`) while it held this claim. The next run reuses it if the plan and its territory still match, or closes it and rebuilds the slice.',
    );
  });

  it('reads the job line /omni:pr writes, with or without its bullet or backticks, and no other job\'s', () => {
    expect(namesJob('- job: a8a6bf82 · runner box-1', 'a8a6bf82')).toBe(true);
    expect(namesJob('intro\n  - job: `a8a6bf82` · runner box-1\nmore', 'a8a6bf82')).toBe(true);
    expect(namesJob('job: a8a6bf82', 'a8a6bf82')).toBe(true);
    expect(namesJob('- job: a8a6bf821 · runner box-1', 'a8a6bf82')).toBe(false);
    expect(namesJob('- job: xa8a6bf82', 'a8a6bf82')).toBe(false);
    expect(namesJob('- the job: a8a6bf82 ran', 'a8a6bf82')).toBe(false);
    expect(namesJob('- job: a.b', 'a+b')).toBe(false);
  });
});

describe('releaser()', () => {
  /** A checkout of `acme/widgets` whose config says `config`, or none. */
  function checkout(config: string | null): string {
    const dir = mkdtempSync(join(tmpdir(), 'omni-release-'));
    if (config !== null) {
      mkdirSync(join(dir, '.omni-loop'));
      writeFileSync(join(dir, '.omni-loop', 'config.yml'), config);
    }
    return dir;
  }

  it('reads the labels and the status marker from the config of the checkout the job ran in', () => {
    const dir = checkout('kit: 1\nrepo:\n  slug: acme/widgets\nlabels:\n  inProgress: wip\n  released: freed\nmarkers:\n  prefix: acme\n');
    const calls: string[][] = [];
    const exec = (file: string, args: readonly string[]): string => {
      calls.push([file, ...args]);
      if (args[1] === 'list') return JSON.stringify([{ number: 3, isDraft: true, labels: [{ name: 'wip' }] }]);
      if (args[0] === 'api') return `${JSON.stringify(['<!-- acme-status -->\n- job: 9 · runner box-1'])}\n`;
      return '';
    };
    const free = releaser({ exec, checkouts: new Map([['acme/widgets', dir]]) });
    expect(free({ id: '9', runner: 'box-1', repo: 'acme/widgets', reason: 'runner lost' })).toEqual({ released: [3], releaseError: null });
    expect(calls.every(([file]) => file === 'gh')).toBe(true);
    expect(calls.map((call) => call.join(' '))).toContain('gh pr edit 3 --repo acme/widgets --remove-label wip --add-label freed');
  });

  it('reads the default labels and marker when the config sets none', () => {
    const dir = checkout('kit: 1\n');
    const calls: string[] = [];
    const exec = (_file: string, args: readonly string[]): string => {
      calls.push(args.join(' '));
      if (args[1] === 'list') return JSON.stringify([{ number: 3, isDraft: true, labels: [{ name: 'omni:in-progress' }] }]);
      if (args[0] === 'api') return `${JSON.stringify(['<!-- omni-outbox-status -->\n- job: 9'])}\n`;
      return '';
    };
    expect(releaser({ exec, checkouts: new Map([['acme/widgets', dir]]) })({ id: '9', runner: 'box-1', repo: 'acme/widgets', reason: 'done' }).released).toEqual([3]);
    expect(calls).toContain('pr edit 3 --repo acme/widgets --remove-label omni:in-progress --add-label omni:released');
  });

  it('releases nothing, and runs nothing, in a repository it does not hold or that has no config', () => {
    const exec = (): string => {
      throw new Error('no call expected');
    };
    const bare = checkout(null);
    const free = releaser({ exec, checkouts: new Map([['acme/bare', bare]]) });
    expect(free({ id: '9', runner: 'box-1', repo: 'acme/other', reason: 'done' })).toEqual({ released: [], releaseError: null });
    expect(free({ id: '9', runner: 'box-1', repo: 'acme/bare', reason: 'done' })).toEqual({ released: [], releaseError: null });
  });

  it('reports a config it cannot read', () => {
    const dir = checkout('kit: 99\n');
    const exec = (): string => '[]';
    expect(releaser({ exec, checkouts: new Map([['acme/widgets', dir]]) })({ id: '9', runner: 'box-1', repo: 'acme/widgets', reason: 'done' })).toEqual({
      released: [], releaseError: 'the config of acme/widgets could not be read',
    });
  });

  describe('as the job’s app (PRD 2433, s3)', () => {
    const TOKEN = ['ghs', 'fakeTokenOfTheJobBeingReleased0123456789'].join('_');
    const ended = { id: '9', runner: 'box-1', repo: 'acme/widgets', reason: 'done' };

    /** Every `gh` call of a release, with the environment it ran in (none: the machine's own). */
    function releasedWith(extra: { ghToken?: string | null }, env?: Record<string, string | undefined>) {
      const dir = checkout('kit: 1\n');
      const seen: { args: string; env: NodeJS.ProcessEnv | undefined }[] = [];
      const exec = (_file: string, args: readonly string[], options: { env?: NodeJS.ProcessEnv | undefined }): string => {
        seen.push({ args: args.join(' '), env: options.env });
        if (args[1] === 'list') return JSON.stringify([{ number: 3, isDraft: true, labels: [{ name: 'omni:in-progress' }] }]);
        if (args[0] === 'api') return `${JSON.stringify(['<!-- omni-outbox-status -->\n- job: 9'])}\n`;
        return '';
      };
      const done = releaser({ exec, checkouts: new Map([['acme/widgets', dir]]), ...(env === undefined ? {} : { env }) })({ ...ended, ...extra });
      return { done, seen };
    }

    it('runs every gh call with the job’s token as GH_TOKEN, on top of the runner’s own environment', () => {
      const { done, seen } = releasedWith({ ghToken: TOKEN }, { PATH: '/usr/bin', HOME: '/home/box' });
      expect(done).toEqual({ released: [3], releaseError: null });
      expect(seen.length).toBeGreaterThanOrEqual(4);
      for (const call of seen) expect(call.env).toEqual({ PATH: '/usr/bin', HOME: '/home/box', GH_TOKEN: TOKEN });
    });

    it('runs with the machine’s own gh, and no environment of its own, when the job had no app', () => {
      const cases: { ghToken?: string | null }[] = [{}, { ghToken: null }];
      for (const extra of cases) {
        const { done, seen } = releasedWith(extra, { PATH: '/usr/bin', GH_TOKEN: 'a-token-of-the-machine' });
        expect(done.released).toEqual([3]);
        for (const call of seen) expect(call.env).toBeUndefined();
      }
    });

    it('says why a release that could not run came to nothing, cut to what the app stores', () => {
      expect(notReleased('github app: its token expired')).toEqual({ released: [], releaseError: 'github app: its token expired' });
      const long = notReleased(`github app: ${'x'.repeat(500)}`);
      expect(long.released).toEqual([]);
      expect(long.releaseError).toHaveLength(MAX_RELEASE_ERROR);
      expect(long.releaseError?.endsWith('…')).toBe(true);
    });
  });
});
