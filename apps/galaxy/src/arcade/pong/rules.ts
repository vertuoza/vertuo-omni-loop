// OMNI PONG's numbers, in one place so a follow-up retunes the feel without touching the engine.

/** The pitch a player's voice is steered around, set on the ready screen. Hz. */
export const LIMITS = Object.freeze({ LOW: 160, MID: 220, HIGH: 300 });
export type LimitName = keyof typeof LIMITS;
export const LIMIT_NAMES: readonly LimitName[] = ['LOW', 'MID', 'HIGH'];
export const DEFAULT_LIMIT: LimitName = 'MID';

/** Half the dead band around the limit, Hz: without it a voice held near the limit shakes the paddle. */
export const BAND_HZ = 10;

/** How a frame of samples is read as a pitch. */
export const PITCH = Object.freeze({
  /** Samples read from the analyser each frame. */
  frame: 2048,
  /** The range a pitch is looked for in, Hz. */
  minHz: 70,
  maxHz: 1000,
  /** Under this RMS the frame is silence. */
  loudnessFloor: 0.01,
  /** Under this normalised autocorrelation peak the frame is not clearly pitched (speech, breath, noise). */
  clarityFloor: 0.8,
  /** The first peak within this share of the highest is the period: a later one is an octave below. */
  peakShare: 0.9,
});
