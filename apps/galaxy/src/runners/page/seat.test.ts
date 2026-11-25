import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Seat } from '../../supervisor/api/supervisor.contract';
import { UNREACHABLE } from '../runners.client';
import type { Board, Runner } from '../runners.contract';
import type { RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';
import { holdsSeat, keptSlots, keptWords, moveTargets, seatAccount, seatStrip } from './seat';
import { placeSeat } from './seat.client';

// The Supervisor's seat on the Runners page (PRD omni-loop-34 s8, screen 3.A): the kept slot, the strip, Place and Move,
// and the subtitle's kept slot.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = '2027-01-29T14:00:00.000Z';
const id = (n: number) => `00000000-0000-4000-8000-00000000f${String(n).padStart(3, '0')}`;
const WS = id(500);
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();

const runner = (over: Partial<Runner> & Pick<Runner, 'id' | 'name'>): Runner => ({
  owner: id(900), fleet: null, slots: 4, used: 0, repos: ['acme/widgets'], version: '0.0.706', lastSeenAt: NOW, state: 'online', githubApp: true, ...over,
});
const seat = (over: Partial<Seat> = {}): Seat => ({
  workspace: WS, runner: id(1), placedBy: 'ada', paused: false, dailyTokens: 5_000_000, tokensToday: 412_000, thinking: true,
  lastLookAt: '2027-01-29T13:59:20.000Z', missedLooks: 0, ...over,
});
const accounts = (list: { id: string; agent: string; state: 'ready' | 'active' | 'out' }[]): Runner['health'] =>
  ({ cpu: null, load1: null, cores: null, memUsed: null, memTotal: null, diskFree: null, diskTotal: null, paused: null, accounts: list } as unknown as Runner['health']);

const ATLAS1 = runner({ id: id(1), name: 'atlas-01', state: 'busy', used: 2, health: accounts([{ id: 'claude-1', agent: 'claude', state: 'out' }, { id: 'claude-2', agent: 'claude', state: 'active' }, { id: 'codex-1', agent: 'codex', state: 'ready' }]) });
const ATLAS2 = runner({ id: id(2), name: 'atlas-02', used: 1 });

function page(owner: boolean, supervisor: RunnersPageView extends infer V ? V extends { kind: 'board' } ? V['supervisor'] : never : never): string {
  const board: Board = { runners: [ATLAS1, ATLAS2], jobs: [], saves: [], viewer: { id: id(900), owner, fleet: null } };
  const view: RunnersPageView = { kind: 'board', name: 'Acme', board, fleets: [], prds: {}, now: NOW, answered: [], ...(supervisor === undefined ? {} : { supervisor }) };
  return renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null }));
}

describe('the seat, pure', () => {
  it('keeps one slot on the runner that holds it, none elsewhere', () => {
    expect(holdsSeat(ATLAS1, seat())).toBe(true);
    expect(keptSlots(ATLAS1, seat())).toBe(1);
    expect(keptSlots(ATLAS2, seat())).toBe(0);
    expect(keptSlots(ATLAS1, null)).toBe(0);
  });

  it('thinks on the first Claude account that is not out', () => {
    expect(seatAccount(ATLAS1)).toBe('claude-2');
    expect(seatAccount(ATLAS2)).toBeNull();
  });

  it('reads the strip: watching, the last look, the tokens of the day and the account', () => {
    expect(seatStrip(seat(), ATLAS1, NOW)).toEqual({ state: 'watching', title: 'Supervisor · watching', look: 'last look 40 s', tokens: '412k tokens', account: 'claude-2' });
  });

  it('reads paused, offline and past its token limit', () => {
    expect(seatStrip(seat({ paused: true }), ATLAS1, NOW).title).toBe('Supervisor · paused');
    expect(seatStrip(seat({ missedLooks: 3 }), ATLAS1, NOW).title).toBe('Supervisor · offline');
    expect(seatStrip(seat({ lastLookAt: null }), ATLAS1, NOW)).toMatchObject({ state: 'offline', look: 'no look yet' });
    expect(seatStrip(seat({ thinking: false }), ATLAS1, NOW).title).toBe('Supervisor · thinking paused');
  });

  it('names the kept slot in the subtitle while an online runner holds the seat', () => {
    expect(keptWords([ATLAS1, ATLAS2], seat())).toBe('1 kept for the Supervisor');
    expect(keptWords([{ ...ATLAS1, state: 'offline' }, ATLAS2], seat())).toBeNull();
    expect(keptWords([ATLAS1, ATLAS2], null)).toBeNull();
  });

  it('moves to any runner but the one that holds it', () => {
    expect(moveTargets([ATLAS1, ATLAS2], seat()).map((r) => r.name)).toEqual(['atlas-02']);
  });
});

