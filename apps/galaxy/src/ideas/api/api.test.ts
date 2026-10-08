// The ideas board's half of the terminal's contract (PRD 1246, s2): POST /api/ideas and GET /api/ideas,
// with the sign-in and the ideas port faked. Each test checks the validation, the response's shape, or a
// refusal, in the words the kit prints after `refused (<status>):`.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Board, Idea } from '../model';
import { addIdea, listIdeas, MAX_ADD_BYTES, type IdeasApiDeps } from './api';
import { IdeasRefusal, type IdeasPort, type NewIdeaRow } from './store';

const ORIGIN = 'https://omni.example';

const Answer = z.looseObject({
  error: z.string().optional(),
  id: z.string().optional(),
  url: z.string().optional(),
  repo: z.string().optional(),
  ideas: z.array(z.looseObject({ title: z.string(), lane: z.string(), votes: z.number() })).optional(),
});

const idea = (n: number, over: Partial<Idea> = {}): Idea => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  title: `Idea ${n}`, pitch: 'A pitch.', lane: 'later', prd: null,
  created_at: `2026-10-0${n}T09:00:00+00:00`, votes: 0, voted: false, archived: false, ...over,
});

/** A fake board store: who may add to which repository, and the boards each reader sees. */
function world({ database = true, member = true, boards = {}, failAdd }: {
  database?: boolean; member?: boolean; boards?: Record<string, Board | null>; failAdd?: Error;
} = {}) {
  const added: (NewIdeaRow & { by: string })[] = [];
  const port = (token: string): IdeasPort => ({
    add(row) {
      if (failAdd) return Promise.reject(failAdd);
      if (!member) return Promise.reject(new IdeasRefusal(403, `No workspace of yours lists ${row.repo}.`));
      added.push({ ...row, by: token });
      return Promise.resolve({ id: '00000000-0000-4000-8000-0000000000a1' });
    },
    board: (repo) => Promise.resolve(boards[repo] ?? null),
  });
  const deps: IdeasApiDeps = {
    connect: database ? (token) => ({
      auth: { getUser: () => Promise.resolve(token === 'ada-token' ? { data: { user: { id: 'ada', email: null } }, error: null } : { data: { user: null }, error: new Error('bad') }) },
      ideas: port(token),
    }) : null,
  };
  const post = async (body: unknown, { token = 'ada-token', raw }: { token?: string | null; raw?: string } = {}) => {
    const response = await addIdea(new Request(`${ORIGIN}/api/ideas`, {
      method: 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }), deps);
    return { status: response.status, body: Answer.parse(await response.json()) };
  };
  const get = async (query: string, { token = 'ada-token' }: { token?: string | null } = {}) => {
    const response = await listIdeas(new Request(`${ORIGIN}/api/ideas${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    return { status: response.status, body: Answer.parse(await response.json()) };
  };
  return { added, post, get };
}

/** An error that names `field`. */
const naming = (field: string): unknown => expect.stringContaining(field);

const IDEA = { repo: 'Acme/Widgets', title: '  Improve the HUD ', pitch: 'More useful facts.', lane: 'now' };

describe('POST /api/ideas: a member adds an idea', () => {
  it('answers 201 with the idea\'s id and its board\'s link, the repository lower-cased and the text trimmed', async () => {
    const w = world();
    expect(await w.post(IDEA)).toEqual({ status: 201, body: { id: '00000000-0000-4000-8000-0000000000a1', url: `${ORIGIN}/ideas/acme/widgets` } });
    expect(w.added).toEqual([{ repo: 'acme/widgets', title: 'Improve the HUD', pitch: 'More useful facts.', lane: 'now', by: 'ada-token' }]);
  });

  it('puts an idea with no lane in later', async () => {
    const w = world();
    expect((await w.post({ repo: 'acme/widgets', title: 'A', pitch: 'B' })).status).toBe(201);
    expect(w.added[0]?.lane).toBe('later');
  });

  it('refuses a malformed body with 400, naming the field', async () => {
    const w = world();
    expect(await w.post({ ...IDEA, lane: 'soon' })).toMatchObject({ status: 400, body: { error: naming('`lane`') } });
    expect(await w.post({ ...IDEA, title: 'x'.repeat(121) })).toMatchObject({ status: 400, body: { error: naming('`title`') } });
    expect(await w.post({ ...IDEA, pitch: 'y'.repeat(601) })).toMatchObject({ status: 400, body: { error: naming('`pitch`') } });
    expect(await w.post({ ...IDEA, pitch: ' ' })).toMatchObject({ status: 400, body: { error: naming('`pitch`') } });
    expect(await w.post({ ...IDEA, repo: 'not a repo' })).toMatchObject({ status: 400, body: { error: naming('`repo`') } });
    expect(await w.post({ ...IDEA, votes: 9 })).toMatchObject({ status: 400, body: { error: 'An idea does not carry votes.' } });
    expect(await w.post(null, { raw: '[1]' })).toMatchObject({ status: 400, body: { error: 'The body must be a JSON object.' } });
    expect(await w.post(null, { raw: '{' })).toMatchObject({ status: 400 });
    expect(w.added).toEqual([]);
  });

  it('refuses a body over its cap with 413', async () => {
    const w = world();
    expect((await w.post({ ...IDEA, pitch: 'y'.repeat(MAX_ADD_BYTES) })).status).toBe(413);
  });

  it('refuses no sign-in with 401, and answers 503 with no database here', async () => {
    expect((await world().post(IDEA, { token: null })).status).toBe(401);
    expect((await world().post(IDEA, { token: 'stale-token' })).status).toBe(401);
    expect((await world({ database: false }).post(IDEA)).status).toBe(503);
  });

  it('refuses someone in no workspace listing the repository with 403 and the store\'s reason', async () => {
    const w = world({ member: false });
    expect(await w.post(IDEA)).toEqual({ status: 403, body: { error: 'No workspace of yours lists acme/widgets.' } });
  });

  it('answers 500 when the database fails, saying nothing of why', async () => {
    const w = world({ failAdd: new Error('connection reset') });
    expect(await w.post(IDEA)).toEqual({ status: 500, body: { error: 'The idea could not be added. Try again.' } });
  });
});

describe('GET /api/ideas: a member lists the board', () => {
  const board: Board = {
    repo: 'acme/widgets', public: false, member: true,
    ideas: [
      idea(1, { lane: 'now', votes: 1 }),
      idea(2, { lane: 'now', votes: 5 }),
      idea(3, { lane: 'later', prd: 1210 as Idea['prd'] }),
      idea(4, { lane: 'next', archived: true }),
    ],
  };

  it('answers the board\'s ideas, Now, Next then Later, each lane by votes, with no archived idea', async () => {
    const w = world({ boards: { 'acme/widgets': board } });
    const { status, body } = await w.get('?repo=Acme%2FWidgets');
    expect(status).toBe(200);
    expect(body).toEqual({
      repo: 'acme/widgets', url: `${ORIGIN}/ideas/acme/widgets`,
      ideas: [
        { id: idea(2).id, title: 'Idea 2', pitch: 'A pitch.', lane: 'now', prd: null, votes: 5 },
        { id: idea(1).id, title: 'Idea 1', pitch: 'A pitch.', lane: 'now', prd: null, votes: 1 },
        { id: idea(3).id, title: 'Idea 3', pitch: 'A pitch.', lane: 'later', prd: 1210, votes: 0 },
      ],
    });
  });

  it('refuses a board the caller is no member of, and a private or missing one, with the same 403', async () => {
    const w = world({ boards: { 'acme/widgets': { ...board, public: true, member: false } } });
    const refused = { status: 403, body: { error: 'No workspace of yours lists acme/widgets.' } };
    expect(await w.get('?repo=acme/widgets')).toEqual(refused);
    expect(await world().get('?repo=acme/widgets')).toEqual(refused);
  });

  it('refuses a query with no repository, 401 with no sign-in, 503 with no database', async () => {
    expect(await world().get('')).toEqual({ status: 400, body: { error: 'Name the board\'s repository: ?repo=<owner/name>.' } });
    expect((await world().get('?repo=acme/widgets', { token: null })).status).toBe(401);
    expect((await world({ database: false }).get('?repo=acme/widgets')).status).toBe(503);
  });
});
