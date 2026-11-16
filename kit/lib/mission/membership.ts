// PRD 2898, s3: whether a PRD belongs to a mission, as the repository's own mission folders record it:
// each `<nnnn>-<slug>/mission.md` names the PRDs in its scope. A mission's running or paused state lives
// on the Omni page, which a checkout cannot read here, so this answers only "named by a mission record".
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrdNumber } from '../ids.ts';
import { prdFoldersIn } from '../layout.ts';
import type { Layout } from '../layout.ts';
import { MISSION_RECORD, parseBrief } from './brief.ts';

/** The missions whose record names PRD `prd` in its scope, by number; empty when none does. A record
 * that does not read names nothing. */
export function missionsOfPrd(ctx: { root: string; layout: Layout }, prd: PrdNumber): number[] {
  return prdFoldersIn(join(ctx.root, ctx.layout.dirs.missions)).flatMap(({ name, prd: mission }) => {
    const file = join(ctx.root, ctx.layout.dirs.missions, name, MISSION_RECORD);
    if (!existsSync(file)) return [];
    const brief = parseBrief(readFileSync(file, 'utf8'));
    return brief.ok && brief.brief.scope.prds.includes(prd) ? [mission] : [];
  });
}
