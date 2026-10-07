import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { readEnv } from '../env.ts';
import { forwardStageEvent, signStageEvent, STAGE_SIGNATURE_HEADER, stageEventUrl, toStageEvent, type StageEvent } from './stage-forward.ts';

const REPOSITORY: Record<string, unknown> = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' }, default_branch: 'main' };

type PullOver = { head?: string; base?: string; merged?: boolean; body?: string | null; [field: string]: unknown };

const pull = (action: string, { head, base = 'main', merged = false, body = null, ...over }: PullOver = {}) => ({
  action,
  installation: { id: 7 },
  repository: REPOSITORY,
  pull_request: {
    number: 12,
    head: { ref: head, sha: 'abc' },
    base: { ref: base },
    merged,
    merged_at: merged ? '2026-09-29T10:00:00Z' : null,
    created_at: '2026-09-29T08:00:00Z',
    updated_at: '2026-09-29T09:00:00Z',
    body,
    ...over,
  },
});

describe('toStageEvent', () => {
  it('turns a merged phase-0 PR into inbox, with the PRD from its link line', () => {
    expect(toStageEvent('pull_request', pull('closed', { head: 'docs/phase-0-real-stages', merged: true, body: 'Docs.\n\nRefs #587\n' })))
      .toEqual({ repository: 'acme/widgets', topic: 'real-stages', prd: 587, stage: 'inbox', at: '2026-09-29T10:00:00Z' });
  });

  it('turns a merged slice PR into the feature branch into building', () => {
    expect(toStageEvent('pull_request', pull('closed', { head: 'feat/real-stages--s1', base: 'feat/real-stages', merged: true, body: 'Part of #587' })))
      .toEqual({ repository: 'acme/widgets', topic: 'real-stages', prd: 587, stage: 'building', at: '2026-09-29T10:00:00Z' });
  });

  it('turns the feature PR marked ready into outbox', () => {
    expect(toStageEvent('pull_request', pull('ready_for_review', { head: 'feat/real-stages', body: 'Closes #587' })))
      .toEqual({ repository: 'acme/widgets', topic: 'real-stages', prd: 587, stage: 'outbox', at: '2026-09-29T09:00:00Z' });
  });

  it('turns the merged feature PR into shipped', () => {
    expect(toStageEvent('pull_request', pull('closed', { head: 'feat/real-stages', merged: true, body: 'Closes #587' })))
      .toEqual({ repository: 'acme/widgets', topic: 'real-stages', prd: 587, stage: 'shipped', at: '2026-09-29T10:00:00Z' });
  });

  it('turns an opened retro PR into retro, with no PRD when its body names none', () => {
    expect(toStageEvent('pull_request', pull('opened', { head: 'docs/retro-real-stages', body: 'The retro.' })))
      .toEqual({ repository: 'acme/widgets', topic: 'real-stages', prd: null, stage: 'retro', at: '2026-09-29T08:00:00Z' });
  });

  it('reads no PRD from a link line naming no PRD number (PRD 1049)', () => {
    expect(toStageEvent('pull_request', pull('closed', { head: 'docs/phase-0-x', merged: true, body: 'Refs #0' }))?.prd).toBeNull();
  });

  it('reads no PRD from a body without a link line, or from none', () => {
    expect(toStageEvent('pull_request', pull('closed', { head: 'docs/phase-0-x', merged: true, body: 'See #12 and issue 587' }))?.prd).toBeNull();
    expect(toStageEvent('pull_request', pull('closed', { head: 'docs/phase-0-x', merged: true, body: null }))?.prd).toBeNull();
  });

  it('gives no stage event for any other branch or action', () => {
    const none = [
      pull('closed', { head: 'docs/phase-0-x', merged: false }),
      pull('closed', { head: 'fix/typo', merged: true }),
      pull('closed', { head: 'feat/x--s1', base: 'main', merged: true }),
      pull('closed', { head: 'feat/x', base: 'feat/other', merged: true }),
      pull('ready_for_review', { head: 'feat/x--s1', base: 'feat/x' }),
      pull('opened', { head: 'feat/x' }),
      pull('opened', { head: 'docs/phase-0-x' }),
      pull('synchronize', { head: 'docs/retro-x' }),
      pull('closed', { head: 'docs/knowledge-x', merged: true }),
    ];
    for (const payload of none) expect(toStageEvent('pull_request', payload)).toBeNull();
    expect(toStageEvent('check_run', { action: 'rerequested', repository: REPOSITORY })).toBeNull();
    expect(toStageEvent('pull_request', { action: 'closed' })).toBeNull();
  });

  it('follows the branch shapes and link lines it is given', () => {
    const shapes = {
      branches: { phase0: 'plan/{topic}', slice: 'work/{topic}/{slice}', feature: 'work/{topic}', retro: 'retro/{topic}' },
      prLinks: { feature: 'Fixes #{prd}', sub: 'Slice of #{prd}', phase0: 'Plans #{prd}' },
    };
    expect(toStageEvent('pull_request', pull('closed', { head: 'plan/x', merged: true, body: 'Plans #9' }), shapes))
      .toMatchObject({ topic: 'x', prd: 9, stage: 'inbox' });
    expect(toStageEvent('pull_request', pull('closed', { head: 'work/x/s1', base: 'work/x', merged: true }), shapes))
      .toMatchObject({ topic: 'x', stage: 'building' });
    expect(toStageEvent('pull_request', pull('closed', { head: 'docs/phase-0-x', merged: true }), shapes)).toBeNull();
  });

  it('takes the default branch as main when the delivery does not name it', () => {
    const payload = pull('closed', { head: 'feat/x', merged: true });
    delete payload.repository.default_branch;
    expect(toStageEvent('pull_request', payload)?.stage).toBe('shipped');
    payload.repository.default_branch = 'main';
  });
});

