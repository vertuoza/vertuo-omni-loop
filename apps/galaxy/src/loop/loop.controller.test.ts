import { describe, expect, it } from 'vitest';
import { parseCommentId, parseIssue, parsePr, type IssueNumber, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import {
  ChangeDetailSchema, ChangesSchema, CommentsSchema, IssueDetailSchema, IssuesSchema, LoopRefusalSchema, MAX_CHANGES, MAX_ISSUES,
  type Change, type ChangesQuery, type Comment, type CommentsQuery, type Issue, type IssuesQuery,
} from './loop.contract';
import { readChange, readChanges, readComments, readIssue, readIssues, type LoopReadsDeps } from './loop.controller';
import { HostSpent, HostUnreadable, loopService, type LoopHost } from './loop.service';

// The loop's read routes (PRD 1665, s1 and s2), with a fake host and a fake
// workspace check behind the real service: the sign-in is checked first, the workspace before any call
// to the host, each answer is in the contract's shape, and each refusal is in plain words.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test' };
const INSTALL = 'https://github.com/apps/omni-loop/installations/new';
const TOKEN = 'ghs_never_shown';
const REFILL = Date.parse('2026-10-12T11:00:00Z');

const change = (number: number, more: Partial<Change> = {}): Change => ({
  number: parsePr(number), title: `Change ${number}`, head: `feat/x--s${number}`, base: 'feat/x', state: 'open',
  createdAt: new Date(Date.UTC(2026, 9, 1) + number * 60_000).toISOString(), updatedAt: '2026-10-11T08:00:00Z',
  mergedAt: null, labels: [], body: '', url: `https://github.com/acme/widgets/pull/${number}`, author: 'ada', ...more,
});

const issue = (number: number, more: Partial<Issue> = {}): Issue => ({
  number: parseIssue(number), title: `Issue ${number}`, state: 'open', labels: ['omni:bug'], body: `PRD #${number}`, ...more,
});

const comment = (id: number): Comment => ({
  id: parseCommentId(id), author: 'ada', body: `Comment ${id}`, createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T09:00:00Z',
});

const REVIEW = { checks: [{ name: 'test', state: 'success' as const }], mergeable: true, threads: [] };

type World = {
  owned?: string[];
  changes?: Change[];
  issues?: Issue[];
  /** Each issue's or change's comments, by its number; a number not here is no issue nor change. */
  comments?: Record<number, Comment[]>;
  /** The host throws this on every read. */
  failure?: Error;
  database?: boolean;
  app?: boolean;
};

function world({ owned = ['acme/widgets'], changes = [change(1), change(2)], issues = [issue(3), issue(5)], comments = { 2: [comment(1)] }, failure, database = true, app = true }: World = {}) {
  const calls: string[] = [];
  const logged: string[] = [];
  const host: LoopHost = {
    changes(query: ChangesQuery) {
      calls.push(`host changes ${JSON.stringify(query)}`);
      return failure ? Promise.reject(failure) : Promise.resolve(changes);
    },
    change(repo: string, number: PrNumber) {
      calls.push(`host change ${repo} ${number}`);
      if (failure) return Promise.reject(failure);
      const found = changes.find((c) => c.number === number);
      return Promise.resolve(found ? { ...found, lastCommitAt: '2026-10-11T09:30:00Z', files: ['a.ts'], review: REVIEW } : null);
    },
    comments(query: CommentsQuery) {
      calls.push(`host comments ${JSON.stringify(query)}`);
      return failure ? Promise.reject(failure) : Promise.resolve(comments[query.on] ?? null);
    },
    issues(query: IssuesQuery) {
      calls.push(`host issues ${JSON.stringify(query)}`);
      return failure ? Promise.reject(failure) : Promise.resolve(issues);
    },
    issue(repo: string, number: IssueNumber) {
      calls.push(`host issue ${repo} ${number}`);
      if (failure) return Promise.reject(failure);
      const found = issues.find((i) => i.number === number);
      return Promise.resolve(found ? { ...found, comments: comments[number] ?? [], closedBy: [parsePr(9)] } : null);
    },
  };
  const workspaces = {
    workspaceOf(person: string, repo: string) {
      calls.push(`workspace ${person} ${repo}`);
      return Promise.resolve(owned.includes(repo) ? { workspace: 'w-acme' } : { refusal: 'No workspace you belong to lists it; install the Omni App' });
    },
  };
  const deps: LoopReadsDeps = {
    connect: database
      ? () => ({ auth: { getUser: (jwt: string) => Promise.resolve(jwt === 'ada-token' ? { data: { user: ADA }, error: null } : { data: { user: null }, error: { status: 401 } }) } })
      : null,
    service: app ? loopService(workspaces, host) : null,
    installLink: INSTALL,
    log: (line) => logged.push(line),
  };
  const request = (path: string, token: string | null) =>
    new Request(`https://omni.example/api/loop/${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const list = async (query: string, token: string | null = 'ada-token') => {
    const response = await readChanges(request(`changes${query}`, token), deps);
    return { status: response.status, body: (await response.json()) as unknown, headers: response.headers };
  };
  const one = async (number: string, query: string, token: string | null = 'ada-token') => {
    const response = await readChange(request(`changes/${number}${query}`, token), number, deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  /** A read of one of s2's routes: `comments`, `issues`, or `issues/<n>`. */
  const read = async (path: string, token: string | null = 'ada-token') => {
    const req = request(path, token);
    const [route, number] = new URL(req.url).pathname.replace('/api/loop/', '').split('/');
    const response = route === 'comments' ? await readComments(req, deps)
      : number === undefined ? await readIssues(req, deps) : await readIssue(req, number, deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  return { list, one, read, calls, logged };
}

const errorOf = (body: unknown) => LoopRefusalSchema.parse(body).error;

describe('GET /api/loop/changes', () => {
  it('answers the repository\'s changes in the contract\'s shape, newest first', async () => {
    const { list } = world();
    const { status, body } = await list('?repo=acme/widgets&base=feat/x&state=all');
    expect(status).toBe(200);
    expect(ChangesSchema.parse(body).changes.map((c) => c.number)).toEqual([2, 1]);
  });

  it('passes base, head, label and state to the host, open by default', async () => {
    const { list, calls } = world();
    await list('?repo=acme/widgets&head=feat/x--s1&label=omni:sub');
    expect(calls.at(-1)).toBe(`host changes ${JSON.stringify({ repo: 'acme/widgets', head: 'feat/x--s1', label: 'omni:sub', state: 'open' })}`);
  });

  it('answers at most 200', async () => {
    const { list } = world({ changes: Array.from({ length: 250 }, (_, i) => change(i + 1)) });
    const { body } = await list('?repo=acme/widgets&state=all');
    expect(ChangesSchema.parse(body).changes).toHaveLength(MAX_CHANGES);
  });

  it('refuses a signed-out call with 401, before anything is read', async () => {
    const { list, calls } = world();
    expect((await list('?repo=acme/widgets', null)).status).toBe(401);
    expect((await list('?repo=acme/widgets', 'expired')).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('refuses a repository outside the caller\'s workspace with 403, before any call to the host', async () => {
    const { list, calls } = world();
    const { status, body } = await list('?repo=other/thing');
    expect(status).toBe(403);
    expect(errorOf(body)).toBe(`other/thing is not in your workspace: No workspace you belong to lists it; install the Omni App: ${INSTALL}`);
    expect(calls).toEqual([`workspace ${ADA.id} other/thing`]);
  });

  it('answers 424 with the install link when the app cannot read the repository', async () => {
    const { list, logged } = world({ failure: new HostUnreadable('acme/widgets', 'the app is not installed there') });
    const { status, body } = await list('?repo=acme/widgets');
    expect(status).toBe(424);
    expect(errorOf(body)).toBe(`The Omni app cannot read acme/widgets: ${INSTALL}`);
    expect(logged).toHaveLength(1);
  });

  it('answers 429 saying when the budget refills', async () => {
    const { list } = world({ failure: new HostSpent('acme/widgets', REFILL, 'GitHub') });
    const { status, body, headers } = await list('?repo=acme/widgets');
    expect(status).toBe(429);
    expect(errorOf(body)).toBe('GitHub\'s budget for acme/widgets is spent until 2026-10-12T11:00:00.000Z.');
    expect(Number(headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  });

  it('answers 500 on any other failure, logging its message, never a token', async () => {
    const { list, logged } = world({ failure: new Error('GitHub answered 502 to /pulls') });
    const { status, body } = await list('?repo=acme/widgets');
    expect(status).toBe(500);
    expect(errorOf(body)).toBe('The loop could not be read. Try again.');
    expect(logged).toEqual(['loop: GitHub answered 502 to /pulls']);
    expect(JSON.stringify(body) + logged.join('')).not.toContain(TOKEN);
  });

  it.each([
    ['no repository', ''],
    ['a malformed repository', '?repo=acme'],
    ['an unknown state', '?repo=acme/widgets&state=closed'],
    ['an unknown parameter', '?repo=acme/widgets&author=ada'],
    ['a repeated parameter', '?repo=acme/widgets&base=a&base=b'],
  ])('refuses %s with 400', async (_, query) => {
    const { list, calls } = world();
    expect((await list(query)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('answers 503 without a database, and without an app to read with', async () => {
    expect((await world({ database: false }).list('?repo=acme/widgets')).status).toBe(503);
    expect((await world({ app: false }).list('?repo=acme/widgets')).status).toBe(503);
  });
});

describe('GET /api/loop/changes/<n>', () => {
  it('answers one change with lastCommitAt and files', async () => {
    const { one } = world();
    const { status, body } = await one('2', '?repo=acme/widgets');
    expect(status).toBe(200);
    expect(ChangeDetailSchema.parse(body)).toMatchObject({ number: 2, lastCommitAt: '2026-10-11T09:30:00Z', files: ['a.ts'] });
  });

  it('answers 404 for a number the repository has no change by', async () => {
    const { one } = world();
    const { status, body } = await one('9', '?repo=acme/widgets');
    expect(status).toBe(404);
    expect(errorOf(body)).toBe('No change 9 in acme/widgets.');
  });

  it('checks the workspace before asking the host', async () => {
    const { one, calls } = world();
    expect((await one('2', '?repo=other/thing')).status).toBe(403);
    expect(calls).toEqual([`workspace ${ADA.id} other/thing`]);
  });

  it('refuses a signed-out call first', async () => {
    const { one, calls } = world();
    expect((await one('x', '', null)).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it.each([['0', '?repo=acme/widgets'], ['2a', '?repo=acme/widgets'], ['2', ''], ['2', '?repo=acme/widgets&state=all']])('refuses %s%s with 400', async (number, query) => {
    expect((await world().one(number, query)).status).toBe(400);
  });

  it('answers 424 and 429 as the list does', async () => {
    expect((await world({ failure: new HostUnreadable('acme/widgets', 'refused') }).one('2', '?repo=acme/widgets')).status).toBe(424);
    expect((await world({ failure: new HostSpent('acme/widgets', REFILL, 'GitHub') }).one('2', '?repo=acme/widgets')).status).toBe(429);
  });

  it('answers the change\'s review in the contract\'s shape', async () => {
    const { body } = await world().one('2', '?repo=acme/widgets');
    expect(ChangeDetailSchema.parse(body).review).toEqual(REVIEW);
  });
});

describe('GET /api/loop/comments', () => {
  it('answers the conversation of an issue or a change', async () => {
    const { read, calls } = world();
    const { status, body } = await read('comments?repo=acme/widgets&on=2');
    expect(status).toBe(200);
    expect(CommentsSchema.parse(body)).toEqual({ comments: [comment(1)] });
    expect(calls.at(-1)).toBe(`host comments ${JSON.stringify({ repo: 'acme/widgets', on: 2 })}`);
  });

  it('answers 404 for a number with neither', async () => {
    const { status, body } = await world().read('comments?repo=acme/widgets&on=7');
    expect(status).toBe(404);
    expect(errorOf(body)).toBe('No issue or change 7 in acme/widgets.');
  });

  it.each([
    ['no number', '?repo=acme/widgets'],
    ['a malformed number', '?repo=acme/widgets&on=0'],
    ['an unknown parameter', '?repo=acme/widgets&on=2&page=2'],
    ['a repeated number', '?repo=acme/widgets&on=2&on=3'],
  ])('refuses %s with 400', async (_, query) => {
    const { read, calls } = world();
    expect((await read(`comments${query}`)).status).toBe(400);
    expect(calls).toEqual([]);
  });
});

describe('GET /api/loop/issues', () => {
  it('answers the repository\'s issues, newest first, passing label and state, open by default', async () => {
    const { read, calls } = world();
    const { status, body } = await read('issues?repo=acme/widgets&label=omni:bug');
    expect(status).toBe(200);
    expect(IssuesSchema.parse(body).issues.map((i) => i.number)).toEqual([5, 3]);
    expect(calls.at(-1)).toBe(`host issues ${JSON.stringify({ repo: 'acme/widgets', label: 'omni:bug', state: 'open' })}`);
  });

  it('answers at most 200', async () => {
    const { body } = await world({ issues: Array.from({ length: 250 }, (_, i) => issue(i + 1)) }).read('issues?repo=acme/widgets&state=all');
    expect(IssuesSchema.parse(body).issues).toHaveLength(MAX_ISSUES);
  });

  it.each([
    ['an unknown state', '?repo=acme/widgets&state=merged'],
    ['a base', '?repo=acme/widgets&base=main'],
    ['no repository', ''],
  ])('refuses %s with 400', async (_, query) => {
    expect((await world().read(`issues${query}`)).status).toBe(400);
  });
});

describe('GET /api/loop/issues/<n>', () => {
  it('answers one issue with its comments and what closes it', async () => {
    const { status, body } = await world({ comments: { 5: [comment(4)] } }).read('issues/5?repo=acme/widgets');
    expect(status).toBe(200);
    expect(IssueDetailSchema.parse(body)).toEqual({ ...issue(5), comments: [comment(4)], closedBy: [9] });
  });

  it('answers 404 for a number with no issue', async () => {
    const { status, body } = await world().read('issues/4?repo=acme/widgets');
    expect(status).toBe(404);
    expect(errorOf(body)).toBe('No issue 4 in acme/widgets.');
  });

  it.each([['0', '?repo=acme/widgets'], ['x', '?repo=acme/widgets'], ['5', ''], ['5', '?repo=acme/widgets&state=all']])('refuses %s%s with 400', async (number, query) => {
    expect((await world().read(`issues/${number}${query}`)).status).toBe(400);
  });
});

describe('the comments and issues routes: the refusals every read shares', () => {
  const PATHS = ['comments?repo=acme/widgets&on=2', 'issues?repo=acme/widgets', 'issues/5?repo=acme/widgets'];

  it.each(PATHS)('%s refuses a signed-out call with 401, before anything is read', async (path) => {
    const { read, calls } = world();
    expect((await read(path, null)).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it.each(PATHS)('%s refuses a repository outside the workspace with 403, before any call to the host', async (path) => {
    const { read, calls } = world({ owned: [] });
    expect((await read(path)).status).toBe(403);
    expect(calls).toEqual([`workspace ${ADA.id} acme/widgets`]);
  });

  it.each(PATHS)('%s answers 424, 429 and 500 as the changes do', async (path) => {
    expect((await world({ failure: new HostUnreadable('acme/widgets', 'refused') }).read(path)).status).toBe(424);
    expect((await world({ failure: new HostSpent('acme/widgets', REFILL, 'GitHub') }).read(path)).status).toBe(429);
    expect((await world({ failure: new Error('GitHub answered 502') }).read(path)).status).toBe(500);
  });

  it.each(PATHS)('%s answers 503 without a database, and without an app', async (path) => {
    expect((await world({ database: false }).read(path)).status).toBe(503);
    expect((await world({ app: false }).read(path)).status).toBe(503);
  });
});
