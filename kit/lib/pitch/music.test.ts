// Silence as a WAV (PRD 1108 s5), what the `none` music provider writes.
import { describe, expect, it } from 'vitest';
import { silenceWav } from './music.ts';

/** The fields of a PCM WAV header. */
function header(wav: Buffer) {
  return {
    riff: wav.toString('ascii', 0, 4),
    wave: wav.toString('ascii', 8, 12),
    format: wav.readUInt16LE(20),
    channels: wav.readUInt16LE(22),
    rate: wav.readUInt32LE(24),
    bits: wav.readUInt16LE(34),
    data: wav.readUInt32LE(40),
  };
}

describe('silenceWav (PRD 1108 s5)', () => {
  it('is a WAV of the asked length, every sample zero', () => {
    const wav = silenceWav(2.5);
    const fields = header(wav);
    expect(fields).toEqual({ riff: 'RIFF', wave: 'WAVE', format: 1, channels: 2, rate: 44100, bits: 16, data: Math.round(2.5 * 44100) * 4 });
    expect(wav.length).toBe(44 + fields.data);
    expect(wav.subarray(44).every((byte) => byte === 0)).toBe(true);
  });

  it('refuses a length that is not positive', () => {
    expect(() => silenceWav(0)).toThrow(/silence needs a length/);
    expect(() => silenceWav(Number.NaN)).toThrow(/silence needs a length/);
  });
});
