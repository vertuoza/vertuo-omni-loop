import { describe, expect, it } from 'vitest';
import type { AppPick } from '../sign-up';
import {
  answerSignUp, changeChoice, CHOICE_KEY, clearChoice, hintLine, readChoice, saveChoice, type ChoiceStorage, type SignUpClickPorts,
} from './choice';

// The pick REMEMBER MY CHOICE saves (PRD 932, s3): kept in this browser under its own key, read and
// written in try/catch like the arcade's mute, so a browser that refuses storage still works.

function memory(): ChoiceStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => { items.set(k, v); },
    removeItem: (k) => { items.delete(k); },
  };
}

const refusing: ChoiceStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

describe('the saved pick', () => {
  it('lives under omni-loop:app-choice', () => {
    expect(CHOICE_KEY).toBe('omni-loop:app-choice');
  });

  it('is saved, read and cleared', () => {
    const storage = memory();
    expect(readChoice(storage)).toBeNull();
    saveChoice(storage, 'app');
    expect(storage.items.get(CHOICE_KEY)).toBe('app');
    expect(readChoice(storage)).toBe('app');
    saveChoice(storage, 'arcade');
    expect(readChoice(storage)).toBe('arcade');
    clearChoice(storage);
    expect(readChoice(storage)).toBeNull();
    expect(storage.items.has(CHOICE_KEY)).toBe(false);
  });

  it.each(['', 'App', 'play', '/app', 'null', '{"pick":"app"}'])('reads an unknown stored value, %j, as no pick', (value) => {
    const storage = memory();
    storage.items.set(CHOICE_KEY, value);
    expect(readChoice(storage)).toBeNull();
  });

  it('reads storage that throws as no pick, and saves or clears nothing, without throwing', () => {
    expect(readChoice(refusing)).toBeNull();
    expect(() => saveChoice(refusing, 'app')).not.toThrow();
    expect(() => clearChoice(refusing)).not.toThrow();
  });

  it('reads no storage at all as no pick, and saves nothing', () => {
    expect(readChoice(null)).toBeNull();
    expect(() => saveChoice(null, 'arcade')).not.toThrow();
    expect(() => clearChoice(null)).not.toThrow();
  });
});

// A remembered pick (PRD 932, s4): the line under SIGN UP WITH GITHUB says where it opens, a click goes
// straight to GitHub with the pick, and change forgets it and opens the overlay.
describe('the hint line under the button', () => {
  it.each([
    ['app', 'Opens the Omni app · change'],
    ['arcade', 'Opens the Arcade · change'],
  ] as const)('reads %j as %j', (pick, line) => {
    const words = hintLine(pick);
    expect(words).not.toBeNull();
    expect(`${words?.opens} · ${words?.change}`).toBe(line);
  });

  it('is not there without a saved pick', () => {
    expect(hintLine(null)).toBeNull();
  });
});

describe('a click on SIGN UP WITH GITHUB', () => {
  function ports(storage: ChoiceStorage | null): SignUpClickPorts & { opened: number; went: AppPick[] } {
    const p = {
      storage,
      opened: 0,
      went: [] as AppPick[],
      open: () => { p.opened += 1; },
      go: (pick: AppPick) => { p.went.push(pick); },
    };
    return p;
  }

  it.each(['app', 'arcade'] as const)('with %j saved, starts the sign-in with it and never opens the overlay', (pick) => {
    const storage = memory();
    saveChoice(storage, pick);
    const p = ports(storage);
    answerSignUp(p);
    expect(p.went).toEqual([pick]);
    expect(p.opened).toBe(0);
    expect(readChoice(storage)).toBe(pick);
  });

  it('with no saved pick, an unknown one or storage that refuses, opens the overlay and starts nothing', () => {
    const unknown = memory();
    unknown.items.set(CHOICE_KEY, 'play');
    for (const storage of [memory(), unknown, refusing, null]) {
      const p = ports(storage);
      answerSignUp(p);
      expect(p.opened).toBe(1);
      expect(p.went).toEqual([]);
    }
  });

  it('change clears the pick and opens the overlay, and a later click opens it again', () => {
    const storage = memory();
    saveChoice(storage, 'app');
    const p = ports(storage);
    changeChoice(p);
    expect(readChoice(storage)).toBeNull();
    expect(p.opened).toBe(1);
    expect(p.went).toEqual([]);
    answerSignUp(p);
    expect(p.opened).toBe(2);
    expect(p.went).toEqual([]);
  });

  it('change with storage that refuses still opens the overlay, without throwing', () => {
    const p = ports(refusing);
    expect(() => changeChoice(p)).not.toThrow();
    expect(p.opened).toBe(1);
  });
});
