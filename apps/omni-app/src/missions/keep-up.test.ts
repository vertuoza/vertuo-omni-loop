// The mission branch follows the default branch (PRD 2896 s5, criterion 8), against a GitHub over a real git repository
// (./git.fake.ts): every rebase, merge and conflict below is git's own.
import { afterEach, describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import { gitGithub } from './git.fake.ts';
import { keptWaits, missionKeepUps, type KeptUp } from './keep-up.ts';

const BRANCH = 'mission/12-faster-quotes';
const BUNDLE = 'kit/dist/omni.mjs';
const GENERATED = [{ path: 'kit/dist/', from: ['kit/lib/'], build: 'pnpm kit:build' }];

const lines = (...words: string[]): string => `${words.join('\n')}\n`;

let open: ReturnType<typeof gitGithub>[] = [];
afterEach(() => {
  for (const one of open) one.done();
  open = [];
});

/** A repository whose main holds a bundle and two sources, and a mission branch cut from it. */
function repo() {
  const gh = gitGithub({ [BUNDLE]: lines('b1', 'b2', 'b3'), 'kit/lib/a.ts': lines('a1', 'a2', 'a3', 'a4', 'a5', 'a6'), 'kit/lib/b.ts': lines('x') });
  open.push(gh);
  // The mission branch starts at main's head: no commit of its own yet.
  gh.branch(BRANCH, 'main');
  return gh;
}

/** The keeper over `octokit`, the repository's generated outputs those of GENERATED. */
const keeper = (octokit: GitHubClient) => missionKeepUps({ octokitFor: () => octokit, generatedOf: () => Promise.resolve(GENERATED) });

const at = (features: { prd: number; pr: number }[] = []) => ({
  installation: 7,
  repo: 'acme/widgets',
  branch: BRANCH,
  features: features.map(({ prd, pr }) => ({ prd: parsePrd(prd), pr: parsePr(pr) })),
});

/** A mission branch cut from main with no commit of its own, then two PRDs squash-joined onto it. */
function withTwoPrds() {
  const gh = gitGithub({ [BUNDLE]: lines('b1', 'b2', 'b3'), 'kit/lib/a.ts': lines('a1', 'a2', 'a3', 'a4', 'a5', 'a6'), 'kit/lib/b.ts': lines('x') });
  open.push(gh);
  const cut = gh.head('main') ?? '';
  gh.push(BRANCH, { 'kit/lib/a.ts': lines('a1 by PRD 7', 'a2', 'a3', 'a4', 'a5', 'a6') }, 'feat(quotes): faster (#45)', cut);
  gh.push(BRANCH, { 'docs/quotes.md': lines('quotes') }, 'docs(quotes): the guide (#46)');
  return gh;
}

describe('missionKeepUps.keepUp: the mission branch, in step with the default branch (PRD 2896 s5)', () => {
  it('writes nothing while the default branch has not moved', async () => {
    const gh = withTwoPrds();
    const head = gh.head(BRANCH);
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept).toMatchObject({ branch: 'in-step', defaultBranch: 'main', features: [] });
    expect(gh.head(BRANCH)).toBe(head);
    expect(gh.calls.filter(({ route }) => !route.startsWith('GET'))).toEqual([]);
  });

  it('rebases the branch onto the new tip: one commit per PRD, in order, each with one parent, its title and author kept', async () => {
    const gh = withTwoPrds();
    gh.push('main', { 'kit/lib/a.ts': lines('a1', 'a2', 'a3', 'a4', 'a5', 'a6 on main') }, 'fix(a): the last line (#50)');
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept.branch).toBe('rebased');
    expect(gh.isAncestor('main', BRANCH)).toBe(true);
    expect(gh.subjects(BRANCH)).toEqual(['feat(quotes): faster (#45)', 'docs(quotes): the guide (#46)']);
    expect(gh.parentCounts(BRANCH, 'main')).toEqual([1, 1]);
    expect(gh.read(BRANCH, 'kit/lib/a.ts')).toBe(lines('a1 by PRD 7', 'a2', 'a3', 'a4', 'a5', 'a6 on main'));
    expect(gh.read(BRANCH, 'docs/quotes.md')).toBe(lines('quotes'));
    // The scratch branch the merges were made on is gone, and main was never written.
    expect(gh.branches().sort()).toEqual([BRANCH, 'main'].sort());
    expect(gh.calls.some(({ route, params }) => route.startsWith('PATCH') && String(params.ref) === 'heads/main')).toBe(false);
  });

  it('writes the rebased branch with force only after reading its head again, and moves it once', async () => {
    const gh = withTwoPrds();
    gh.push('main', { 'kit/lib/b.ts': lines('y') }, 'fix(b): y (#51)');
    await keeper(gh.octokit).keepUp(at());
    const writes = gh.calls.filter(({ route, params }) => route.startsWith('PATCH') && String(params.ref) === `heads/${BRANCH}`);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.params.force).toBe(true);
    const reads = gh.calls.map(({ route, params }) => `${route} ${String(params.ref)}`);
    const lastRead = reads.lastIndexOf(`GET /repos/{owner}/{repo}/git/ref/{ref} heads/${BRANCH}`);
    const write = reads.findIndex((call) => call.startsWith('PATCH') && call.endsWith(`heads/${BRANCH}`));
    expect(lastRead).toBeLessThan(write);
    expect(lastRead).toBeGreaterThan(reads.findIndex((call) => call.startsWith('POST /repos/{owner}/{repo}/merges')));
  });

  it('writes nothing when the branch moved while it was being rebased: the next run reads it again', async () => {
    const gh = withTwoPrds();
    gh.push('main', { 'kit/lib/b.ts': lines('y') }, 'fix(b): y (#51)');
    let pushed = false;
    const racing: GitHubClient = {
      request: async (route, params) => {
        const answer = await gh.octokit.request(route, params);
        if (!pushed && route === 'POST /repos/{owner}/{repo}/merges') {
          pushed = true;
          gh.push(BRANCH, { 'docs/late.md': lines('late') }, 'docs: a late join (#47)');
        }
        return answer;
      },
    };
    const moved = gh.head(BRANCH);
    const kept = await keeper(racing).keepUp(at());
    expect(kept).toMatchObject({ branch: 'held' });
    expect(gh.head(BRANCH)).not.toBe(moved);
    expect(gh.subjects(BRANCH, 'main~1')).toContain('docs: a late join (#47)');
    expect(gh.branches().sort()).toEqual([BRANCH, 'main'].sort());
  });

  it('moves a branch with no commit of its own to the new tip without force', async () => {
    const gh = repo();
    gh.push('main', { 'kit/lib/b.ts': lines('y') }, 'fix(b): y (#51)');
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept.branch).toBe('rebased');
    expect(gh.head(BRANCH)).toBe(gh.head('main'));
    const write = gh.calls.find(({ route, params }) => route.startsWith('PATCH') && String(params.ref) === `heads/${BRANCH}`);
    expect(write?.params.force).toBe(false);
  });

  it('changes no branch on a conflict in a source, and names the files both sides changed', async () => {
    const gh = withTwoPrds();
    gh.push('main', { 'kit/lib/a.ts': lines('a1 on main', 'a2', 'a3', 'a4', 'a5', 'a6') }, 'fix(a): the first line (#50)');
    const before = gh.head(BRANCH);
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept).toEqual({ branch: 'conflict', defaultBranch: 'main', title: 'feat(quotes): faster (#45)', generated: false, files: ['kit/lib/a.ts'] });
    expect(gh.head(BRANCH)).toBe(before);
    expect(gh.branches().sort()).toEqual([BRANCH, 'main'].sort());
  });

  it('tells a conflict only in generated paths apart, and changes no branch for it either', async () => {
    const gh = withTwoPrds();
    gh.push(BRANCH, { [BUNDLE]: lines('b1 built with PRD 8', 'b2', 'b3') }, 'feat(cli): a flag (#48)');
    gh.push('main', { [BUNDLE]: lines('b1 built on main', 'b2', 'b3') }, 'feat(x): y (#52)');
    const before = gh.head(BRANCH);
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept).toEqual({ branch: 'conflict', defaultBranch: 'main', title: 'feat(cli): a flag (#48)', generated: true, files: [BUNDLE] });
    expect(gh.head(BRANCH)).toBe(before);
  });

  it('reads a conflict as generated only when the sources both sides changed merge cleanly', async () => {
    const gh = withTwoPrds();
    gh.push(BRANCH, { [BUNDLE]: lines('b1 built with PRD 8', 'b2', 'b3') }, 'feat(cli): a flag (#48)');
    gh.push('main', { [BUNDLE]: lines('b1 built on main', 'b2', 'b3'), 'kit/lib/a.ts': lines('a1', 'a2', 'a3', 'a4', 'a5', 'a6 on main') }, 'feat(x): y (#52)');
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept).toMatchObject({ branch: 'conflict', generated: true, files: [BUNDLE] });
    expect(gh.branches().sort()).toEqual([BRANCH, 'main'].sort());
  });

  it('reads it as a person\'s when a source conflicts beside the generated paths, and names the sources', async () => {
    const gh = withTwoPrds();
    gh.push(BRANCH, { [BUNDLE]: lines('b1 built with PRD 8', 'b2', 'b3') }, 'feat(cli): a flag (#48)');
    gh.push('main', { [BUNDLE]: lines('b1 built on main', 'b2', 'b3'), 'kit/lib/a.ts': lines('a1 on main', 'a2', 'a3', 'a4', 'a5', 'a6') }, 'feat(x): y (#52)');
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept).toMatchObject({ branch: 'conflict', title: 'feat(quotes): faster (#45)', generated: false, files: ['kit/lib/a.ts'] });
  });

  it('holds a branch that holds a merge commit: it is never merged into', async () => {
    const gh = withTwoPrds();
    gh.push('side', { 'docs/side.md': lines('side') }, 'docs: side', 'main');
    gh.push('main', { 'kit/lib/b.ts': lines('y') }, 'fix(b): y (#51)');
    await gh.octokit.request('POST /repos/{owner}/{repo}/merges', { base: BRANCH, head: 'side', commit_message: 'Merge side' });
    const before = gh.head(BRANCH);
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept).toMatchObject({ branch: 'held' });
    expect(kept.branch === 'held' ? kept.why : '').toContain('merge commit');
    expect(gh.head(BRANCH)).toBe(before);
  });

  it('after a landing by Rebase and merge, drops the commits the default branch holds already: the branch moves to its tip (PRD 2896 s6)', async () => {
    const gh = withTwoPrds();
    // A person merged the mission pull request with Rebase and merge: main gets a copy of each PRD's commit.
    gh.push('main', { 'kit/lib/a.ts': lines('a1 by PRD 7', 'a2', 'a3', 'a4', 'a5', 'a6') }, 'feat(quotes): faster (#45)');
    gh.push('main', { 'docs/quotes.md': lines('quotes') }, 'docs(quotes): the guide (#46)');
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept.branch).toBe('rebased');
    expect(gh.head(BRANCH)).toBe(gh.head('main'));
    expect(gh.subjects(BRANCH)).toEqual([]);
  });

  it('after a landing, replays only the PRD that joined after it, onto the tip that landed the others (PRD 2896 s6)', async () => {
    const gh = withTwoPrds();
    gh.push('main', { 'kit/lib/a.ts': lines('a1 by PRD 7', 'a2', 'a3', 'a4', 'a5', 'a6') }, 'feat(quotes): faster (#45)');
    gh.push('main', { 'docs/quotes.md': lines('quotes') }, 'docs(quotes): the guide (#46)');
    gh.push(BRANCH, { 'docs/later.md': lines('later') }, 'feat(later): joined after the landing (#47)');
    const kept = await keeper(gh.octokit).keepUp(at());
    expect(kept.branch).toBe('rebased');
    expect(gh.subjects(BRANCH)).toEqual(['feat(later): joined after the landing (#47)']);
    expect(gh.read(BRANCH, 'docs/quotes.md')).toBe(lines('quotes'));
  });

  it('never writes the default branch', async () => {
    const gh = withTwoPrds();
    await expect(keeper(gh.octokit).keepUp({ ...at(), branch: 'main' })).rejects.toThrow('default branch');
  });
});

