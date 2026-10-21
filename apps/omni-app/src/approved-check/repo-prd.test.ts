// `approved-check` on a ◆ PRD of a repository, and `approved-rerun` (PRD 1612, folded into PRD 1548's
// check): a feature PR or a `Part of <owner/repo>#<n>` target PR, judged by the kit's one judge at the
// head, its reading said in the check's one set of states (./state.ts). Against a stubbed GitHub of
// several repositories; galaxy's judge is a function the test hands in.
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import type { ApprovalReply } from 'omni-loop/kit/lib/approval/approval.ts';
import { sha256 } from 'omni-loop/kit/lib/dossier/folder.ts';
import { readEnv } from '../env.ts';
import { appFunctions } from '../functions.ts';
import { APPROVED_CHECK_EVENT, APPROVED_LABEL_EVENT, inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import {
  APPROVED_DEBOUNCE,
  APPROVED_FUNCTION_ID,
  APPROVED_RERUN_FUNCTION_ID,
  RERUN_DEBOUNCE,
  createApprovedCheck,
  createApprovedRerun,
} from './approved-check.ts';
import type { AskJudge } from './repo-reading.ts';

/** A request's parameters, as a unit hands them to `octokit.request`. */
type Params = Record<string, unknown>;

/** A commit: its files, path to text. */
type Files = Record<string, string>;

type FakePull = { base: { ref: string; sha: string }; head: { ref: string; sha: string }; body?: string };

/** One repository of the double: its commits by sha, its pull requests by number. */
type FakeRepo = { commits: Record<string, Files>; pulls?: Record<number, FakePull> };

type SearchItem = { number: number; body: string; repository_url: string; pull_request: object };

/**
 * A stubbed GitHub of several repositories: commits are in-memory files, read through trees and blobs
 * (a tree's sha is `<commit>:<dir>`, a blob's `<commit>:<path>`). A repository it does not hold answers
 * 404, as GitHub does to a token that cannot read it. It records every request and every check run.
 */
function fakeGitHub(repos: Record<string, FakeRepo>, search: SearchItem[] = []) {
  const requests: ({ route: string } & Params)[] = [];
  const checkRuns: Params[] = [];
  const notFound = () => Object.assign(new Error('Not Found'), { status: 404 });
  const found = <T>(value: T | undefined): T => {
    if (value === undefined) throw notFound();
    return value;
  };

  const repoOf = (params: Params): FakeRepo => {
    const repo = repos[`${String(params.owner)}/${String(params.repo)}`];
    if (!repo) throw notFound();
    return repo;
  };

  function tree(files: Files, commit: string, dir: string, recursive: boolean) {
    const prefix = dir ? `${dir}/` : '';
    const seen = new Map<string, { path: string; mode: string; type: string; sha: string; size?: number }>();
    for (const [path, text] of Object.entries(files)) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length).split('/');
      const upTo = recursive ? rest.length : 1;
      for (let depth = 1; depth <= upTo; depth += 1) {
        const relative = rest.slice(0, depth).join('/');
        const full = `${prefix}${relative}`;
        const leaf = depth === rest.length;
        seen.set(relative, leaf
          ? { path: relative, mode: '100644', type: 'blob', sha: `${commit}:${full}`, size: text.length }
          : { path: relative, mode: '040000', type: 'tree', sha: `${commit}:${full}` });
      }
    }
    return [...seen.values()];
  }

  /** Each route the double answers, by its name. */
  const routes: Record<string, (params: Params) => unknown> = {
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': (params) => {
      const [commit = '', dir = ''] = String(params.tree_sha).split(':');
      const files = found(repoOf(params).commits[commit]);
      return { tree: tree(files, commit, dir, params.recursive === '1'), truncated: false };
    },
    'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': (params) => {
      const [commit = '', path = ''] = String(params.file_sha).split(':');
      return { content: Buffer.from(found(repoOf(params).commits[commit]?.[path])).toString('base64'), encoding: 'base64' };
    },
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': (params) =>
      ({ ...found(repoOf(params).pulls?.[Number(params.pull_number)]), number: params.pull_number, labels: [] }),
    'GET /repos/{owner}/{repo}/pulls': (params) =>
      params.page === 1 ? Object.entries(repoOf(params).pulls ?? {}).map(([number, pull]) => ({ number: Number(number), body: pull.body ?? null })) : [],
    'GET /search/issues': () => ({ items: search }),
    'POST /repos/{owner}/{repo}/check-runs': (params) => {
      const created = { id: 900 + checkRuns.length, ...params };
      checkRuns.push(created);
      return created;
    },
  };

  function answer(route: string, params: Params): { data: unknown } {
    requests.push({ route, ...params });
    const handler = routes[route];
    if (!handler) throw new Error(`fake GitHub: unexpected route ${route}`);
    return { data: handler(params) };
  }

  const octokit = {
    request: (route: string, params: Params = {}) => new Promise<{ data: unknown }>((resolve) => { resolve(answer(route, params)); }),
  };
  return { octokit, requests, checkRuns };
}

