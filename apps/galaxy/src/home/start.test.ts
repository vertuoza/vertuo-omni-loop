import { describe, expect, it } from 'vitest';
import { isMuted, PLAY_HREF, pressStart, startsOnKey, type StartPorts } from './start';

// PRESS START on HOME (PRD 261, s3): the start sound, unless the player muted the game, then /play.

function ports(muted: string | null, choice: string | null = null) {
  const calls: string[] = [];
  const stored: Record<string, string | null> = { 'omni-loop:muted': muted, 'omni-loop:app-choice': choice };
  const at: StartPorts = {
    storage: { getItem: (key) => stored[key] ?? null },
    playStart: () => { calls.push('sound'); },
    wait: async (ms) => { calls.push(`wait ${ms}`); },
    go: (href) => { calls.push(`go ${href}`); },
    open: () => { calls.push('select your app'); },
  };
  return { at, calls };
}

describe('the mute', () => {
  it('is the arcade\'s own: omni-loop:muted set to 1', () => {
    expect(isMuted({ getItem: () => '1' })).toBe(true);
    expect(isMuted({ getItem: () => '0' })).toBe(false);
    expect(isMuted({ getItem: () => null })).toBe(false);
  });

  it('reads as not muted when storage is missing or throws', () => {
    expect(isMuted(null)).toBe(false);
    expect(isMuted({ getItem: () => { throw new Error('blocked'); } })).toBe(false);
  });
});

describe('pressing START', () => {
  it('opens /play', () => {
    expect(PLAY_HREF).toBe('/play');
  });

  it('muted, plays nothing and still opens /play, at once', async () => {
    const { at, calls } = ports('1');
    await pressStart(at, { pick: 'arcade' });
    expect(calls).toEqual(['go /play']);
  });

  it('unmuted, plays the start sound first, lets it ring, then opens /play', async () => {
    const { at, calls } = ports(null);
    await pressStart(at, { pick: 'arcade' });
    expect(calls[0]).toBe('sound');
    expect(calls.at(-1)).toBe('go /play');
    expect(calls).toHaveLength(3);
    expect(calls[1]).toMatch(/^wait \d+$/);
  });

  it('holds a flash before anything else when one is asked (the Konami code)', async () => {
    const { at, calls } = ports('1');
    await pressStart(at, { holdMs: 900, pick: 'arcade' });
    expect(calls).toEqual(['wait 900', 'go /play']);
  });
});

// #955: PRESS START opens SELECT YOUR APP (PRD 932) as SIGN UP WITH GITHUB does, and a remembered
// pick skips it. The Arcade is the game as before; the Omni app opens /app, without the jingle.
describe('PRESS START and SELECT YOUR APP (#955)', () => {
  it('without a remembered pick, opens SELECT YOUR APP: no sound, and it goes nowhere yet', async () => {
    const { at, calls } = ports(null);
    await pressStart(at);
    expect(calls).toEqual(['select your app']);
  });

  it('with the Omni app remembered, opens /app at once, without the start sound', async () => {
    const { at, calls } = ports(null, 'app');
    await pressStart(at);
    expect(calls).toEqual(['go /app']);
  });

  it('with the Arcade remembered, starts the game as before', async () => {
    const { at, calls } = ports('1', 'arcade');
    await pressStart(at);
    expect(calls).toEqual(['go /play']);
  });

  it('a value that is not a pick reads as none, and the overlay opens', async () => {
    const { at, calls } = ports(null, 'galaxy');
    await pressStart(at);
    expect(calls).toEqual(['select your app']);
  });

  it('the Omni app picked in the overlay opens /app', async () => {
    const { at, calls } = ports(null);
    await pressStart(at, { pick: 'app' });
    expect(calls).toEqual(['go /app']);
  });
});

describe('the keys that start the game', () => {
  const key = (over: Partial<Parameters<typeof startsOnKey>[0]> = {}) =>
    ({ key: 'Enter', repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, inControl: false, ...over });

  it('is Enter, anywhere on HOME', () => {
    expect(startsOnKey(key())).toBe(true);
  });

  it('is not another key, a held Enter, or Enter with a modifier', () => {
    expect(startsOnKey(key({ key: ' ' }))).toBe(false);
    expect(startsOnKey(key({ repeat: true }))).toBe(false);
    expect(startsOnKey(key({ metaKey: true }))).toBe(false);
    expect(startsOnKey(key({ ctrlKey: true }))).toBe(false);
  });

  it('leaves Enter to a focused control, which answers it itself', () => {
    expect(startsOnKey(key({ inControl: true }))).toBe(false);
  });
});
