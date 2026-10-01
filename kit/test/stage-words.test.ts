// PRD 587: the seven stages of the loop are the same words everywhere. Each side keeps its list in one
// place — `STAGES` in galaxy's stage module, and `STAGE_ORDER` in the kit's `kit/lib/status/format.ts`,
// which `omni status`, `omni help` and the skills' hand-offs are held to — and this test holds the two
// lists to each other. It reads galaxy's list from the module's text, so it never runs app code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STAGE_ORDER } from '../lib/status/format.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const GALAXY_STAGE = 'apps/galaxy/src/stages/stage.ts';

/** The ids of the `export const STAGES` array literal in `source`, or null when it holds none. */
function galaxyStages(source: string) {
  const found = source.match(/export const STAGES\b[^=]*=\s*\[([^\]]*)\]/);
  if (!found) return null;
  return [...found[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((quoted) => quoted[1] ?? quoted[2]);
}

describe("the kit's stage words and galaxy's (PRD 587)", () => {
  it("lists the same seven stages as galaxy's STAGES, in the same order", () => {
    const galaxy = galaxyStages(readFileSync(join(repoRoot, GALAXY_STAGE), 'utf8'));
    expect(galaxy).not.toBeNull();
    expect(galaxy).toHaveLength(7);
    expect([...STAGE_ORDER]).toEqual(galaxy);
  });

  it('reads a STAGES list, and fails on one that differs', () => {
    const source = "export const STAGES: readonly StageId[] = ['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro'];";
    expect(galaxyStages(source)).toEqual([...STAGE_ORDER]);
    expect(galaxyStages(source.replace("'building', ", ''))).not.toEqual([...STAGE_ORDER]);
    expect(galaxyStages(source.replace("'inbox', 'building'", "'building', 'inbox'"))).not.toEqual([...STAGE_ORDER]);
    expect(galaxyStages('export const OTHER = [];')).toBeNull();
  });
});
