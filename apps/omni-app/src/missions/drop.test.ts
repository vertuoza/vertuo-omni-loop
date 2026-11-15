// A person drops a PRD from the mission branch (PRD 2896 s7, criterion 11), against a GitHub over a real git repository
// (./git.fake.ts): every replay, merge and conflict below is git's own.
import { afterEach, describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { gitGithub } from './git.fake.ts';
import { missionDrops } from './drop.ts';

const BRANCH = 'mission/12-faster-quotes';
const lines = (...words: string[]): string => `${words.join('\n')}\n`;
const A = lines('a1', 'a2', 'a3', 'a4', 'a5', 'a6');

let open: ReturnType<typeof gitGithub>[] = [];
afterEach(() => {
  for (const one of open) one.done();
  open = [];
});

/**
 * main, a mission branch with three PRDs squash-joined: #45 (a1), #46 (a docs file), #47 (a6, the same file as #45, other
 * lines), and each one's feature branch and closed pull request, merged into the mission branch.
 */
function repo() {
  const gh = gitGithub({ 'kit/lib/a.ts': A });
  open.push(gh);
  const cut = gh.head('main') ?? '';
  gh.push(BRANCH, { 'kit/lib/a.ts': lines('a1 by 45', 'a2', 'a3', 'a4', 'a5', 'a6') }, 'feat(quotes): faster (#45)', cut);
  gh.push(BRANCH, { 'docs/quotes.md': lines('quotes') }, 'docs(quotes): the guide (#46)');
  gh.push(BRANCH, { 'kit/lib/a.ts': lines('a1 by 45', 'a2', 'a3', 'a4', 'a5', 'a6 by 47') }, 'feat(quotes): the end (#47)');
  for (const [n, file] of [[45, 'kit/lib/a.ts'], [46, 'docs/quotes.md'], [47, 'kit/lib/z.ts']] as const) {
    gh.push(`feat/prd-${String(n)}`, { [file]: lines(`work of ${String(n)}`) }, `work of ${String(n)}`, cut);
    gh.pull(n, BRANCH, `feat/prd-${String(n)}`, 'closed', `Title of ${String(n)}`, `Body of ${String(n)}.`);
  }
  return gh;
}

const drops = (gh: ReturnType<typeof repo>) => missionDrops({ octokitFor: () => gh.octokit });
const at = (...prds: [number, number][]) => ({ installation: 7, repo: 'acme/widgets', branch: BRANCH, prds: prds.map(([prd, pr]) => ({ prd: parsePrd(prd), pr: parsePr(pr) })) });

describe('missionDrops.drop', () => {
  it('removes one PRD\'s commit by rebase: the others keep their commits, in order, and their changes', async () => {
    const gh = repo();
    const main = gh.head('main');
    const dropped = await drops(gh).drop(at([46, 46]));
    expect(dropped).toMatchObject({ ok: true, removed: [46], absent: [] });
    expect(gh.subjects(BRANCH)).toEqual(['feat(quotes): faster (#45)', 'feat(quotes): the end (#47)']);
    expect(gh.parentCounts(BRANCH, 'main')).toEqual([1, 1]);
    expect(gh.read(BRANCH, 'docs/quotes.md')).toBeNull();
    expect(gh.read(BRANCH, 'kit/lib/a.ts')).toBe(lines('a1 by 45', 'a2', 'a3', 'a4', 'a5', 'a6 by 47'));
    // The default branch is never written, and the scratch branch is gone.
    expect(gh.head('main')).toBe(main);
    expect(gh.branches()).not.toContain(`${BRANCH}--drop`);
  });

  it('takes a PRD that leads the branch and its later changes to the same file apart cleanly', async () => {
    const gh = repo();
    expect(await drops(gh).drop(at([45, 45]))).toMatchObject({ ok: true, removed: [45] });
    expect(gh.subjects(BRANCH)).toEqual(['docs(quotes): the guide (#46)', 'feat(quotes): the end (#47)']);
    expect(gh.read(BRANCH, 'kit/lib/a.ts')).toBe(lines('a1', 'a2', 'a3', 'a4', 'a5', 'a6 by 47'));
  });

  it('removes several PRDs in one replay, and leaves an empty branch when all go', async () => {
    const gh = repo();
    expect(await drops(gh).drop(at([45, 45], [47, 47]))).toMatchObject({ ok: true, removed: [45, 47] });
    expect(gh.subjects(BRANCH)).toEqual(['docs(quotes): the guide (#46)']);
    expect(await drops(gh).drop(at([46, 46]))).toMatchObject({ ok: true });
    expect(gh.head(BRANCH)).toBe(gh.head('main'));
  });

  it('opens each feature pull request again against the mission branch, with its title and body and why', async () => {
    const gh = repo();
    const dropped = await drops(gh).drop(at([46, 46]));
    if (!dropped.ok) throw new Error(dropped.why);
    const [one] = dropped.reopened;
    expect(one).toMatchObject({ prd: 46, why: null, url: expect.stringContaining('/pull/') as string });
    const made = gh.pullOf(Number(one?.pr));
    expect(made).toMatchObject({ base: BRANCH, head: 'feat/prd-46', state: 'open', title: 'Title of 46' });
    expect(made?.body).toContain('Body of 46.');
    expect(made?.body).toContain('PRD 46 was dropped from `mission/12-faster-quotes` (was #46)');
  });

  it('cuts a feature branch again, at the head its pull request had, when it went with the merge', async () => {
    const gh = repo();
    const head = gh.head('feat/prd-46');
    gh.remove('feat/prd-46');
    const dropped = await drops(gh).drop(at([46, 46]));
    expect(dropped).toMatchObject({ ok: true, removed: [46] });
    expect(gh.head('feat/prd-46')).toBe(head);
    expect(dropped.ok ? dropped.reopened[0] : null).toMatchObject({ prd: 46, why: null });
  });

  it('changes nothing and names the commit when a PRD kept was built on the one dropped', async () => {
    const gh = repo();
    gh.push(BRANCH, { 'kit/lib/a.ts': lines('a1 by 48', 'a2', 'a3', 'a4', 'a5', 'a6 by 47') }, 'feat(quotes): on the first line (#48)');
    const head = gh.head(BRANCH);
    const dropped = await drops(gh).drop(at([45, 45]));
    expect(dropped).toMatchObject({ ok: false });
    expect(dropped.ok ? '' : dropped.why).toContain('on the first line (#48)');
    expect(gh.head(BRANCH)).toBe(head);
    expect(gh.branches()).not.toContain(`${BRANCH}--drop`);
  });

  it('takes the dependent PRD with it when both are dropped', async () => {
    const gh = repo();
    gh.push(BRANCH, { 'kit/lib/a.ts': lines('a1 by 48', 'a2', 'a3', 'a4', 'a5', 'a6 by 47') }, 'feat(quotes): on the first line (#48)');
    gh.push('feat/prd-48', { 'kit/lib/y.ts': 'y\n' }, 'work of 48', 'main');
    gh.pull(48, BRANCH, 'feat/prd-48', 'closed', 'Title of 48');
    expect(await drops(gh).drop(at([45, 45], [48, 48]))).toMatchObject({ ok: true, removed: [45, 48] });
    expect(gh.subjects(BRANCH)).toEqual(['docs(quotes): the guide (#46)', 'feat(quotes): the end (#47)']);
  });

  it('reads a PRD whose commit is not on the branch as dropped already: nothing is rebased or reopened for it', async () => {
    const gh = repo();
    const head = gh.head(BRANCH);
    const dropped = await drops(gh).drop(at([49, 49]));
    expect(dropped).toEqual({ ok: true, removed: [], absent: [49], reopened: [] });
    expect(gh.head(BRANCH)).toBe(head);
  });

  it('says so when the mission branch is not cut', async () => {
    const gh = repo();
    expect(await missionDrops({ octokitFor: () => gh.octokit }).drop({ ...at([46, 46]), branch: 'mission/99-none' })).toEqual({ ok: false, why: 'mission/99-none is not cut' });
  });

  it('refuses the default branch before any write', async () => {
    const gh = repo();
    await expect(drops(gh).drop({ ...at([46, 46]), branch: 'main' })).rejects.toThrow();
    expect(gh.calls.filter(({ route }) => !route.startsWith('GET'))).toEqual([]);
  });

  it('tells a pull request GitHub refuses to open again, and still drops the commit', async () => {
    const gh = repo();
    // A feature branch with nothing beyond the mission branch has nothing to open a pull request for.
    gh.branch('feat/prd-46', 'main');
    const dropped = await drops(gh).drop(at([46, 46]));
    expect(dropped).toMatchObject({ ok: true, removed: [46] });
    expect(dropped.ok ? dropped.reopened[0] : null).toMatchObject({ prd: 46, pr: null, url: null, why: expect.stringContaining('GitHub refused to open #46 again') as string });
    expect(gh.subjects(BRANCH)).not.toContain('docs(quotes): the guide (#46)');
  });
});
