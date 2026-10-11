import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import type { ApprovalReply } from 'vertuo-omni-plan/kit/lib/approval/approval.ts';
import { sha256 } from 'vertuo-omni-plan/kit/lib/dossier/folder.ts';
import { readEnv } from '../env.ts';
import { appFunctions } from '../functions.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import {
  APPROVED_DEBOUNCE,
  APPROVED_FUNCTION_ID,
  APPROVED_RERUN_FUNCTION_ID,
  RERUN_DEBOUNCE,
  createApprovedCheck,
  createApprovedRerun,
  type AskJudge,
} from './approved-check.ts';
import { APPROVED_CHECK_EVENT, APPROVED_LABEL_EVENT } from './events.ts';

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

const PAGE = 'https://galaxy.test/prd/d-1612';

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

const checkEvent = (over: Params = {}) => ({
  name: OUTBOX_CHECK_EVENT,
  data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1', trigger: 'pull_request.synchronize', ...over },
});

async function run(github: ReturnType<typeof fakeGitHub>, ask: AskJudge, event = checkEvent()) {
  const fn = createApprovedCheck({ client: inngest, octokitFor: () => github.octokit, ask });
  return new InngestTestEngine({ function: fn, events: [event] }).execute();
}

describe('approved-check — which pull requests get the check', () => {
  it('a feature PR of a ◆ PRD gets one omni/approved check on its head', async () => {
    const github = fakeGitHub(widgets());
    const { result } = await run(github, answering(APPROVED));
    expect(github.checkRuns).toHaveLength(1);
    expect(github.checkRuns[0]).toMatchObject({ owner: 'acme', repo: 'widgets', name: 'omni/approved', head_sha: 'head1', status: 'completed' });
    expect(result).toMatchObject({ name: 'omni/approved', conclusion: 'success' });
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

  it('the check carries the name ci.approvedContext gives', async () => {
    const github = fakeGitHub(widgets({ config: 'kit: 1\nci:\n  approvedContext: gate/approved\n' }));
    await run(github, answering(APPROVED));
    expect(github.checkRuns[0]).toMatchObject({ name: 'gate/approved' });
  });

  it('a target PR whose body starts `Part of <owner/repo>#<n>` gets one, judged on the PRD’s feature PR', async () => {
    const plan = widgets();
    const repos: Record<string, FakeRepo> = {
      ...plan,
      'acme/api': {
        commits: { apibase: { '.omni-loop/config.yml': CONFIG }, apihead: {} },
        pulls: { 40: { base: { ref: 'main', sha: 'apibase' }, head: { ref: 'feat/approved-gate', sha: 'apihead' }, body: 'Part of acme/widgets#1612\n\nThe API side.' } },
      },
    };
    const asked: string[] = [];
    const github = fakeGitHub(repos);
    await run(github, (repo, prd) => { asked.push(`${repo}#${prd}`); return Promise.resolve({ reply: APPROVED }); },
      checkEvent({ repo: 'api', repository: 'acme/api', prNumber: 40, headSha: 'apihead' }));
    expect(asked).toEqual(['acme/widgets#1612']);
    expect(github.checkRuns).toHaveLength(1);
    expect(github.checkRuns[0]).toMatchObject({
      owner: 'acme',
      repo: 'api',
      head_sha: 'apihead',
      conclusion: 'success',
      details_url: `${PAGE}/attestation?head=head1`,
    });
  });

  it('a target PR whose PRD repository cannot be read is held, never failed', async () => {
    const github = fakeGitHub({
      'acme/api': {
        commits: { apibase: { '.omni-loop/config.yml': CONFIG } },
        pulls: { 40: { base: { ref: 'main', sha: 'apibase' }, head: { ref: 'feat/x', sha: 'apihead' }, body: 'Part of acme/private#7' } },
      },
    });
    await run(github, answering(APPROVED), checkEvent({ repo: 'api', repository: 'acme/api', prNumber: 40, headSha: 'apihead' }));
    expect(github.checkRuns[0]).toMatchObject({ conclusion: 'neutral', output: { title: 'server unreachable · held, not failed' } });
  });

  it('a body that only mentions `Part of` further down is no target PR', async () => {
    const github = fakeGitHub(widgets({ pull: { head: { ref: 'chore/x', sha: 'head1' }, body: 'Notes\n\nPart of acme/plan#7' } }));
    await run(github, answering(APPROVED));
    expect(github.checkRuns).toEqual([]);
  });
});

describe('approved-check — each state’s conclusion and title', () => {
  const titleOf = async (files: Files, ask: AskJudge) => {
    const github = fakeGitHub(widgets({ files }));
    await run(github, ask);
    return github.checkRuns[0];
  };

  it('approved: success, `approved by @<login> · <k>/<k> pinned files match`, Details on the attestation', async () => {
    expect(await titleOf(head({ [`${FOLDER}/voice.json`]: '{"rounds":2}' }), answering(APPROVED))).toMatchObject({
      conclusion: 'success',
      output: { title: 'approved by @pm · 2/2 pinned files match' },
      details_url: `${PAGE}/attestation?head=head1`,
    });
  });

  it('waiting: neutral, `waits for approval: <PRD page>`', async () => {
    expect(await titleOf(head(), answering({ url: PAGE, approval: null }))).toMatchObject({
      conclusion: 'neutral',
      output: { title: `waits for approval: ${PAGE}` },
      details_url: `${PAGE}/attestation?head=head1`,
    });
  });

  it('drifted content: failure, naming the file and `omni approval restore <n>`', async () => {
    const run = await titleOf(head({ [`${FOLDER}/plan.md`]: '# Plan\n\n| s1 | another kit |\n' }), answering(APPROVED));
    expect(run).toMatchObject({
      conclusion: 'failure',
      output: { title: '≠ plan.md · content · run omni approval restore 1612, or approve again' },
    });
  });

  it('drifted in spacing alone: failure, `· whitespace only`', async () => {
    const run = await titleOf(head({ [`${FOLDER}/spec.md`]: `${SPEC}\n\n` }), answering(APPROVED));
    expect(run).toMatchObject({ conclusion: 'failure', output: { title: '≠ spec.md · whitespace only · run omni approval restore 1612, or approve again' } });
  });

  it('held: neutral, `server unreachable · held, not failed`, with no Details link', async () => {
    const run = await titleOf(head(), () => Promise.resolve({ held: 'galaxy answered 401' }));
    expect(run).toMatchObject({ conclusion: 'neutral', output: { title: 'server unreachable · held, not failed' } });
    expect(run).not.toHaveProperty('details_url');
  });

  it('an approver who left the workspace is held, never failed', async () => {
    const reply = { ...APPROVED, approval: { ...APPROVED.approval, approver: { login: 'gone', member: false } } } as ApprovalReply;
    expect(await titleOf(head(), answering(reply))).toMatchObject({ conclusion: 'neutral' });
  });
});

describe('approved-check — when it runs', () => {
  it('runs on the outbox check’s event and on its own rerun event, debounced per pull request', () => {
    const fn = createApprovedCheck({ client: inngest, octokitFor: () => fakeGitHub({}).octokit, ask: answering(APPROVED) });
    expect(fn.id()).toBe(APPROVED_FUNCTION_ID);
    expect(APPROVED_DEBOUNCE.key).toBe('event.data.repository + "#" + string(event.data.prNumber)');
  });

  it('is served by the app, beside its rerun', () => {
    const { approvedCheck, approvedRerun } = appFunctions(readEnv({}));
    expect(approvedCheck.id()).toBe(APPROVED_FUNCTION_ID);
    expect(approvedRerun.id()).toBe(APPROVED_RERUN_FUNCTION_ID);
  });

  it('on the rerun event, reads the pull request’s head fresh', async () => {
    const github = fakeGitHub(widgets());
    await run(github, answering(APPROVED), { name: APPROVED_CHECK_EVENT, data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12 } } as never);
    expect(github.checkRuns[0]).toMatchObject({ head_sha: 'head1' });
  });
});

describe('approved-rerun — the approved label added or removed', () => {
  it('reruns the check on every open pull request of the PRD: its feature PR and its target PRs', async () => {
    const repos = widgets();
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
    expect(events.map((e) => [e.name, e.data.repository, e.data.prNumber, e.data.trigger])).toEqual([
      [APPROVED_CHECK_EVENT, 'acme/widgets', 12, 'issues.unlabeled'],
      [APPROVED_CHECK_EVENT, 'acme/api', 40, 'issues.unlabeled'],
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
