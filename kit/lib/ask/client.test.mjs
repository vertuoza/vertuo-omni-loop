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
});
