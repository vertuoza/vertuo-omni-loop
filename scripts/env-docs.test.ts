// The docs check for the kit, the game and the scripts (PRD 1059, s4; ADR-0057): the root README's and
// the game's variable lists name exactly what `kit/lib/env/read.ts` reads, both ways. The readers are
// `kit/lib/env/docs.ts`; the app and the arcade check their own docs beside their env modules.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listDifference, readmeNames } from '../kit/lib/env/docs.ts';
import { GAME_VARIABLES, PLATFORM_VARIABLES, VARIABLES } from '../kit/lib/env/read.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const text = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

describe('the docs check, for the kit, the game and the scripts', () => {
  it('keeps the platform\'s variables apart, and the game\'s inside the kit\'s', () => {
    expect(VARIABLES.filter((name) => PLATFORM_VARIABLES.includes(name))).toEqual([]);
    expect(GAME_VARIABLES.filter((name) => !VARIABLES.includes(name))).toEqual([]);
  });

  it('README.md lists exactly the variables the kit, the game and the scripts read', () => {
    expect(listDifference(VARIABLES, readmeNames(text('README.md')))).toEqual({ unlisted: [], unread: [] });
  });

  it('game/README.md lists exactly the variables the game reads', () => {
    expect(listDifference(GAME_VARIABLES, readmeNames(text('game/README.md')))).toEqual({ unlisted: [], unread: [] });
  });
});
