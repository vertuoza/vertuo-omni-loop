// A run of frames into a steady voice: the room's noise is learnt, then a frame counts only when it is
// clearly pitched and well above that noise, the pitch is the median of the last voiced frames, a voice
// steers only once it has held on one note (speech glides, a hum does not), and it keeps steering through
// a dropped frame.
import type { Heard } from './pitch';
import { PITCH, VOICE, type VoiceTuning } from './rules';

/** What the tracker made of the latest frame: the pitch the game steers on, and why. */
export interface VoiceReading {
  /** The pitch to steer on, or null: silence, the room, a voice not yet steady, or still listening to the room. */
  hz: number | null;
  /** The room's noise, RMS, and the loudness a frame needs to count. */
  noise: number;
  gate: number;
  /** The frame counted as the player's voice. */
  voiced: boolean;
  calibrating: boolean;
}

export interface Voice {
  /** The latest frame, `dt` seconds after the one before; null while the microphone is off. */
  hear(heard: Heard | null, dt: number): VoiceReading;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] ?? 0 : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

/** A tracker; `tuning` is read on every frame, so a retune applies to the next one. */
export function newVoice(tuning: Readonly<VoiceTuning> = VOICE): Voice {
  let listened = 0;
  let calibration = { sum: 0, n: 0 };
  let noise = 0;
  let recent: number[] = [];
  let voicedFor = 0;
  let last: number | null = null;
  let holdLeft = 0;

  const reset = () => {
    listened = 0;
    calibration = { sum: 0, n: 0 };
    noise = 0;
    recent = [];
    voicedFor = 0;
    last = null;
    holdLeft = 0;
  };
  const gateOf = () => Math.max(PITCH.loudnessFloor, noise * 10 ** (tuning.marginDb / 20));
  const follow = (rms: number, dt: number) => {
    const rate = rms < noise ? tuning.noiseFall : tuning.noiseRise;
    noise += (rms - noise) * Math.min(1, rate * dt);
  };
  const calibrate = (rms: number): VoiceReading => {
    calibration = { sum: calibration.sum + rms, n: calibration.n + 1 };
    noise = calibration.sum / calibration.n;
    return { hz: null, noise, gate: gateOf(), voiced: false, calibrating: true };
  };
  /** A voiced frame: off its note, the hold starts again; held long enough, it steers. */
  const voice = (hz: number, dt: number) => {
    if (recent.length > 0 && Math.abs(hz / median(recent) - 1) > tuning.stability) { voicedFor = 0; recent = []; }
    voicedFor += dt;
    recent = [...recent, hz].slice(-tuning.medianFrames);
    if (voicedFor < tuning.steadySeconds) return;
    last = median(recent);
    holdLeft = tuning.holdSeconds;
  };
  /** Any other frame: the room, learnt only while under the gate; the last pitch kept through its hold. */
  const room = (rms: number, gate: number, dt: number) => {
    if (rms < gate) follow(rms, dt);
    voicedFor = 0;
    recent = [];
    holdLeft -= dt;
    if (holdLeft <= 0) last = null;
  };

  return {
    hear(heard, dt) {
      if (!heard) {
        reset();
        return { hz: null, noise: 0, gate: PITCH.loudnessFloor, voiced: false, calibrating: false };
      }
      listened += dt;
      if (listened < tuning.calibrationSeconds) return calibrate(heard.rms);
      const gate = gateOf();
      const hz = heard.rms >= gate ? heard.hz : null;
      if (hz === null) room(heard.rms, gate, dt);
      else voice(hz, dt);
      return { hz: last, noise, gate, voiced: hz !== null, calibrating: false };
    },
  };
}
