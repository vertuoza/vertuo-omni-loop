import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { item } from '../../ask/test-item';
import type { GithubSummary } from '../../dossier/github/summary';
import { recountOutboxes } from '../outbox/recount';
import { fakePrdOutboxStore } from '../outbox/store.fake';
import { fakeStageStore } from '../store.fake';
import { parseStageEvent, receiveStageEvent, STAGE_SIGNATURE_HEADER, type StageEventDeps, verifySignature } from './event';

const SECRET = 'stage-secret';
const WS = 'ws-acme';
const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const event = (over: Record<string, unknown> = {}) => ({
  repository: 'Acme/Widgets', topic: 'real-stages', prd: 587, stage: 'inbox', at: '2026-09-29T10:00:00Z', ...over,
});

function setup(over: Partial<StageEventDeps> = {}) {
  const store = fakeStageStore(() => '2026-09-29T12:00:00Z');
  const log = vi.fn();
  const deps: StageEventDeps = {
    secret: SECRET,
    store: () => store,
    workspacesOf: (repository) => Promise.resolve(repository.toLowerCase().startsWith('acme/') ? [WS] : []),
    log,
    ...over,
  };
  const post = (payload: unknown, signature?: string | null) => {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const headers = new Headers();
    if (signature !== null) headers.set(STAGE_SIGNATURE_HEADER, signature ?? sign(body));
    return receiveStageEvent({ body, headers }, deps);
  };
  return { store, log, post };
}

describe('the stage event route', () => {
  it('writes the stage of a PRD found by number', async () => {
    const { store, post } = setup();
    const reply = await post(event());
    expect(reply.status).toBe(200);
    expect(store.stages).toEqual([
      { workspace_id: WS, repository: 'acme/widgets', prd: 587, stage: 'inbox', reached_at: '2026-09-29T10:00:00Z', synced_at: '2026-09-29T12:00:00Z' },
    ]);
  });

  it('writes the stage of a PRD found by its topic when the event names no number', async () => {
    const { store, post } = setup();
    await store.recordTopic({ workspace_id: WS, repository: 'acme/widgets', prd: 580, topic: 'real-stages' });
    const reply = await post(event({ prd: null, stage: 'retro' }));
    expect(reply.status).toBe(200);
    expect(store.stages.map((s) => [s.prd, s.stage])).toEqual([[580, 'retro']]);
  });

  it('keeps the first date when the same event comes again', async () => {
    const { store, post } = setup();
    await post(event());
    const writes = store.writes.length;
    await post(event({ at: '2026-09-30T10:00:00Z' }));
    expect(store.writes.length).toBe(writes);
    expect(store.stages).toHaveLength(1);
    expect(item(store.stages, 0).reached_at).toBe('2026-09-29T10:00:00Z');
  });

  it('answers 401 and writes nothing to a bad, missing or foreign signature', async () => {
    const { store, post } = setup();
    expect((await post(event(), sign('{"other":1}'))).status).toBe(401);
    expect((await post(event(), null)).status).toBe(401);
    expect((await post(event(), sign(JSON.stringify(event()), 'another-secret'))).status).toBe(401);
    expect((await post(event(), 'sha256=zz')).status).toBe(401);
    expect(store.writes).toEqual([]);
  });

  it('answers 401 to everything while STAGE_EVENT_SECRET is not set', async () => {
    const { store, post, log } = setup({ secret: undefined });
    expect((await post(event(), sign(JSON.stringify(event()), ''))).status).toBe(401);
    expect(store.writes).toEqual([]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('STAGE_EVENT_SECRET'));
  });

  it('answers 202 and writes nothing to an event it cannot place', async () => {
    const { store, post } = setup();
    expect((await post(event({ repository: 'nobody/widgets' }))).status).toBe(202);
    expect((await post(event({ prd: null, topic: 'unknown-topic' }))).status).toBe(202);
    expect(store.writes).toEqual([]);
  });

  it('answers 400 to a signed body that is not a stage event', async () => {
    const { store, post } = setup();
    expect((await post('not json')).status).toBe(400);
    expect((await post(event({ stage: 'idea' }))).status).toBe(400);
    expect(store.writes).toEqual([]);
  });

  it('answers 500 and logs when the store refuses', async () => {
    const { store, post, log } = setup();
    store.fail = 'down';
    expect((await post(event())).status).toBe(500);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('down'));
  });

  it('places the event in every workspace that owns the repository', async () => {
    const { store, post } = setup({ workspacesOf: () => Promise.resolve(['ws-a', 'ws-b']) });
    await post(event());
    expect(store.stages.map((s) => s.workspace_id)).toEqual(['ws-a', 'ws-b']);
  });
});

describe('parseStageEvent', () => {
  it('keeps a well-formed event and refuses a malformed one', () => {
    expect(parseStageEvent(event())).toEqual(event());
    expect(parseStageEvent(event({ prd: null }))).toEqual(event({ prd: null }));
    for (const bad of [null, [], event({ repository: 'no-slash' }), event({ topic: '' }), event({ prd: -1 }), event({ prd: 1.5 }),
      event({ stage: 'prd' }), event({ at: 'yesterday' }), event({ prd: null, topic: undefined })]) {
      expect(parseStageEvent(bad)).toBeNull();
    }
  });
});

describe('verifySignature', () => {
  it('accepts only the HMAC of the exact body', () => {
    expect(verifySignature(SECRET, 'abc', sign('abc'))).toBe(true);
    expect(verifySignature(SECRET, 'abd', sign('abc'))).toBe(false);
    expect(verifySignature(SECRET, 'abc', null)).toBe(false);
    expect(verifySignature(SECRET, 'abc', 'sha1=00')).toBe(false);
  });
});

describe('the open outbox questions (PRD 657, s5)', () => {
  const summary: GithubSummary = {
    repo: 'acme/widgets', prd: 587, folder: null, topic: null, issue: null, phase0: null, retro: null, mergedSlices: 0,
    feature: { number: 9, url: 'https://github.com/acme/widgets/pull/9', state: 'open', draft: false },
    outbox: { open: [{ id: 's1-01-a', rank: 'high', question: 'Q?', decision: null, options: [], personSteps: null }], settled: [] },
  };

  function withRecount(recountFails = false) {
    const outbox = fakePrdOutboxStore(() => '2026-09-29T12:00:00Z');
    const asked: number[] = [];
    const set = setup({
      recount: async (workspace, prds) => {
        if (recountFails) throw new Error('GitHub is down');
        return recountOutboxes(workspace, prds, { stages: set.store, store: outbox, summary: (ref) => { asked.push(ref.prd); return Promise.resolve(summary); } });
      },
    });
    return { ...set, outbox, asked };
  }

  it('recounts the PRD an event places, from its new stage', async () => {
    const { post, outbox, asked } = withRecount();
    expect((await post(event({ stage: 'outbox' }))).status).toBe(200);
    expect(asked).toEqual([587]);
    expect(outbox.writes).toEqual([`${WS} acme/widgets#587 1`]);
  });

  it('stores 0 for a PRD an event moves past its outbox, without reading GitHub', async () => {
    const { post, outbox, asked } = withRecount();
    await post(event({ stage: 'shipped' }));
    expect(asked).toEqual([]);
    expect(outbox.writes).toEqual([`${WS} acme/widgets#587 0`]);
  });

  it('keeps its reply when the recount fails, and logs it', async () => {
    const { post, store, log } = withRecount(true);
    expect((await post(event({ stage: 'outbox' }))).status).toBe(200);
    expect(store.stages).toHaveLength(1);
    expect(log.mock.calls.flat().join('\n')).toContain('not recounted');
  });
});
