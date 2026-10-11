// Tests only (PRD 1572): several live links wired together in memory, standing in for the workspace's
// Realtime channel. Presence is the members' entries by id, a broadcast reaches every member but its
// sender, and the test sets the delay a message takes and which messages are dropped. Time is the
// test's: nothing is delivered late until `advance` says so.
import type { KartLink, KartLinkEvents } from '../types';

interface Member { who: Record<string, unknown>; on: KartLinkEvents }

export interface FakeHub {
  /** A player's link to the grid, as the account gives it. */
  link(id: string): KartLink;
  /** How long, in ms, a message and a Presence update take to arrive; 0 is at once. */
  delay: number;
  /** Decides whether a broadcast from `from` to `to` is lost on the way. */
  dropIf: (from: string, to: string, body: unknown) => boolean;
  /** Makes `id`'s next joins refused, as a channel the database refuses. */
  refuse(id: string): void;
  /** Lets `ms` pass: what was due by then arrives, in order. */
  advance(ms: number): void;
  /** Who Presence holds now, by id. */
  present(): string[];
}

export function createHub(): FakeHub {
  const members = new Map<string, Member>();
  const refused = new Set<string>();
  let now = 0;
  let queue: { at: number; run: () => void }[] = [];
  const later = (run: () => void) => {
    if (hub.delay <= 0) run(); else queue.push({ at: now + hub.delay, run });
  };
  const state = (): Record<string, unknown> => Object.fromEntries([...members].map(([id, m]) => [id, m.who]));
  const sync = () => { for (const [id, m] of members) later(() => { if (members.get(id) === m) m.on.presence(state()); }); };
  const hub: FakeHub = {
    delay: 0,
    dropIf: () => false,
    refuse: (id) => { refused.add(id); },
    present: () => [...members.keys()],
    advance(ms) {
      now += ms;
      for (;;) {
        const due = queue.filter((q) => q.at <= now).sort((a, b) => a.at - b.at)[0];
        if (!due) return;
        queue = queue.filter((q) => q !== due);
        due.run();
      }
    },
    link(id) {
      return {
        join(who, on) {
          if (refused.has(id)) { later(() => { on.status('refused'); }); return; }
          const me = { who, on };
          members.set(id, me);
          later(() => { if (members.get(id) === me) on.status('joined'); });
          sync();
        },
        send(body) {
          if (!members.has(id)) return;
          for (const [to, m] of members) {
            if (to === id || hub.dropIf(id, to, body)) continue;
            later(() => { if (members.get(to) === m) m.on.message(id, body); });
          }
        },
        leave() {
          if (members.delete(id)) sync();
        },
      };
    },
  };
  return hub;
}
