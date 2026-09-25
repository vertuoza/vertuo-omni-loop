// `omni plan check <prd>` — grades a PRD's own `plan.md` before anyone builds off it. Runs
// `parsePlanSlices`, `sameWaveCollisions` and `collisionRows` (`kit/lib/inbox/territory.mjs`) over
// the slice table, then three checks that module does not carry: every `blocked by` id must name a
// slice in this same plan, no slice may be blocked by one in its own wave or a later one, and no id
// may be used twice. Prints the slice count, the waves and the collision matrix, then every
// violation; exits 1 on any.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatFailure, formatPass } from '../../lib/check-report.mjs';
import { collisionRows, parsePlanSlices, sameWaveCollisions } from '../../lib/inbox/territory.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni plan check <prd>';

function isTableRow(line) {
  return line.trim().startsWith('|');
}

function isSeparatorRow(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const NOTHING = /^[—–-]?$/;

/** The ids one `blocked by` cell names — comma-separated, backticks stripped. `[]` for a cell that
 * declares nothing. */
function blockedByCell(cell) {
  const text = (cell ?? '').trim();
  if (NOTHING.test(text)) return [];
  return text
    .split(',')
    .map((token) => token.replace(/`/g, '').trim())
    .filter(Boolean);
}

/**
 * The plan's own slice table's `blocked by` column, by id — a `Map<id, string[]>`.
 * `territory.mjs`'s own `parsePlanSlices` reads `id`, `slice`, `territory` and `wave` only; this
 * command is the one place that needs `blocked by` too, so it reads the same table a second,
 * narrower way rather than widen that module's job.
 */
function blockedByColumn(markdown) {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex(
    (line) => isTableRow(line) && /^\|\s*id\s*\|/i.test(line.trim()),
  );
  const map = new Map();
  if (headerIndex === -1) return map;

  const header = cells(lines[headerIndex]).map((name) => name.toLowerCase());
  const idCol = header.indexOf('id');
  const blockedCol = header.indexOf('blocked by');
  if (blockedCol === -1) return map;

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isTableRow(line)) break;
    if (isSeparatorRow(line)) continue;
    const row = cells(line);
    const id = row[idCol];
    if (!id) continue;
    map.set(id, blockedByCell(row[blockedCol]));
  }
  return map;
}

/** Every id used by more than one slice row, each reported once. */
function duplicateIds(slices) {
  const counts = new Map();
  for (const slice of slices) counts.set(slice.id, (counts.get(slice.id) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

/** Every `blocked by` violation: an id naming no slice in this plan, or a blocker in the same wave
 * or a later one than the slice it blocks. */
function blockedByViolations(slices, blockedBy) {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  const violations = [];
  for (const slice of slices) {
    for (const blocker of blockedBy.get(slice.id) ?? []) {
      if (!waveOf.has(blocker)) {
        violations.push(`${slice.id} is blocked by "${blocker}", which names no slice in this plan.`);
        continue;
      }
      const blockerWave = waveOf.get(blocker);
      if (blockerWave >= slice.wave) {
        violations.push(
          `${slice.id} (wave ${slice.wave}) is blocked by ${blocker} (wave ${blockerWave}) — a blocker must sit in an earlier wave.`,
        );
      }
    }
  }
  return violations;
}

function checkPlan(prd, { ctx }) {
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null) throw usageError(`omni plan check: PRD ${prd} has no inbox or shipped folder.`);

  let markdown;
  try {
    markdown = readFileSync(join(ctx.root, planPath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') throw usageError(`omni plan check: no plan at ${planPath}.`);
    throw error;
  }

  let slices;
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    throw usageError(`omni plan check: ${planPath}: ${error.message}`);
  }

  const violations = [
    ...duplicateIds(slices).map((id) => `id "${id}" is used by more than one slice row.`),
    ...blockedByViolations(slices, blockedByColumn(markdown)),
    ...sameWaveCollisions(slices).map(
      (collision) =>
        `${collision.left} and ${collision.right} share ${collision.shared.join(', ')} and both sit in wave ${collision.wave} — two slices in one wave may never share territory.`,
    ),
  ];

  const waves = [...new Set(slices.map((slice) => slice.wave))].sort((a, b) => a - b);
  return { planPath, slices, waves, rows: collisionRows(slices), violations };
}

export const plan = {
  async run(args, { ctx, stdout }) {
    const [sub, ...rest] = args;
    if (sub !== 'check') throw usageError(USAGE);
    const { positional } = parseArgs('plan check', rest);
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = positiveInt('plan check', '<prd>', positional[0]);

    const { planPath, slices, waves, rows, violations } = checkPlan(prd, { ctx });

    println(
      stdout,
      `omni plan check — PRD ${prd}: ${slices.length} slice(s) across wave(s) ${waves.join(', ')} (${planPath}).`,
    );
    if (rows.length > 0) {
      println(stdout, `omni plan check — collision matrix (${rows.length} pair(s) sharing ground):`);
      for (const row of rows) println(stdout, `  ${row.pair}: ${row.shared} — ${row.resolved}`);
    }

    if (violations.length > 0) {
      println(stdout, formatFailure(`omni plan check — PRD ${prd}: violation(s):`, violations));
      return 1;
    }
    println(
      stdout,
      formatPass(`omni plan check — PRD ${prd}: ${slices.length} slice(s), all territories and blocks well-formed.`),
    );
    return 0;
  },
};
