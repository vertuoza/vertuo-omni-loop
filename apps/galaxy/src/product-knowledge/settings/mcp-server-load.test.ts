import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeReader } from '../constituents/knowledge-reader';

// The MCP server card's read (PRD 2707 s4), with the reader, the request headers and the packs stubbed: the
// card is drawn from the caller's own rows, never from a service role, and a repository with no pack is named
// only while the server is on. Fictional product only.

interface Stubs {
  reader: unknown;
  packs: Record<string, 'ok' | 'missing' | 'failed'>;
  held: { plan: string | null; repositories: string[] } | null;
}

const state = vi.hoisted((): Stubs => ({ reader: { kind: 'unreadable' }, packs: {}, held: null }));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers({ host: 'omni.example', 'x-forwarded-proto': 'https' })) }));
vi.mock('../constituents/knowledge-reader', () => ({
  knowledgeReader: () => Promise.resolve(state.reader),
  writeSourceOf: () => ({ kind: 'database', url: 'u', key: 'k', workspace: 'w-1' }),
}));
vi.mock('../repositories/repositories.repository', () => ({ productRepositoriesOf: () => Promise.resolve(state.held) }));
vi.mock('../../knowledge-packs/knowledge-packs.repository', () => ({ knowledgePacksRepository: () => ({}) }));
vi.mock('../../knowledge-packs/knowledge-packs.service', () => ({
  knowledgePacksService: () => ({
    read: ({ repo }: { repo: string }) => {
      const pack = state.packs[repo] ?? 'ok';
      return Promise.resolve(pack === 'ok' ? { ok: true } : { ok: false, kind: pack });
    },
  }),
}));

import { loadMcpCard } from './mcp-server-load';

const query = (data: unknown, error: unknown = null) => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data, error }) }), maybeSingle: () => Promise.resolve({ data, error }) }) });
const database = (row: unknown, role: unknown): KnowledgeReader =>
  ({
    kind: 'database', me: 'u-1', workspace: 'w-1', env: { url: 'u', key: 'k' },
    db: { from: (table: string) => ({ select: () => query(table === 'products' ? row : role) }) },
  }) as unknown as KnowledgeReader;

describe('loadMcpCard', () => {
  beforeEach(() => {
    state.packs = {};
    state.held = { plan: null, repositories: ['acme/api', 'acme/web'] };
  });

  it('draws an off card for an owner in the demo, writing nowhere', async () => {
    state.reader = { kind: 'demo' };
    const read = await loadMcpCard('p-1');
    expect(read?.source).toEqual({ kind: 'demo' });
    expect(read?.card).toMatchObject({ on: false, owner: true, origin: 'https://omni.example' });
  });

  it('draws nothing for a visitor who cannot read', async () => {
    state.reader = { kind: 'unreadable' };
    expect(await loadMcpCard('p-1')).toBeNull();
  });

  it('draws nothing when the product cannot be read', async () => {
    state.reader = database(null, { role: 'owner' });
    expect(await loadMcpCard('p-1')).toBeNull();
  });

  it('names the repositories with no pack yet while the server is on, and reads the role', async () => {
    state.reader = database({ key: 'acme', mcp_enabled: true, archived_at: null }, { role: 'member' });
    state.packs = { 'acme/web': 'missing', 'acme/api': 'failed' };
    const read = await loadMcpCard('p-1');
    expect(read?.card).toEqual({ key: 'acme', on: true, owner: false, archived: false, origin: 'https://omni.example', missing: ['acme/web'] });
  });

  it('names none while the server is off, and finds an owner', async () => {
    state.reader = database({ key: 'acme', mcp_enabled: false, archived_at: null }, { role: 'owner' });
    state.packs = { 'acme/web': 'missing' };
    const read = await loadMcpCard('p-1');
    expect(read?.card).toMatchObject({ on: false, owner: true, missing: [] });
  });

  it('draws with no repositories when the product holds none readable', async () => {
    state.reader = database({ key: 'acme', mcp_enabled: true, archived_at: null }, { role: 'owner' });
    state.held = null;
    expect((await loadMcpCard('p-1'))?.card.missing).toEqual([]);
  });
});
