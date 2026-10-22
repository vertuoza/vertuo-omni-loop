// A track's measure (PRD 2038 s1): its length, its rises and falls, and its energy in 2-second blocks, by
// the method of `release-videos`. Pure on generated samples; the decoding runs on a faked ffmpeg, never a
// real one.
import { describe, expect, it } from 'vitest';
import { SAMPLE_RATE, decodeTrack, measure, measureTrack } from './energy.ts';
import type { Exec } from './providers/types.ts';

/** `seconds` of a 440 Hz tone at `amplitude` (of 32767), at 8 kHz. */
function tone(seconds: number, amplitude: number): Int16Array {
  const samples = new Int16Array(Math.round(seconds * SAMPLE_RATE));
  for (let n = 0; n < samples.length; n += 1) samples[n] = Math.round(amplitude * Math.sin((2 * Math.PI * 440 * n) / SAMPLE_RATE));
  return samples;
}

/** Spans of tone played one after the other. */
function track(...spans: readonly (readonly [seconds: number, amplitude: number])[]): Int16Array {
  const parts = spans.map(([seconds, amplitude]) => tone(seconds, amplitude));
  const samples = new Int16Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    samples.set(part, offset);
    offset += part.length;
  }
  return samples;
}

/** The gain, in dB, from one amplitude to another, rounded as the measure rounds it. */
const gain = (from: number, to: number): number => Math.round(200 * Math.log10(to / from)) / 10;

/** The samples as ffmpeg writes them: 16-bit little-endian. */
const bytesOf = (samples: Int16Array): Buffer => {
  const bytes = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => bytes.writeInt16LE(sample, index * 2));
  return bytes;
};

describe('measure (PRD 2038 s1)', () => {
  it('finds one rise where 8 s of quiet turn into 8 s of loud, and no fall', () => {
    const { seconds, rises, falls } = measure(track([8, 1000], [8, 16000]));
    expect(seconds).toBe(16);
    expect(rises).toEqual([{ at: 8, db: gain(1000, 16000) }]);
    expect(falls).toEqual([]);
  });

  it('finds nothing in a steady tone', () => {
    const { seconds, rises, falls } = measure(tone(16, 8000));
    expect(seconds).toBe(16);
    expect(rises).toEqual([]);
    expect(falls).toEqual([]);
  });

  it('keeps one rise of two jumps 4 s apart, the larger, whichever comes first', () => {
    expect(measure(track([8, 1000], [4, 2000], [8, 16000])).rises).toEqual([{ at: 12, db: gain(2000, 16000) }]);
    expect(measure(track([8, 1000], [4, 8000], [8, 16000])).rises).toEqual([{ at: 8, db: gain(1000, 8000) }]);
  });

  it('keeps both rises of two jumps more than 8 s apart', () => {
    expect(measure(track([8, 500], [10, 4000], [8, 32000])).rises).toEqual([
      { at: 8, db: gain(500, 4000) },
      { at: 18, db: gain(4000, 32000) },
    ]);
  });

  it('ignores a jump under 3 dB', () => {
    expect(measure(track([8, 10000], [8, 12000])).rises).toEqual([]);
  });

  it('finds one fall where loud turns quiet, its db the change, below 0', () => {
    const { rises, falls } = measure(track([8, 16000], [8, 1000]));
    expect(falls).toEqual([{ at: 8, db: -gain(1000, 16000) }]);
    expect(rises).toEqual([]);
  });

  it('gives the energy of each 2-second block, the last one shorter, and the length to 0.01 s', () => {
    const { seconds, energy } = measure(track([4, 1000], [3.03, 16000]));
    expect(seconds).toBe(7.03);
    expect(energy.map(({ at }) => at)).toEqual([0, 2, 4, 6]);
    const [first, second, third, last] = energy.map(({ db }) => db);
    expect(first).toBe(second);
    expect(third).toBe(last);
    expect((third ?? 0) - (first ?? 0)).toBeCloseTo(gain(1000, 16000), 1);
    // A full-scale sine is 3 dB under full scale: a tone at 16000 of 32767 sits near -9.2 dB.
    expect(third).toBeCloseTo(-9.2, 1);
  });

  it('measures silence and an empty track without a number that is not one', () => {
    const silent = measure(new Int16Array(SAMPLE_RATE * 10));
    expect(silent.rises).toEqual([]);
    expect(silent.energy.every(({ db }) => Number.isFinite(db))).toBe(true);
    expect(measure(new Int16Array(0))).toEqual({ seconds: 0, rises: [], falls: [], energy: [] });
  });

  it('finds the rise out of silence', () => {
    expect(measure(track([8, 0], [8, 8000])).rises.map(({ at }) => at)).toEqual([8]);
  });
});

describe('decodeTrack (PRD 2038 s1)', () => {
  it('asks ffmpeg for mono 16-bit samples at 8 kHz on stdout and reads them', () => {
    const samples = track([1, 1000], [1, -2000]);
    const calls: { file: string; args: readonly string[] }[] = [];
    const exec: Exec = (file, args) => {
      calls.push({ file, args });
      return bytesOf(samples);
    };
    expect(decodeTrack('/run/music.mp3', exec)).toEqual(samples);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.file).toBe('ffmpeg');
    const args = calls[0]?.args ?? [];
    expect(args).toEqual(expect.arrayContaining(['-i', '/run/music.mp3', '-ac', '1', '-ar', '8000', '-f', 's16le', '-acodec', 'pcm_s16le']));
    expect(args.at(-1)).toBe('-');
  });

  it('fails naming why when ffmpeg is missing', () => {
    const exec: Exec = () => {
      throw Object.assign(new Error('spawnSync ffmpeg ENOENT'), { code: 'ENOENT' });
    };
    expect(() => decodeTrack('/run/music.mp3', exec)).toThrow(/ffmpeg is not installed/);
  });

  it('fails naming the track and what ffmpeg said when it fails', () => {
    const exec: Exec = () => {
      throw Object.assign(new Error('Command failed: ffmpeg'), { status: 1, stderr: Buffer.from('/run/music.mp3: Invalid data found when processing input\n') });
    };
    expect(() => decodeTrack('/run/music.mp3', exec)).toThrow('ffmpeg could not decode /run/music.mp3: /run/music.mp3: Invalid data found when processing input');
  });

  it('drops a trailing odd byte rather than misreading the samples', () => {
    const bytes = Buffer.concat([bytesOf(new Int16Array([1, -2, 3])), Buffer.from([7])]);
    expect(decodeTrack('/run/music.mp3', () => bytes)).toEqual(new Int16Array([1, -2, 3]));
  });
});

describe('measureTrack (PRD 2038 s1)', () => {
  it('decodes the track through the given exec and measures it', () => {
    const exec: Exec = () => bytesOf(track([8, 1000], [8, 16000]));
    const result = measureTrack('/run/music.mp3', exec);
    expect(result.seconds).toBe(16);
    expect(result.rises).toEqual([{ at: 8, db: gain(1000, 16000) }]);
    expect(result.energy).toHaveLength(8);
  });
});
