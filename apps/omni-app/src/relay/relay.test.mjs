import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { evaluate } from '../evaluate/evaluate.mjs';
import { readOutbox, relayBody, relayTarget, sendOutbox, signBody } from './relay.mjs';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);
const configOf = (name) => parseConfig(readFileSync(join(fixture(name), '.omni-loop/config.yml'), 'utf8'));
const PR = { baseRef: 'main', headRef: 'feat/widget', headSha: 'head1', labels: [] };
const NOW = () => '2026-09-27T10:00:00.000Z';

/** The outbox comment the check writes on this head, as the evaluation plans it. */
function checkComment(head = 'head-answers', comments = []) {
  const verdict = evaluate({ base: fixture('base-answers'), head: fixture(head), pr: PR, comments, now: NOW });
  return verdict.comment.body;
}

const reply = (id, login, association, body, at) => ({
  id,
  body,
  user: { login },
  author_association: association,
  created_at: at,
  html_url: `https://github.com/acme/widgets/pull/12#issuecomment-${id}`,
});

describe('relayTarget — whether the outbox goes to the page', () => {
  it('goes to the page when the switch is on and ask.url is on the page’s host', () => {
    expect(relayTarget({ config: configOf('base-answers'), pageUrl: 'https://omni.example/' })).toBe('https://omni.example');
  });

  it('goes nowhere with the switch off', () => {
    expect(relayTarget({ config: configOf('base-answers-off'), pageUrl: 'https://omni.example' })).toBeNull();
  });

  it('goes nowhere when ask.url names another host, or none', () => {
    expect(relayTarget({ config: configOf('base-answers-elsewhere'), pageUrl: 'https://omni.example' })).toBeNull();
    expect(relayTarget({ config: configOf('base-active'), pageUrl: 'https://omni.example' })).toBeNull();
  });

  it('goes nowhere when the App has no page, or no config was read', () => {
    expect(relayTarget({ config: configOf('base-answers'), pageUrl: undefined })).toBeNull();
    expect(relayTarget({ config: configOf('base-answers'), pageUrl: 'not a url' })).toBeNull();
    expect(relayTarget({ config: null, pageUrl: 'https://omni.example' })).toBeNull();
  });
});

