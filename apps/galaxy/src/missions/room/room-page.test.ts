import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { StreamedProps } from '../../skeleton/Streamed';
import type { FleetScreenProps } from '../../dashboard/fleet/FleetScreen';

// /app/fleet's Operation room block (PRD 2842 s7): a virtual fleet's Operation room streams its own block, read as the
// signed-in person; any other tab, or an ordinary fleet, has none.
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const db = vi.hoisted(() => ({ auth: { getClaims: () => Promise.resolve({ data: { claims: { sub: 'u1' } }, error: null }) } }));
const board = vi.hoisted((): { value: unknown } => ({ value: {} }));
const loadRoom = vi.hoisted(() => vi.fn(() => Promise.resolve({ workspace: null, fleet: 'night-shift', missions: [] })));

vi.mock('server-only', () => ({}));
vi.mock('../../env', async (actual) => {
  const env = await actual<typeof import('../../env')>();
  return { ...env, serverEnv: () => ({ ...env.readEnv({}), mode: 'supabase' }) };
});
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => ({ url: 'http://127.0.0.1:54321', key: 'anon' }),
  supabaseServer: () => Promise.resolve(db),
}));
vi.mock('../../dashboard/fleet/fleet', () => ({ demoFleetBoard: vi.fn(), loadFleetBoard: () => Promise.resolve(board.value) }));
vi.mock('./room.live', () => ({ loadRoom }));

const { Streamed } = await import('../../skeleton/Streamed');
const { default: Page } = await import('../../../app/app/fleet/page.tsx');

async function roomOf(query: Record<string, string>, virtualNames: string[]) {
  board.value = { kind: 'board', fleet: { name: 'night-shift', color: null }, virtual: { workspace: WORKSPACE, mascots: [], names: virtualNames } };
  const page = (await Page({ searchParams: Promise.resolve(query) })) as ReactElement;
  const { read, children } = page.props as StreamedProps<unknown>;
  expect(page.type).toBe(Streamed);
  return (children(await read) as ReactElement<FleetScreenProps>).props.room;
}

describe('/app/fleet\'s Operation room block', () => {
  it('reads the fleet\'s missions as the signed-in person on the Operation room of a virtual fleet', async () => {
    const block = await roomOf({ tab: 'room' }, ['night-shift']) as ReactElement<StreamedProps<unknown>>;
    expect(block.type).toBe(Streamed);
    await block.props.read;
    expect(loadRoom).toHaveBeenCalledWith(db, WORKSPACE, 'night-shift', null, { tab: 'room' });
  });

  it('has none on another tab, or on an ordinary fleet', async () => {
    expect(await roomOf({ tab: 'heroes' }, ['night-shift'])).toBeUndefined();
    expect(await roomOf({ tab: 'room' }, [])).toBeUndefined();
  });
});