describe('missionKeepUps.keepUp: each open feature branch of the mission, onto the new tip (PRD 2896 s5)', () => {
  /** Main moved under a mission branch with one PRD on it, and PRD 9's feature branch cut from the branch, its PR #60. */
  function withFeature(feature: Record<string, string>) {
    const gh = withTwoPrds();
    gh.push('feat/nine', feature, 'feat(nine): the work', BRANCH);
    gh.pull(60, BRANCH, 'feat/nine');
    gh.push('main', { 'kit/lib/b.ts': lines('y') }, 'fix(b): y (#51)');
    return gh;
  }

  it('brings an open feature branch onto the rebased tip, with the lease of its head, and keeps its own commits', async () => {
    const gh = withFeature({ 'kit/lib/nine.ts': lines('nine') });
    const head = gh.head('feat/nine');
    const kept = await keeper(gh.octokit).keepUp(at([{ prd: 9, pr: 60 }]));
    expect(kept).toMatchObject({ branch: 'rebased', features: [{ prd: 9, pr: 60, kept: 'updated' }] });
    expect(gh.isAncestor(BRANCH, 'feat/nine')).toBe(true);
    expect(gh.isAncestor(head ?? '', 'feat/nine')).toBe(true);
    expect(gh.read('feat/nine', 'kit/lib/nine.ts')).toBe(lines('nine'));
    expect(gh.calls.find(({ route }) => route.endsWith('/update-branch'))?.params.expected_head_sha).toBe(head);
  });

  it('leaves a feature branch already on the tip, and a pull request closed or into another base', async () => {
    const gh = withFeature({ 'kit/lib/nine.ts': lines('nine') });
    gh.push('feat/ten', { 'kit/lib/ten.ts': lines('ten') }, 'feat(ten)', 'main');
    gh.pull(61, 'main', 'feat/ten');
    gh.push('feat/eleven', { 'kit/lib/eleven.ts': lines('eleven') }, 'feat(eleven)', BRANCH);
    gh.pull(62, BRANCH, 'feat/eleven', 'closed');
    const kept = await keeper(gh.octokit).keepUp(at([{ prd: 9, pr: 60 }, { prd: 10, pr: 61 }, { prd: 11, pr: 62 }]));
    expect(kept.branch === 'rebased' ? kept.features.map(({ kept: what }) => what) : []).toEqual(['updated', 'skipped', 'skipped']);
    const again = await keeper(gh.octokit).keepUp(at([{ prd: 9, pr: 60 }]));
    expect(again).toMatchObject({ branch: 'in-step', features: [{ prd: 9, kept: 'in-step' }] });
  });

  it('names a feature branch that conflicts only in generated paths as one a rebuild settles, and leaves it', async () => {
    const gh = withTwoPrds();
    gh.push('feat/nine', { [BUNDLE]: lines('b1 built with PRD 9', 'b2', 'b3') }, 'feat(nine): built', BRANCH);
    gh.pull(60, BRANCH, 'feat/nine');
    gh.push('main', { [BUNDLE]: lines('b1 built on main', 'b2', 'b3') }, 'feat(x): y (#52)');
    const head = gh.head('feat/nine');
    const kept = await keeper(gh.octokit).keepUp(at([{ prd: 9, pr: 60 }]));
    expect(kept).toMatchObject({ branch: 'rebased', features: [{ prd: 9, pr: 60, kept: 'conflict', generated: true, files: [BUNDLE] }] });
    expect(gh.head('feat/nine')).toBe(head);
  });

  it('names the sources of a feature branch that conflicts in them, and leaves it', async () => {
    const gh = withTwoPrds();
    gh.push('feat/nine', { 'kit/lib/b.ts': lines('nine') }, 'feat(nine): b', BRANCH);
    gh.pull(60, BRANCH, 'feat/nine');
    gh.push('main', { 'kit/lib/b.ts': lines('main') }, 'fix(b): main (#51)');
    const kept = await keeper(gh.octokit).keepUp(at([{ prd: 9, pr: 60 }]));
    expect(kept).toMatchObject({ branch: 'rebased', features: [{ prd: 9, kept: 'conflict', generated: false, files: ['kit/lib/b.ts'] }] });
    expect(gh.branches().sort()).toEqual([BRANCH, 'feat/nine', 'main'].sort());
  });

  it('touches no feature branch while the mission branch itself cannot follow', async () => {
    const gh = withTwoPrds();
    gh.push('feat/nine', { 'kit/lib/nine.ts': lines('nine') }, 'feat(nine)', BRANCH);
    gh.pull(60, BRANCH, 'feat/nine');
    gh.push('main', { 'kit/lib/a.ts': lines('a1 on main', 'a2', 'a3', 'a4', 'a5', 'a6') }, 'fix(a) (#50)');
    const head = gh.head('feat/nine');
    expect((await keeper(gh.octokit).keepUp(at([{ prd: 9, pr: 60 }]))).branch).toBe('conflict');
    expect(gh.head('feat/nine')).toBe(head);
    expect(gh.calls.some(({ route }) => route.endsWith('/update-branch'))).toBe(false);
  });
});

