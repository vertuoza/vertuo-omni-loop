// A pitch's default music (PRD 859 s4): the same audience gives the same bytes, and the WAV is 30 s,
// 44.1 kHz, stereo.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MUSIC, pitchMusic } from './music.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The fields of a PCM WAV header. */
function header(wav) {
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

describe('pitchMusic', () => {
  it('gives the same bytes every time for an audience, and different music for each', () => {
    const inside = pitchMusic('inside');
    const customers = pitchMusic('customers');
    expect(sha(pitchMusic('inside'))).toBe(sha(inside));
    expect(sha(pitchMusic('customers'))).toBe(sha(customers));
    expect(sha(inside)).not.toBe(sha(customers));
  });

  it('is a 30-second, 44.1 kHz, 16-bit stereo PCM WAV, never silent', () => {
    for (const audience of ['inside', 'customers']) {
      const wav = pitchMusic(audience);
      const fields = header(wav);
      expect(fields, audience).toEqual({ riff: 'RIFF', wave: 'WAVE', format: 1, channels: 2, rate: 44100, bits: 16, data: 30 * 44100 * 4 });
      expect(fields.data / (fields.rate * fields.channels * 2), audience).toBe(MUSIC.seconds);
      expect(wav.length, audience).toBe(44 + fields.data);
      let loudest = 0;
      for (let at = 44; at < wav.length; at += 2000) loudest = Math.max(loudest, Math.abs(wav.readInt16LE(at)));
      expect(loudest, audience).toBeGreaterThan(3000);
    }
  });

  it('refuses an audience other than customers or inside', () => {
    expect(() => pitchMusic('investors')).toThrow(/customers or inside/);
  });
});
