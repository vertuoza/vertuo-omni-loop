import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoAccount } from './account-demo';
import { sure } from './test/sure';

// The demo keeps everything in this browser's storage: here, a map standing in for localStorage.
let storage: Map<string, string>;
let refused = false;
beforeEach(() => {
  storage = new Map();
  refused = false;
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => { if (refused) throw new Error('SecurityError'); return storage.get(k) ?? null; },
      setItem: (k: string, v: string) => { if (refused) throw new Error('SecurityError'); storage.set(k, v); },
    },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const HERO = { v: 1 as const, body: 'boy' as const, skin: 2, hair: 1, suit: 0, cape: 2 };

/** A demo guest who signed in, linked GitHub and joined a fleet, as the onboarding leaves them. */
async function player() {
  vi.useFakeTimers();
  const a = demoAccount();
  const signing = a.signIn(); await vi.runAllTimersAsync(); await signing;
  const linking = a.linkGithub(); await vi.runAllTimersAsync(); await linking;
  await a.save({ team: 'octopod', display_name: 'INKY', hero: HERO }, null);
  vi.useRealTimers();
  return a;
}

describe('the demo\'s high scores', () => {
  it('keeps the lowest time for the kart, and the highest score for the others', async () => {
    const a = await player();
    expect(await a.submitScore('kart', 1200)).toBe(1200);
    expect(await a.submitScore('kart', 1500)).toBe(1200);
    expect(await a.submitScore('kart', 900)).toBe(900);
    expect((await a.scores('kart')).mine).toBe(900);
    expect(await a.submitScore('platformer', 100)).toBe(100);
    expect(await a.submitScore('platformer', 50)).toBe(100);
  });

  it('start empty: no table, and no best of the guest\'s', async () => {
    expect(await demoAccount().scores('invaders')).toEqual({ top: [], mine: null });
  });

  it('keep the guest\'s best in browser storage, and resolve each score with the best as stored', async () => {
    const a = await player();
    expect(await a.submitScore('invaders', 300)).toBe(300);
    expect(await a.submitScore('invaders', 200)).toBe(300);
    expect(await a.submitScore('invaders', 1240)).toBe(1240);
    expect(await a.scores('invaders')).toEqual({ top: [{ id: 'guest', name: 'INKY', hero: HERO, team: 'octopod', best: 1240 }], mine: 1240 });
    expect(await a.scores('maze')).toEqual({ top: [], mine: null });
  });

  it('are still there after a reload, on this browser', async () => {
    await (await player()).submitScore('invaders', 385);
    expect((await demoAccount().scores('invaders')).mine).toBe(385);
  });

  it('refuse what Supabase refuses: a score out of 0 to 9,999,999, and a guest who is not a player yet', async () => {
    const a = await player();
    await expect(a.submitScore('invaders', -1)).rejects.toThrow(/0 to 9,999,999/);
    await expect(a.submitScore('invaders', 10_000_000)).rejects.toThrow(/0 to 9,999,999/);
    await expect(a.submitScore('invaders', 1.5)).rejects.toThrow(/0 to 9,999,999/);
    expect(await a.submitScore('invaders', 9_999_999)).toBe(9_999_999);
    storage.clear(); // a fresh guest on this browser
    await expect(a.submitScore('invaders', 100)).rejects.toThrow(/player/);
  });

  it('fail to save when the browser refuses its storage, as a score not saved', async () => {
    const a = await player();
    refused = true;
    await expect(a.submitScore('invaders', 100)).rejects.toThrow(/player/);
    expect(await a.scores('invaders')).toEqual({ top: [], mine: null });
  });
});

describe('the demo\'s saved guest', () => {
  it('comes back as it was saved, after a reload', async () => {
    await player();
    expect(sure(demoAccount().restore, 'demoAccount().restore')()).toMatchObject({ session: { id: 'guest', github: 'guest-gh' }, me: { display_name: 'INKY', team: 'octopod', hero: HERO } });
  });

  it('starts a fresh guest when what this browser kept is not a guest', () => {
    storage.set('omni-loop:guest', JSON.stringify({ signedIn: true, me: { id: 'guest', display_name: 'INKY', hero: 'not a hero' } }));
    expect(sure(demoAccount().restore, 'demoAccount().restore')()).toEqual({ session: null, me: null });
  });
});