describe('the card with the seat (3.A)', () => {
  const html = page(true, { workspace: WS, seat: seat() });

  it('draws the cyan pip, 2 of 3 slots and +1 Supervisor on the runner that holds it', () => {
    expect(html).toContain('<i class="runners-pip is-used"></i><i class="runners-pip is-used"></i><i class="runners-pip"></i><i class="runners-pip is-seat" title="Kept for the Supervisor"></i>');
    expect(text(html)).toContain('2 of 3 slots +1 Supervisor');
    expect(text(html)).toContain('1 of 4 slots');
  });

  it('draws the strip with Move for an owner', () => {
    expect(text(html)).toContain('Supervisor · watching last look 40 s · 412k tokens · claude-2 Move');
    expect(html.match(/runners-seat is-/g)).toHaveLength(1);
    expect(html).not.toContain('Place the Supervisor');
  });

  it('counts the kept slot out of the subtitle, and names it', () => {
    expect(text(html)).toContain('2 runners · 2 online · 3 of 7 slots in use · 1 kept for the Supervisor');
  });

  it('shows a member the strip without Move or Place', () => {
    const member = page(false, { workspace: WS, seat: seat() });
    expect(text(member)).toContain('Supervisor · watching');
    expect(member).not.toContain('>Move<');
    expect(member).not.toContain('Place the Supervisor');
  });
});

describe('with no seat', () => {
  it('offers an owner Place the Supervisor on every card, and the subtitle as before', () => {
    const html = page(true, { workspace: WS, seat: null });
    expect(html.match(/Place the Supervisor/g)).toHaveLength(2);
    expect(text(html)).toContain('2 runners · 2 online · 3 of 8 slots in use');
    expect(text(html)).not.toContain('kept for the Supervisor');
  });

  it('offers a member nothing', () => {
    expect(page(false, { workspace: WS, seat: null })).not.toContain('Place the Supervisor');
  });

  it('draws no seat and no Place when the seat could not be read', () => {
    const html = page(true, undefined);
    expect(html).not.toContain('Place the Supervisor');
    expect(html).not.toContain('runners-seat');
  });
});

describe('placeSeat', () => {
  const answer = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it('posts the workspace and the runner, and reads the seat back', async () => {
    const fetcher = answer(200, { seat: seat({ runner: id(2) }) });
    expect(await placeSeat(WS, id(2), fetcher)).toEqual({ ok: true, value: seat({ runner: id(2) }) });
    expect(fetcher).toHaveBeenCalledWith('/api/supervisor/seat', expect.objectContaining({ method: 'POST', body: JSON.stringify({ workspace: WS, runner: id(2) }) }));
  });

  it('gives the route\'s words for a refusal, and says unreachable otherwise', async () => {
    expect(await placeSeat(WS, id(2), answer(403, { error: 'Only an owner places the Supervisor.' }))).toEqual({ ok: false, error: 'Only an owner places the Supervisor.' });
    expect(await placeSeat(WS, id(2), answer(200, { seat: 'x' }))).toEqual({ ok: false, error: UNREACHABLE });
  });
});
