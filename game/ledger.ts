// @ts-nocheck
// The ledger: append-only game events (spec §7.2). The store of record is Supabase
// (sources/supabase.ts › supabaseLedger). Two stores with the same contract serve fixtures and
// offline runs: files (one JSONL per month) and memory.
//   read()          → every event, sorted by time then id
//   append(events)  → validates all first, stores the ones whose id is new, returns those
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEvent } from './events.ts';

const monthOf = (iso) => iso.slice(0, 7);
const byTime = (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

export function readLedger(dir) {
  if (!existsSync(dir)) return [];
  const events = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      if (line.trim()) events.push(makeEvent(JSON.parse(line)));
    }
  }
  return events.sort(byTime);
}

export function appendEvents(dir, events) {
  const valid = events.map(makeEvent); // throws before anything is written
  mkdirSync(dir, { recursive: true });
  const known = new Set(readLedger(dir).map((e) => e.id));
  const appended = [];
  for (const e of valid) {
    if (known.has(e.id)) continue;
    appendFileSync(join(dir, `${monthOf(e.at)}.jsonl`), JSON.stringify(e) + '\n');
    known.add(e.id);
    appended.push(e);
  }
  return appended;
}

export function fileLedger(dir) {
  return { read: async () => readLedger(dir), append: async (events) => appendEvents(dir, events) };
}

export function memoryLedger(initial = []) {
  const events = new Map();
  for (const e of initial.map(makeEvent)) events.set(e.id, e);
  return {
    read: async () => [...events.values()].sort(byTime),
    async append(list) {
      const valid = list.map(makeEvent);
      const appended = [];
      for (const e of valid) if (!events.has(e.id)) { events.set(e.id, e); appended.push(e); }
      return appended;
    },
  };
}
