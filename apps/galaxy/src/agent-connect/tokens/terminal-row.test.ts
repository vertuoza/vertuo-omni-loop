import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConnectAgentCard, REVOKE, TERMINAL_TOKEN } from './ConnectAgentCard';
import { expiresLabel, isTerminalToken, tokenOf, type AgentToken } from './model';
import { initialTokensState, tokensReducer } from './state';

// Members' terminal tokens where every link is listed (PRD 1628 s4): agent_tokens_list() hands an owner
// every member's live kit tokens, and their maker their own; each reads `terminal token` and the day it
// expires, with Revoke for whoever may. A database from before PRD 1628 sends no scope: a link.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const row = (over: Partial<AgentToken> = {}): AgentToken => ({
  id: 't-1', name: 'Tom’s editor', lastFour: 'Zz09', createdAt: '2026-10-01T08:00:00Z', lastUsedAt: null,
  maker: { id: 'u-1', login: 'tom', name: 'Tom' }, mine: true, canRevoke: true, working: true, ...over,
});
const KIT = row({ id: 'k-1', name: 'claude-cloud', lastFour: '9fKa', scope: 'kit', expiresAt: '2027-01-09T08:00:00Z', mine: false, maker: { id: 'u-2', login: 'ada', name: 'Ada' } });

describe('a terminal token where links are listed', () => {
  it('reads its scope and expiry, and a row with neither as a link', () => {
    expect(tokenOf(KIT)).toEqual(KIT);
    expect(isTerminalToken(KIT)).toBe(true);
    expect(expiresLabel(KIT)).toBe('expires 9 Jan 2027');
    expect(isTerminalToken(row())).toBe(false);
    expect(expiresLabel(row({ scope: 'business', expiresAt: null }))).toBeNull();
    expect(tokenOf({ ...KIT, scope: 'other' })).toBeNull();
  });

  it('shows an owner a member’s terminal token, with the day it expires and Revoke', () => {
    const html = renderToStaticMarkup(createElement(ConnectAgentCard, { state: initialTokensState([KIT, row()]) }));
    const said = text(html);
    expect(said).toContain(`claude-cloud ${TERMINAL_TOKEN} made by Ada created 1 Oct 2026 never used expires 9 Jan 2027 …9fKa ${REVOKE}`);
    expect(said).toContain('Tom’s editor made by you created 1 Oct 2026 never used …Zz09 Revoke');
    expect(html).toContain('data-scope="kit"');
    expect(html).toContain(`aria-label="${REVOKE} claude-cloud"`);
  });

  it('leaves the list once revoked', () => {
    const state = tokensReducer(initialTokensState([KIT, row()]), { type: 'revoked', id: 'k-1' });
    expect(state.tokens.map((t) => t.id)).toEqual(['t-1']);
  });
});
