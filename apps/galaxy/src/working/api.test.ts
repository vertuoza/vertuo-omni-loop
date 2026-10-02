import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { heartbeat, MAX_HEARTBEAT_BYTES, type WorkingDeps } from './api';
import { fakeWorking, type FakeAccount } from './store.fake';
import { workingReader } from './store';
import { workingState } from './state';

// What an answer of the heartbeat carries, checked as it is read.
const Answer = z.looseObject({ error: z.string().optional() });

const ACME = '00000000-0000-4000-8000-000000000ace';
const OTHER = '00000000-0000-4000-8000-00000000beef';
const ADA: FakeAccount = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', workspaces: [ACME] };
const BOB: FakeAccount = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@acme.test', workspaces: [ACME] };
const CARL: FakeAccount = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', workspaces: [OTHER] };
const NELL: FakeAccount = { id: '00000000-0000-4000-8000-0000000000f1', email: 'nell@none.test', workspaces: [] };
const START = Date.parse('2026-09-30T10:00:00Z');
const DRAFT = '00000000-0000-4000-8000-00000000d0a1';
const PRD_7 = '00000000-0000-4000-8000-00000000d007';
const VISUAL_12 = '00000000-0000-4000-8000-00000000d012';
const BUG_13 = '00000000-0000-4000-8000-00000000d013';
const SESSION = '5e5510aa-0000-4000-8000-000000000001';

type Call = { token?: string | null; body?: unknown; raw?: string };

function world({ database = true } = {}) {
  const clock = { now: START };
  const fake = fakeWorking({ 'ada-token': ADA, 'bob-token': BOB, 'carl-token': CARL, 'nell-token': NELL }, { [ACME]: 'acme', [OTHER]: 'other' }, () => clock.now);
  fake.tables.dossiers.push(
    { id: DRAFT, workspace_id: ACME, home_repo: 'acme/widgets', kind: 'prd', prd: null },
    { id: PRD_7, workspace_id: ACME, home_repo: 'acme/widgets', kind: 'prd', prd: 7 },
    { id: VISUAL_12, workspace_id: ACME, home_repo: 'acme/widgets', kind: 'visual', prd: 12 },
    { id: BUG_13, workspace_id: ACME, home_repo: 'acme/widgets', kind: 'bug', prd: 13 },
  );
  // The stub answers only the calls the route makes, so it is not a whole Supabase client.
  const deps: WorkingDeps = { connect: database ? fake.client as unknown as WorkingDeps['connect'] : null };
  const send = async (body: unknown, { token = 'ada-token', raw }: Call = {}) => {
    const response = await heartbeat(new Request('https://omni.example/api/ask/heartbeat', {
      method: 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }), deps);
    const text = await response.text();
    return { status: response.status, body: text ? Answer.parse(JSON.parse(text)) : null };
  };
  const ping = (session = SESSION) => fake.tables.working_pings.find((p) => p.claude_session_id === session);
  return { clock, fake, deps, send, ping };
}

const BEAT = { claudeSessionId: SESSION, repo: 'acme/widgets', work: { kind: 'prd', number: 7 } };

