import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// No Vertuoza leftovers (PRD 400, acceptance criterion 9): fleets are each workspace's own, so the
// galaxy's code names none of Vertuoza's, and no flavour is looked up by a fleet's name. The scan
// reads every tracked text file of the game's code (the galaxy app, the packages, the game engine),
// outside the tests and their fakes. The migrations and the seed are data, not code, and live
// outside these folders.
//
// `beaver`, `octopod` and `picsou` are mascot keys too, so the sprite set keeps them. So is `cia`:
// it may appear only where flavour is keyed by mascot (the sprite library, the sound motifs, HOME's
// card rules, and HOME's example fleets, which name the mascot each flies: PRD 971), never as a fleet.

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCANNED = ['apps/galaxy', 'packages', 'game'];
const TEXT = /\.(ts|tsx|mts|mjs|js|css|md|json|html|sql)$/;
const EXEMPT = /(\.test\.|\.fake\.|\/test\/|\/__fixtures__\/)/;

/** Where `cia` may appear: the tables keyed by mascot. */
const MASCOT_TABLES = new Set([
  'packages/design/src/sprites.ts',
  'apps/galaxy/src/arcade/sound.ts',
  'apps/galaxy/src/home/spreads/cards.ts',
  'apps/galaxy/src/home/spreads/fleets.ts',
]);

/** The fleet-only names: Vertuoza's fleets that are no mascot key. */
const FLEET_ONLY = [/\bpirates\b/i, /\binvincible-team\b/i, /C\.I\.A\./];
const CIA = /\bcia\b/i;
/** A lookup keyed by a fleet's name: the old tables by name, or a constant indexed by a fleet or its name. */
const BY_FLEET_NAME = [/\bFLEET_SPRITE\b/, /\bRULE_OF\b/, /\b[A-Z][A-Z_]{2,}\[\s*(?:(?:f|t|fleet|team)\.name|fleet|team)\s*\]/];

function leftovers(path: string, source: string): string[] {
  const found: string[] = [];
  source.split('\n').forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    for (const re of FLEET_ONLY) if (re.test(line)) found.push(`${at} names a Vertuoza fleet (${re.source})`);
    if (CIA.test(line) && !MASCOT_TABLES.has(path)) found.push(`${at} names a Vertuoza fleet (cia)`);
    for (const re of BY_FLEET_NAME) if (re.test(line)) found.push(`${at} looks flavour up by a fleet's name (${re.source})`);
  });
  return found;
}

const tracked = () => execFileSync('git', ['ls-files', '--', ...SCANNED], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((p) => TEXT.test(p) && !EXEMPT.test(p));

describe('no Vertuoza fleets in the code', () => {
  it('finds a Vertuoza fleet-only name, and a lookup keyed by fleet name, when there is one', () => {
    expect(leftovers('a.ts', "const f = 'pirates';")).toHaveLength(1);
    expect(leftovers('a.ts', "teams: { 'invincible-team': {} }")).toHaveLength(1);
    expect(leftovers('a.ts', "label: 'C.I.A.'")).toHaveLength(1);
    expect(leftovers('a.ts', "cia: { label: 'SPIES' }")).toHaveLength(1);
    expect(leftovers('apps/galaxy/src/arcade/sound.ts', 'cia(o, t) {')).toEqual([]);
    expect(leftovers('a.ts', 'FLEET_SPRITE.beaver')).toHaveLength(1);
    expect(leftovers('a.ts', 'RULES.find((r) => r.key === RULE_OF[f.name])')).toHaveLength(2);
    expect(leftovers('a.ts', 'if (MOTIFS[fleet]) return MOTIFS[fleet](o, t);')).toHaveLength(1);
    expect(leftovers('a.ts', 'const song = SONGS[name]; MOTIFS[f.mascot];')).toEqual([]);
    expect(leftovers('a.ts', "mascot: 'pirate', label: 'BEAVER'")).toEqual([]);
  });

  it('finds none in the galaxy app, the packages and the game engine, outside the tests', () => {
    const files = tracked();
    expect(files.length).toBeGreaterThan(100);
    const found = files.flatMap((p) => leftovers(p, readFileSync(`${ROOT}${p}`, 'utf8')));
    expect(found).toEqual([]);
  });
});
