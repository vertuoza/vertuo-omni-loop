import { describe, expect, it } from 'vitest';
import { pitchOf } from './pitch';
import { PITCH } from './rules';

const RATES = [44_100, 48_000] as const;

const tone = (partials: readonly (readonly [hz: number, amplitude: number])[], rate: number, n = PITCH.frame): Float32Array => {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = partials.reduce((sum, [hz, a]) => sum + a * Math.sin((2 * Math.PI * hz * i) / rate + hz), 0);
  return out;
};

const sine = (hz: number, rate: number, amplitude = 0.5) => tone([[hz, amplitude]], rate);

// Seeded, so the noise is the same on every run.
function noise(seed: number, n = PITCH.frame): Float32Array {
  let s = seed >>> 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0;
    out[i] = s / 2 ** 32 - 0.5;
  }
  return out;
}

const within2pc = (heard: number | null, hz: number) => heard !== null && Math.abs(heard - hz) / hz < 0.02;

describe('pitchOf', () => {
  for (const rate of RATES) {
    for (const hz of [70, 110, 165, 220, 330, 660]) {
      it(`reads a ${String(hz)} Hz sine at ${String(rate)} Hz within 2 %`, () => {
        expect(within2pc(pitchOf(sine(hz, rate), rate), hz)).toBe(true);
      });
    }

    it(`reads a sine with harmonics as its fundamental, not an octave, at ${String(rate)} Hz`, () => {
      for (const hz of [110, 220, 330]) {
        const heard = pitchOf(tone([[hz, 0.4], [2 * hz, 0.3], [3 * hz, 0.2], [4 * hz, 0.1]], rate), rate);
        expect(within2pc(heard, hz)).toBe(true);
      }
    });

    it(`reads silence, a sine under the loudness floor and white noise as null at ${String(rate)} Hz`, () => {
      expect(pitchOf(new Float32Array(PITCH.frame), rate)).toBeNull();
      expect(pitchOf(sine(220, rate, PITCH.loudnessFloor / 2), rate)).toBeNull();
      for (let seed = 1; seed <= 20; seed++) expect(pitchOf(noise(seed), rate)).toBeNull();
    });
  }

  it('looks between 60 and 1000 Hz only', () => {
    expect(PITCH.minHz).toBe(60);
    expect(PITCH.maxHz).toBe(1000);
    expect(pitchOf(sine(40, 48_000), 48_000)).toBeNull();
    expect(within2pc(pitchOf(sine(1500, 48_000), 48_000), 1500)).toBe(false);
  });

  it('reads the edges of the range', () => {
    for (const hz of [65, 950]) expect(within2pc(pitchOf(sine(hz, 48_000), 48_000), hz)).toBe(true);
  });

  it('reads an empty or too short frame as null', () => {
    expect(pitchOf(new Float32Array(0), 48_000)).toBeNull();
    expect(pitchOf(sine(110, 48_000).subarray(0, 64), 48_000)).toBeNull();
  });
});
