import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MASCOTS } from '@omni/design';
import { farOf, motif, setMuted, sfx, unlock, writtenMotif, type Sfx } from './sound';
import { sure } from './test/sure';

// A fleet's motif is keyed by its mascot, never by its name (PRD 400): a workspace names its own
// fleets, and the mascot is what the motif was written for.
describe('writtenMotif', () => {
  it('gives a fleet with the beaver mascot the beaver motif, whatever its name', () => {
    expect(writtenMotif({ name: 'dam-builders', mascot: 'beaver' })).toBe('beaver');
    expect(writtenMotif({ name: 'zz-top', mascot: 'beaver' })).toBe('beaver');
  });

  it('never plays a written motif by a fleet\'s name alone', () => {
    expect(writtenMotif({ name: 'beaver', mascot: null })).toBeNull();
    expect(writtenMotif({ name: 'beaver', mascot: 'octopod' })).toBe('octopod');
  });

  it('has a written motif only for mascots of the library, and none for an unknown one', () => {
    expect(writtenMotif({ name: 'x', mascot: 'dragon' })).toBeNull();
    for (const m of ['beaver', 'octopod', 'picsou', 'pirate']) {
      expect(MASCOTS).toContain(m);
      expect(writtenMotif({ name: 'x', mascot: m })).toBe(m);
    }
  });

  // PRD 517: the five mascots added after the first six each have a motif of their own. They are
  // named here rather than read from the library, so this holds whichever lands first.
  it('gives each of the five new mascots its own written motif, whatever the fleet\'s name', () => {
    for (const m of ['atom-eve', 'shark', 'turtle', 'allen', 'robot']) {
      expect(writtenMotif({ name: 'x', mascot: m })).toBe(m);
      expect(writtenMotif({ name: 'deep-blue', mascot: m })).toBe(m);
      expect(writtenMotif({ name: m, mascot: null })).toBeNull();
    }
  });

  it('still plays notes from the name for invincible', () => {
    expect(writtenMotif({ name: 'x', mascot: 'invincible' })).toBeNull();
  });
});

// The motifs themselves, played into a stand-in for the browser's audio: each oscillator the
// engine starts is kept, with its pitch, when it starts, and whether it slides or wobbles.
type Tone = { f: number; start: number; slides: boolean; wobbles: boolean };

class Param {
  value = 0;
  set: number | null = null;
  slides = false;
  wobbles = false;
  setValueAtTime(v: number) { if (this.set === null) this.set = v; return this; }
  exponentialRampToValueAtTime() { this.slides = true; return this; }
  target: number | null = null;
  setTargetAtTime(v: number) { this.target = v; return this; }
}
class Node {
  connect(to: unknown) { if (to instanceof Param) to.wobbles = true; }
  disconnect() {}
}
class Osc extends Node {
  type = 'sine';
  frequency = new Param();
  at = 0;
  start(t: number) { this.at = t; }
  stop() {}
  setPeriodicWave() {}
}
let audio: FakeAudio;
/** The context sound.ts made last, which the tests read. */
const made = (context: FakeAudio) => { audio = context; };
class FakeAudio {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new Node();
  oscs: Osc[] = [];
  gains: { gain: Param }[] = [];
  hisses = 0;
  constructor() { made(this); }
  resume() {}
  createGain() { const g = Object.assign(new Node(), { gain: new Param() }); this.gains.push(g); return g; }
  createDelay() { return Object.assign(new Node(), { delayTime: new Param() }); }
  createBiquadFilter() { return Object.assign(new Node(), { type: 'lowpass', frequency: new Param(), Q: new Param() }); }
  createPeriodicWave() { return {}; }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { this.hisses++; return Object.assign(new Node(), { buffer: null, loop: false, start() {}, stop() {} }); }
  createOscillator() { const o = new Osc(); this.oscs.push(o); return o; }
}

/** The tones a fleet's motif plays, in the order they start (a vibrato's own oscillator left out). */
function tones(f: { name: string; mascot: string | null }): Tone[] {
  audio.oscs = [];
  motif(f);
  return audio.oscs
    .filter((o) => o.frequency.set !== null)
    .map((o) => ({ f: sure(o.frequency.set, 'o.frequency.set'), start: o.at, slides: o.frequency.slides, wobbles: o.frequency.wobbles }))
    .sort((a, b) => a.start - b.start || a.f - b.f);
}

