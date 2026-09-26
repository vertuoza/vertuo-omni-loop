import { describe, it, expect } from 'vitest';
import { freqOf, parseSong, SONGS, stepSeconds, type Song } from './score';
import { motifNotes } from './sound';

describe('freqOf', () => {
  it('tunes A4 to 440 Hz and reads sharps and flats', () => {
    expect(freqOf('A4')).toBe(440);
    expect(freqOf('C4')).toBeCloseTo(261.63, 2);
    expect(freqOf('F#4')).toBeCloseTo(369.99, 2);
    expect(freqOf('Bb1')).toBeCloseTo(freqOf('A#1')!, 6);
    expect(freqOf('A5')).toBe(880);
    for (const bad of ['-', '.', 'H4', 'C', 'c4', 'k']) expect(freqOf(bad)).toBeNull();
  });
});

describe('parseSong', () => {
  it('holds a note over its dashes and skips rests', () => {
    const { notes, steps } = parseSong({ bpm: 120, lead: ['C5 - - . E5 .'], drums: ['k . s .'] });
    expect(steps).toBe(6);
    expect(notes).toEqual([
      { voice: 'lead', token: 'C5', step: 0, steps: 3 },
      { voice: 'lead', token: 'E5', step: 4, steps: 1 },
      { voice: 'drums', token: 'k', step: 0, steps: 1 },
      { voice: 'drums', token: 's', step: 2, steps: 1 },
    ]);
  });

  it('names the voice and step of a token it cannot play', () => {
    expect(() => parseSong({ bpm: 120, bass: ['C2 - X9'] })).toThrow(/bass: "X9" at step 2/);
    expect(() => parseSong({ bpm: 120, drums: ['k C4'] })).toThrow(/not a drum/);
  });
});

describe('the songs', () => {
  it.each(Object.entries(SONGS))('%s: every bar is 16 sixteenths, every voice as long as the others', (_, song: Song) => {
    const lengths = (['lead', 'harm', 'bass', 'drums'] as const).filter((v) => song[v]).map((v) => {
      for (const bar of song[v]!) expect(bar.trim().split(/\s+/), bar).toHaveLength(16);
      return song[v]!.length;
    });
    expect(new Set(lengths).size).toBe(1);
    expect(() => parseSong(song)).not.toThrow();
  });

  it('times the intro to its scene: 20 seconds', () => {
    expect(parseSong(SONGS.intro).steps * stepSeconds(SONGS.intro.bpm)).toBe(20);
  });

  it('loops only the background tracks', () => {
    const looping = Object.entries(SONGS).filter(([, s]) => 'loop' in s && s.loop).map(([n]) => n).sort();
    expect(looping).toEqual(['name', 'select']);
  });

  it('rings the unlock fanfare as the level-up fanfare, then a bar of its own for the game', () => {
    const levelup = parseSong(SONGS.levelup), unlock = parseSong(SONGS.unlock);
    expect(levelup.steps).toBe(32);
    expect(unlock.steps).toBe(levelup.steps + 16);
    for (const voice of ['lead', 'harm', 'bass', 'drums'] as const) expect(SONGS.unlock[voice][0], voice).toBe(SONGS.levelup[voice][0]);
    // Short enough to leave the screen with its keys a moment after it lands.
    expect(unlock.steps * stepSeconds(SONGS.unlock.bpm)).toBeLessThan(5);
  });
});

describe('motifNotes', () => {
  it('gives a fleet without a written motif three notes of its own, the same every time', () => {
    const a = motifNotes('dragons');
    expect(a).toHaveLength(3);
    expect(motifNotes('dragons')).toEqual(a);
    for (const n of a) expect(freqOf(n)).not.toBeNull();
    expect(new Set(['dragons', 'ninjas', 'wizards', 'yetis'].map((f) => motifNotes(f).join())).size).toBeGreaterThan(1);
  });
});
