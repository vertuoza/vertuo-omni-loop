import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { missionAnswers } from './settle.ts';

// The App settles a high item the fleet's committee answered (PRD 2896 s10): one commit on the feature branch, its ledger appended
// as answered by the fleet and its item file deleted; never on a pull request into the default branch.

const HEAD = 'a'.repeat(40);
const BRANCH = 'mission/12-faster-quotes';
const FEATURE = 'feat/quotes';
const OUTBOX = '.omni-loop/delivery/outbox/0007-quotes';
const ITEM = 's1-01-colour';

const item = (rank: string): string =>
  [
    '---', `id: ${ITEM}`, 'prd: 7', 'slice: s1', `rank: ${rank}`, 'bears-on: none', 'raised: 2027-01-22', 'wave: 1', '---', '',
    '## The question, in plain words', '', 'Which colour?', '',
    '## The decision, in plain words', '', 'Blue.', '',
    '## The options, in plain words', '', 'A. Blue (built).', 'B. Red.', '',
    ...['What I had to decide', 'What I did meanwhile', 'What it costs to change later', 'What I could not know'].flatMap((heading) => [`## ${heading}`, '', '(author) The colour.', '']),
  ].join('\n');

/** A GitHub holding `files` at the head of pull request 45 on `FEATURE`; every call kept, every write answered. */
function github({ files = {}, pull = {} }: { files?: Record<string, string>; pull?: Record<string, unknown> } = {}) {
  const calls: { route: string; params: Record<string, unknown> }[] = [];
  const treeOf = (dir: string) => {
    const prefix = dir === '' ? '' : `${dir}/`;
    const names = new Map<string, 'blob' | 'tree'>();
    for (const path of Object.keys(files)) {
      if (!path.startsWith(prefix)) continue;
      const [name = '', ...rest] = path.slice(prefix.length).split('/');
      names.set(name, rest.length > 0 ? 'tree' : 'blob');
    }
    return [...names].map(([name, type]) => ({ path: name, mode: type === 'tree' ? '040000' : '100644', type, sha: `${type}:${prefix}${name}`, size: type === 'blob' ? (files[`${prefix}${name}`] ?? '').length : null }));
  };
  const recursiveOf = (dir: string) =>
    Object.keys(files)
      .filter((path) => path.startsWith(`${dir}/`))
      .map((path) => ({ path: path.slice(dir.length + 1), mode: '100644', type: 'blob', sha: `blob:${path}`, size: (files[path] ?? '').length }));
  const routes: Record<string, (params: Record<string, unknown>) => unknown> = {
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': () => ({
      html_url: 'https://github.com/acme/widgets/pull/45',
      state: 'open',
      base: { ref: BRANCH, repo: { default_branch: 'main' } },
      head: { ref: FEATURE, sha: HEAD },
      ...pull,
    }),
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': (params) => {
      const sha = String(params.tree_sha);
      const dir = sha === HEAD ? '' : sha.replace(/^tree:/, '');
      return { truncated: false, tree: params.recursive === '1' ? recursiveOf(dir) : treeOf(dir) };
    },
    'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': (params) => ({ content: Buffer.from(files[String(params.file_sha).replace(/^blob:/, '')] ?? '').toString('base64'), encoding: 'base64' }),
    'GET /repos/{owner}/{repo}/git/commits/{commit_sha}': () => ({ sha: HEAD, tree: { sha: 'tree-0' } }),
    'POST /repos/{owner}/{repo}/git/trees': () => ({ sha: 'tree-1' }),
    'POST /repos/{owner}/{repo}/git/commits': () => ({ sha: 'b'.repeat(40) }),
    'PATCH /repos/{owner}/{repo}/git/refs/{ref}': () => ({ object: { sha: 'b'.repeat(40) } }),
  };
  const octokit = {
    request: (route: string, params: Record<string, unknown> = {}) => {
      calls.push({ route, params });
      const answer = routes[route];
      return answer ? Promise.resolve({ data: answer(params) }) : Promise.reject(new Error(`unexpected ${route}`));
    },
  };
  return { calls, answers: missionAnswers({ octokitFor: () => octokit }) };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };
const verdicts = [
  { role: 'pm', answer: 'yes', sentence: 'In scope.' },
  { role: 'architect', answer: 'yes', sentence: 'Reversible.' },
  { role: 'reviewer', answer: 'yes', sentence: 'Tested.' },
];
const at = { installation: 7, repo: 'acme/widgets', prd: parsePrd(7), pr: parsePr(45), item: ITEM, answer: { fleet: 'night-shift', option: 'A', branch: BRANCH, at: '2027-01-22T09:00:00.000Z', verdicts } };

describe('missionAnswers.settle', () => {
  it('commits the ledger and the item\'s deletion on the feature branch, in the fleet\'s name', async () => {
    const gh = github({ files: { ...CONFIG, [`${OUTBOX}/${ITEM}.md`]: item('high') } });
    expect(await gh.answers.settle(at)).toEqual({ ok: true, settled: true });
    const tree = gh.calls.find(({ route }) => route === 'POST /repos/{owner}/{repo}/git/trees')?.params.tree as { path: string; content?: string; sha?: null }[];
    expect(tree.map(({ path, sha }) => [path, sha === null ? 'deleted' : 'written'])).toEqual([[`${OUTBOX}/settled.md`, 'written'], [`${OUTBOX}/${ITEM}.md`, 'deleted']]);
    expect(tree[0]?.content).toContain('- Approved by: fleet night-shift');
    expect(tree[0]?.content).toContain('- Channel: feature pull request #45');
    expect(gh.calls.find(({ route }) => route === 'POST /repos/{owner}/{repo}/git/commits')?.params.message).toBe(`docs(outbox): ${ITEM} answered by fleet night-shift\n\nPart of #7`);
    expect(gh.calls.find(({ route }) => route === 'PATCH /repos/{owner}/{repo}/git/refs/{ref}')?.params).toMatchObject({ ref: `heads/${FEATURE}`, force: false });
  });

  it('writes nothing for an item no longer open: it was settled already', async () => {
    const gh = github({ files: { ...CONFIG, [`${OUTBOX}/settled.md`]: '# Settled\n' } });
    expect(await gh.answers.settle(at)).toEqual({ ok: true, settled: false });
    expect(gh.calls.some(({ route }) => route.startsWith('POST') || route.startsWith('PATCH'))).toBe(false);
  });

  it('refuses a pull request into the default branch before reading anything else: a person answers its items', async () => {
    const gh = github({ files: { ...CONFIG, [`${OUTBOX}/${ITEM}.md`]: item('high') }, pull: { base: { ref: 'main', repo: { default_branch: 'main' } } } });
    expect(await gh.answers.settle(at)).toEqual({ ok: false, why: '#45 targets main, the default branch: a person answers its items' });
    expect(gh.calls.map(({ route }) => route)).toEqual(['GET /repos/{owner}/{repo}/pulls/{pull_number}']);
  });

  it('refuses a closed pull request, and an item the kit will not settle', async () => {
    expect(await github({ pull: { state: 'closed' } }).answers.settle(at)).toEqual({ ok: false, why: '#45 is closed' });
    const human = github({ files: { ...CONFIG, [`${OUTBOX}/${ITEM}.md`]: item('human-action') } });
    expect(await human.answers.settle(at)).toEqual({ ok: false, why: `${ITEM}: the fleet answers a high item only, not a human-action one.` });
  });
});
