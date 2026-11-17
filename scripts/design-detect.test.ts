import { describe, expect, it } from 'vitest';
import { HEADING, main, targetsOf, type Deps, type Finding, type Run } from './design-detect.ts';

const ENTRIES = ['arcade', 'ask', 'dossier', 'home', 'play-dock', 'outbox'];

function fake(run: Run, seen: string[][] = []): Deps {
  return {
    list: () => ENTRIES,
    run: (targets) => {
      seen.push(targets);
      return run;
    },
  };
}

const finding = (rule: string, line: number): Finding => ({ antipattern: rule, file: `/w/apps/galaxy/src/ask/a.css`, line });

describe('impeccable’s detector is a report that never blocks', () => {
  it('reads every app page but the arcade and HOME', () => {
    const seen: string[][] = [];
    main([], fake({ status: 0, stdout: '[]' }, seen));
    expect(seen[0]).toEqual(['apps/galaxy/src/ask', 'apps/galaxy/src/dossier', 'apps/galaxy/src/outbox']);
    expect(targetsOf(['apps/galaxy/src/ask/a.css'], ENTRIES)).toEqual(['apps/galaxy/src/ask/a.css']);
  });

  it('prints its findings under the heading and exits 0 even with findings', () => {
    const stdout = JSON.stringify([finding('side-tab', 3), finding('side-tab', 9), finding('flat-type', 1)]);
    const { code, lines } = main([], fake({ status: 2, stdout }), '/w');
    expect(code).toBe(0);
    expect(lines[0]).toBe(HEADING);
    expect(lines).toContain('3 findings');
    expect(lines).toContain('  side-tab: 2');
    expect(lines).toContain('apps/galaxy/src/ask/a.css:3 side-tab');
  });

  it('says so when nothing is found', () => {
    expect(main([], fake({ status: 0, stdout: '[]' })).lines).toEqual([HEADING, 'no finding']);
  });

  it('prints one line and exits 0 when the detector cannot start', () => {
    const failed = main([], fake({ status: null, stdout: '', error: 'spawn ENOENT' }));
    expect(failed.code).toBe(0);
    expect(failed.lines).toEqual([`${HEADING}: the detector could not start (spawn ENOENT)`]);
    const garbled = main([], fake({ status: 0, stdout: 'not json' }));
    expect(garbled.code).toBe(0);
    expect(garbled.lines).toHaveLength(1);
  });
});
