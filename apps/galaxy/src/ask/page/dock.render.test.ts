import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PlayDockProps } from '../../play-dock/PlayDock';
import type { AskDock } from './dock-player';
import type { SessionState } from './view';

// The /ask tab's play dock (PRD 757), as the server renders the tab: the dock itself draws nothing
// before the browser measures the window (play-dock's own tests), so it is stubbed here to show what
// the tab hands it. The "Claude is working" card stays exactly as it was, beside it.
vi.mock('../../play-dock/PlayDock', () => ({
  PlayDock: (props: PlayDockProps) => createElement('i', { 'data-dock': props.state, 'data-href': props.answerHref }),
}));
const { AskSession } = await import('./AskSession');

const NOW = Date.parse('2026-09-30T10:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const QUESTIONS = [{ question: 'Which storage?', header: 'Storage', multiSelect: false, options: [{ label: 'Postgres', description: '' }, { label: 'Memory', description: '' }] }];
const DOCK: AskDock = { player: { linked: true, xp: { xp: 180, level: 3, unlocked: ['invaders'] } }, hero: null, team: null, workspace: 'ws', supabase: { url: 'u', key: 'k' } };

function tab(patch: Partial<SessionState> = {}): SessionState {
  return {
    session: { id: 'session-1', owner: 'ada', title: 'vertuo-omni-loop · feat/play-while-working', status: 'open', created_at: at(3_600_000), last_seen_at: at(1000), claude_session_id: 'claude-1' },
    rounds: [],
    ping: { seen_at: at(20_000), ended_at: null },
    ...patch,
  };
}

const render = (initial: SessionState, dock: AskDock | null = DOCK, viewer: 'owner' | 'member' = 'owner') =>
  renderToStaticMarkup(createElement(AskSession, { source: { kind: 'demo' }, initial, serverNow: NOW, viewer, me: 'ada', dock }));
const dockOf = (html: string) => html.match(/data-dock="([a-z]+)"/)?.[1] ?? null;

describe('the /ask tab offers the game while its terminal works (PRD 757)', () => {
  it('while its terminal\'s heartbeat is fresh, the dock is working, beside the unchanged "Claude is working" card', () => {
    const html = render(tab());
    expect(dockOf(html)).toBe('working');
    expect(html).toContain('<h1 class="ask-working">Claude is working</h1>');
  });

  it('with no heartbeat, a stale one or an ended one, the dock is idle, so no pill', () => {
    expect(dockOf(render(tab({ ping: null })))).toBe('idle');
    expect(dockOf(render(tab({ ping: { seen_at: at(180_000), ended_at: null } })))).toBe('idle');
    expect(dockOf(render(tab({ ping: { seen_at: at(20_000), ended_at: at(5000) } })))).toBe('idle');
  });

  it('the open question pauses it, and ⏸ CLAUDE ASKED · ANSWER leads to the question on this page', () => {
    const open = { id: 'r1', questions: QUESTIONS, answers: null, answered_via: null, status: 'open' as const, created_at: at(30_000), answered_at: null };
    const html = render(tab({ rounds: [open] }));
    expect(dockOf(html)).toBe('asking');
    expect(html).toContain('data-href="#ask-question"');
    expect(html).toContain('id="ask-question"');
  });

  it('a teammate\'s session, read-only, has no dock', () => {
    expect(dockOf(render(tab(), null, 'member'))).toBeNull();
  });
});
