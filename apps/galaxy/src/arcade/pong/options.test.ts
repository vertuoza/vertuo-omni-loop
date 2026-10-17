import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { defaultOptions, limitHz, loadOptions, OPTIONS_KEY, optionsPress, parseOptions, saveOptions, type PongOptions } from './options';

const store = (text: string | null) => ({ getItem: () => text, setItem: () => {} });

describe('the limit kept in the browser', () => {
  it('is MID by default', () => {
    expect(defaultOptions()).toEqual({ limit: 'MID' });
    expect(limitHz(defaultOptions())).toBe(220);
  });

  it('names LOW 160 Hz, MID 220 Hz and HIGH 300 Hz', () => {
    expect([limitHz({ limit: 'LOW' }), limitHz({ limit: 'MID' }), limitHz({ limit: 'HIGH' })]).toEqual([160, 220, 300]);
  });

  it('is kept under omni-loop:pong-options and read back', () => {
    expect(OPTIONS_KEY).toBe('omni-loop:pong-options');
    for (const limit of ['LOW', 'MID', 'HIGH'] as const) {
      let kept = '';
      saveOptions({ limit }, () => ({ getItem: () => kept, setItem: (k, v) => { expect(k).toBe(OPTIONS_KEY); kept = v; } }));
      expect(loadOptions(() => store(kept))).toEqual({ limit });
    }
  });

  it('reads a missing, empty, broken or unknown store as MID', () => {
    for (const text of [null, '', '{nope', '42', '[1]', 'null', '{}', '{"limit":"SOPRANO"}', '{"limit":220}']) {
      expect(parseOptions(text)).toEqual({ limit: 'MID' });
      expect(loadOptions(() => store(text))).toEqual({ limit: 'MID' });
    }
  });

  it('reads a store that refuses as MID, and a write it refuses leaves the game playable', () => {
    expect(loadOptions(() => { throw new Error('blocked'); })).toEqual({ limit: 'MID' });
    expect(loadOptions(() => ({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} }))).toEqual({ limit: 'MID' });
    expect(() => { saveOptions({ limit: 'HIGH' }, () => { throw new Error('full'); }); }).not.toThrow();
    expect(() => { saveOptions({ limit: 'HIGH' }, () => ({ getItem: () => null, setItem: () => { throw new Error('full'); } })); }).not.toThrow();
  });
});

describe('◀ ▶ on the limit', () => {
  const press = (o: PongOptions, ...actions: Action[]) => actions.reduce((acc, a) => optionsPress(acc, a), o);

  it('steps through LOW, MID and HIGH', () => {
    expect(press({ limit: 'MID' }, 'right')).toEqual({ limit: 'HIGH' });
    expect(press({ limit: 'MID' }, 'left')).toEqual({ limit: 'LOW' });
    expect(press({ limit: 'LOW' }, 'right', 'right')).toEqual({ limit: 'HIGH' });
  });

  it('stops at the ends', () => {
    expect(press({ limit: 'HIGH' }, 'right')).toEqual({ limit: 'HIGH' });
    expect(press({ limit: 'LOW' }, 'left')).toEqual({ limit: 'LOW' });
    expect(press({ limit: 'MID' }, 'left', 'left', 'left')).toEqual({ limit: 'LOW' });
  });

  it('leaves the limit alone on any other press', () => {
    for (const action of ['up', 'down', 'a', 'b', 'start', 'select'] as const) expect(press({ limit: 'LOW' }, action)).toEqual({ limit: 'LOW' });
  });
});
