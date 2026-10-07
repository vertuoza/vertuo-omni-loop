// Readers for the delivery layer's file formats. They read; they never grade — the guards in the
// engineering repositories do that (spec §8).
//
// The game imports two parts of the kit only (README: delete game/ and the delivery layer is
// untouched): its ID brands (`ids`, kit/lib/ids.ts, PRD 1049) and its parsed environment (`env`,
// kit/lib/env/read.ts, PRD 1059). So the kit's rules these readers need are mirrored here, and must
// stay the same as the kit's (PRD 728):
//   - the delivery folder: `paths.delivery` of `.omni-loop/config.yml`, else `.omni-loop/delivery`
//     (kit/lib/config.ts, as game/dossiers/folders.ts mirrors it);
//   - a PRD folder's name: `<nnnn>-<topic>` (kit/lib/layout.ts);
//   - a settled entry opens with `<!-- <markers.prefix>-settled: <id> -->` (kit/lib/markers.ts).
import { parse } from 'yaml';
import { z } from 'zod';
import { PrdNumberSchema, SliceIdSchema, type PrdNumber, type SliceId } from '../../kit/lib/ids.ts';

/** One settled entry of an outbox's `settled.md`. */
export type SettledEntry = { verdict: string | null; at: string | null; by: string | null; rank: string | null };

/** One row of a plan's slice table. */
export type PlanSlice = { id: SliceId; blockedBy: string[]; wave: number };

// The one setting the game reads of a repository's config: `paths.delivery`, when it is text.
const DeliveryConfig = z.looseObject({ paths: z.looseObject({ delivery: z.string() }) });

const DEFAULT_DELIVERY = '.omni-loop/delivery';
const FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parseFrontMatter(text: string): Record<string, string> {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

// The PRD numbers a front matter list names; an entry that is no PRD number is left out.
function prdList(value: string | undefined): PrdNumber[] {
  if (!value || value === 'none') return [];
  return value.replace(/[[\]]/g, '').split(',').flatMap((s) => {
    const read = PrdNumberSchema.safeParse(Number(s.trim().replace(/^#/, '')));
    return read.success ? [read.data] : [];
  });
}

/** A PRD's spec: the PRDs it is blocked by (front matter `blocked-by`), none when it says none or cannot be read. */
export function parseSpec(text: string | null | undefined): { blockedBy: PrdNumber[] } {
  return { blockedBy: prdList(parseFrontMatter(text ?? '')['blocked-by']) };
}

/** A repository's delivery folder, from its `.omni-loop/config.yml`; the kit's default when it names none or does not read. */
export function deliveryOf(text: string | null | undefined): string {
  let config: unknown = null;
  try {
    config = text ? parse(text) : null;
  } catch {
    config = null;
  }
  const read = DeliveryConfig.safeParse(config);
  const named = read.success ? read.data.paths.delivery.trim().replace(/^\.\/+/, '').replace(/\/+$/, '') : '';
  return named || DEFAULT_DELIVERY;
}

/** The PRD number a delivery folder's name gives, or null when it does not read as `<nnnn>-<topic>`. */
export function prdOfFolder(name: string): PrdNumber | null {
  const match = FOLDER.exec(name);
  const prd = match ? PrdNumberSchema.safeParse(Number(match[1])) : null;
  return prd?.success ? prd.data : null;
}

export function parseOutboxItem(text: string): { id: string | undefined; rank: string | undefined; raised: string | undefined } {
  const fm = parseFrontMatter(text);
  return { id: fm.id, rank: fm.rank, raised: fm.raised };
}

// Who settled an item, from its `Approved by` line: the login it was asked of, or on whose behalf a
// session answered, else the first word. `nobody` (an item adopted when it was raised) is no one.
// A leading `@` (a merge over red wrote `@<login>` before PRD 1180) is not part of the login. Any
// other name that is no login (a dotted one) is kept as written: the projector skips its event until
// the line is fixed, rather than settling it on no one forever.
function approver(line: string): string | null {
  const named = line.match(/(?:asked of|delegated by) ([^\s),]+)/);
  const login = (named ? named[1] : line.split(/\s+/)[0])?.replace(/^@/, '');
  return login && login !== 'nobody' ? login : null;
}

export function parseSettled(text: string): Map<string, SettledEntry> {
  const entries = new Map<string, SettledEntry>();
  const parts = text.split(/<!-- [\w-]*-settled: ([^\s]+) -->/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i] ?? '';
    const body = parts[i + 1] ?? '';
    const field = (name: string): string | null => body.match(new RegExp(`^- ${name}: (.+)$`, 'm'))?.[1]?.trim() ?? null;
    entries.set(id, { verdict: field('Verdict'), at: field('Approved at'), by: approver(field('Approved by') ?? ''), rank: field('Rank') });
  }
  return entries;
}

// A plan's lines, each split into its trimmed `|` cells, beside the slice table's header the lines
// above it named (its cells in lower case; null before one). A header line is not itself a row.
function* sliceTableRows(text: string | null | undefined): Generator<{ cells: string[]; header: string[] | null }> {
  let header: string[] | null = null;
  for (const line of (text ?? '').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const names = cells.map((c) => c.toLowerCase());
    if (names.includes('id') && names.includes('blocked by') && names.includes('wave')) header = names;
    else yield { cells, header };
  }
}

const FIXED_COLUMNS = { id: 1, blocked: 5, wave: 6, min: 8 };

// A plan's slice table. Its columns are found by the header (`id`, `blocked by`, `wave`), so the
// kit's table (`| id | slice | territory | blocked by | wave |`) and older ones with more columns
// read alike; with no such header, the older fixed positions.
export function parsePlanSlices(text: string | null | undefined): PlanSlice[] {
  const rows: PlanSlice[] = [];
  for (const { cells, header } of sliceTableRows(text)) {
    const cols = header ? { id: header.indexOf('id'), blocked: header.indexOf('blocked by'), wave: header.indexOf('wave'), min: 0 } : FIXED_COLUMNS;
    const id = SliceIdSchema.safeParse(cells[cols.id]);
    if (cells.length < cols.min || !id.success) continue;
    const cell = cells[cols.blocked] ?? '';
    const blocked = cell === '—' || cell === '-' || cell === '' ? [] : cell.split(',').map((s) => s.trim()).filter(Boolean);
    rows.push({ id: id.data, blockedBy: blocked, wave: Number(cells[cols.wave]) });
  }
  return rows;
}

// A plan repository's slice table names the repository each slice lands in, in a `repo` column
// (PRD 549, as kit/lib/inbox/territory.ts reads it): slice id → that cell, null when empty. An
// ordinary plan has no such column, and every slice is its home's.
export function parsePlanRepos(text: string | null | undefined): Map<SliceId, string | null> {
  const out = new Map<SliceId, string | null>();
  for (const { cells, header } of sliceTableRows(text)) {
    if (!header?.includes('repo')) continue;
    const id = SliceIdSchema.safeParse(cells[header.indexOf('id')]);
    if (id.success) out.set(id.data, (cells[header.indexOf('repo')] ?? '').replace(/`/g, '').trim() || null);
  }
  return out;
}
