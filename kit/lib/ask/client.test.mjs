import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../../test/fake-ask-server.mjs';
import { askClient, AskCallError } from './client.mjs';

/** A token store held in memory, keyed by host like the real one. */
function memoryTokens(entries = {}) {
  const store = { ...entries };
  return {
    store,
    read: (host) => store[host] ?? null,
    write: (host, tokens) => { store[host] = tokens; },
  };
}

const QUESTIONS = [{ question: 'Which colour?', header: 'Colour', multiSelect: false, options: [{ label: 'Red', description: 'warm' }, { label: 'Blue', description: 'cool' }] }];

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function setUp(options = {}, signedIn = { access_token: 'access-1', refresh_token: 'refresh-1' }) {
  server = await startFakeAskServer(options);
  const tokens = memoryTokens(signedIn ? { [server.host]: signedIn } : {});
  const client = askClient({ baseUrl: server.url, host: server.host, tokens });
  return { client, tokens };
}

describe('the ask contract client', () => {
  it('opens and closes a session, carrying the bearer token', async () => {
    const { client } = await setUp();
    const session = await client.openSession('acme/widgets · main');
    expect(session).toEqual({ id: expect.any(String), url: `${server.url}/ask/${session.id}` });
    await client.closeSession(session.id);
    expect(server.sessions.get(session.id).status).toBe('closed');
    expect(server.calls.map((call) => call.authorization)).toEqual(['Bearer access-1', 'Bearer access-1']);
    expect(server.calls[0].body).toEqual({ title: 'acme/widgets · main' });
  });

  it('posts a round with the questions as given, waits on it, answers and abandons it', async () => {
    const { client } = await setUp();
    const { id } = server.openSession();
    const { roundId } = await client.openRound(id, QUESTIONS);
    expect(server.rounds.get(roundId).questions).toEqual(QUESTIONS);
    expect(await client.wait(roundId, { timeoutMs: 2000 })).toEqual({ status: 'open' });
    await client.answer(roundId, { 'Which colour?': 'Red' });
    expect(server.rounds.get(roundId)).toMatchObject({ status: 'answered', answers: { 'Which colour?': 'Red' }, answeredVia: 'terminal' });
    expect(await client.wait(roundId, { timeoutMs: 2000 })).toEqual({ status: 'answered', answers: { 'Which colour?': 'Red' } });
    const second = await client.openRound(id, QUESTIONS);
    await client.abandon(second.roundId);
    expect(server.rounds.get(second.roundId).status).toBe('abandoned');
  });

  it('sends a context with a session and a round when it is given one, and none otherwise', async () => {
    const { client } = await setUp();
    const context = { repo: 'acme/widgets', branch: 'main', prd: null, claudeSessionId: 'c1', skill: null, model: null, tokens: null };
    const session = await client.openSession('acme/widgets · main', { repo: 'acme/widgets' });
    expect(server.calls[0].body).toEqual({ title: 'acme/widgets · main', context: { repo: 'acme/widgets' } });
    expect(server.sessions.get(session.id).context).toEqual({ repo: 'acme/widgets' });
    const { roundId } = await client.openRound(session.id, QUESTIONS, context);
    expect(server.calls[1].body).toEqual({ questions: QUESTIONS, context });
    expect(server.rounds.get(roundId).context).toEqual(context);
    await client.openRound(session.id, QUESTIONS);
    expect(server.calls[2].body).toEqual({ questions: QUESTIONS });
  });

  it('keeps a path under ask.url, with or without a trailing slash', async () => {
    server = await startFakeAskServer();
    const tokens = memoryTokens({ [server.host]: { access_token: 'access-1' } });
    await askClient({ baseUrl: `${server.url}/`, host: server.host, tokens }).openSession('t');
    await askClient({ baseUrl: `${server.url}/under`, host: server.host, tokens }).openSession('t').catch(() => {});
    expect(server.calls.map((call) => call.path)).toEqual(['/api/ask/sessions', '/under/api/ask/sessions']);
  });

  it('on a 401, refreshes once, keeps the new tokens and retries', async () => {
    const { client, tokens } = await setUp({}, { access_token: 'access-1', refresh_token: 'refresh-1', email: 'person@example.com' });
    const { id } = server.openSession();
    server.expireAccess();
    const { roundId } = await client.openRound(id, QUESTIONS);
    expect(server.rounds.has(roundId)).toBe(true);
    expect(server.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `POST /api/ask/sessions/${id}/rounds`,
      'POST /api/ask/token',
      `POST /api/ask/sessions/${id}/rounds`,
    ]);
    expect(server.calls[1].body).toEqual({ refresh_token: 'refresh-1' });
    expect(server.calls[1].authorization).toBeNull();
    expect(tokens.store[server.host]).toMatchObject({ access_token: 'access-2', refresh_token: 'refresh-2', email: 'person@example.com' });
    expect(server.calls[2].authorization).toBe('Bearer access-2');
  });

  it('on a 401, takes the tokens another terminal already renewed, and never replays the old refresh token', async () => {
    // Terminal B read the store before terminal A renewed it. Replaying B's refresh token, already
    // rotated by A, is what makes Supabase revoke the whole sign-in.
    const { client: a, tokens } = await setUp();
    const { id } = server.openSession();
    server.expireAccess();
    await a.openRound(id, QUESTIONS);
    const stale = { access_token: 'access-1', refresh_token: 'refresh-1' };
    let first = true;
    const behind = { read: (host) => (first ? ((first = false), stale) : tokens.read(host)), write: tokens.write };
    const b = askClient({ baseUrl: server.url, host: server.host, tokens: behind });
    server.calls.length = 0;

    const { roundId } = await b.openRound(id, QUESTIONS);

    expect(server.rounds.has(roundId)).toBe(true);
    expect(server.calls.map((call) => call.path)).toEqual([`/api/ask/sessions/${id}/rounds`, `/api/ask/sessions/${id}/rounds`]);
    expect(server.calls[1].authorization).toBe('Bearer access-2');
  });

  it('refreshes only once: a second 401 is an error', async () => {
    const { client } = await setUp();
    const { id } = server.openSession();
    server.denyAccess();
    await expect(client.openRound(id, QUESTIONS)).rejects.toMatchObject({ name: 'AskCallError', status: 401 });
    expect(server.calls.map((call) => call.path)).toEqual([
      `/api/ask/sessions/${id}/rounds`,
      '/api/ask/token',
      `/api/ask/sessions/${id}/rounds`,
    ]);
  });

  it('a refused refresh is a 401 error, and the tokens are left as they were', async () => {
    const { client, tokens } = await setUp();
    const { id } = server.openSession();
    server.expireAccess();
    server.expireRefresh();
    await expect(client.openRound(id, QUESTIONS)).rejects.toMatchObject({ status: 401 });
    expect(tokens.store[server.host]).toEqual({ access_token: 'access-1', refresh_token: 'refresh-1' });
  });

  it('signed out, makes no call at all', async () => {
    const { client } = await setUp({}, null);
    const error = await client.openSession('t').catch((e) => e);
    expect(error).toBeInstanceOf(AskCallError);
    expect(error.status).toBeNull();
    expect(server.calls).toEqual([]);
  });

  it('with the server down, fails fast', async () => {
    const { client } = await setUp();
    await server.close();
    const started = Date.now();
    await expect(client.openRound('sess-1', QUESTIONS)).rejects.toBeInstanceOf(AskCallError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('gives up on a call that outlives its timeout', async () => {
    const { client } = await setUp({ holdMs: 5000 });
    const { id } = server.openSession();
    const { roundId } = await client.openRound(id, QUESTIONS);
    const started = Date.now();
    await expect(client.wait(roundId, { timeoutMs: 100 })).rejects.toBeInstanceOf(AskCallError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('a refused call carries its status', async () => {
    const { client } = await setUp();
    await expect(client.openRound('no-such-session', QUESTIONS)).rejects.toMatchObject({ status: 404 });
  });

  it('a refused call keeps the server\'s reason, and none when the reply carries none (PRD 459)', async () => {
    const tokens = memoryTokens({ 'omni.example': { access_token: 'access-1', refresh_token: 'refresh-1' } });
    const reply = (status, body) => async () => new Response(body, { status });
    const reason = 'you are not a member of Globex, which owns globex/web';
    const refused = askClient({ baseUrl: 'https://omni.example', host: 'omni.example', tokens, fetch: reply(403, JSON.stringify({ error: reason })) });
    await expect(refused.openSession('t')).rejects.toMatchObject({ name: 'AskCallError', status: 403, reason });
    for (const body of ['', '{}', 'not json', JSON.stringify({ error: 7 }), JSON.stringify({ error: '  ' })]) {
      const bare = askClient({ baseUrl: 'https://omni.example', host: 'omni.example', tokens, fetch: reply(403, body) });
      await expect(bare.openSession('t'), body).rejects.toMatchObject({ status: 403, reason: null });
    }
  });
});

describe('the dossier calls (PRD 216)', () => {
  const SPEC = '---\ntitle: Team inbox\n---\n# Team inbox\n';

  it('opens a draft with the bearer token, sending the Claude session id only when there is one', async () => {
    const { client } = await setUp();
    const draft = await client.openDossier({ title: 'A team inbox', repo: 'acme/widgets', claudeSessionId: 'c-1' });
    expect(draft).toEqual({ id: expect.any(String), url: `${server.url}/prd/${draft.id}` });
    await client.openDossier({ title: 'Another idea', repo: 'acme/widgets', claudeSessionId: null });
    expect(server.calls.map(({ method, path, body, authorization }) => ({ method, path, body, authorization }))).toEqual([
      { method: 'POST', path: '/api/dossiers', body: { title: 'A team inbox', repo: 'acme/widgets', claudeSessionId: 'c-1' }, authorization: 'Bearer access-1' },
      { method: 'POST', path: '/api/dossiers', body: { title: 'Another idea', repo: 'acme/widgets' }, authorization: 'Bearer access-1' },
    ]);
  });

  it('pushes a folder\'s artifacts, naming the draft only when there is one, and hands back what was added', async () => {
    const { client } = await setUp();
    const draft = await client.openDossier({ title: 'A team inbox', repo: 'acme/widgets' });
    const first = await client.pushDossier({ repo: 'acme/widgets', prd: 7, title: 'Team inbox', draftId: draft.id, artifacts: [{ kind: 'spec', content: SPEC }] });
    expect(first).toEqual({ id: draft.id, url: `${server.url}/prd/${draft.id}`, added: [{ kind: 'spec', version: 1 }], unchanged: [] });
    expect(server.calls[1].body).toEqual({ repo: 'acme/widgets', prd: 7, title: 'Team inbox', draftId: draft.id, artifacts: [{ kind: 'spec', content: SPEC }] });

    const again = await client.pushDossier({ repo: 'acme/widgets', prd: 7, title: 'Team inbox', draftId: null, artifacts: [{ kind: 'spec', content: SPEC }] });
    expect(again).toMatchObject({ id: draft.id, added: [], unchanged: ['spec'] });
    expect(server.calls[2].body).not.toHaveProperty('draftId');
  });

  it('carries a refusal\'s status, as every call does', async () => {
    const { client } = await setUp({ artifactBytes: 10 });
    await expect(client.pushDossier({ repo: 'acme/widgets', prd: 7, title: 'T', artifacts: [{ kind: 'spec', content: SPEC }] }))
      .rejects.toMatchObject({ status: 413 });
  });
});

describe('the dossier lookup (PRD 413)', () => {
  /** A client over a stubbed fetch that records each call and answers with `reply`. */
  function stubbed(reply) {
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url: String(url), method: init.method, authorization: init.headers.authorization, body: init.body });
      return reply(String(url));
    };
    const tokens = memoryTokens({ 'omni.example': { access_token: 'access-1', refresh_token: 'refresh-1' } });
    return { calls, client: askClient({ baseUrl: 'https://omni.example/', host: 'omni.example', tokens, fetch }) };
  }

  it('asks GET /api/dossiers by repository and number, with the bearer token, and hands back {id, url}', async () => {
    const { calls, client } = stubbed(() => new Response(JSON.stringify({ id: 'd-1', url: 'https://omni.example/prd/d-1' }), { status: 200 }));
    expect(await client.findDossier({ repo: 'acme/widgets', prd: 7 })).toEqual({ id: 'd-1', url: 'https://omni.example/prd/d-1' });
    expect(calls).toEqual([
      { url: 'https://omni.example/api/dossiers?repo=acme%2Fwidgets&prd=7', method: 'GET', authorization: 'Bearer access-1', body: undefined },
    ]);
  });

  it('a PRD with no dossier is a refusal carrying 404', async () => {
    const { client } = stubbed(() => new Response('{}', { status: 404 }));
    await expect(client.findDossier({ repo: 'acme/widgets', prd: 7 })).rejects.toMatchObject({ status: 404 });
  });
});
