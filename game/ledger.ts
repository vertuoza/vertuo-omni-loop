// The ledger: append-only game events (spec §7.2). The store of record is Supabase
// (sources/supabase.ts › supabaseLedger). Two stores with the same contract serve fixtures and
// offline runs: files (one JSONL per month) and memory.
//   read()          → every event, sorted by time then id
//   append(events)  → validates all first, stores the ones whose id is new, returns those
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEvent, type GameEvent } from './events.ts';

/** A store of ledger events. */
export type Ledger = {
  read: () => Promise<GameEvent[]>;
  append: (events: unknown[]) => Promise<GameEvent[]>;
};

const monthOf = (iso: string): string => iso.slice(0, 7);
const byTime = (a: GameEvent, b: GameEvent): number => a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

export function readLedger(dir: string): GameEvent[] {
  if (!existsSync(dir)) return [];
  const events: GameEvent[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      if (line.trim()) events.push(makeEvent(JSON.parse(line)));
    }
  }
  return events.sort(byTime);
}

export function appendEvents(dir: string, events: unknown[]): GameEvent[] {
  const valid = events.map((e) => makeEvent(e)); // throws before anything is written
  mkdirSync(dir, { recursive: true });
  const known = new Set(readLedger(dir).map((e) => e.id));
  const appended: GameEvent[] = [];
  for (const e of valid) {
    if (known.has(e.id)) continue;
    appendFileSync(join(dir, `${monthOf(e.at)}.jsonl`), JSON.stringify(e) + '\n');
    known.add(e.id);
    appended.push(e);
  }
  return appended;
}

export function fileLedger(dir: string): Ledger {
  // Each read or append runs at once, as an async function's body did, and a throw rejects the promise.
  return {
    read: () => new Promise((resolve) => { resolve(readLedger(dir)); }),
    append: (events: unknown[]) => new Promise((resolve) => { resolve(appendEvents(dir, events)); }),
  };
}

export function memoryLedger(initial: unknown[] = []): Ledger {
  const events = new Map<string, GameEvent>();
  for (const e of initial.map((x) => makeEvent(x))) events.set(e.id, e);
  return {
    read: () => Promise.resolve([...events.values()].sort(byTime)),
    // An invalid event rejects the promise, as it did when this was an async function.
    append: (list: unknown[]) => new Promise((resolve) => {
      const valid = list.map((x) => makeEvent(x));
      const appended: GameEvent[] = [];
      for (const e of valid) if (!events.has(e.id)) { events.set(e.id, e); appended.push(e); }
      resolve(appended);
    }),
  };
}
