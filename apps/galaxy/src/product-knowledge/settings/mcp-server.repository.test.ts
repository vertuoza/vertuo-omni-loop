import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { mcpProductOf, roleIn, setMcp } from './mcp-server.repository';
import { switchServer } from './mcp-port';

const created = vi.hoisted(() => ({ rpc: [] as unknown[][] }));
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({ rpc: (...args: unknown[]) => { created.rpc.push(args); return Promise.resolve({ error: null }); } }),
}));

// The MCP server card's storage and browser write (PRD 2707 s4), on stubbed clients: a read that fails reads as
// nothing, and the switch is product_mcp_set() with the product and the new state, as the signed-in person.

const reading = (data: unknown, error: unknown = null): Pick<SupabaseClient, 'from'> => {
  const done = () => Promise.resolve({ data, error });
  return { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: done }), maybeSingle: done }) }) }) } as unknown as Pick<SupabaseClient, 'from'>;
};

describe('the MCP server card storage', () => {
  it('reads the product row, and nothing when the read fails', async () => {
    const row = { key: 'acme', mcp_enabled: true, archived_at: null };
    expect(await mcpProductOf(reading(row), 'p-1')).toEqual(row);
    expect(await mcpProductOf(reading(null, { message: 'x' }), 'p-1')).toBeNull();
  });

  it('reads the role, and nothing when the read fails', async () => {
    expect(await roleIn(reading({ role: 'owner' }), 'w-1', 'u-1')).toBe('owner');
    expect(await roleIn(reading(null), 'w-1', 'u-1')).toBeUndefined();
    expect(await roleIn(reading(null, { message: 'x' }), 'w-1', 'u-1')).toBeNull();
  });

  it('switches through product_mcp_set, accepted or refused', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: '42501' } });
    expect(await setMcp({ rpc }, 'p-1', true)).toBe(true);
    expect(await setMcp({ rpc }, 'p-1', false)).toBe(false);
    expect(rpc).toHaveBeenCalledWith('product_mcp_set', { p_product: 'p-1', p_on: true });
  });
});

describe('the browser write', () => {
  it('writes nowhere in the demo', async () => {
    expect(await switchServer({ kind: 'demo' }, 'p-1', true)).toBe(true);
    expect(created.rpc).toEqual([]);
  });

  it('calls product_mcp_set as the signed-in person', async () => {
    expect(await switchServer({ kind: 'database', url: 'https://db.example', key: 'pk', workspace: 'w-1' }, 'p-1', false)).toBe(true);
    expect(created.rpc).toEqual([['product_mcp_set', { p_product: 'p-1', p_on: false }]]);
  });
});