describe('POST /api/ask/heartbeat: the terminal says it is working', () => {
  it('answers 204 with no body on a valid heartbeat, and records it for its owner', async () => {
    const w = world();
    const { status, body } = await w.send(BEAT);
    expect(status).toBe(204);
    expect(body).toBeNull();
    expect(w.ping()).toMatchObject({ user_id: ADA.id, workspace_id: ACME, repo: 'acme/widgets', work_kind: 'prd', work_number: 7, ended_at: null });
  });

  it('takes a heartbeat with no work, and the end with `ended`', async () => {
    const w = world();
    expect((await w.send({ ...BEAT, work: null })).status).toBe(204);
    expect(w.ping()).toMatchObject({ work_kind: null, work_number: null, dossier_id: null });
    expect((await w.send({ ...BEAT, work: null, ended: true })).status).toBe(204);
    expect(w.ping()?.ended_at).not.toBeNull();
  });

  it('upserts one row per Claude session, its last heartbeat the time it was seen', async () => {
    const w = world();
    await w.send(BEAT);
    w.clock.now += 60_000;
    await w.send(BEAT);
    expect(w.fake.tables.working_pings).toHaveLength(1);
    expect(w.ping()?.seen_at).toBe(new Date(START + 60_000).toISOString());
  });

  it('sends exactly what the database needs: the session, the repository, the work, the end', async () => {
    const w = world();
    await w.send({ claudeSessionId: SESSION, repo: 'Acme/Widgets', work: { kind: 'draft', draftId: DRAFT }, ended: false });
    expect(w.fake.calls).toEqual([{ fn: 'working_ping', args: {
      p_claude_session_id: SESSION, p_repo: 'Acme/Widgets', p_work_kind: 'draft', p_work_number: null, p_draft: DRAFT, p_ended: false,
    } }]);
  });
});

describe('the dossier a heartbeat resolves to', () => {
  const cases: Array<[string, unknown, string | null]> = [
    ['a draft, by its id', { kind: 'draft', draftId: DRAFT }, DRAFT],
    ['a PRD, by the repository and its number', { kind: 'prd', number: 7 }, PRD_7],
    ['a visual fix, by its number', { kind: 'visual', number: 12 }, VISUAL_12],
    ['a bug fix, by its number', { kind: 'bug', number: 13 }, BUG_13],
    ['a PRD with no dossier yet: null', { kind: 'prd', number: 99 }, null],
    ['a fix of another kind with that number: null', { kind: 'bug', number: 12 }, null],
    ['no work: null', null, null],
  ];
  for (const [name, work, dossier] of cases) {
    it(name, async () => {
      const w = world();
      expect((await w.send({ ...BEAT, work })).status).toBe(204);
      expect(w.ping()?.dossier_id).toBe(dossier);
    });
  }

  it('resolves again on the next heartbeat, once the dossier exists', async () => {
    const w = world();
    await w.send({ ...BEAT, work: { kind: 'prd', number: 99 } });
    expect(w.ping()?.dossier_id).toBeNull();
    const later = '00000000-0000-4000-8000-00000000d099';
    w.fake.tables.dossiers.push({ id: later, workspace_id: ACME, home_repo: 'acme/widgets', kind: 'prd', prd: 99 });
    await w.send({ ...BEAT, work: { kind: 'prd', number: 99 } });
    expect(w.ping()?.dossier_id).toBe(later);
  });
});

