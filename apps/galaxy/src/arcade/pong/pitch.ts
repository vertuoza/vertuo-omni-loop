// The voice's pitch from one frame of samples, by normalised autocorrelation (McLeod's NSDF), with no dependency.
import { PITCH } from './rules';

type Samples = Float32Array | Float64Array;

const at = (values: Samples, i: number): number => values[i] ?? 0;

function rmsOf(samples: Samples): number {
  let energy = 0;
  for (const s of samples) energy += s * s;
  return Math.sqrt(energy / samples.length);
}

/** The normalised square difference at each lag up to `maxLag`: 1 where the frame repeats itself exactly. */
function nsdfOf(samples: Samples, maxLag: number): Float64Array {
  const n = samples.length;
  const out = new Float64Array(maxLag + 2);
  for (let lag = 0; lag < out.length; lag++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i + lag < n; i++) {
      const a = at(samples, i);
      const b = at(samples, i + lag);
      acf += a * b;
      m += a * a + b * b;
    }
    out[lag] = m > 0 ? (2 * acf) / m : 0;
  }
  return out;
}

/** The highest lag of each positive stretch after the curve first falls below zero. */
function keyMaxima(nsdf: Float64Array): number[] {
  const peaks: number[] = [];
  const end = nsdf.length - 1;
  let best = -1;
  let fell = false;
  for (let lag = 1; lag < end; lag++) {
    const v = at(nsdf, lag);
    if (v <= 0) {
      fell = true;
      if (best >= 0) peaks.push(best);
      best = -1;
    } else if (fell && (best < 0 || v > at(nsdf, best))) {
      best = lag;
    }
  }
  if (best >= 0) peaks.push(best);
  return peaks;
}

/** The peak's lag refined between samples by the parabola through it and its neighbours. */
function refined(nsdf: Float64Array, lag: number): number {
  const left = at(nsdf, lag - 1);
  const right = at(nsdf, lag + 1);
  const curve = left - 2 * at(nsdf, lag) + right;
  return curve === 0 ? lag : lag + (0.5 * (left - right)) / curve;
}

/** The frame's pitch in Hz, or null when it is too quiet, not clearly pitched, or outside the range. */
export function pitchOf(samples: Samples, sampleRate: number): number | null {
  const minLag = Math.max(2, Math.floor(sampleRate / PITCH.maxHz));
  const maxLag = Math.ceil(sampleRate / PITCH.minHz);
  // Two periods of the lowest pitch must fit, so its lag is read over enough samples.
  if (samples.length < 2 * maxLag || rmsOf(samples) < PITCH.loudnessFloor) return null;

  const nsdf = nsdfOf(samples, maxLag);
  const peaks = keyMaxima(nsdf).filter((lag) => lag >= minLag && lag <= maxLag);
  const highest = Math.max(0, ...peaks.map((lag) => at(nsdf, lag)));
  if (highest < PITCH.clarityFloor) return null;

  // The first peak near the highest is the period; a later one is an octave below.
  const period = peaks.find((lag) => at(nsdf, lag) >= PITCH.peakShare * highest);
  if (period === undefined) return null;
  const hz = sampleRate / refined(nsdf, period);
  return hz >= PITCH.minHz && hz <= PITCH.maxHz ? hz : null;
}