describe('readOutbox — what the check evaluated, as the page keeps it', () => {
  it('numbers the open items as the comment does, each with its file verbatim', () => {
    const outbox = readOutbox({ head: fixture('head-answers'), config: configOf('base-answers'), pr: PR, commentBody: checkComment() });
    expect(outbox.prd).toBe(42);
    expect(outbox.numbering.map(({ number, id }) => [number, id])).toEqual([
      [1, 's1-02-widget-key'],
      [2, 's1-01-widget-colour'],
      [3, 's1-03-widget-size'],
    ]);
    const colour = readFileSync(join(fixture('head-answers'), '.omni-loop/delivery/outbox/0042-widget/s1-01-widget-colour.md'), 'utf8');
    expect(outbox.open).toEqual([
      { number: 1, id: 's1-02-widget-key', rank: 'human-action', text: expect.stringContaining('What a person must do') },
      { number: 2, id: 's1-01-widget-colour', rank: 'high', text: colour },
    ]);
  });

  it('carries every numbered adopted item with its item text, so a person can object', () => {
    const outbox = readOutbox({ head: fixture('head-answers'), config: configOf('base-answers'), pr: PR, commentBody: checkComment() });
    expect(outbox.adopted).toEqual([
      { number: 3, id: 's1-03-widget-size', text: expect.stringContaining('How large should the widget be?') },
    ]);
  });

  it('carries every settled entry with its verdict, who approved it, when, its channel and its answer', () => {
    const outbox = readOutbox({ head: fixture('head-answers'), config: configOf('base-answers'), pr: PR, commentBody: checkComment() });
    expect(outbox.settled).toEqual([
      {
        number: null,
        id: 's1-00-widget-name',
        verdict: 'agreed',
        approvedBy: 'ada',
        approvedAt: '2026-09-26T10:00:00Z',
        channel: 'feature pull request #12',
        channelUrl: 'https://github.com/acme/widgets/pull/12#issuecomment-5',
        answer: 'A. Keep it as built.',
      },
    ]);
  });

  it('reads pending answers with planReplies: one per number, who, when, where and the link', () => {
    const body = checkComment();
    const comments = [
      { id: 1, body, user: { login: 'omni-loop[bot]' }, author_association: 'NONE', created_at: '2026-09-27T09:00:00Z', html_url: 'x#1' },
      reply(2, 'bob', 'MEMBER', '2: A', '2026-09-27T09:10:00Z'),
      reply(3, 'ada', 'OWNER', '2: B because red is the brand\n1: ok\n\n_answered on the Omni page · PRD 42_', '2026-09-27T09:20:00Z'),
      reply(4, 'stranger', 'NONE', '1: no, because I say so', '2026-09-27T09:30:00Z'),
      reply(5, 'cy', 'COLLABORATOR', '3: B because it is too small', '2026-09-27T09:40:00Z'),
    ];
    const outbox = readOutbox({ head: fixture('head-answers'), config: configOf('base-answers'), pr: PR, comments, commentBody: body });
    expect(outbox.pending).toEqual([
      { number: 1, id: 's1-02-widget-key', text: 'ok', by: 'ada', at: '2026-09-27T09:20:00Z', url: comments[2].html_url, via: 'page' },
      { number: 2, id: 's1-01-widget-colour', text: 'B because red is the brand', by: 'ada', at: '2026-09-27T09:20:00Z', url: comments[2].html_url, via: 'page' },
      { number: 3, id: 's1-03-widget-size', text: 'B because it is too small', by: 'cy', at: '2026-09-27T09:40:00Z', url: comments[4].html_url, via: 'github' },
    ]);
  });

  it('names the terminal as the door of a reply the terminal wrote', () => {
    const body = checkComment();
    const comments = [
      { id: 1, body, user: { login: 'omni-loop[bot]' }, author_association: 'NONE', created_at: '2026-09-27T09:00:00Z', html_url: 'x#1' },
      reply(2, 'bob', 'MEMBER', '2: A\n\n_answered in the terminal · PRD 42_', '2026-09-27T09:10:00Z'),
    ];
    const outbox = readOutbox({ head: fixture('head-answers'), config: configOf('base-answers'), pr: PR, comments, commentBody: body });
    expect(outbox.pending).toEqual([expect.objectContaining({ number: 2, by: 'bob', via: 'terminal' })]);
  });

  it('takes the numbering from the comment already there when the check planned none', () => {
    const body = checkComment();
    const comments = [{ id: 1, body, created_at: '2026-09-27T09:00:00Z' }];
    const outbox = readOutbox({ head: fixture('head-answers'), config: configOf('base-answers'), pr: PR, comments, commentBody: null });
    expect(outbox.numbering).toHaveLength(3);
  });

  it('is null on a pull request that is not a feature pull request', () => {
    const head = fixture('head-answers');
    const config = configOf('base-answers');
    expect(readOutbox({ head, config, pr: { ...PR, baseRef: 'develop' } })).toBeNull();
    expect(readOutbox({ head, config, pr: { ...PR, headRef: 'fix/widget' } })).toBeNull();
    expect(readOutbox({ head, config, pr: { ...PR, headRef: 'feat/gadget' } })).toBeNull();
  });
});

describe('relayBody and sendOutbox — the signed send', () => {
  const outbox = { prd: 42, numbering: [], open: [], adopted: [], pending: [], settled: [] };
  const body = relayBody({
    repository: 'acme/widgets',
    pr: { number: 12, headSha: 'head1', state: 'open' },
    evaluatedAt: '2026-09-27T10:00:00.000Z',
    outbox,
  });

  it('carries the repository, the PRD, the pull request and when it was evaluated', () => {
    expect(body).toEqual({
      repo: 'acme/widgets',
      prd: 42,
      pr: { number: 12, url: 'https://github.com/acme/widgets/pull/12', headSha: 'head1', state: 'open' },
      evaluatedAt: '2026-09-27T10:00:00.000Z',
      numbering: [],
      open: [],
      adopted: [],
      pending: [],
      settled: [],
    });
  });

  it('posts the raw body to /api/outbox, signed with the shared secret', async () => {
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'd1', url: 'https://omni.example/prd/d1?tab=outbox' }), { status: 200 });
    };
    const sent = await sendOutbox({ fetch, origin: 'https://omni.example', secret: 'shh', body });
    expect(sent).toEqual({ status: 200, url: 'https://omni.example/prd/d1?tab=outbox' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://omni.example/api/outbox');
    const raw = calls[0].init.body;
    expect(JSON.parse(raw)).toEqual(body);
    expect(calls[0].init.headers['x-omni-signature']).toBe(`sha256=${createHmac('sha256', 'shh').update(raw).digest('hex')}`);
    expect(signBody(raw, 'shh')).toBe(calls[0].init.headers['x-omni-signature']);
  });

  it('throws on a refusal, so the step is retried', async () => {
    const fetch = async () => new Response('{"error":"bad signature"}', { status: 401 });
    await expect(sendOutbox({ fetch, origin: 'https://omni.example', secret: 'shh', body })).rejects.toThrow(/401/);
  });

  it('refuses to send without a secret', async () => {
    const fetch = async () => new Response('{}', { status: 200 });
    await expect(sendOutbox({ fetch, origin: 'https://omni.example', secret: '', body })).rejects.toThrow(/OMNI_OUTBOX_SECRET/);
  });
});
