import { describe, expect, it } from 'vitest';
import { bindKey, defaultOptions, DEFAULT_KEYS, driveOf, FIRST_OPTIONS, loadOptions, optionsKey, optionsPress, OPTIONS_KEY, parseOptions, RESERVED_KEYS, saveOptions, type KartOptions, type OptionsView } from './options';

// The player's options (PRD 1762, slice 1): the defaults, reading them back field by field, binding a key.

const store = (text: string | null) => ({ getItem: () => text, setItem: () => {} });

describe('the defaults', () => {
  it('are ▲ ▼ ◀ ▶ and SPACE, 3 laps, NORMAL and the FLEET CLASSIC look', () => {
    expect(defaultOptions()).toEqual({
      keys: { gas: 'ArrowUp', brake: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', item: ' ' },
      laps: 3, difficulty: 'normal', look: { color: 'FLEET', design: 'CLASSIC' },
    });
  });
});

describe('reading the store back', () => {
  it('reads a missing, empty, unreadable or non-JSON store as the defaults', () => {
    expect(parseOptions(null)).toEqual(defaultOptions());
    expect(parseOptions('')).toEqual(defaultOptions());
    expect(parseOptions('{nope')).toEqual(defaultOptions());
    expect(parseOptions('42')).toEqual(defaultOptions());
    expect(parseOptions('[1]')).toEqual(defaultOptions());
    expect(loadOptions(() => { throw new Error('blocked'); })).toEqual(defaultOptions());
  });

  it('keeps what was saved', () => {
    const o: KartOptions = { keys: { gas: 'w', brake: 's', left: 'a', right: 'd', item: 'e' }, laps: 7, difficulty: 'hard', look: { color: 'PINK', design: 'RACER' } };
    let kept = '';
    saveOptions(o, () => ({ getItem: () => kept, setItem: (k, v) => { expect(k).toBe(OPTIONS_KEY); kept = v; } }));
    expect(loadOptions(() => store(kept))).toEqual(o);
  });

  it('lets a store that throws on write leave the game playable', () => {
    expect(() => saveOptions(defaultOptions(), () => { throw new Error('full'); })).not.toThrow();
  });

  it('falls back on an invalid field alone, keeping the others', () => {
    const text = JSON.stringify({ keys: { gas: 'w', brake: 's', left: 'a', right: 'd', item: 'e' }, laps: 4, difficulty: 'hard', look: { color: 'MAUVE', design: 'ROCKET' } });
    const o = parseOptions(text);
    expect(o.laps).toBe(3);
    expect(o.difficulty).toBe('hard');
    expect(o.keys.gas).toBe('w');
    expect(o.look).toEqual({ color: 'FLEET', design: 'ROCKET' });
    expect(parseOptions(JSON.stringify({ laps: 5, difficulty: 'wild' }))).toEqual({ ...defaultOptions(), laps: 5 });
  });

  it('puts the keys back to their defaults when two actions hold one key', () => {
    const o = parseOptions(JSON.stringify({ laps: 5, keys: { gas: 'w', brake: 'w', left: 'a', right: 'd', item: 'e' } }));
    expect(o.keys).toEqual(DEFAULT_KEYS);
    expect(o.laps).toBe(5);
  });

  it('puts the keys back to their defaults when a stored key is reserved', () => {
    for (const key of RESERVED_KEYS) {
      const o = parseOptions(JSON.stringify({ keys: { gas: key, brake: 's', left: 'a', right: 'd', item: 'e' } }));
      expect(o.keys, key).toEqual(DEFAULT_KEYS);
    }
    expect(parseOptions(JSON.stringify({ keys: { gas: 'M', brake: 's', left: 'a', right: 'd', item: 'e' } })).keys).toEqual(DEFAULT_KEYS);
  });

  it('puts the keys back to their defaults when one is missing or not a key', () => {
    expect(parseOptions(JSON.stringify({ keys: { gas: 'w' } })).keys).toEqual(DEFAULT_KEYS);
    expect(parseOptions(JSON.stringify({ keys: { gas: 1, brake: 's', left: 'a', right: 'd', item: 'e' } })).keys).toEqual(DEFAULT_KEYS);
  });

  it('keeps a stored letter in lower case', () => {
    expect(parseOptions(JSON.stringify({ keys: { gas: 'W', brake: 'S', left: 'A', right: 'D', item: 'E' } })).keys.gas).toBe('w');
  });
});

describe('binding a key', () => {
  it('gives a free key to the action', () => {
    expect(bindKey(DEFAULT_KEYS, 'gas', 'w')).toEqual({ keys: { ...DEFAULT_KEYS, gas: 'w' } });
  });

  it('swaps the two when another action holds the key', () => {
    expect(bindKey(DEFAULT_KEYS, 'gas', 'ArrowDown')).toEqual({ keys: { ...DEFAULT_KEYS, gas: 'ArrowDown', brake: 'ArrowUp' } });
    expect(bindKey(DEFAULT_KEYS, 'left', ' ')).toEqual({ keys: { ...DEFAULT_KEYS, left: ' ', item: 'ArrowLeft' } });
  });

  it('binds the key an action already holds to no change', () => {
    expect(bindKey(DEFAULT_KEYS, 'gas', 'ArrowUp')).toEqual({ keys: DEFAULT_KEYS });
  });

  it('refuses each of ENTER, TAB, SHIFT, ESC, M and F', () => {
    for (const key of ['Enter', 'Tab', 'Shift', 'Escape', 'm', 'M', 'f', 'F']) expect(bindKey(DEFAULT_KEYS, 'gas', key), key).toEqual({ refused: 'reserved' });
  });

  it('keeps a letter in lower case, and finds it with or without SHIFT', () => {
    const { keys } = bindKey(DEFAULT_KEYS, 'gas', 'W') as { keys: KartOptions['keys'] };
    expect(keys.gas).toBe('w');
    expect(driveOf(keys, 'W')).toBe('gas');
    expect(driveOf(keys, 'w')).toBe('gas');
    expect(driveOf(keys, 'z')).toBeNull();
  });

  it('finds the arrows and SPACE by default, and not A, Z, K, B, X or J', () => {
    expect(driveOf(DEFAULT_KEYS, 'ArrowUp')).toBe('gas');
    expect(driveOf(DEFAULT_KEYS, ' ')).toBe('item');
    for (const k of ['a', 'z', 'k', 'b', 'x', 'j', 'Escape']) expect(driveOf(DEFAULT_KEYS, k), k).toBeNull();
  });
});

describe('the OPTIONS panel', () => {
  const run = (...actions: Parameters<typeof optionsPress>[2][]) => {
    let view: OptionsView = FIRST_OPTIONS;
    let options = defaultOptions();
    for (const a of actions) ({ view, options } = optionsPress(view, options, a));
    return { view, options };
  };

  it('moves its cursor over KEYS, LAPS, DIFFICULTY and DEFAULTS, and stops at the ends', () => {
    expect(run('down').view).toEqual({ screen: 'menu', cursor: 'laps' });
    expect(run('down', 'down', 'down', 'down', 'down').view).toEqual({ screen: 'menu', cursor: 'defaults' });
    expect(run('up').view).toEqual({ screen: 'menu', cursor: 'keys' });
  });

  it('changes LAPS through 3, 5 and 7, and DIFFICULTY through EASY, NORMAL and HARD', () => {
    expect(run('down', 'right').options.laps).toBe(5);
    expect(run('down', 'right', 'right').options.laps).toBe(7);
    expect(run('down', 'left').options.laps).toBe(7);
    expect(run('down', 'down', 'right').options.difficulty).toBe('hard');
    expect(run('down', 'down', 'left').options.difficulty).toBe('easy');
  });

  it('puts every option back with DEFAULTS', () => {
    const changed = run('down', 'right', 'down', 'right').options;
    expect(changed).not.toEqual(defaultOptions());
    let step = optionsPress({ screen: 'menu', cursor: 'defaults' }, changed, 'a');
    expect(step.options).toEqual(defaultOptions());
    step = optionsPress({ screen: 'menu', cursor: 'defaults' }, { ...changed, keys: { ...changed.keys, gas: 'w' } }, 'a');
    expect(step.options.keys).toEqual(DEFAULT_KEYS);
  });

  it('opens KEYS on A, and goes back with B: the panel on its lines, then out', () => {
    const keys = run('a').view;
    expect(keys).toEqual({ screen: 'keys', cursor: 'gas', capture: false, refused: false });
    expect(optionsPress(keys, defaultOptions(), 'b')).toMatchObject({ view: FIRST_OPTIONS, leave: false });
    expect(optionsPress(FIRST_OPTIONS, defaultOptions(), 'b')).toMatchObject({ leave: true });
  });

  it('lists the five actions, waits for a key on A and binds the next one', () => {
    let { view, options } = run('a', 'down', 'down', 'a');
    expect(view).toEqual({ screen: 'keys', cursor: 'left', capture: true, refused: false });
    ({ view, options } = optionsKey(view, options, 'q'));
    expect(options.keys.left).toBe('q');
    expect(view).toMatchObject({ capture: false });
  });

  it('swaps on a key another action holds, refuses a reserved key and keeps waiting, and cancels on ESC or B', () => {
    const waiting: OptionsView = { screen: 'keys', cursor: 'gas', capture: true, refused: false };
    expect(optionsKey(waiting, defaultOptions(), 'ArrowDown').options.keys).toMatchObject({ gas: 'ArrowDown', brake: 'ArrowUp' });
    const refused = optionsKey(waiting, defaultOptions(), 'Enter');
    expect(refused.view).toEqual({ ...waiting, refused: true });
    expect(refused.options).toEqual(defaultOptions());
    expect(optionsKey(waiting, defaultOptions(), 'Escape').view).toMatchObject({ capture: false, refused: false });
    expect(optionsPress(waiting, defaultOptions(), 'b').view).toMatchObject({ screen: 'keys', capture: false });
  });
});
