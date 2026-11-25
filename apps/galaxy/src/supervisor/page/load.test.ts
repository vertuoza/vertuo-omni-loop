import { describe, expect, it, vi } from 'vitest';

vi.mock('omni-loop/kit/lib/log/log.ts', () => ({ log: { error: vi.fn() } }));

import { demoChat, demoDone, demoOpen, demoSeat } from './demo';
import { loadSupervisorPage, type SupervisorPageReads } from './load';

// The Supervisor page's read (PRD omni-loop-34 s5), on fake reads: no database, no clock of its own.

const NOW = new Date('2026-11-25T14:42:00.000Z');
const now = NOW.toISOString();
const ok = <T>(value: T) => Promise.resolve({ ok: true as const, value });

function reads(change: Partial<SupervisorPageReads> = {}): SupervisorPageReads & { asked: (string | null)[] } {
  const asked: (string | null)[] = [];
  return {
    asked,
    workspace: () => Promise.resolve({ id: 'ws-1' }),
    role: () => ok({ owner: true }),
    seat: () => ok(demoSeat(now)),
    findings: (_ws, open) => ok(open ? demoOpen(now) : demoDone(now)),
    messages: (_ws, finding) => { asked.push(finding); return ok(finding === null ? demoChat(now) : []); },
    notes: () => ok([{ id: 'n1', scope: 'short', line: 'x', cites: ['f-silent'], createdAt: now, expiresAt: null }]),
    runner: () => Promise.resolve({ name: 'atlas-01', slots: 4 }),
    ...change,
  };
}

describe('loadSupervisorPage', () => {
  it('reads the role, the seat and its runner, both tabs, the chat and an owner\'s notes', async () => {
    const view = await loadSupervisorPage(reads(), null, NOW);
    expect(view).toMatchObject({ kind: 'page', workspace: 'ws-1', owner: true, runner: { name: 'atlas-01', slots: 4 }, notes: 1, thread: [], now });
    if (view.kind !== 'page') throw new Error('a page');
    expect([view.open.length, view.done.length, view.chat.length]).toEqual([4, 2, 3]);
  });

  it('reads the thread of the finding the address names, and of none it does not hold', async () => {
    const fake = reads();
    await loadSupervisorPage(fake, 'f-route', NOW);
    await loadSupervisorPage(fake, 'not-a-finding', NOW);
    expect(fake.asked).toEqual([null, 'f-route', null]);
  });

  it('counts no notes for a member, and reads none', async () => {
    const notes = vi.fn();
    const view = await loadSupervisorPage(reads({ role: () => ok({ owner: false }), notes }), null, NOW);
    expect(view).toMatchObject({ kind: 'page', owner: false, notes: 0 });
    expect(notes).not.toHaveBeenCalled();
  });

  it('draws the page with no seat, and with no runner or notes when they fail', async () => {
    expect(await loadSupervisorPage(reads({ seat: () => ok(null) }), null, NOW)).toMatchObject({ kind: 'page', seat: null, runner: null });
    const view = await loadSupervisorPage(reads({ runner: () => Promise.reject(new Error('down')), notes: () => Promise.resolve({ ok: false, kind: 'database', error: 'down' }) }), null, NOW);
    expect(view).toMatchObject({ kind: 'page', runner: null, notes: 0 });
  });

  it('says no workspace, and unreadable when a read is refused or throws', async () => {
    expect(await loadSupervisorPage(reads({ workspace: () => Promise.resolve(null) }), null, NOW)).toEqual({ kind: 'no-workspace' });
    expect(await loadSupervisorPage(reads({ role: () => Promise.resolve({ ok: false, kind: 'forbidden', error: 'no' }) }), null, NOW)).toEqual({ kind: 'unreadable' });
    expect(await loadSupervisorPage(reads({ findings: () => Promise.reject(new Error('down')) }), null, NOW)).toEqual({ kind: 'unreadable' });
  });
});
