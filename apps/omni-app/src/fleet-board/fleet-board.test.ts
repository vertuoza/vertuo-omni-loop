// The `fleet-board` function (PRD 2530 s2), run on its event against a faked GitHub GraphQL and an
// in-memory store with the database's semantics: the author's fleet with a board gets the card and the note
// `Added #<n> · <owner>/<repo>`; no fleet, or no board, calls and writes nothing; GitHub's refusals write
// their notes and are never retried; two workspaces on one installation each use their own fleet. No test
// calls GitHub or Supabase.
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { httpError } from '../../test/github-replay.ts';
import { inngest } from '../inngest-client.ts';
import { FLEET_BOARD_EVENT, type FleetBoardData } from './events.ts';
import { createFleetBoard, FLEET_BOARD_FUNCTION_ID } from './fleet-board.ts';
import type { GraphqlOctokit } from './github.ts';
import type { Fleet, FleetBoardStore } from './store.ts';

const BOARD = 'https://github.com/orgs/acme/projects/7';
const NOW = '2026-10-27T10:30:00.000Z';

const DATA: FleetBoardData = {
  installationId: 4242,
  owner: 'acme',
  repo: 'widgets',
  repository: 'acme/widgets',
  prNumber: parsePr(28),
  nodeId: 'PR_kwDO28',
  url: 'https://github.com/acme/widgets/pull/28',
  author: 'Ada-L',
};

// ---- An in-memory store: workspaces tracking a repository on an installation, their players and fleets ----

type Workspace = { id: string; installationId: number; tracked: string[]; players: Record<string, string | null>; fleets: Record<string, Fleet & { retired?: boolean; note?: string; notedAt?: string }> };

function memoryStore(workspaces: Workspace[]) {
  const calls: string[] = [];
  const store: FleetBoardStore = {
    workspaces({ installationId, repository }) {
      calls.push(`workspaces ${String(installationId)} ${repository}`);
      return Promise.resolve(workspaces.filter((ws) => ws.installationId === installationId && ws.tracked.includes(repository.toLowerCase())).map((ws) => ws.id));
    },
    fleetOf({ workspace, login }) {
      calls.push(`fleet ${workspace} ${login}`);
      const ws = workspaces.find((one) => one.id === workspace);
      const team = Object.entries(ws?.players ?? {}).find(([player]) => player.toLowerCase() === login.toLowerCase())?.[1];
      const fleet = team ? ws?.fleets[team] : undefined;
      return Promise.resolve(fleet && !fleet.retired ? { name: fleet.name, projectUrl: fleet.projectUrl } : null);
    },
    note({ workspace, fleet, projectUrl, note, at }) {
      calls.push(`note ${workspace} ${fleet} ${note}`);
      const kept = workspaces.find((one) => one.id === workspace)?.fleets[fleet];
      if (!kept || kept.projectUrl !== projectUrl) return Promise.resolve({ noted: false });
      kept.note = note;
      kept.notedAt = at;
      return Promise.resolve({ noted: true });
    },
  };
  return { store, calls };
}

const fleet = (name: string, projectUrl: string | null = BOARD) => ({ name, projectUrl });

/** One workspace on installation 4242 tracking acme/widgets, Ada in the fleet `core`. */
const acme = (over: Partial<Workspace> = {}): Workspace => ({
  id: 'ws-acme',
  installationId: 4242,
  tracked: ['acme/widgets'],
  players: { 'ada-l': 'core', grace: null },
  fleets: { core: fleet('core') },
  ...over,
});

// ---- A faked GitHub GraphQL: an organization's projects, and the cards added -----------------------------

/** A GraphQL error as `octokit.graphql` throws it: the answer's errors, each with its type. */
const graphqlError = (type: string, message: string) => Object.assign(new Error(message), { name: 'GraphqlResponseError', errors: [{ type, message }] });

type Github = { octokit: GraphqlOctokit; added: { project: string; content: string }[]; queries: number };

function fakeGithub({ projects = { 'acme/7': 'PVT_acme7' }, refuse }: { projects?: Record<string, string>; refuse?: { at: 'read' | 'add'; error: Error } } = {}): Github {
  const github: Github = {
    added: [],
    queries: 0,
    octokit: {
      graphql(query, variables = {}) {
        github.queries += 1;
        if (query.includes('addProjectV2ItemById')) {
          if (refuse?.at === 'add') return Promise.reject(refuse.error);
          const project = String(variables.project);
          const content = String(variables.content);
          github.added.push({ project, content });
          return Promise.resolve({ addProjectV2ItemById: { item: { id: `PVTI_${content}` } } });
        }
        if (refuse?.at === 'read') return Promise.reject(refuse.error);
        const id = projects[`${String(variables.org).toLowerCase()}/${String(variables.number)}`];
        if (!id) return Promise.reject(graphqlError('NOT_FOUND', `Could not resolve to a ProjectV2 with the number ${String(variables.number)}.`));
        return Promise.resolve({ organization: { projectV2: { id } } });
      },
    },
  };
  return github;
}