const FOLDER = '.omni-loop/delivery/inbox/1612-approved-gate';
const SPEC = `---\nprd: 1612\ntitle: The gate\nphase0: server\n---\n\n# The gate\n`;
const PLAN = '# Plan\n\n| s1 | the kit |\n';
const CONFIG = 'kit: 1\n';

const head = (over: Files = {}): Files => ({ [`${FOLDER}/spec.md`]: SPEC, [`${FOLDER}/plan.md`]: PLAN, ...over });

const GALAXY = 'https://galaxy.test';
const DOSSIER = '0d5e0c6e-1612-4a1b-8c2d-3e4f5a6b7c8d';
const PAGE = `${GALAXY}/prd/${DOSSIER}`;
const DETAILS = `${PAGE}#approval`;

const pinned = (kind: string, file: string, content: string) => ({ kind, path: `${FOLDER}/${file}`, sha256: sha256(content), versionId: `v-${kind}`, content });

const APPROVED: ApprovalReply = {
  url: PAGE,
  approval: {
    approver: { login: 'pm', member: true },
    approvedAt: '2026-10-11T09:00:00Z',
    files: [pinned('spec', 'spec.md', SPEC), pinned('plan', 'plan.md', PLAN), pinned('voice', 'voice.json', '{}')],
  },
};

const answering = (reply: ApprovalReply): AskJudge => () => Promise.resolve({ reply });

