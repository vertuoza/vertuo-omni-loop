import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sendOpen } from '../../outbox/open';
import type { SentView } from '../../outbox/sent';
import type { GithubSummary } from '../github/summary';
import { OutboxPane, sendOffOf } from './OutboxPane';
import { OutboxSend, SendResult } from './OutboxSend';
import { outboxView, SEND_OFF } from './outbox-view';

// Send, wired on the Outbox tab (PRD 251, s11): open once this deployment knows the omni-loop App's
// client, off in the demo and before; and what the tab says once GitHub sent the person back. Rendered as
// the server renders it, before any script runs.

const PR = 'https://github.com/acme/widgets/pull/12';
const summary: GithubSummary = {
  repo: 'acme/widgets', prd: 7, folder: '0007-widgets', topic: 'widgets',
  issue: { number: 7, url: 'https://github.com/acme/widgets/issues/7', state: 'open' },
  phase0: null, feature: { number: 12, url: PR, state: 'open', draft: true, mergedAt: null }, retro: null, mergedSlices: 1,
  outbox: {
    open: [{ id: 's11-01-colour', rank: 'high', question: 'Blue?', decision: 'Blue.', options: [{ letter: 'A', text: 'Blue.' }, { letter: 'B', text: 'Red.' }], personSteps: null }],
    settled: [], adopted: [],
  },
  outboxComment: `${PR}#issuecomment-1`,
  replies: { numbering: [{ number: 1, id: 's11-01-colour' }], pending: [] },
};
const render = (canSend: boolean, demo = false) =>
  renderToStaticMarkup(createElement(OutboxPane, { dossierId: 'd1', outbox: outboxView(summary, { demo }), spec: null, canSend }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Send on the tab', () => {
  it('is open once the deployment may send: no reason shown beside it', () => {
    const html = render(true);
    expect(html).toMatch(/<button type="button" class="ask-button" disabled="">Send 0 answers<\/button>/);
    expect(html).not.toContain(SEND_OFF.notYet);
  });

  it('says why it is off before then, and in the demo whatever the deployment', () => {
    expect(render(false)).toContain(SEND_OFF.notYet);
    expect(render(true, true)).toContain(SEND_OFF.demo);
    expect(sendOffOf(outboxView(summary, { demo: true }), true)).toBe(SEND_OFF.demo);
    expect(sendOffOf(outboxView(summary), false)).toBe(SEND_OFF.notYet);
    expect(sendOffOf(outboxView(summary), true)).toBeNull();
  });

  it('counts the answers the picks give, and is enabled once one is given', () => {
    const questions = [{ number: 1, kind: 'decision' as const, adopted: false, letters: ['A', 'B'] }];
    const html = renderToStaticMarkup(createElement(OutboxSend, {
      dossierId: 'd1', questions, picks: { 1: { pick: 'B', reason: '' } }, count: 1, sendOff: null, onDrop: () => {},
    }));
    expect(html).toBe('<button type="button" class="ask-button">Send 1 answer</button>');
  });
});

describe('whether the deployment may send', () => {
  const env = {
    GITHUB_APP_CLIENT_ID: 'Iv1.client', GITHUB_APP_CLIENT_SECRET: 'shh', NEXT_PUBLIC_SUPABASE_URL: 'http://db', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
  };
  it('needs the App\'s client id and secret, and a database', () => {
    expect(sendOpen(env)).toBe(true);
    expect(sendOpen({ ...env, GITHUB_APP_CLIENT_ID: '' })).toBe(false);
    expect(sendOpen({ ...env, GITHUB_APP_CLIENT_SECRET: ' ' })).toBe(false);
    expect(sendOpen({ ...env, NEXT_PUBLIC_SUPABASE_URL: undefined })).toBe(false);
  });
});

describe('what the tab says of a send', () => {
  const posted: SentView = {
    state: 'posted', login: 'ada', url: `${PR}#issuecomment-99`, counted: true, next: '/omni:yolo-fix 7', reply: '1: B', at: '2026-09-28T10:06:00Z',
  };
  const say = (sent: SentView) => renderToStaticMarkup(createElement(SendResult, { sent }));

  it('posted: Sent as @login, the reply\'s link, and the next step with a copy button', () => {
    const html = say(posted);
    expect(html).toContain('<b>Sent as @ada</b>');
    expect(html).toContain(`<a href="${PR}#issuecomment-99" target="_blank" rel="noopener noreferrer">the reply on the pull request</a>`);
    expect(html).toContain('<code>/omni:yolo-fix 7</code>');
    expect(html).toContain('>Copy</button>');
    expect(html).not.toContain('will not read');
  });

  it('posted: the sender\'s face before @login when the page knows it (PRD 652)', () => {
    const html = renderToStaticMarkup(createElement(SendResult, { sent: posted, sender: { kind: 'initial', letter: 'A' } }));
    expect(html).toContain('<b>Sent as <span class="person-chip is-inline"><span class="person-face is-initial" aria-hidden="true" data-initial="A"></span>@ada</span></b>');
  });

  it('an author the kit does not count: said, with what it means', () => {
    const html = text(say({ ...posted, login: 'visitor', counted: false }));
    expect(html).toContain('GitHub does not list @visitor as an owner, member or collaborator of this repository, so /omni:yolo-fix will not read this reply.');
  });

  it('failed, or never sent back: why, and that the answers are kept', () => {
    expect(text(say({ state: 'failed', error: 'GitHub did not answer, so nothing was posted. Try again in a moment.' })))
      .toContain('GitHub did not answer, so nothing was posted. Try again in a moment. Your answers are kept: send them again.');
    expect(text(say({ state: 'waiting' }))).toContain('nothing was posted. Your answers are kept');
  });
});
