import { describe, expect, it } from 'vitest';
import { isMuted, PLAY_HREF, pressStart, startsOnKey, type StartPorts } from './start';

// PRESS START on HOME (PRD 261, s3): the start sound, unless the player muted the game, then /play.

function ports(muted: string | null) {
  const calls: string[] = [];
  const at: StartPorts = {
    storage: { getItem: (key) => (key === 'omni-loop:muted' ? muted : null) },
    playStart: () => { calls.push('sound'); },
    wait: async (ms) => { calls.push(`wait ${ms}`); },
    go: (href) => { calls.push(`go ${href}`); },
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
    await pressStart(at);
    expect(calls).toEqual(['go /play']);
  });

  it('unmuted, plays the start sound first, lets it ring, then opens /play', async () => {
    const { at, calls } = ports(null);
    await pressStart(at);
    expect(calls[0]).toBe('sound');
    expect(calls.at(-1)).toBe('go /play');
    expect(calls).toHaveLength(3);
    expect(calls[1]).toMatch(/^wait \d+$/);
  });

  it('holds a flash before anything else when one is asked (the Konami code)', async () => {
    const { at, calls } = ports('1');
    await pressStart(at, { holdMs: 900 });
    expect(calls).toEqual(['wait 900', 'go /play']);
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
