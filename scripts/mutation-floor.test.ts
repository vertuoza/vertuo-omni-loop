// The floor only goes up (PRD 1072): `mutation/floor.json` may raise a module's floor, never lower one
// or drop a module, against the default branch's copy. The rule is proven on fixtures first, then held
// on this checkout's floor file, which must also name every module of the delivery core.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { floorLowerings, moduleOf, parseFloors } from './mutation-report.ts';
import { corePatterns, isCoreFile } from './mutation-changed-plan.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const FLOOR_FILE = 'mutation/floor.json';
const DEFAULT_BRANCH = 'origin/main';

describe('the guard, on fixtures', () => {
  it('passes a floor kept or raised', () => {
    expect(floorLowerings({ ids: 97, board: 89 }, { ids: 97, board: 90 })).toEqual([]);
  });

  it('passes a module added', () => {
    expect(floorLowerings({ ids: 97 }, { ids: 97, board: 89 })).toEqual([]);
  });

  it('refuses a floor lowered, even by a fraction', () => {
    expect(floorLowerings({ ids: 97, board: 89 }, { ids: 96.5, board: 89 })).toEqual([{ module: 'ids', from: 97, to: 96.5 }]);
  });

  it('refuses a module removed', () => {
    expect(floorLowerings({ ids: 97, board: 89 }, { ids: 97 })).toEqual([{ module: 'board', from: 89, to: null }]);
  });

  it('refuses a floor file that is not one score from 0 to 100 per module', () => {
    expect(() => parseFloors({ ids: 101 })).toThrow();
    expect(() => parseFloors({ ids: '97' })).toThrow();
    expect(() => parseFloors([97])).toThrow();
  });
});

/** The default branch's floor file: `null` when that branch has none yet, `undefined` when git has no such ref here. */
function defaultBranchFloors(): ReturnType<typeof parseFloors> | null | undefined {
  const ref = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${DEFAULT_BRANCH}^{commit}`], { cwd: repoRoot, encoding: 'utf8' });
  if (ref.status !== 0) return undefined;
  const shown = spawnSync('git', ['show', `${DEFAULT_BRANCH}:${FLOOR_FILE}`], { cwd: repoRoot, encoding: 'utf8' });
  if (shown.status !== 0) return null;
  return parseFloors(JSON.parse(shown.stdout));
}

const floors = parseFloors(JSON.parse(readFileSync(join(repoRoot, FLOOR_FILE), 'utf8')));
const previous = defaultBranchFloors();

describe('the floor file of this checkout', () => {
  it('holds one floor per module of the delivery core, and none for another', () => {
    const tracked = execFileSync('git', ['ls-files', '-z', 'kit/lib'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    const modules = [...new Set(tracked.filter((path) => isCoreFile(path, corePatterns)).map(moduleOf))].sort();
    expect(modules.length).toBeGreaterThan(0);
    expect(Object.keys(floors).sort()).toEqual(modules);
  });

  // A shallow clone (the CI test job's) has no default branch to compare with: the guard holds wherever
  // it is fetched, as on every agent's worktree and in the preflight.
  it.skipIf(previous === undefined)(`lowers no floor and removes no module of ${DEFAULT_BRANCH}'s copy`, () => {
    expect(floorLowerings(previous ?? {}, floors)).toEqual([]);
  });
});
