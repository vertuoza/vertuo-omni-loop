// Append-only event log, one JSONL file per month, committed to git (spec §7.2).
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEvent } from './events.mjs';

const monthOf = (iso) => iso.slice(0, 7);

export function readLedger(dir) {
  if (!existsSync(dir)) return [];
  const events = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      if (line.trim()) events.push(makeEvent(JSON.parse(line)));
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
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
