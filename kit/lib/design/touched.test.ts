// PRD 1369: whether a diff touches a screen, as `omni design touched` says it.
import { describe, expect, it } from 'vitest';
import { designTouched, formatTouched } from './touched.ts';

const CHANGED = ['src/ui/Button.tsx', 'src/api/route.ts', 'styles/global.css', 'README.md'];

describe('designTouched', () => {
  it('is off while design.enabled is false, whatever the paths and the diff', () => {
    expect(designTouched({ enabled: false, paths: ['src/ui/**'] }, CHANGED)).toEqual({ ui: 'off' });
    expect(designTouched({ enabled: false, paths: [] }, CHANGED)).toEqual({ ui: 'off' });
  });

  it('is unknown when design.paths is empty', () => {
    expect(designTouched({ enabled: true, paths: [] }, CHANGED)).toEqual({ ui: 'unknown' });
  });

  it('is yes with every changed path a glob matches, in the diff order, each once', () => {
    expect(designTouched({ enabled: true, paths: ['src/ui/**', '**/*.css', 'src/ui/'] }, CHANGED)).toEqual({
      ui: 'yes',
      paths: ['src/ui/Button.tsx', 'styles/global.css'],
    });
  });

  it('is no when no changed path matches, or nothing changed', () => {
    expect(designTouched({ enabled: true, paths: ['src/ui/**'] }, ['src/api/route.ts'])).toEqual({ ui: 'no' });
    expect(designTouched({ enabled: true, paths: ['src/ui/**'] }, [])).toEqual({ ui: 'no' });
  });
});

describe('formatTouched', () => {
  it('prints design: off, ui: no, ui: unknown with its reason, or ui: yes and each path', () => {
    expect(formatTouched({ ui: 'off' })).toEqual(['design: off']);
    expect(formatTouched({ ui: 'no' })).toEqual(['ui: no']);
    expect(formatTouched({ ui: 'unknown' })).toEqual(['ui: unknown', 'design.paths is empty: judge from the diff whether a screen changed']);
    expect(formatTouched({ ui: 'unknown', reason: 'cannot read origin/main' })).toEqual(['ui: unknown', 'cannot read origin/main']);
    expect(formatTouched({ ui: 'yes', paths: ['a.css', 'b.tsx'] })).toEqual(['ui: yes', '  a.css', '  b.tsx']);
  });
});