/** The function on `store` and `github`, run once on `data`. */
async function run({ store, github, data = DATA }: { store: FleetBoardStore; github: Github; data?: FleetBoardData }) {
  const fn = createFleetBoard({ client: inngest, octokitFor: () => github.octokit, store, now: () => new Date(NOW) });
  return new InngestTestEngine({ function: fn, events: [{ name: FLEET_BOARD_EVENT, data } as never] }).execute();
}

describe('fleet-board — a loop pull request lands on its author’s fleet’s board (PRD 2530 s2)', () => {
  it('runs on the fleet board event, retrying a GitHub error twice', () => {
    const fn = createFleetBoard({ client: inngest, octokitFor: () => fakeGithub().octokit, store: null });
    expect(fn.opts).toMatchObject({ id: FLEET_BOARD_FUNCTION_ID, triggers: [{ event: FLEET_BOARD_EVENT }], retries: 2 });
  });

  it('adds the pull request to the board of its author’s fleet, matched case-insensitively, and notes it', async () => {
    const ws = acme();
    const { store, calls } = memoryStore([ws]);
    const github = fakeGithub();
    const { result, error } = await run({ store, github });

    expect(error).toBeUndefined();
    expect(github.added).toEqual([{ project: 'PVT_acme7', content: 'PR_kwDO28' }]);
    expect(ws.fleets.core).toMatchObject({ note: 'Added #28 · acme/widgets', notedAt: NOW });
    expect(calls).toEqual(['workspaces 4242 acme/widgets', 'fleet ws-acme Ada-L', 'note ws-acme core Added #28 · acme/widgets']);
    expect(result).toEqual({ pull: 'acme/widgets#28', workspaces: [{ workspace: 'ws-acme', fleet: 'core', note: 'Added #28 · acme/widgets' }] });
  });

  it('calls nothing and writes nothing when the author is in no fleet', async () => {
    const ws = acme();
    const { store, calls } = memoryStore([ws]);
    const github = fakeGithub();
    const { result, error } = await run({ store, github, data: { ...DATA, author: 'grace' } });

    expect(error).toBeUndefined();
    expect(github.queries).toBe(0);
    expect(calls.filter((call) => call.startsWith('note'))).toEqual([]);
    expect(result).toEqual({ pull: 'acme/widgets#28', workspaces: [{ workspace: 'ws-acme', skipped: 'the author is in no active fleet' }] });
  });

  it('calls nothing and writes nothing when the author is in no workspace at all, or the fleet is retired', async () => {
    const retired = acme({ fleets: { core: { ...fleet('core'), retired: true } } });
    for (const [ws, author] of [[acme(), 'stranger'], [retired, 'Ada-L']] as const) {
      const { store, calls } = memoryStore([ws]);
      const github = fakeGithub();
      expect((await run({ store, github, data: { ...DATA, author } })).error).toBeUndefined();
      expect(github.queries).toBe(0);
      expect(calls.filter((call) => call.startsWith('note'))).toEqual([]);
    }
  });

  it('calls nothing and writes nothing when the fleet has no board', async () => {
    const ws = acme({ fleets: { core: fleet('core', null) } });
    const { store, calls } = memoryStore([ws]);
    const github = fakeGithub();
    const { result } = await run({ store, github });

    expect(github.queries).toBe(0);
    expect(calls.filter((call) => call.startsWith('note'))).toEqual([]);
    expect(ws.fleets.core?.note).toBeUndefined();
    expect(result).toEqual({ pull: 'acme/widgets#28', workspaces: [{ workspace: 'ws-acme', fleet: 'core', skipped: 'the fleet has no board' }] });
  });

  it('calls nothing when no workspace tracks the repository on this installation', async () => {
    const { store, calls } = memoryStore([acme({ installationId: 9 }), acme({ id: 'ws-other', tracked: ['acme/other'] })]);
    const github = fakeGithub();
    const { result } = await run({ store, github });

    expect(github.queries).toBe(0);
    expect(calls).toEqual(['workspaces 4242 acme/widgets']);
    expect(result).toEqual({ pull: 'acme/widgets#28', workspaces: [] });
  });

  it('writes `Not added: ask an org admin` when GitHub refuses the App the organization’s projects, and is not retried', async () => {
    const refusals = [
      { at: 'read' as const, error: graphqlError('FORBIDDEN', 'Resource not accessible by integration') },
      { at: 'add' as const, error: graphqlError('FORBIDDEN', 'Resource not accessible by integration') },
      { at: 'add' as const, error: httpError(403, 'Resource not accessible by integration') },
      { at: 'read' as const, error: graphqlError('INSUFFICIENT_SCOPES', 'Your token has not been granted the required scopes') },
    ];
    for (const refuse of refusals) {
      const ws = acme();
      const { store } = memoryStore([ws]);
      const github = fakeGithub({ refuse });
      const { result, error } = await run({ store, github });

      expect(error, refuse.error.message).toBeUndefined();
      expect(github.added).toEqual([]);
      expect(ws.fleets.core).toMatchObject({ note: 'Not added: ask an org admin', notedAt: NOW });
      expect(result).toEqual({ pull: 'acme/widgets#28', workspaces: [{ workspace: 'ws-acme', fleet: 'core', note: 'Not added: ask an org admin' }] });
    }
  });

  it('writes `Not added: no such project` when the project or its organization does not exist, and is not retried', async () => {
    const missing = [
      { github: fakeGithub({ projects: {} }) },
      { github: fakeGithub({ refuse: { at: 'read', error: graphqlError('NOT_FOUND', "Could not resolve to an Organization with the login of 'acme'.") } }) },
      { github: fakeGithub({ refuse: { at: 'add', error: httpError(404, 'Not Found') } }) },
    ];
    for (const { github } of missing) {
      const ws = acme();
      const { store } = memoryStore([ws]);
      const { error } = await run({ store, github });

      expect(error).toBeUndefined();
      expect(github.added).toEqual([]);
      expect(ws.fleets.core?.note).toBe('Not added: no such project');
    }
  });

  it('writes `Not added: no such project` for a board link that is not an organization project, calling nothing', async () => {
    const ws = acme({ fleets: { core: fleet('core', 'https://github.com/users/ada/projects/1') } });
    const { store } = memoryStore([ws]);
    const github = fakeGithub();
    await run({ store, github });

    expect(github.queries).toBe(0);
    expect(ws.fleets.core?.note).toBe('Not added: no such project');
  });

  it('fails the run, writing no note, on a rate limit or a GitHub error of 5xx, so Inngest retries it', async () => {
    const failures = [httpError(502, 'Bad Gateway'), graphqlError('RATE_LIMITED', 'API rate limit exceeded'), httpError(403, 'API rate limit exceeded for installation')];
    for (const failure of failures) {
      const ws = acme();
      const { store } = memoryStore([ws]);
      const { error } = await run({ store, github: fakeGithub({ refuse: { at: 'add', error: failure } }) });

      expect(String((error as Error | undefined)?.message), failure.message).toContain(failure.message);
      expect(ws.fleets.core?.note).toBeUndefined();
    }
  });

  it('handles two workspaces on one installation each with its own fleet and board', async () => {
    const first = acme();
    const second = acme({ id: 'ws-beta', players: { 'ADA-L': 'ops' }, fleets: { ops: fleet('ops', 'https://github.com/orgs/acme/projects/9'), core: fleet('core', null) } });
    const third = acme({ id: 'ws-gamma', players: {}, fleets: {} });
    const { store } = memoryStore([first, second, third]);
    const github = fakeGithub({ projects: { 'acme/7': 'PVT_acme7', 'acme/9': 'PVT_acme9' } });
    const { result } = await run({ store, github });

    expect(github.added).toEqual([
      { project: 'PVT_acme7', content: 'PR_kwDO28' },
      { project: 'PVT_acme9', content: 'PR_kwDO28' },
    ]);
    expect(first.fleets.core?.note).toBe('Added #28 · acme/widgets');
    expect(second.fleets.ops?.note).toBe('Added #28 · acme/widgets');
    expect(second.fleets.core?.note).toBeUndefined();
    expect(result).toEqual({
      pull: 'acme/widgets#28',
      workspaces: [
        { workspace: 'ws-acme', fleet: 'core', note: 'Added #28 · acme/widgets' },
        { workspace: 'ws-beta', fleet: 'ops', note: 'Added #28 · acme/widgets' },
        { workspace: 'ws-gamma', skipped: 'the author is in no active fleet' },
      ],
    });
  });

  it('skips the run with no database, calling nothing', async () => {
    const github = fakeGithub();
    const fn = createFleetBoard({ client: inngest, octokitFor: () => github.octokit, store: null });
    const { result, error } = await new InngestTestEngine({ function: fn, events: [{ name: FLEET_BOARD_EVENT, data: DATA } as never] }).execute();

    expect(error).toBeUndefined();
    expect(result).toEqual({ pull: 'acme/widgets#28', skipped: 'no database to read the fleets from' });
    expect(github.queries).toBe(0);
  });

  it('refuses an event out of shape by its field, calling nothing', async () => {
    const { store, calls } = memoryStore([acme()]);
    const github = fakeGithub();
    const { error } = await run({ store, github, data: { ...DATA, nodeId: '' } });

    expect(String((error as Error | undefined)?.message)).toContain('nodeId');
    expect(calls).toEqual([]);
  });
});
