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
  /** The range a pitch is looked for in, Hz: a low male hum sits near 70. */
  minHz: 60,
  maxHz: 1000,
  /** The microphone's band-pass, Hz: a little under the range, so the lowest hum keeps its fundamental. */
  highpassHz: 50,
  lowpassHz: 1000,
  /** Under this RMS the frame is silence, whatever the room. */
  loudnessFloor: 0.004,
  /** Under this normalised autocorrelation peak the frame is not clearly pitched: a hum is near 1, speech, breath and noise lower. */
  clarityFloor: 0.9,
  /** The first peak within this share of the highest is the period: a later one is an octave below. */
  peakShare: 0.9,
});

/**
 * How a run of frames becomes a steady voice, so a laptop's built-in microphone in an open room steers
 * only on the player's own hum. Times in seconds, rates per second.
 */
export interface VoiceTuning {
  /** Under this normalised autocorrelation peak a frame is not the voice: a hum is near 1, speech and noise lower. */
  clarityFloor: number;
  /** How far above the room's noise a frame must be to count, dB: the player is at the microphone, the room is not. */
  marginDb: number;
  /** How long the room is listened to when the microphone opens, before anything counts. */
  calibrationSeconds: number;
  /** How fast the noise estimate follows a quieter room, and a louder one (only from frames under the gate, so a voice never raises it). */
  noiseFall: number;
  noiseRise: number;
  /** How long a voice must hold before it steers, and how long it keeps steering through a dropped frame. */
  steadySeconds: number;
  holdSeconds: number;
  /** The pitch steered on is the median of this many voiced frames. */
  medianFrames: number;
  /** A frame further than this share from that median starts the hold again: a hum stays on its note, speech glides. */
  stability: number;
}

export const VOICE: Readonly<VoiceTuning> = Object.freeze({
  clarityFloor: PITCH.clarityFloor,
  marginDb: 12,
  calibrationSeconds: 0.8,
  noiseFall: 4,
  noiseRise: 0.3,
  steadySeconds: 0.15,
  holdSeconds: 0.12,
  medianFrames: 5,
  stability: 0.06,
});

/**
 * The match's numbers, chosen by eye so a follow-up tunes the feel without touching the engine. Lengths
 * are the playfield's game pixels, speeds pixels a second, times seconds, angles radians from level.
 */
export const MATCH = Object.freeze({
  field: Object.freeze({ w: 320, h: 288 }),
  /** Each paddle's size, and how far its centre stands from its own edge of the field. */
  paddle: Object.freeze({ w: 6, h: 40, inset: 14 }),
  /** The ball's side: it is a square. */
  ball: 6,
  /** The one speed the voice moves the player's paddle at. */
  playerSpeed: 220,
  /** The ball's speed at each serve, the factor every return multiplies it by, and its cap. */
  serveSpeed: 150,
  speedUp: 1.07,
  maxSpeed: 480,
  /** The angles a serve is drawn between, either way up. */
  serveAngle: Object.freeze({ min: 0.25, max: 0.6 }),
  /** How far off level a return turns per half-paddle the ball struck off the centre, and the steepest it ever leaves. */
  english: 0.35,
  maxAngle: 1,
  /** The AI sees the ball this late, and moves its paddle no faster than this. */
  ai: Object.freeze({ delay: 0.25, speed: 160 }),
  /** How long the ball waits at the centre before each serve. */
  serveSeconds: 1,
  lives: 3,
  /** The fixed step the match is played in, and the longest frame played at once: the same match at 60 or 120 frames a second. */
  subStep: 1 / 120,
  maxDt: 0.05,
});