/** The widgets repository: its base carries the loop's config, its pull request 12 the feature branch. */
function widgets(over: { files?: Files; pull?: Partial<FakePull>; config?: string | null } = {}): Record<string, FakeRepo> {
  const base: Files = over.config === null ? {} : { '.omni-loop/config.yml': over.config ?? CONFIG };
  return {
    'acme/widgets': {
      commits: { base1: base, head1: over.files ?? head() },
      pulls: { 12: { base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/approved-gate', sha: 'head1' }, body: 'Closes #1612', ...over.pull } },
    },
  };
}

/** The api repository: a target PR, 40, whose body is `body`. */
const api = (body: string): FakeRepo => ({
  commits: { apibase: { '.omni-loop/config.yml': CONFIG }, apihead: {} },
  pulls: { 40: { base: { ref: 'main', sha: 'apibase' }, head: { ref: 'feat/approved-gate', sha: 'apihead' }, body } },
});

const checkEvent = (over: Params = {}) => ({
  name: OUTBOX_CHECK_EVENT,
  data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1', trigger: 'pull_request.synchronize', ...over },
});

async function run(github: ReturnType<typeof fakeGitHub>, ask: AskJudge, event: { name: string; data: Params } = checkEvent()) {
  const fn = createApprovedCheck({ client: inngest, octokitFor: () => github.octokit, readRecord: null, galaxyUrl: GALAXY, ask });
  return new InngestTestEngine({ function: fn, events: [event] as never }).execute();
}

describe('approved-check, a ◆ PRD of a repository — which pull requests get the check', () => {
  it('a feature PR of a ◆ PRD gets one omni/approved check on its head', async () => {
    const github = fakeGitHub(widgets());
    const { result } = await run(github, answering(APPROVED));
    expect(github.checkRuns).toHaveLength(1);
    expect(github.checkRuns[0]).toMatchObject({ owner: 'acme', repo: 'widgets', name: 'omni/approved', head_sha: 'head1', status: 'completed' });
    expect(result).toMatchObject({ name: 'omni/approved', prd: '1612', state: 'building', conclusion: 'success' });
  });

  it('a ◇ PRD’s feature PR (its spec without phase0: server) gets none, and galaxy is never asked', async () => {
    const asked: string[] = [];
    const github = fakeGitHub(widgets({ files: head({ [`${FOLDER}/spec.md`]: '---\nprd: 1612\n---\n# x\n' }) }));
    const { result } = await run(github, (repo) => { asked.push(repo); return Promise.resolve({ reply: APPROVED }); });
    expect(github.checkRuns).toEqual([]);
    expect(asked).toEqual([]);
    expect(result).toMatchObject({ posted: false });
  });

  it('a sub-PR (its base is the feature branch) gets none', async () => {
    const github = fakeGitHub(widgets({ pull: { base: { ref: 'feat/approved-gate', sha: 'base1' }, head: { ref: 'feat/approved-gate--s3', sha: 'head1' } } }));
    await run(github, answering(APPROVED));
    expect(github.checkRuns).toEqual([]);
  });

  it('a pull request naming no PRD gets none', async () => {
    const github = fakeGitHub(widgets({ pull: { head: { ref: 'chore/bump', sha: 'head1' }, body: 'Bumps a dependency.' } }));
    await run(github, answering(APPROVED));
    expect(github.checkRuns).toEqual([]);
  });

  it('a feature branch whose topic has no PRD folder gets none', async () => {
    const github = fakeGitHub(widgets({ pull: { head: { ref: 'feat/other', sha: 'head1' } } }));
    await run(github, answering(APPROVED));
    expect(github.checkRuns).toEqual([]);
  });

  it('a repository without the loop’s config gets nothing at all (PRD 359)', async () => {
    const github = fakeGitHub(widgets({ config: null }));
    await run(github, answering(APPROVED));
    expect(github.checkRuns).toEqual([]);
  });

  it('the check carries the name ci.approvedContext gives, and a null one posts none', async () => {
    const named = fakeGitHub(widgets({ config: 'kit: 1\nci:\n  approvedContext: gate/approved\n' }));
    await run(named, answering(APPROVED));
    expect(named.checkRuns[0]).toMatchObject({ name: 'gate/approved' });
    const off = fakeGitHub(widgets({ config: 'kit: 1\nci:\n  approvedContext: null\n' }));
    await run(off, answering(APPROVED));
    expect(off.checkRuns).toEqual([]);
  });

  it('a target PR whose body starts `Part of <owner/repo>#<n>` gets one, judged on the PRD’s feature PR', async () => {
    const asked: string[] = [];
    const github = fakeGitHub({ ...widgets(), 'acme/api': api('Part of acme/widgets#1612\n\nThe API side.') });
    await run(github, (repo, prd) => { asked.push(`${repo}#${prd}`); return Promise.resolve({ reply: APPROVED }); },
      checkEvent({ repo: 'api', repository: 'acme/api', prNumber: 40, headSha: 'apihead' }));
    expect(asked).toEqual(['acme/widgets#1612']);
    expect(github.checkRuns).toHaveLength(1);
    expect(github.checkRuns[0]).toMatchObject({ owner: 'acme', repo: 'api', head_sha: 'apihead', conclusion: 'success', details_url: DETAILS });
  });

  it('a target PR whose PRD repository cannot be read is held, never failed', async () => {
    const github = fakeGitHub({ 'acme/api': api('Part of acme/private#7') });
    await run(github, answering(APPROVED), checkEvent({ repo: 'api', repository: 'acme/api', prNumber: 40, headSha: 'apihead' }));
    expect(github.checkRuns[0]).toMatchObject({ conclusion: 'neutral', output: { title: 'held · server unreachable · held, not failed' } });
  });

  it('a body that only mentions `Part of` further down is no target PR', async () => {
    const github = fakeGitHub(widgets({ pull: { head: { ref: 'chore/x', sha: 'head1' }, body: 'Notes\n\nPart of acme/plan#7' } }));
    await run(github, answering(APPROVED));
    expect(github.checkRuns).toEqual([]);
  });

  it('a body naming a product PRD is that product PRD’s, never asked of galaxy’s judge', async () => {
    const asked: string[] = [];
    const github = fakeGitHub(widgets({ pull: { body: 'Closes #1612\n\nPart of mobile-12' } }));
    await run(github, (repo) => { asked.push(repo); return Promise.resolve({ reply: APPROVED }); });
    expect(asked).toEqual([]);
    expect(github.checkRuns[0]).toMatchObject({ conclusion: 'neutral', output: { title: expect.stringMatching(/^held · server unreachable since /) as unknown } });
  });
});

describe('approved-check, a ◆ PRD of a repository — each state, named once (PRD 1548’s states)', () => {
  const checkOf = async (files: Files, ask: AskJudge) => {
    const github = fakeGitHub(widgets({ files }));
    await run(github, ask);
    return github.checkRuns[0];
  };

  it('approved is building: success, `building · <k> of <k> pinned`, Details on the PRD page’s approval', async () => {
    expect(await checkOf(head({ [`${FOLDER}/voice.json`]: '{"rounds":2}' }), answering(APPROVED))).toMatchObject({
      conclusion: 'success',
      output: { title: 'building · 3 of 3 pinned' },
      details_url: DETAILS,
    });
  });

  it('waiting is pending: failure, `pending · PRD <n> waits for approval`', async () => {
    expect(await checkOf(head(), answering({ url: PAGE, approval: null }))).toMatchObject({
      conclusion: 'failure',
      output: { title: 'pending · PRD 1612 waits for approval' },
      details_url: DETAILS,
    });
  });

  it('drifted content: failure, naming the file and the head, its summary `omni approval restore <n>`', async () => {
    const check = await checkOf(head({ [`${FOLDER}/plan.md`]: '# Plan\n\n| s1 | another kit |\n' }), answering(APPROVED));
    expect(check).toMatchObject({ conclusion: 'failure', output: { title: 'drifted · ≠ plan.md in head1 · content' } });
    expect((check?.output as { summary: string }).summary).toContain('Run `omni approval restore 1612`');
  });

  it('drifted in spacing alone: failure, `· whitespace only`', async () => {
    const check = await checkOf(head({ [`${FOLDER}/spec.md`]: `${SPEC}\n\n` }), answering(APPROVED));
    expect(check).toMatchObject({ conclusion: 'failure', output: { title: 'drifted · ≠ spec.md in head1 · whitespace only' } });
  });

  it('held: neutral, `held · server unreachable · held, not failed`, with no Details link', async () => {
    const check = await checkOf(head(), () => Promise.resolve({ held: 'galaxy answered 401' }));
    expect(check).toMatchObject({ conclusion: 'neutral', output: { title: 'held · server unreachable · held, not failed' } });
    expect(check).not.toHaveProperty('details_url');
  });

  it('an approver who left the workspace is refused: failure, as for a product PRD', async () => {
    const reply = { ...APPROVED, approval: { ...APPROVED.approval, approver: { login: 'gone', member: false } } } as ApprovalReply;
    expect(await checkOf(head(), answering(reply))).toMatchObject({ conclusion: 'failure', output: { title: 'refused · approver gone is not a workspace member' } });
  });
});

describe('approved-check — when it runs', () => {
  it('runs on the outbox check’s event and on its own, debounced per pull request', () => {
    const fn = createApprovedCheck({ client: inngest, octokitFor: () => fakeGitHub({}).octokit, readRecord: null, galaxyUrl: GALAXY, ask: answering(APPROVED) });
    expect(fn.id()).toBe(APPROVED_FUNCTION_ID);
    expect(APPROVED_DEBOUNCE.key).toBe('event.data.repository + "#" + string(event.data.prNumber)');
  });

  it('is served by the app, beside its rerun', () => {
    const { approvedCheck, approvedRerun } = appFunctions(readEnv({}));
    expect(approvedCheck.id()).toBe(APPROVED_FUNCTION_ID);
    expect(approvedRerun.id()).toBe(APPROVED_RERUN_FUNCTION_ID);
  });

  it('on its own event, posts on the head the event names', async () => {
    const github = fakeGitHub(widgets());
    await run(github, answering(APPROVED), { name: APPROVED_CHECK_EVENT, data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1' } });
    expect(github.checkRuns[0]).toMatchObject({ head_sha: 'head1' });
  });
});

describe('approved-rerun — the approved label added or removed', () => {
  it('reruns the check on every open pull request of the PRD, its feature PR and its target PRs, each at its head', async () => {
    const repos: Record<string, FakeRepo> = { ...widgets(), 'acme/api': api('Part of acme/widgets#1612\n\nAPI.') };
    const widgetsRepo = repos['acme/widgets'];
    if (widgetsRepo?.pulls) widgetsRepo.pulls[13] = { base: { ref: 'main', sha: 'base1' }, head: { ref: 'chore/x', sha: 'h' }, body: 'Closes #16120' };
    const github = fakeGitHub(repos, [
      { number: 40, body: 'Part of acme/widgets#1612\n\nAPI.', repository_url: 'https://api.github.com/repos/acme/api', pull_request: {} },
      { number: 41, body: 'Mentions Part of acme/widgets#1612 later', repository_url: 'https://api.github.com/repos/acme/web', pull_request: {} },
      { number: 42, body: 'Part of acme/widgets#16120', repository_url: 'https://api.github.com/repos/acme/web', pull_request: {} },
    ]);
    const fn = createApprovedRerun({ client: inngest, octokitFor: () => github.octokit });
    const { result, ctx } = await new InngestTestEngine({
      function: fn,
      events: [{ name: APPROVED_LABEL_EVENT, data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prd: 1612, trigger: 'issues.unlabeled' } }],
      steps: [{ id: 'rerun', handler: () => ({ ids: ['e1', 'e2'] }) }],
    }).execute();
    expect(result).toEqual({ rerun: ['acme/widgets#12', 'acme/api#40'] });
    const [[id, events]] = ctx.step.sendEvent.mock.calls as [[string, { name: string; data: Params }[]]];
    expect(id).toBe('rerun');
    expect(events.map((e) => [e.name, e.data.repository, e.data.prNumber, e.data.headSha, e.data.trigger])).toEqual([
      [APPROVED_CHECK_EVENT, 'acme/widgets', 12, 'head1', 'issues.unlabeled'],
      [APPROVED_CHECK_EVENT, 'acme/api', 40, 'apihead', 'issues.unlabeled'],
    ]);
    const searched = github.requests.find((r) => r.route === 'GET /search/issues');
    expect(searched?.q).toBe('"Part of acme/widgets#1612" is:pr is:open user:acme');
  });

  it('sends nothing when the PRD has no open pull request', async () => {
    const github = fakeGitHub({ 'acme/widgets': { commits: {} } });
    const fn = createApprovedRerun({ client: inngest, octokitFor: () => github.octokit });
    const { result } = await new InngestTestEngine({
      function: fn,
      events: [{ name: APPROVED_LABEL_EVENT, data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prd: 1612 } }],
    }).execute();
    expect(result).toEqual({ rerun: [] });
  });

  it('is debounced per PRD', () => {
    expect(RERUN_DEBOUNCE.key).toBe('event.data.repository + "#" + string(event.data.prd)');
  });
});
