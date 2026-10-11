// OMNI KART's grid channel (PRD 1572, ADR-0095): the one file that opens the Realtime channel. A
// workspace has one private channel, `kart:<workspace id>`, which only a player of the workspace with
// OMNI KART unlocked may join (supabase/migrations/…_arcade_kart_grid.sql). The player joins as
// themselves, with their own session, never the service key (ADR-0051): Presence is keyed by their
// id, and Broadcast comes back to everyone but the sender. This file tracks, sends and unsubscribes
// and holds no rule: who starts, the places and the order are the game's (arcade/kart/grid.ts).
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { KartLink } from '../arcade/types';

/** The part of the Supabase client the grid uses. */
export type KartGridDb = Pick<SupabaseClient, 'channel' | 'removeChannel'>;

/** The channel of a workspace's grid. */
export const kartTopic = (workspace: string): string => `kart:${workspace}`;

/** The one Broadcast event every message of the race goes under. */
const KART_EVENT = 'kart';

/** Presence's state as the game reads it: each key's latest entry, without Supabase's own `presence_ref`. */
function entriesOf(state: Record<string, readonly object[]>): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  for (const [key, metas] of Object.entries(state)) {
    const latest = metas.at(-1);
    if (!latest) continue;
    const { presence_ref: _ref, ...entry } = latest as Record<string, unknown>;
    entries[key] = entry;
  }
  return entries;
}

/** A broadcast payload read: who sent it and what, or null when it is not one of ours. */
function messageOf(payload: unknown): { from: string; body: unknown } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { from, body } = payload as { from?: unknown; body?: unknown };
  return typeof from === 'string' ? { from, body } : null;
}

/**
 * The link to a workspace's grid. `user` answers the signed-in player's id (null: nobody signed in,
 * which reads as refused). Each `join` opens a fresh channel; supabase-js rejoins a dropped one by
 * itself, and the player says who they are again once it is back.
 */
export function kartGridRepository(db: KartGridDb, workspace: string, user: () => Promise<string | null>): KartLink {
  let channel: RealtimeChannel | null = null;
  let me: string | null = null;
  /** Bumped by every join and leave: what an older join says after that is ignored. */
  let turn = 0;
  const close = () => {
    const open = channel;
    channel = null;
    if (open) void db.removeChannel(open);
  };
  return {
    join(who, on) {
      close();
      const mine = ++turn;
      void (async () => {
        const id = await user().catch(() => null);
        if (mine !== turn) return;
        if (!id) { on.status('refused'); return; }
        me = id;
        const open = db.channel(kartTopic(workspace), { config: { private: true, presence: { key: id }, broadcast: { self: false } } });
        channel = open;
        let joined = false;
        open
          .on('presence', { event: 'sync' }, () => { if (mine === turn) on.presence(entriesOf(open.presenceState())); })
          .on('broadcast', { event: KART_EVENT }, ({ payload }) => {
            const message = mine === turn ? messageOf(payload) : null;
            if (message) on.message(message.from, message.body);
          })
          .subscribe((status) => {
            if (mine !== turn) return;
            if (status === 'SUBSCRIBED') {
              joined = true;
              void open.track(who);
              on.status('joined');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              if (joined) { on.status('reconnecting'); return; }
              close();
              on.status('refused');
            }
          });
      })();
    },
    send(body) {
      if (channel && me) void channel.send({ type: 'broadcast', event: KART_EVENT, payload: { from: me, body } });
    },
    leave() {
      turn += 1;
      close();
    },
  };
}