describe('keptWaits: what a person must do for the branch to follow (PRD 2896 s5)', () => {
  const conflict = (generated: boolean, files: string[]): KeptUp => ({ branch: 'conflict', defaultBranch: 'main', title: 'feat(quotes): faster (#45)', generated, files });

  it('names nothing while the branch and its feature branches follow, or a rebuild settles a feature branch', () => {
    expect(keptWaits({ branch: 'in-step', defaultBranch: 'main', since: '', features: [] }, BRANCH)).toEqual([]);
    expect(keptWaits({ branch: 'rebased', defaultBranch: 'main', since: '', features: [{ prd: parsePrd(9), pr: parsePr(60), kept: 'conflict', generated: true, files: [BUNDLE] }] }, BRANCH)).toEqual([]);
  });

  it('names the PRD\'s commit and the files of a conflict on the branch, and that nothing changed', () => {
    const [words = ''] = keptWaits(conflict(false, ['kit/lib/a.ts', 'kit/lib/b.ts']), BRANCH);
    expect(words).toContain(`${BRANCH} cannot follow main`);
    expect(words).toContain('feat(quotes): faster (#45)');
    expect(words).toContain('kit/lib/a.ts, kit/lib/b.ts');
    expect(words).toContain('no branch changed');
  });

  it('says a conflict only in generated files on the branch is rebuilt by hand, naming them', () => {
    const [words = ''] = keptWaits(conflict(true, [BUNDLE]), BRANCH);
    expect(words).toContain(`only in generated files: ${BUNDLE}`);
    expect(words).toContain('rebuild');
  });

  it('names at most five files, and how many more', () => {
    const [words = ''] = keptWaits(conflict(false, ['a', 'b', 'c', 'd', 'e', 'f', 'g']), BRANCH);
    expect(words).toContain('a, b, c, d, e and 2 more');
  });

  it('names a feature branch whose sources conflict with the branch', () => {
    expect(keptWaits({ branch: 'rebased', defaultBranch: 'main', since: '', features: [{ prd: parsePrd(9), pr: parsePr(60), kept: 'conflict', generated: false, files: ['kit/lib/b.ts'] }] }, BRANCH)).toEqual([
      `PRD 9: #60 conflicts with ${BRANCH} in kit/lib/b.ts`,
    ]);
  });

  it('says why a branch is held', () => {
    expect(keptWaits({ branch: 'held', defaultBranch: 'main', why: 'it holds a merge commit' }, BRANCH)).toEqual([`${BRANCH} cannot follow main: it holds a merge commit`]);
  });
});
