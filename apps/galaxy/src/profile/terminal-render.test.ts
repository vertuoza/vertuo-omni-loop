import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UNREADABLE } from '../dashboard/part';
import { DEMO_VIEWER } from '../dashboard/board/demo';
import type { KitToken } from './terminal-tokens.contract';
import type { ProfileTerminal } from './load';
import { ProfileScreen, type ProfileView } from './ProfileScreen';
import { initialTerminalState, terminalReducer, TERMINAL_LINE, type TerminalAction } from './terminal-tokens';
import { TerminalTokensCard } from './TerminalTokensCard';

vi.mock('server-only', () => ({}));
const { demoProfile } = await import('./profile');

// **Terminal tokens** as the server draws it (PRD 1628 s4): on your own profile, under Alerts, your
// live kit tokens newest first with Revoke, and Make a token; on anyone else's, nothing. Revoke asks to
// confirm; at 20 live tokens Make a token says the limit is reached; the token shown once is in the
// markup only once the round trip came back; tokens that could not be read say so in place of the list.

const NOW = new Date('2026-10-11T10:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const token = (over: Partial<KitToken> = {}): KitToken => ({
  id: 'k-1', name: 'claude-cloud', lastFour: '9fKa', createdAt: '2026-10-11T08:00:00Z', lastUsedAt: '2026-10-11T09:58:00Z', expiresAt: '2027-01-09T08:00:00Z', ...over,
});
const OLDER = token({ id: 'k-0', name: 'ci-laptop', lastFour: 'Lm2Q', createdAt: '2026-08-02T08:00:00Z', lastUsedAt: null, expiresAt: '2026-12-01T08:00:00Z' });
const OMK = `omk_${'Q'.repeat(39)}9fKa`;

const ownProfile = (terminal?: ProfileTerminal): ProfileView => {
  const view = demoProfile(DEMO_VIEWER.login, '7d', NOW);
  if (view.kind !== 'profile') throw new Error('the demo has no profile of its viewer');
  return terminal ? { ...view, terminal } : view;
};
const screen = (view: ProfileView) =>
  renderToStaticMarkup(createElement(ProfileScreen, { view, supabase: null, signinError: null, query: { period: '7d' } }));
const terminalOf = (mine: ProfileTerminal['mine']): ProfileTerminal => ({ source: { kind: 'database', workspace: 'ws-1' }, slug: 'vertuoza', mine, now: NOW.getTime() });

const card = (actions: TerminalAction[] = [], start: { tokens: KitToken[] | null; live: number | null } = { tokens: [OLDER, token()], live: 2 }) =>
  renderToStaticMarkup(createElement(TerminalTokensCard, {
    state: actions.reduce(terminalReducer, initialTerminalState(start)), workspace: 'vertuoza', back: '/app/people/ada', now: NOW.getTime(),
  }));

describe('Terminal tokens on a profile', () => {
  it('shows on your own profile, after Alerts’ place, with your tokens newest first', () => {
    const html = screen(ownProfile(terminalOf({ tokens: [OLDER, token()], live: 2, limit: 20 })));
    const said = text(html);
    expect(said).toContain(`${TERMINAL_LINE.title} ${TERMINAL_LINE.intro}`);
    expect(said).toContain('claude-cloud ··9fKa Made 11 Oct · Used 2 min ago · Expires 9 Jan Revoke');
    expect(said).toContain('ci-laptop ··Lm2Q Made 2 Aug · Never used · Expires 1 Dec Revoke');
    expect(said.indexOf('claude-cloud')).toBeLessThan(said.indexOf('ci-laptop'));
    expect(said.indexOf(TERMINAL_LINE.title)).toBeLessThan(said.indexOf('Season and counts'));
  });

  it('is absent from anyone else’s profile', () => {
    const someone = demoProfile('paul-e', '7d', NOW);
    expect(someone.kind === 'profile' && !someone.own).toBe(true);
    expect(text(screen(someone))).not.toContain(TERMINAL_LINE.title);
    expect(screen(ownProfile())).toContain(TERMINAL_LINE.title);
  });

  it('says it could not load in place of the list, and keeps Make a token', () => {
    const said = text(screen(ownProfile(terminalOf(UNREADABLE))));
    expect(said).toContain('Couldn’t load this. Reload in a moment.');
    expect(said).toContain(TERMINAL_LINE.make);
  });
});

describe('the section', () => {
  it('sends Make a token to the sign-in round trip, with a name and 30, 90 or 365 days, back to your profile', () => {
    const html = card();
    expect(html).toContain('<form class="terminal-make" action="/ask/signin" method="get">');
    for (const field of ['name="purpose" value="token"', 'name="workspace" value="vertuoza"', 'name="back" value="/app/people/ada"']) expect(html).toContain(field);
    expect(html).toContain('<input type="text" required="" maxLength="40" placeholder="cloud-agent" name="name"/>');
    expect(html).toContain('<option value="30">30 days</option><option value="90" selected="">90 days</option><option value="365">365 days</option>');
    expect(html).toMatch(/<button type="submit" class="ask-button" data-primary="true">Make a token<\/button>/);
  });

  it('asks to confirm Revoke', () => {
    expect(text(card())).not.toContain('Revoke ··9fKa?');
    const said = text(card([{ type: 'confirm', id: 'k-1' }]));
    expect(said).toContain('claude-cloud ··9fKa Made 11 Oct · Used 2 min ago · Expires 9 Jan Revoke ··9fKa? Revoke Keep');
    expect(said).toContain('ci-laptop ··Lm2Q Made 2 Aug · Never used · Expires 1 Dec Revoke');
  });

  it('says the limit is reached at 20 live tokens', () => {
    expect(text(card([], { tokens: [token()], live: 19 }))).not.toContain(TERMINAL_LINE.limit);
    const html = card([], { tokens: [token()], live: 20 });
    expect(text(html)).toContain(TERMINAL_LINE.limit);
    expect(html).toMatch(/data-primary="true" disabled="">Make a token/);
  });

  it('shows no list with no live token, and keeps the line and the form', () => {
    const said = text(card([], { tokens: [], live: 0 }));
    expect(said).toBe(`${TERMINAL_LINE.title} ${TERMINAL_LINE.intro} ${TERMINAL_LINE.name} ${TERMINAL_LINE.expiresIn} 30 days 90 days 365 days ${TERMINAL_LINE.make}`);
  });

  it('holds no token in its markup, but the one shown once, in a copy field, once the round trip came back', () => {
    expect(card()).not.toContain('omk_');
    const html = card([{ type: 'shown', shown: { name: 'claude-cloud', token: OMK, expiresAt: '2027-01-09T08:00:00Z' } }]);
    expect(html.split(OMK).length - 1).toBe(1);
    expect(html).toContain(`<code data-token-shown="true">${OMK}</code>`);
    expect(text(html)).toContain(`claude-cloud · shown once · Expires 9 Jan ${OMK} Copy Paste as OMNI_TOKEN= in your environment.`);
  });
});
