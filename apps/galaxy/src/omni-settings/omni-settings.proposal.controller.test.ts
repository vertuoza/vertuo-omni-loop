import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { PlaybookProposedSchema } from './omni-settings.contract';
import { proposePlaybookPage, type PlaybookProposalDeps } from './omni-settings.controller';
import type { SettingsWorkspace } from './omni-settings.repository';
import { omniSettingsEditService, type PlaybookChange, type ProposeOutcome, type SettingsPullRequests } from './omni-settings.service';

// POST /api/omni-settings/proposal (PRD 2417, s7), with a fake database and a fake GitHub behind the
// real service: an owner's change answers the pull request opened; signed out is 401 before any read;
// a member who is not an owner, or one with no GitHub login, is 403 and nothing is written; each case
// where no pull request opens answers its reason in plain words; a GitHub failure is 502.

const ACME: SettingsWorkspace = { id: 'w-acme', githubOrg: 'acme', installation: 77, planRepo: 'plan', settingsRepository: null };
const REVIEW = '---\nform: review\nform-version: 1\nstate: filled\npoints-to: null\nevidence: []\ninvaded: null\nowner: null\n---\n\n# Review\n\nNew words.\n';
const OPENED: ProposeOutcome = { kind: 'opened', pullRequest: { number: parsePr(42), url: 'https://github.com/acme/plan/pull/42' } };

type World = {
  owner?: boolean;
  login?: string | null;
  signedIn?: boolean;
  workspace?: SettingsWorkspace;
  installation?: number | null;
  outcome?: ProposeOutcome | Error;
};

function world({ owner = true, login = 'ada', signedIn = true, workspace = ACME, installation = 77, outcome = OPENED }: World = {}, database = true) {
  const reads: string[] = [];
  const written: PlaybookChange[] = [];
  const logged: string[] = [];
  const store = {
    workspaceById: (id: string) => { reads.push(`workspace ${id}`); return Promise.resolve(id === workspace.id ? workspace : null); },
    isOwner: () => Promise.resolve(owner),
  };
  const github: SettingsPullRequests = {
    installationFor: () => Promise.resolve(installation),
    propose: (_installation, _repository, change) => {
      if (outcome instanceof Error) return Promise.reject(outcome);
      written.push(change);
      return Promise.resolve(outcome);
    },
  };
  const service = omniSettingsEditService(store, github, () => Date.parse('2026-10-23T12:00:00Z'));
  const deps: PlaybookProposalDeps = {
    session: database ? () => Promise.resolve(signedIn ? { login, service } : null) : null,
    installLink: 'https://github.com/apps/omni',
    log: (line) => { logged.push(line); },
  };
  return { deps, reads, written, logged };
}

const post = (deps: PlaybookProposalDeps, body: unknown = { workspace: 'w-acme', form: 'review', text: REVIEW }) =>
  proposePlaybookPage(new Request('https://omni.test/api/omni-settings/proposal', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }), deps);

describe('POST /api/omni-settings/proposal', () => {
  it('answers the pull request an owner\'s change opened in the settings repository', async () => {
    const { deps, written } = world();
    const res = await post(deps);
    expect(res.status).toBe(200);
    expect(PlaybookProposedSchema.parse(await res.json())).toEqual({ repository: 'acme/plan', pullRequest: { number: 42, url: 'https://github.com/acme/plan/pull/42' } });
    expect(written.map((change) => change.path)).toEqual(['.omni-loop/settings/playbook/review.md']);
    expect(written[0]?.body).toContain('@ada proposed this change');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses a member who is not an owner with 403, and writes nothing', async () => {
    const { deps, written } = world({ owner: false });
    const res = await post(deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only an owner of the workspace can change its playbook.' });
    expect(written).toEqual([]);
  });

  it('refuses a workspace the caller does not read the same way', async () => {
    const res = await post(world().deps, { workspace: 'w-other', form: 'review', text: REVIEW });
    expect(res.status).toBe(403);
  });

  it('refuses a caller with no GitHub login with 403, before any read', async () => {
    const { deps, reads } = world({ login: null });
    const res = await post(deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Sign in with GitHub to propose a change: the pull request names you.' });
    expect(reads).toEqual([]);
  });

  it('refuses a signed-out request with 401 before any read, and answers 503 with no database', async () => {
    const { deps, reads } = world({ signedIn: false });
    expect((await post(deps)).status).toBe(401);
    expect(reads).toEqual([]);
    expect((await post(world({}, false).deps)).status).toBe(503);
  });

  it('refuses a malformed body with 400', async () => {
    const { deps } = world();
    expect((await post(deps, 'not json')).status).toBe(400);
    expect((await post(deps, { workspace: 'w-acme', form: 'review' })).status).toBe(400);
    expect((await post(deps, { workspace: 'w-acme', form: '../x', text: REVIEW })).status).toBe(400);
    expect((await post(deps, { workspace: 'w-acme', form: 'review', text: '   ' })).status).toBe(400);
    expect((await post(deps, { workspace: 'w-acme', form: 'review', text: REVIEW, extra: 1 })).status).toBe(400);
  });

  it('refuses a text the next sync would skip with 422, saying why', async () => {
    const res = await post(world().deps, { workspace: 'w-acme', form: 'review', text: '# Review\n' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/^This text is not a review page the kit reads: /);
  });

  it('says why no pull request opened, in plain words', async () => {
    const words = async (w: World) => {
      const res = await post(world(w).deps);
      return { status: res.status, body: (await res.json()) as unknown };
    };
    expect(await words({ workspace: { ...ACME, planRepo: null } })).toEqual({
      status: 409, body: { error: 'This workspace has no settings repository: choose one on Settings › Playbook first.' },
    });
    expect(await words({ installation: null })).toEqual({
      status: 409, body: { error: 'The Omni app is not installed where acme/plan lives: install the Omni App: https://github.com/apps/omni' },
    });
    expect(await words({ outcome: { kind: 'unreachable' } })).toEqual({ status: 409, body: { error: 'The Omni app cannot reach acme/plan.' } });
    expect(await words({ outcome: { kind: 'unchanged' } })).toEqual({
      status: 409, body: { error: 'acme/plan already holds this text: there is nothing to propose.' },
    });
  });

  it('answers 502 when GitHub refuses a step, and logs it', async () => {
    const { deps, logged } = world({ outcome: new Error('GitHub answered 422 to opening the pull request on acme/plan') });
    const res = await post(deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'GitHub did not open the pull request. Try again in a moment.' });
    expect(logged).toEqual(['omni settings: GitHub answered 422 to opening the pull request on acme/plan']);
  });
});
