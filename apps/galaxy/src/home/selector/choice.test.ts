import { describe, expect, it } from 'vitest';
import { CHOICE_KEY, clearChoice, readChoice, saveChoice, type ChoiceStorage } from './choice';

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
