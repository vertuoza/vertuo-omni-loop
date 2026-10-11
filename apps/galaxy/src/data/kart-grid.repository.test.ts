import { describe, expect, it, vi } from 'vitest';
import { kartGridRepository, kartTopic, type KartGridDb } from './kart-grid.repository';
import type { KartLinkEvents } from '../arcade/types';

// The grid's channel on a stubbed Supabase client (PRD 1572): the topic, a private channel, Presence
// keyed by the player's id, Broadcast without its own echo; it tracks, sends and unsubscribes.

type Callback = (status: string) => void;

function stub() {
  const handlers = new Map<string, (payload: unknown) => void>();
  let subscribed: Callback = () => {};
  let state: Record<string, object[]> = {};
  const channel = {
    on: vi.fn((type: string, filter: { event: string }, handler: (payload: unknown) => void) => { handlers.set(`${type}:${filter.event}`, handler); return channel; }),
    subscribe: vi.fn((callback: Callback) => { subscribed = callback; return channel; }),
    track: vi.fn(() => Promise.resolve('ok')),
    send: vi.fn(() => Promise.resolve('ok')),
    presenceState: vi.fn(() => state),
  };
  const db = { channel: vi.fn(() => channel), removeChannel: vi.fn(() => Promise.resolve('ok')) };
  return {
    db: db as unknown as KartGridDb, channel, dbMock: db,
    status: (s: string) => { subscribed(s); },
    presence: (s: Record<string, object[]>) => { state = s; handlers.get('presence:sync')?.({}); },
    broadcast: (payload: unknown) => { handlers.get('broadcast:kart')?.({ payload }); },
  };
}

const events = () => ({ presence: vi.fn(), message: vi.fn(), status: vi.fn() } satisfies KartLinkEvents);
const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const WHO = { id: 'u1', name: 'Ada' };

async function joined() {
  const s = stub();
  const on = events();
  const link = kartGridRepository(s.db, 'w1', () => Promise.resolve('u1'));
  link.join(WHO, on);
  await tick();
  return { s, on, link };
}

describe('kartGridRepository', () => {
  it('opens the private channel kart:<workspace id>, Presence keyed by the player and Broadcast without its own echo', async () => {
    const { s } = await joined();
    expect(kartTopic('w1')).toBe('kart:w1');
    expect(s.dbMock.channel).toHaveBeenCalledWith('kart:w1', { config: { private: true, presence: { key: 'u1' }, broadcast: { self: false } } });
  });

  it('tracks who the player is once subscribed, and again each time the channel is back', async () => {
    const { s, on } = await joined();
    s.status('SUBSCRIBED');
    expect(s.channel.track).toHaveBeenCalledWith(WHO);
    expect(on.status).toHaveBeenLastCalledWith('joined');
    s.status('CLOSED');
    expect(on.status).toHaveBeenLastCalledWith('reconnecting');
    s.status('SUBSCRIBED');
    expect(s.channel.track).toHaveBeenCalledTimes(2);
    expect(on.status).toHaveBeenLastCalledWith('joined');
  });

  it('gives each key its latest Presence entry, without Supabase\'s own reference', async () => {
    const { s, on } = await joined();
    s.presence({ u1: [{ id: 'u1', presence_ref: 'a' }, { id: 'u1', name: 'late', presence_ref: 'b' }], u2: [{ id: 'u2', presence_ref: 'c' }], u3: [] });
    expect(on.presence).toHaveBeenCalledWith({ u1: { id: 'u1', name: 'late' }, u2: { id: 'u2' } });
  });

  it('hands over a broadcast with its sender, and leaves out what is not ours', async () => {
    const { s, on } = await joined();
    s.broadcast({ from: 'u2', body: { kind: 'x' } });
    s.broadcast('nope');
    s.broadcast(null);
    s.broadcast({ body: 1 });
    expect(on.message).toHaveBeenCalledTimes(1);
    expect(on.message).toHaveBeenCalledWith('u2', { kind: 'x' });
  });

  it('sends a broadcast under the player\'s id, and nothing before it has a channel', async () => {
    const s = stub();
    const link = kartGridRepository(s.db, 'w1', () => Promise.resolve('u1'));
    link.send({ early: true });
    expect(s.channel.send).not.toHaveBeenCalled();
    link.join(WHO, events());
    await tick();
    link.send({ kind: 'x' });
    expect(s.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'kart', payload: { from: 'u1', body: { kind: 'x' } } });
  });

  it('reads a channel refused before it was ever joined as refused, and closes it', async () => {
    const { s, on } = await joined();
    s.status('CHANNEL_ERROR');
    expect(on.status).toHaveBeenCalledWith('refused');
    expect(s.dbMock.removeChannel).toHaveBeenCalledWith(s.channel);
  });

  it('reads nobody signed in, or a session that cannot be read, as refused', async () => {
    for (const user of [() => Promise.resolve(null), () => Promise.reject(new Error('boom'))]) {
      const s = stub();
      const on = events();
      kartGridRepository(s.db, 'w1', user).join(WHO, on);
      await tick();
      expect(on.status).toHaveBeenCalledWith('refused');
      expect(s.dbMock.channel).not.toHaveBeenCalled();
    }
  });

  it('unsubscribes on leave, and says nothing more afterwards', async () => {
    const { s, on, link } = await joined();
    link.leave();
    expect(s.dbMock.removeChannel).toHaveBeenCalledWith(s.channel);
    s.status('SUBSCRIBED');
    s.presence({ u2: [{ id: 'u2' }] });
    s.broadcast({ from: 'u2', body: 1 });
    expect(on.status).not.toHaveBeenCalled();
    expect(on.presence).not.toHaveBeenCalled();
    expect(on.message).not.toHaveBeenCalled();
    link.send({ late: true });
    expect(s.channel.send).not.toHaveBeenCalled();
  });

  it('leaves before the session was read: no channel is ever opened', async () => {
    const s = stub();
    const link = kartGridRepository(s.db, 'w1', () => Promise.resolve('u1'));
    link.join(WHO, events());
    link.leave();
    await tick();
    expect(s.dbMock.channel).not.toHaveBeenCalled();
  });
});
