// A mission's scope, products included (PRD omni-loop-21 s7, spec "1. The scope takes products"): pure, over the brief's PRDs and
// the rows of each roadmap it names.
//
//   rows      a product roadmap's rows (`<key>-R<n>`), read from the roadmap file its page holds (`omni dossier get <id> roadmap`)
//             with the kit's own parser: each row's id, its PRD (a repository's number or a product's id), its blockers and its wave
//   expand    the PRDs named alone first, in the brief's order, then each roadmap's rows in wave order (table order within a wave),
//             each with the PRDs its blocker rows name. A PRD named twice is kept once, where it came first, with every blocker
//             either names; a blocker row the roadmap does not hold names no PRD, and a PRD never blocks itself
//   held      a row is held until each of its blockers joined the mission branch (or was merged), as /omni:drive --roadmap holds
//             a PRD until its blockers merged
import { parseProductRoadmap, roadmapWaves, type ProductRoadmapRow } from 'omni-loop/kit/lib/roadmap/parse.ts';
import type { MissionPrd } from './store.prd.ts';

/** A roadmap row as the expansion reads it: its row id, its PRD, the row ids it waits on, its wave. */
export type ScopeRow = Pick<ProductRoadmapRow, 'id' | 'prd' | 'blockedBy' | 'wave'>;

/** One PRD of the scope, with the PRDs it waits on. */
export type ScopeEntry = { prd: MissionPrd; blockers: MissionPrd[] };

/** A product roadmap's rows, from its file, or its first fault. */
export function rowsOfRoadmap(text: string): { ok: true; rows: ScopeRow[] } | { ok: false; why: string } {
  const read = parseProductRoadmap(text);
  if (!read.ok) return { ok: false, why: read.errors[0] ?? 'the roadmap does not read' };
  return { ok: true, rows: read.roadmap.prds.map(({ id, prd, blockedBy, wave }) => ({ id, prd, blockedBy, wave })) };
}

/** The scope's PRDs in order, each with the PRDs it waits on: the PRDs named alone first, then each roadmap's rows in wave order. */
export function expandMissionScope(prds: readonly MissionPrd[], roadmaps: readonly (readonly ScopeRow[])[]): ScopeEntry[] {
  const scope = new Map<MissionPrd, Set<MissionPrd>>(prds.map((prd) => [prd, new Set()]));
  for (const rows of roadmaps) addRoadmap(scope, rows);
  return [...scope].map(([prd, blockers]) => ({ prd, blockers: [...blockers] }));
}

/** One roadmap's rows added to `scope`, in wave order, each with the PRDs its blocker rows name. */
function addRoadmap(scope: Map<MissionPrd, Set<MissionPrd>>, rows: readonly ScopeRow[]): void {
  const byRow = new Map(rows.map((row) => [row.id, row.prd]));
  const inOrder = roadmapWaves({ prds: [...rows] }).flatMap((wave) => wave.rows);
  for (const row of inOrder) {
    const named = row.blockedBy.flatMap((one) => {
      const blocker = byRow.get(one);
      return blocker === undefined || blocker === row.prd ? [] : [blocker];
    });
    scope.set(row.prd, new Set([...(scope.get(row.prd) ?? []), ...named]));
  }
}

/** The blockers of `entry` not on the mission branch yet (`joined`, the PRDs on it or merged), in order; none frees it. */
export const heldBy = (entry: ScopeEntry, joined: ReadonlySet<MissionPrd>): MissionPrd[] => entry.blockers.filter((blocker) => !joined.has(blocker));

/** What a held row waits on, in words: `PRD omni-loop-17 waits for PRD omni-loop-16 to join mission/3150-…`. */
export const heldWords = (prd: MissionPrd, by: readonly MissionPrd[], branch: string | null): string =>
  `PRD ${String(prd)} waits for ${by.map((one) => `PRD ${String(one)}`).join(', ')} to join ${branch ?? 'the mission branch'}`;
