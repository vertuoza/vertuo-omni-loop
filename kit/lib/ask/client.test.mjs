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

  it('sends a lead with a round only when there is one (PRD 752)', async () => {
    const { client } = await setUp();
    const session = await client.openSession('acme/widgets · main');
    const { roundId } = await client.openRound(session.id, QUESTIONS, undefined, '## The design');
    expect(server.calls[1].body).toEqual({ questions: QUESTIONS, lead: '## The design' });
    expect(server.rounds.get(roundId).lead).toBe('## The design');
    await client.openRound(session.id, QUESTIONS, undefined, null);
    await client.openRound(session.id, QUESTIONS, undefined, '');
    expect(server.calls[2].body).toEqual({ questions: QUESTIONS });
    expect(server.calls[3].body).toEqual({ questions: QUESTIONS });
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

  it('asks for a fix by its kind, and for a PRD without one (PRD 627)', async () => {
    const { calls, client } = stubbed(() => new Response(JSON.stringify({ id: 'd-2', url: 'https://omni.example/bugs/d-2' }), { status: 200 }));
    await client.findDossier({ repo: 'acme/widgets', prd: 571, kind: 'bug' });
    await client.findDossier({ repo: 'acme/widgets', prd: 7, kind: 'prd' });
    expect(calls.map((c) => c.url)).toEqual([
      'https://omni.example/api/dossiers?repo=acme%2Fwidgets&prd=571&kind=bug',
      'https://omni.example/api/dossiers?repo=acme%2Fwidgets&prd=7',
    ]);
  });

  it('pushes a fix with its kind, and a PRD with none, so an older server reads it as before (PRD 627)', async () => {
    const { calls, client } = stubbed(() => new Response(JSON.stringify({ id: 'd-3', url: 'u', added: [], unchanged: [] }), { status: 200 }));
    const artifacts = [{ kind: 'variations', content: 'r1' }];
    await client.pushDossier({ repo: 'acme/widgets', prd: 548, kind: 'visual', title: 'Links', artifacts });
    await client.pushDossier({ repo: 'acme/widgets', prd: 7, kind: 'prd', title: 'Team inbox', artifacts: [] });
    expect(calls.map((c) => JSON.parse(c.body))).toEqual([
      { repo: 'acme/widgets', prd: 548, kind: 'visual', title: 'Links', artifacts },
      { repo: 'acme/widgets', prd: 7, title: 'Team inbox', artifacts: [] },
    ]);
  });
});

describe('where a repository\'s questions land (PRD 459)', () => {
  const ACME = { workspace: { slug: 'acme', name: 'Acme' }, reason: null };

  it('asks GET /api/ask/workspace with the repository, and answers the page\'s reply', async () => {
    const { client } = await setUp({ place: (repo) => (repo === 'acme/widgets' ? ACME : { workspace: null, reason: 'no' }) });
    expect(await client.whereQuestionsGo('acme/widgets')).toEqual(ACME);
    expect(server.calls.map((call) => `${call.method} ${call.path} ${call.authorization}`)).toEqual(['GET /api/ask/workspace Bearer access-1']);
  });

  it('sends the repository encoded as a query', async () => {
    const seen = [];
    const tokens = memoryTokens({ 'omni.example': { access_token: 'access-1' } });
    const fetch = async (url) => { seen.push(url); return new Response(JSON.stringify(ACME), { status: 200 }); };
    await askClient({ baseUrl: 'https://omni.example', host: 'omni.example', tokens, fetch }).whereQuestionsGo('acme/web.site');
    expect(seen).toEqual(['https://omni.example/api/ask/workspace?repo=acme%2Fweb.site']);
  });

  it('from a server older than the call, is a 404 error', async () => {
    const { client } = await setUp();
    await expect(client.whereQuestionsGo('acme/widgets')).rejects.toMatchObject({ name: 'AskCallError', status: 404 });
  });
});

describe('a renewed sign-in keeps only the sign-in', () => {
  const EXTRAS = { login: 'ada', workspace: { slug: 'acme', name: 'Acme' }, reason: null };

  it('on a 401\'s refresh, keeps the tokens, the email and the login, not where a repository went', async () => {
    const { client, tokens } = await setUp({ tokenExtras: EXTRAS }, { access_token: 'access-1', refresh_token: 'refresh-1', email: 'ada@example.com' });
    const { id } = server.openSession();
    server.expireAccess();
    await client.openRound(id, QUESTIONS);
    expect(tokens.store[server.host]).toEqual({
      access_token: 'access-2', refresh_token: 'refresh-2', expires_at: expect.any(Number), email: 'person@example.com', login: 'ada',
    });
  });

  it('on renew(), the same', async () => {
    const { client, tokens } = await setUp({ tokenExtras: EXTRAS }, { access_token: 'access-1', refresh_token: 'refresh-1', login: 'ada' });
    expect(await client.renew()).toBe('renewed');
    expect(tokens.store[server.host]).toEqual({
      access_token: 'access-2', refresh_token: 'refresh-2', expires_at: expect.any(Number), email: 'person@example.com', login: 'ada',
    });
  });
});

describe('downloading a screenshot (PRD 620)', () => {
  /** A client whose every request is answered by `answer`, each one recorded. */
  function stubbed(answer) {
    const requests = [];
    const tokens = memoryTokens({ 'ask.example': { access_token: 'access-1' } });
    const client = askClient({
      baseUrl: 'https://ask.example',
      host: 'ask.example',
      tokens,
      fetch: async (url, init) => {
        requests.push({ url, init });
        return answer(url, init);
      },
    });
    return { client, requests };
  }

  it('fetches the signed link as it is, with no bearer token, and gives its bytes', async () => {
    const { client, requests } = stubbed(() => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }));
    const link = 'https://files.example/sign/r1/1.png?token=t';
    const bytes = await client.download(link, { timeoutMs: 30_000 });
    expect([...bytes]).toEqual([137, 80, 78, 71]);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(link);
    expect(requests[0].init.headers?.authorization).toBeUndefined();
    expect(requests[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('is an AskCallError for a refused link or one it cannot reach', async () => {
    const refused = stubbed(() => new Response('expired', { status: 400 }));
    await expect(refused.client.download('https://files.example/x')).rejects.toMatchObject({ name: 'AskCallError', status: 400 });
    const down = stubbed(() => { throw new TypeError('fetch failed'); });
    await expect(down.client.download('https://files.example/x')).rejects.toBeInstanceOf(AskCallError);
  });
});