describe('signStageEvent', () => {
  it('is an HMAC-SHA256 over the exact body', () => {
    const body = '{"stage":"inbox"}';
    expect(signStageEvent('s3cret', body)).toBe(`sha256=${createHmac('sha256', 's3cret').update(body).digest('hex')}`);
  });
});

describe('stageEventUrl', () => {
  it('is galaxy’s event route, on GALAXY_URL when set', () => {
    expect(stageEventUrl(readEnv({ GALAXY_URL: 'https://galaxy.example/' }).galaxyUrl)).toBe('https://galaxy.example/api/stages/event');
  });

  it('is on galaxy’s own domain when GALAXY_URL is unset (PRD 983)', () => {
    expect(stageEventUrl(readEnv({}).galaxyUrl)).toBe('https://www.omni-loop.xyz/api/stages/event');
  });
});

describe('forwardStageEvent', () => {
  const event: StageEvent = { repository: 'acme/widgets', topic: 'x', prd: parsePrd(3), stage: 'inbox', at: '2026-09-29T10:00:00Z' };

  it('POSTs the event signed with the secret', async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response('ok', { status: 200 })));
    const log = vi.fn();
    await forwardStageEvent(event, { url: 'https://galaxy.example/api/stages/event', secret: 'k', fetch, log });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, sent] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://galaxy.example/api/stages/event');
    const init = z.looseObject({ method: z.string(), body: z.string(), headers: z.record(z.string(), z.string()) }).parse(sent);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(event);
    expect(init.headers[STAGE_SIGNATURE_HEADER]).toBe(signStageEvent('k', init.body));
    expect(log).not.toHaveBeenCalled();
  });

  it('logs and sends nothing without a secret', async () => {
    const fetch = vi.fn();
    const log = vi.fn();
    await forwardStageEvent(event, { url: 'u', secret: undefined, fetch, log });
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('STAGE_EVENT_SECRET'));
  });

  it('logs a refused or failed POST and never throws', async () => {
    const log = vi.fn();
    await expect(forwardStageEvent(event, { url: 'u', secret: 'k', fetch: () => Promise.resolve(new Response('no', { status: 401 })), log })).resolves.toBeUndefined();
    await expect(forwardStageEvent(event, { url: 'u', secret: 'k', fetch: () => Promise.reject(new Error('down')), log })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toContain('401');
    expect(log.mock.calls[1]?.[0]).toContain('down');
  });
});
