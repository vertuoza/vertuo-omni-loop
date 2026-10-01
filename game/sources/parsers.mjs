// Readers for the delivery layer's file formats. They read; they never grade — the guards in the
// engineering repositories do that (spec §8).
//
// The game never imports the kit (README: delete game/ and the delivery layer is untouched), so the
// kit's rules these readers need are mirrored here, and must stay the same as the kit's (PRD 728):
//   - the delivery folder: `paths.delivery` of `.omni-loop/config.yml`, else `.omni-loop/delivery`
//     (kit/lib/config.mjs, as game/dossiers/folders.mjs mirrors it);
//   - a PRD folder's name: `<nnnn>-<topic>` (kit/lib/layout.mjs);
//   - a settled entry opens with `<!-- <markers.prefix>-settled: <id> -->` (kit/lib/markers.mjs).
import { parse } from 'yaml';

const DEFAULT_DELIVERY = '.omni-loop/delivery';
const FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function numberList(value) {
  if (!value || value === 'none') return [];
  return value.replace(/[[\]]/g, '').split(',').map((s) => Number(s.trim().replace(/^#/, ''))).filter(Number.isInteger);
}

/** A PRD's spec: the PRDs it is blocked by (front matter `blocked-by`), none when it says none or cannot be read. */
export function parseSpec(text) {
  return { blockedBy: numberList(parseFrontMatter(text ?? '')['blocked-by']) };
}

/** A repository's delivery folder, from its `.omni-loop/config.yml`; the kit's default when it names none or does not read. */
export function deliveryOf(text) {
  let config = null;
  try {
    config = text ? parse(text) : null;
  } catch {
    config = null;
  }
  const named = typeof config?.paths?.delivery === 'string' ? config.paths.delivery.trim().replace(/^\.\/+/, '').replace(/\/+$/, '') : '';
  return named || DEFAULT_DELIVERY;
}

/** The PRD number a delivery folder's name gives, or null when it does not read as `<nnnn>-<topic>`. */
export function prdOfFolder(name) {
  const match = FOLDER.exec(name);
  return match && Number(match[1]) > 0 ? Number(match[1]) : null;
}

export function parseOutboxItem(text) {
  const fm = parseFrontMatter(text);
  return { id: fm.id, rank: fm.rank, raised: fm.raised };
}

// Who settled an item, from its `Approved by` line: the login it was asked of, or on whose behalf a
// session answered, else the first word. `nobody` (an item adopted when it was raised) is no one.
function approver(line) {
  const named = line.match(/(?:asked of|delegated by) ([^\s),]+)/);
  const login = named ? named[1] : line.split(/\s+/)[0];
  return login && login !== 'nobody' ? login : null;
}

export function parseSettled(text) {
  const entries = new Map();
  const parts = text.split(/<!-- [\w-]*-settled: ([^\s]+) -->/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1] ?? '';
    const field = (name) => body.match(new RegExp(`^- ${name}: (.+)$`, 'm'))?.[1]?.trim() ?? null;
    entries.set(id, { verdict: field('Verdict'), at: field('Approved at'), by: approver(field('Approved by') ?? ''), rank: field('Rank') });
  }
  return entries;
}

// A plan's lines, each split into its trimmed `|` cells, beside the slice table's header the lines
// above it named (its cells in lower case; null before one). A header line is not itself a row.
function* sliceTableRows(text) {
  let header = null;
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
export function parsePlanSlices(text) {
  const rows = [];
  for (const { cells, header } of sliceTableRows(text)) {
    const cols = header ? { id: header.indexOf('id'), blocked: header.indexOf('blocked by'), wave: header.indexOf('wave'), min: 0 } : FIXED_COLUMNS;
    if (cells.length < cols.min || !/^s\d+$/.test(cells[cols.id] ?? '')) continue;
    const cell = cells[cols.blocked] ?? '';
    const blocked = cell === '—' || cell === '-' || cell === '' ? [] : cell.split(',').map((s) => s.trim()).filter(Boolean);
    rows.push({ id: cells[cols.id], blockedBy: blocked, wave: Number(cells[cols.wave]) });
  }
  return rows;
}

// A plan repository's slice table names the repository each slice lands in, in a `repo` column
// (PRD 549, as kit/lib/inbox/territory.mjs reads it): slice id → that cell, null when empty. An
// ordinary plan has no such column, and every slice is its home's.
export function parsePlanRepos(text) {
  const out = new Map();
  for (const { cells, header } of sliceTableRows(text)) {
    if (!header?.includes('repo')) continue;
    const id = cells[header.indexOf('id')] ?? '';
    if (/^s\d+$/.test(id)) out.set(id, (cells[header.indexOf('repo')] ?? '').replace(/`/g, '').trim() || null);
  }
  return out;
}
