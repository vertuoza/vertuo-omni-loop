// The lint ratchet (PRD 976), proven on fixtures: an area at its ceiling passes, one above or below
// fails naming the number to write, a finding outside every area fails naming its line, and the
// committed ceiling files read and hold every area of the plan.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { type Area, type Finding, areaOf, ceilingProblems, countByArea, readArea } from './lint-areas.ts';

const finding = (path: string, rule = '@typescript-eslint/no-non-null-assertion'): Finding => ({ path, line: 3, rule });

const areas = (kitBin: number, retro: number, retroTests: number): Area[] => [
  { name: 'kit-bin', paths: ['kit/bin/'], ceiling: kitBin },
  { name: 'app-retro', paths: ['apps/omni-app/src/retro/'], ceiling: retro },
  { name: 'app-retro-tests', paths: ['apps/omni-app/src/retro/retro.test.ts'], ceiling: retroTests },
];

const findings: Finding[] = [
  finding('kit/bin/omni.ts'),
  finding('kit/bin/commands/plan.ts', '@typescript-eslint/require-await'),
  finding('apps/omni-app/src/retro/retro.test.ts'),
  finding('apps/omni-app/src/retro/publish.ts'),
];

describe('the lint ceilings, on fixtures', () => {
  it('passes every area at its ceiling', () => {
    expect(ceilingProblems(findings, areas(2, 1, 1))).toEqual([]);
  });

  it('counts a file toward the area holding its longest prefix', () => {
    expect(areaOf('apps/omni-app/src/retro/retro.test.ts', areas(0, 0, 0))?.name).toBe('app-retro-tests');
    expect(areaOf('apps/omni-app/src/retro/publish.ts', areas(0, 0, 0))?.name).toBe('app-retro');
    expect(Object.fromEntries(countByArea(findings, areas(0, 0, 0)).counts)).toEqual({ 'kit-bin': 2, 'app-retro': 1, 'app-retro-tests': 1 });
  });

  it('fails an area above its ceiling, naming the number to write', () => {
    expect(ceilingProblems(findings, areas(1, 1, 1))).toEqual([
      'kit-bin: 2 findings, ceiling 1 — clear the 1 new, or write 2 in scripts/lint-ceilings/kit-bin.json and say why in the pull request',
    ]);
  });

  it('fails an area below its ceiling, naming the number to write', () => {
    expect(ceilingProblems(findings, areas(2, 7, 1))).toEqual(['app-retro: 1 findings, ceiling 7 — write 1 in scripts/lint-ceilings/app-retro.json']);
  });

  it('fails a finding outside every area, naming its line and rule', () => {
    expect(ceilingProblems([...findings, finding('eslint.config.ts', '@typescript-eslint/no-unsafe-call')], areas(2, 1, 1))).toEqual([
      'eslint.config.ts:3 @typescript-eslint/no-unsafe-call: outside every area in scripts/lint-ceilings/ — clear it',
    ]);
  });

  it('fails a prefix two areas hold', () => {
    const twice: Area[] = [...areas(2, 1, 1), { name: 'kit-bin-again', paths: ['kit/bin/'], ceiling: 0 }];
    expect(ceilingProblems(findings, twice)).toEqual(['kit/bin/: held by both kit-bin and kit-bin-again in scripts/lint-ceilings/ — keep it in one']);
  });

  it('reads a ceiling file, and refuses one that does not read, naming why', () => {
    expect(readArea('game', '{ "paths": ["game/"], "ceiling": 285 }')).toEqual({ value: { name: 'game', paths: ['game/'], ceiling: 285 } });
    expect(readArea('game', '{ "paths": ["game/"], "ceiling": -1 }')).toEqual({
      problem: 'scripts/lint-ceilings/game.json: ceiling must be a whole number of findings, not -1',
    });
    expect(readArea('game', '{ "paths": [], "ceiling": 1 }')).toEqual({ problem: 'scripts/lint-ceilings/game.json: paths must be a list of path prefixes' });
    expect(readArea('game', '{ "paths": ["game/"], "ceiling": 1, "why": "x" }')).toEqual({
      problem: 'scripts/lint-ceilings/game.json: why is no field (paths, ceiling)',
    });
    expect(readArea('game', '[1]')).toEqual({ problem: 'scripts/lint-ceilings/game.json: not an object of paths and ceiling' });
    expect(readArea('game', '{ "paths": ')).toEqual({ problem: 'scripts/lint-ceilings/game.json: not JSON' });
  });
});

describe('the committed ceilings', () => {
  const dir = fileURLToPath(new URL('lint-ceilings/', import.meta.url));

  it('hold the seventeen areas of the plan, each file reading', () => {
    const names = readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -'.json'.length));
    expect(names.sort()).toEqual(
      [
        'kit-bin', 'kit-lib-ask-policy-outbox', 'kit-lib-rest', 'kit-test-packages-scripts', 'game', 'app-retro-tests', 'app-core',
        'app-test-api', 'arcade-game', 'arcade-dossier', 'arcade-ask', 'arcade-business', 'arcade-dashboard-jev', 'arcade-data-nav',
        'arcade-work', 'arcade-rest', 'app-retro',
      ].sort(),
    );
    for (const name of names) expect(readArea(name, readFileSync(join(dir, `${name}.json`), 'utf8'))).toHaveProperty('value');
  });
});
