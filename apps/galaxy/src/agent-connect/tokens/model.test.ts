import { describe, expect, it } from 'vitest';
import { lastUsedLabel, makerLabel, mcpUrlOf, nameOf, setupsOf, tokenOf, type AgentToken } from './model';

// What Connect an agent shows of a link, and the setup a person pastes (PRD 855 s1).

const link = (over: Partial<AgentToken> = {}): AgentToken => ({
  id: 't-1', name: 'Tom’s editor', lastFour: 'Zz09', createdAt: '2026-10-01T08:00:00Z', lastUsedAt: null,
  maker: { id: 'u-1', login: 'tom', name: 'Tom' }, mine: true, canRevoke: true, working: true, ...over,
});

describe('the setups', () => {
  const url = mcpUrlOf('https://galaxy.example/');
  const token = `omb_${'A'.repeat(43)}`;

  it('give Cursor, Claude Code and any MCP client the URL and the bearer header', () => {
    expect(url).toBe('https://galaxy.example/api/mcp');
    const setups = setupsOf(url, token);
    expect(setups.map((s) => s.label)).toEqual(['Cursor', 'Claude Code', 'Any MCP client']);
    for (const s of setups) {
      expect(s.text, s.label).toContain(url);
      expect(s.text, s.label).toContain('Authorization');
      expect(s.text, s.label).toContain(`Bearer ${token}`);
    }
    expect(JSON.parse(setups[0]!.text)).toEqual({ mcpServers: { 'omni-business': { url, headers: { Authorization: `Bearer ${token}` } } } });
    expect(setups[1]!.text).toBe(`claude mcp add --transport http omni-business ${url} --header "Authorization: Bearer ${token}"`);
  });
});

describe('a link as listed', () => {
  it('reads the database’s answer, never with a hash in it', () => {
    expect(tokenOf(link())).toEqual(link());
    expect(tokenOf({ ...link(), lastFour: 'toolong' })).toBeNull();
    expect(Object.keys(tokenOf({ ...link(), hash: 'a'.repeat(64) }) ?? {})).not.toContain('hash');
  });

  it('names its maker, and says when it was last used', () => {
    expect(makerLabel(link())).toBe('Tom');
    expect(makerLabel(link({ maker: { id: 'u', login: 'tom', name: null } }))).toBe('@tom');
    expect(makerLabel(link({ maker: { id: 'u', login: null, name: null } }))).toBe('someone');
    expect(lastUsedLabel(link())).toBe('never used');
    expect(lastUsedLabel(link({ lastUsedAt: '2026-10-01T09:30:00Z' }))).toBe('last used 1 Oct 2026');
  });

  it('takes a name of 1 to 40 characters on one line', () => {
    expect(nameOf('  Tom’s editor ')).toBe('Tom’s editor');
    for (const bad of ['', '  ', 'n'.repeat(41), 'a\tb', null]) expect(nameOf(bad)).toBeNull();
  });
});