describe('refusals', () => {
  it('401 without a token, or with one the Auth server refuses', async () => {
    const w = world();
    for (const token of [null, 'forged-token']) {
      const { status, body } = await w.send(BEAT, { token });
      expect(status).toBe(401);
      expect(body?.error).toEqual(expect.any(String));
    }
    expect(w.fake.tables.working_pings).toEqual([]);
  });

  const malformed: Array<[string, unknown]> = [
    ['a missing session id', { repo: 'acme/widgets', work: null }],
    ['an empty session id', { ...BEAT, claudeSessionId: '' }],
    ['a session id over 200 characters', { ...BEAT, claudeSessionId: 'x'.repeat(201) }],
    ['a missing repository', { claudeSessionId: SESSION, work: null }],
    ['a repository not owner/name', { ...BEAT, repo: 'widgets' }],
    ['a missing work', { claudeSessionId: SESSION, repo: 'acme/widgets' }],
    ['a work of an unknown kind', { ...BEAT, work: { kind: 'epic', number: 7 } }],
    ['a PRD without a number', { ...BEAT, work: { kind: 'prd' } }],
    ['a PRD numbered 0', { ...BEAT, work: { kind: 'prd', number: 0 } }],
    ['a PRD numbered 1.5', { ...BEAT, work: { kind: 'prd', number: 1.5 } }],
    ['a draft that is not an id', { ...BEAT, work: { kind: 'draft', draftId: 'draft-1' } }],
    ['a work with a field of its own', { ...BEAT, work: { kind: 'prd', number: 7, title: 'x' } }],
    ['an unknown field', { ...BEAT, tool: 'Bash' }],
    ['`ended` not a boolean', { ...BEAT, ended: 'yes' }],
    ['a list', [BEAT]],
  ];
  for (const [name, body] of malformed) {
    it(`400 on ${name}`, async () => {
      const w = world();
      const { status, body: answer } = await w.send(body);
      expect(status).toBe(400);
      expect(answer?.error).toEqual(expect.any(String));
      expect(w.fake.tables.working_pings).toEqual([]);
    });
  }

  it('400 on a body that is not JSON', async () => {
    const w = world();
    expect((await w.send(undefined, { raw: '{not json' })).status).toBe(400);
  });

  it(`413 past ${MAX_HEARTBEAT_BYTES} bytes`, async () => {
    const w = world();
    expect((await w.send({ ...BEAT, claudeSessionId: 'x'.repeat(MAX_HEARTBEAT_BYTES) })).status).toBe(413);
  });

  it('403 when another account owns the session, and its row stays theirs', async () => {
    const w = world();
    await w.send(BEAT);
    const { status, body } = await w.send({ ...BEAT, work: null }, { token: 'bob-token' });
    expect(status).toBe(403);
    expect(body?.error).toContain('another account');
    expect(w.ping()).toMatchObject({ user_id: ADA.id, work_kind: 'prd', work_number: 7 });
  });

  it('403 for an account in no workspace, with the database\'s reason', async () => {
    const w = world();
    const { status, body } = await w.send({ ...BEAT, repo: 'nowhere/widgets' }, { token: 'nell-token' });
    expect(status).toBe(403);
    expect(body?.error).toContain('install the Omni App');
  });

  it('403 for a repository a workspace the caller is not in owns', async () => {
    const w = world();
    const { status, body } = await w.send(BEAT, { token: 'carl-token' });
    expect(status).toBe(403);
    expect(body?.error).toContain('not a member');
    expect(w.fake.tables.working_pings).toEqual([]);
  });

  it('503 when this deployment has no database', async () => {
    const w = world({ database: false });
    expect((await w.send(BEAT)).status).toBe(503);
  });
});

describe('reading who is working', () => {
  it('a member of the workspace reads the dossier\'s heartbeat; another workspace reads nothing', async () => {
    const w = world();
    await w.send(BEAT);
    const asBob = workingReader(w.fake.client('bob-token') as never);
    const asCarl = workingReader(w.fake.client('carl-token') as never);
    expect(await asBob.forDossier(PRD_7)).toMatchObject({ claude_session_id: SESSION, dossier_id: PRD_7 });
    expect(await asCarl.forDossier(PRD_7)).toBeNull();
    expect(await asBob.forSession(SESSION)).toMatchObject({ user_id: ADA.id });
    expect(await asCarl.forSession(SESSION)).toBeNull();
  });

  it('a dossier is working while any of its sessions is, and idle once they ended or went quiet', async () => {
    const w = world();
    const reader = workingReader(w.fake.client('bob-token') as never);
    await w.send(BEAT);
    w.clock.now += 60_000;
    await w.send({ ...BEAT, claudeSessionId: 'second-session' });
    await w.send({ ...BEAT, claudeSessionId: 'second-session', ended: true });
    expect(workingState(await reader.forDossier(PRD_7), 0, w.clock.now)).toBe('working');
    w.clock.now += 3 * 60_000;
    expect(workingState(await reader.forDossier(PRD_7), 0, w.clock.now)).toBe('idle');
  });

  it('the session\'s end reads idle for its /ask tab', async () => {
    const w = world();
    const reader = workingReader(w.fake.client('ada-token') as never);
    await w.send(BEAT);
    expect(workingState(await reader.forSession(SESSION), 0, w.clock.now)).toBe('working');
    await w.send({ ...BEAT, ended: true });
    expect(workingState(await reader.forSession(SESSION), 0, w.clock.now)).toBe('idle');
  });
});