describe('the five new mascots\' motifs (PRD 517)', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { AudioContext: FakeAudio });
    unlock();
  });
  afterAll(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  beforeEach(() => { vi.clearAllTimers(); });

  it('each plays real pitches of its own, never the three notes from the fleet\'s name', () => {
    const byName = tones({ name: 'deep-blue', mascot: null }).map((t) => t.f);
    for (const m of ['atom-eve', 'shark', 'turtle', 'allen', 'robot']) {
      const played = tones({ name: 'deep-blue', mascot: m });
      expect(played.length, m).toBeGreaterThan(0);
      for (const t of played) expect(Number.isFinite(t.f) && t.f > 20, `${m}: ${t.f}`).toBe(true);
      expect(played.map((t) => t.f), m).not.toEqual(byName);
    }
  });

  it('atom-eve: a sparkly shimmer that rises', () => {
    const played = tones({ name: 'x', mascot: 'atom-eve' });
    expect(played.length).toBeGreaterThanOrEqual(4);
    played.slice(1).forEach((t, i) => { expect(t.f).toBeGreaterThanOrEqual(sure(played[i], 'played[i]').f); });
    expect(sure(played.at(-1), 'played.at(-1)').f).toBeGreaterThan(sure(played[0], 'played[0]').f);
    expect(played.some((t) => t.wobbles)).toBe(true);
  });

  it('shark: a low swell on two notes', () => {
    const played = tones({ name: 'x', mascot: 'shark' });
    expect(new Set(played.map((t) => t.f)).size).toBe(2);
    for (const t of played) expect(t.f).toBeLessThan(110);
  });

  it('turtle: three slow, steady plods', () => {
    const played = tones({ name: 'x', mascot: 'turtle' });
    expect(played).toHaveLength(3);
    const gaps = played.slice(1).map((t, i) => t.start - sure(played[i], 'played[i]').start);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(0.2);
      expect(g).toBeCloseTo(sure(gaps[0], 'gaps[0]'), 6);
    }
    expect(new Set(played.map((t) => t.f)).size).toBe(1);
  });

  it('allen: a wobbly warble that slides', () => {
    const played = tones({ name: 'x', mascot: 'allen' });
    expect(played.every((t) => t.wobbles)).toBe(true);
    expect(played.some((t) => t.slides)).toBe(true);
  });

  it('robot: quick beeps and boops, jumping up and down', () => {
    const played = tones({ name: 'x', mascot: 'robot' });
    expect(played.length).toBeGreaterThanOrEqual(4);
    played.slice(1).forEach((t, i) => { expect(t.start - sure(played[i], 'played[i]').start).toBeLessThanOrEqual(0.1); });
    const steps = played.slice(1).map((t, i) => Math.sign(t.f - sure(played[i], 'played[i]').f));
    expect(steps.every((s) => s !== 0)).toBe(true);
    steps.slice(1).forEach((s, i) => { expect(s).toBe(-sure(steps[i], 'steps[i]')); });
  });
});

// OMNI KART's effects (PRD 1427, slice 2): each new name plays, a rival's is quieter and lower the farther it is, and mute silences them.
describe('the race\'s effects', () => {
  const NEW: readonly Sfx[] = ['beep', 'go', 'boost', 'blob', 'orb', 'box', 'impact', 'spin', 'scrape', 'finalLap'];

  beforeAll(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { AudioContext: FakeAudio });
    unlock();
  });
  afterAll(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  beforeEach(() => { vi.clearAllTimers(); });

  /** What one effect made: the pitches it started, how many hisses, and the loudness of its output. */
  function heard(name: Sfx, far = 0) {
    audio.oscs = [];
    audio.hisses = 0;
    const before = audio.gains.length;
    sfx(name, far);
    const pitches = audio.oscs.filter((o) => o.frequency.set !== null).map((o) => sure(o.frequency.set, 'o.frequency.set'));
    return { pitches, hisses: audio.hisses, level: sure(audio.gains[before], 'the effect\'s output').gain.value };
  }

  it('plays every new effect: a tone or a hiss', () => {
    for (const name of NEW) {
      const h = heard(name);
      expect(h.pitches.length + h.hisses, name).toBeGreaterThan(0);
      expect(h.level, name).toBe(1);
    }
  });

  it('plays a rival\'s effect quieter and lower than the player\'s, and more so the farther it is', () => {
    for (const name of NEW) {
      const own = heard(name), near = heard(name, 0.1), far = heard(name, 0.9);
      expect(near.level, name).toBeLessThan(own.level);
      expect(far.level, name).toBeLessThan(near.level);
      expect(near.level, name).toBeLessThanOrEqual(0.5);
      if (own.pitches.length) {
        expect(sure(near.pitches[0], 'near'), name).toBeLessThan(sure(own.pitches[0], 'own'));
        expect(sure(far.pitches[0], 'far'), name).toBeLessThan(sure(near.pitches[0], 'near'));
      }
    }
  });

  it('gives the loudness and pitch of a distance: the player\'s own at 0, at most half as loud for anything farther', () => {
    expect(farOf(0)).toEqual({ level: 1, pitch: 1 });
    expect(farOf(0.01).level).toBeLessThanOrEqual(0.5);
    expect(farOf(1).level).toBe(0);
    expect(farOf(2)).toEqual(farOf(1));
  });

  it('sounds nothing when muted: the master fades to silence, and back', () => {
    const master = sure(audio.gains[0], 'the master gain').gain;
    setMuted(true);
    expect(master.target).toBe(0);
    setMuted(false);
    expect(master.target).toBeGreaterThan(0);
  });
});
