import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { McpServerCard } from './McpServerCard';
import { cardFrom, claudeCodeCommand, cursorEntry, mcpUrl, originFrom, type McpCard } from './mcp-server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

// The MCP server card as the server draws it (PRD 2707 s4): off and on, a workspace owner and another member,
// an archived product, and the URL and setup lines naming the product's key. Fictional product only.

const CARD: McpCard = { key: 'acme', on: false, owner: true, archived: false, origin: 'https://omni.example', missing: [] };
const draw = (card: Partial<McpCard>) =>
  renderToStaticMarkup(createElement(McpServerCard, { card: { ...CARD, ...card }, product: 'p-1', source: { kind: 'demo' } }));

describe('McpServerCard', () => {
  it('off: says so in two lines and offers Turn on to an owner', () => {
    const html = draw({});
    expect(html).toContain('Off');
    expect(html).toContain('Agents can’t read this product’s knowledge yet.');
    expect(html).toContain('Then every API key reads it.');
    expect(html).toContain('Turn on');
    expect(html).not.toContain('data-mcp-url');
  });

  it('on: shows the URL, the copy buttons, the keys link and Turn off with its line', () => {
    const html = draw({ on: true });
    expect(html).toContain('Any workspace API key reads its knowledge.');
    expect(html).toContain('https://omni.example/api/products/acme/mcp');
    for (const label of ['Copy', 'Copy for Claude Code', 'Copy for Cursor']) expect(html).toContain(`>${label}</button>`);
    expect(html).toContain('href="/app/settings/api-keys"');
    expect(html).toContain('Turn off');
    expect(html).toContain('Stops agents on their next call.');
  });

  it('names each repository with no knowledge pack yet', () => {
    const html = draw({ on: true, missing: ['acme/api', 'acme/web'] });
    expect(html).toContain('No knowledge yet from acme/api.');
    expect(html).toContain('No knowledge yet from acme/web.');
  });

  it('a member who is not an owner sees the state and the URL, with no switch', () => {
    const off = draw({ owner: false });
    expect(off).toContain('Off');
    expect(off).not.toContain('Turn on');
    const on = draw({ owner: false, on: true });
    expect(on).toContain('data-mcp-url');
    expect(on).toContain('Copy for Cursor');
    expect(on).not.toContain('Turn off');
  });

  it('an archived product is read-only, even for an owner', () => {
    const html = draw({ on: true, archived: true });
    expect(html).toContain('data-mcp-url');
    expect(html).not.toContain('Turn off');
    expect(draw({ archived: true })).not.toContain('Turn on');
  });
});

describe('what the card is made from', () => {
  const ROW = { key: 'acme', mcp_enabled: true, archived_at: null };
  it('reads the origin from the forwarded host and scheme, else the host', () => {
    expect(originFrom('omni.example', 'https')).toBe('https://omni.example');
    expect(originFrom('omni.example', null)).toBe('https://omni.example');
    expect(originFrom('localhost:3000', null)).toBe('http://localhost:3000');
    expect(originFrom(null, null)).toBe('http://localhost:3000');
  });
  it('an owner owns, any other role or none does not', () => {
    expect(cardFrom(ROW, 'owner', 'o', []).owner).toBe(true);
    expect(cardFrom(ROW, 'member', 'o', []).owner).toBe(false);
    expect(cardFrom(ROW, null, 'o', []).owner).toBe(false);
  });
  it('archived and on come from the row, and an off server names no missing pack', () => {
    expect(cardFrom({ ...ROW, archived_at: '2027-01-01T00:00:00Z' }, null, 'o', ['acme/api'])).toMatchObject({ archived: true, on: true, missing: ['acme/api'] });
    expect(cardFrom({ ...ROW, mcp_enabled: false }, null, 'o', ['acme/api'])).toMatchObject({ on: false, missing: [] });
  });
});

describe('the setup lines', () => {
  const url = mcpUrl('https://omni.example/', 'acme');
  it('write the URL from the key, whatever slash the origin ends with', () => {
    expect(url).toBe('https://omni.example/api/products/acme/mcp');
    expect(mcpUrl('https://omni.example', null)).toBeNull();
  });
  it('name the key in the Claude Code command, with a placeholder and never a secret', () => {
    const line = claudeCodeCommand('acme', url as string);
    expect(line).toBe('claude mcp add --transport http acme-knowledge https://omni.example/api/products/acme/mcp --header "Authorization: Bearer oma_…"');
  });
  it('name the key and the URL in the Cursor entry', () => {
    expect(JSON.parse(cursorEntry('acme', url as string))).toEqual({
      mcpServers: { 'acme-knowledge': { url, headers: { Authorization: 'Bearer oma_…' } } },
    });
  });
});
