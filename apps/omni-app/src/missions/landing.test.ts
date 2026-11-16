// The mission pull request (PRD 2896 s6, criterion 9): what the App reads and writes of it on GitHub, against the stubbed GitHub
// the App's tests use, and what its body says.
import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { replayGitHub, type Recorded } from '../../test/github-replay.ts';
import { decisionsOf } from 'omni-loop/kit/lib/mission/overturn.ts';
import { landedBy, missionLandings, missionPullBody, missionPullTitle, prOfTitle, type MissionPull } from './landing.ts';

const BRANCH = 'mission/12-faster-quotes';
const TIP = 'tip1';
const at = { installation: 7, repo: 'acme/widgets', branch: BRANCH };

const pull = (number: number, over: Record<string, unknown> = {}) => ({
  number,
  title: 'Mission #12: Faster quotes',
  body: 'the list',
  state: 'closed',
  html_url: `https://github.com/acme/widgets/pull/${String(number)}`,
  head: { ref: BRANCH, sha: `head${String(number)}` },
  base: { ref: 'main' },
  labels: [],
  merged_at: '2027-01-22T10:00:00Z',
  ...over,
});

const commit = (sha: string, message: string) => ({ sha, commit: { message } });

/** A GitHub whose main holds a config with `prLinks.feature`, the mission pull requests `pulls`, and the reads `recorded`. */
function github({ pulls = [] as object[], recorded = [] as Recorded[] } = {}) {
  const gh = replayGitHub({
    commits: { [TIP]: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nprLinks:\n  feature: "Closes #{prd}"\n' } },
    pulls,
    recording: [{ route: 'GET /repos/{owner}/{repo}', params: { owner: 'acme', repo: 'widgets' }, data: { default_branch: 'main' } }, ...recorded],
  });
  gh.state.refs.set('heads/main', TIP);
  return gh;
}

describe('prOfTitle: the feature pull request a squash commit names', () => {
  it('reads the number GitHub\'s squash title ends with, on the first line only', () => {
    expect(prOfTitle('feat(quotes): faster (#41)\n\nbody (#9)')).toBe(parsePr(41));
    expect(prOfTitle('feat(quotes): faster (#41)  ')).toBe(parsePr(41));
    expect(prOfTitle('feat(quotes): faster\n\n(#41)')).toBeNull();
    expect(prOfTitle('chore: start')).toBeNull();
  });
});

describe('missionLandings.landings: the mission pull requests, and what a merged one carried', () => {
  it('lists them newest first, each merged one with the feature pull requests its commits name', async () => {
    const gh = github({
      pulls: [pull(60), pull(61, { state: 'open', merged_at: null })],
      recorded: [
        {
          route: 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
          params: { owner: 'acme', repo: 'widgets', pull_number: 60, per_page: 100, page: 1 },
          data: [commit('c1', 'feat: one (#41)'), commit('c2', 'feat: two (#42)'), commit('c3', 'chore: by hand')],
        },
      ],
    });
    const read = await missionLandings({ octokitFor: () => gh.octokit }).landings(at);
    expect(read).toEqual({
      defaultBranch: 'main',
      pulls: [
        { number: 61, url: 'https://github.com/acme/widgets/pull/61', open: true, merged: false, title: 'Mission #12: Faster quotes', body: 'the list', carried: [] },
        { number: 60, url: 'https://github.com/acme/widgets/pull/60', open: false, merged: true, title: 'Mission #12: Faster quotes', body: 'the list', carried: [41, 42] },
      ],
    });
    // An open one's commits are never read: only a merged one carried anything.
    expect(gh.state.requests.filter((one) => one.route.endsWith('/commits') && one.pull_number === 61)).toEqual([]);
  });

  it('never reads the default branch as a mission branch', async () => {
    const gh = github();
    await expect(missionLandings({ octokitFor: () => gh.octokit }).landings({ ...at, branch: 'main' })).rejects.toThrow('default branch');
  });
});

describe('missionLandings.branch: the mission branch\'s commits, and the line that closes a PRD\'s issue', () => {
  it('reads each commit since the default branch, in order, and the default branch\'s prLinks.feature', async () => {
    const gh = github({
      recorded: [
        {
          route: 'GET /repos/{owner}/{repo}/compare/{basehead}',
          params: { owner: 'acme', repo: 'widgets', basehead: `main...${BRANCH}` },
          data: { commits: [commit('c1', 'feat: one (#41)'), commit('c2', 'docs: no number')] },
        },
      ],
    });
    expect(await missionLandings({ octokitFor: () => gh.octokit }).branch({ ...at, defaultBranch: 'main' })).toEqual({
      commits: [
        { sha: 'c1', pr: 41 },
        { sha: 'c2', pr: null },
      ],
      link: 'Closes #{prd}',
    });
  });
});

describe('missionLandings.write: the mission pull request opened or rewritten, never merged', () => {
  it('opens one from the mission branch into the default branch, not a draft', async () => {
    const gh = github();
    const written = await missionLandings({ octokitFor: () => gh.octokit }).write({ ...at, defaultBranch: 'main', pull: null, title: 'Mission #12: Faster quotes', body: 'b' });
    expect(written).toMatchObject({ ok: true, created: true });
    expect(gh.state.requests.filter((one) => one.route === 'POST /repos/{owner}/{repo}/pulls')).toEqual([
      expect.objectContaining({ head: BRANCH, base: 'main', title: 'Mission #12: Faster quotes', body: 'b', draft: false }),
    ]);
  });

  it('rewrites the open one\'s title and body in place', async () => {
    const gh = github({ pulls: [pull(61, { state: 'open', merged_at: null })] });
    const written = await missionLandings({ octokitFor: () => gh.octokit }).write({ ...at, defaultBranch: 'main', pull: parsePr(61), title: 't', body: 'new list' });
    expect(written).toEqual({ ok: true, number: 61, url: 'https://github.com/acme/widgets/pull/61', created: false });
    expect(gh.state.pulls.find((one) => one.number === 61)?.body).toBe('new list');
    expect(gh.state.requests.some((one) => one.route.includes('/merge'))).toBe(false);
  });

  it('says why GitHub refused to open one, and throws on any other failure', async () => {
    const gh = github({ pulls: [pull(61, { state: 'open', merged_at: null })] });
    const landings = missionLandings({ octokitFor: () => gh.octokit });
    expect(await landings.write({ ...at, defaultBranch: 'main', pull: null, title: 't', body: 'b' })).toEqual({
      ok: false,
      why: `GitHub refused to open the mission pull request: A pull request already exists for ${BRANCH}.`,
    });
  });

  it('refuses to write from the default branch before any request', async () => {
    const gh = github();
    await expect(missionLandings({ octokitFor: () => gh.octokit }).write({ ...at, branch: 'main', defaultBranch: 'main', pull: null, title: 't', body: 'b' })).rejects.toThrow('default branch');
    expect(gh.state.requests).toEqual([]);
  });
});

describe('landedBy: the PRDs a merged mission pull request carried', () => {
  const mission = (number: number, merged: boolean, carried: number[]): MissionPull => ({
    number: parsePr(number),
    url: `https://github.com/acme/widgets/pull/${String(number)}`,
    open: !merged,
    merged,
    title: 't',
    body: 'b',
    carried: carried.map(parsePr),
  });

  it('names each PRD on the branch whose feature pull request a merged one carried, in the order they joined', () => {
    const features = new Map([
      [parsePrd(2), parsePr(42)],
      [parsePrd(1), parsePr(41)],
      [parsePrd(3), parsePr(43)],
    ]);
    expect(landedBy([mission(61, false, []), mission(60, true, [41, 42])], features)).toEqual([
      { prd: 2, pr: 60, url: 'https://github.com/acme/widgets/pull/60' },
      { prd: 1, pr: 60, url: 'https://github.com/acme/widgets/pull/60' },
    ]);
  });

  it('names none while no mission pull request was merged', () => {
    expect(landedBy([mission(60, false, [41])], new Map([[parsePrd(1), parsePr(41)]]))).toEqual([]);
  });
});

describe('the mission pull request\'s title and body', () => {
  const rows = [
    { prd: parsePrd(1), pr: parsePr(41), commit: 'abcdef0123456789', pass: { round: 2, url: 'https://github.com/acme/widgets/pull/41#pullrequestreview-7' }, page: 'https://omni.example.com/prd/d-1' },
    { prd: parsePrd(2), pr: null, commit: null, pass: null, page: null },
  ];

  it('is titled by the mission', () => {
    expect(missionPullTitle({ number: 12, title: 'Faster quotes' })).toBe('Mission #12: Faster quotes');
  });

  it('opens with what the fleet approved and answered, each with its verdicts, and who overturned it (PRD 2896 s11)', () => {
    const decisions = decisionsOf([
      { kind: 'decided', prd: parsePrd(1), sentence: 'The committee approved PRD 1: pm yes, architect yes, reviewer yes.' },
      { kind: 'decided', prd: parsePrd(2), sentence: 'The committee answered s2-01 of PRD 2 with option A: pm yes, architect yes, reviewer yes.' },
      { kind: 'overturned', prd: parsePrd(2), sentence: 'ada overturned fleet decision 2/s2-01: no.', actor: 'ada' },
    ]);
    const body = missionPullBody({ mission: { number: 12, title: 'Faster quotes' }, branch: BRANCH, defaultBranch: 'main', rows, link: null, decisions });
    expect(body.startsWith('**Approved by the fleet**\n\n- PRD 1: pm yes, architect yes, reviewer yes.')).toBe(true);
    expect(body).toContain('**Answered by the fleet**\n\n- s2-01 of PRD 2, option A: pm yes, architect yes, reviewer yes · overturned by ada.');
    expect(body.indexOf('Lands mission #12')).toBeGreaterThan(body.indexOf('Answered by the fleet'));
    expect(missionPullBody({ mission: { number: 12, title: 'Faster quotes' }, branch: BRANCH, defaultBranch: 'main', rows, link: null })).not.toContain('by the fleet');
  });

  it('lists each PRD in the order it joined, with its commit, the Reviewer\'s pass and its page, then how to merge it', () => {
    const body = missionPullBody({ mission: { number: 12, title: 'Faster | quotes' }, branch: BRANCH, defaultBranch: 'main', rows, link: 'Closes #{prd}' });
    expect(body).toBe(
      [
        `Lands mission #12, Faster \\| quotes, on \`main\`: each PRD below joined \`${BRANCH}\` as one commit, in this order.`,
        '',
        '| # | PRD | Its pull request | Commit | Reviewer | Page |',
        '|---|---|---|---|---|---|',
        '| 1 | PRD 1 | #41 | `abcdef0` | [pass, round 2 of 2](https://github.com/acme/widgets/pull/41#pullrequestreview-7) | [its page](https://omni.example.com/prd/d-1) |',
        '| 2 | PRD 2 | — | not on the branch yet | pass | no page yet |',
        '',
        '**Merge it with Rebase and merge**: `main` then gets one commit per PRD, each revertible alone, and each PRD is shipped from that moment. A squash or a merge commit would land them as one.',
        '',
        'Merge it at any time: it carries what has joined so far, and one knowledge pull request then covers every PRD it landed. The Omni app rewrites this list on every join and never merges it: a person does.',
        '',
        'Closes #1',
        'Closes #2',
        '',
      ].join('\n'),
    );
  });

  it('closes no issue when the line was not read', () => {
    expect(missionPullBody({ mission: { number: 12, title: 'Faster quotes' }, branch: BRANCH, defaultBranch: 'main', rows, link: null })).not.toContain('Closes');
  });
});
