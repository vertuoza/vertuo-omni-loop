import { describe, expect, it } from 'vitest';
import type { Heard } from './pitch';
import { PITCH, VOICE } from './rules';
import { newVoice } from './voice';

const DT = 1 / 60;
const room = (rms = 0.002): Heard => ({ rms, clarity: 0.3, hz: null });
const hum = (hz: number, rms = 0.05): Heard => ({ rms, clarity: 0.97, hz });

/** A tracker past its calibration on a quiet room. */
function listening(roomRms = 0.002) {
  const voice = newVoice();
  for (let t = 0; t < VOICE.calibrationSeconds + DT; t += DT) voice.hear(room(roomRms), DT);
  return voice;
}

const feed = (voice: ReturnType<typeof newVoice>, heard: Heard, frames: number) => {
  let last = voice.hear(heard, DT);
  for (let i = 1; i < frames; i++) last = voice.hear(heard, DT);
  return last;
};

describe('the voice tracker', () => {
  it('listens to the room first, and steers on nothing meanwhile', () => {
    const voice = newVoice();
    const first = voice.hear(hum(300), DT);
    expect(first.calibrating).toBe(true);
    expect(first.hz).toBeNull();
  });

  it('learns the room\'s noise and sets the gate the margin above it', () => {
    const r = feed(listening(0.004), room(0.004), 1);
    expect(r.noise).toBeCloseTo(0.004, 3);
    expect(r.gate).toBeCloseTo(0.004 * 10 ** (VOICE.marginDb / 20), 3);
  });

  it('never lets the gate fall under the silence floor', () => {
    expect(feed(listening(0), room(0), 1).gate).toBe(PITCH.loudnessFloor);
  });

  it('steers on a hum well above the room once it has held', () => {
    const voice = listening();
    expect(voice.hear(hum(300), DT).hz).toBeNull();
    expect(feed(voice, hum(300), Math.ceil(VOICE.steadySeconds / DT)).hz).toBeCloseTo(300);
  });

  it('ignores a pitched sound that is not loud enough over the room: a colleague across the room', () => {
    const voice = listening(0.004);
    const r = feed(voice, hum(300, 0.008), 30);
    expect(r.voiced).toBe(false);
    expect(r.hz).toBeNull();
  });

  it('ignores a loud sound that is not clearly pitched: speech, a clap, a fan', () => {
    expect(feed(listening(), { rms: 0.2, clarity: 0.6, hz: null }, 30).hz).toBeNull();
  });

  it('never steers on speech: a voice that glides keeps starting its hold again', () => {
    const voice = listening();
    let r = voice.hear(hum(100), DT);
    for (let i = 1; i < 60; i++) r = voice.hear(hum(100 * (1 + 0.08 * (i % 2))), DT);
    expect(r.hz).toBeNull();
  });

  it('steers on the median, so one wrong frame (an octave off) never moves it', () => {
    const voice = listening();
    feed(voice, hum(300), 12);
    expect(voice.hear(hum(150), DT).hz).toBeCloseTo(300);
  });

  it('keeps steering through a dropped frame, then lets go after its hold', () => {
    const voice = listening();
    feed(voice, hum(300), 12);
    expect(voice.hear(room(), DT).hz).toBeCloseTo(300);
    expect(feed(voice, room(), Math.ceil(VOICE.holdSeconds / DT) + 1).hz).toBeNull();
  });

  it('follows a quieter room fast and a louder one slowly, and only between hums', () => {
    const voice = listening(0.01);
    expect(feed(voice, room(0.002), 60).noise).toBeLessThan(0.0025);
    const louder = feed(voice, room(0.01), 60).noise;
    expect(louder).toBeGreaterThan(0.002);
    expect(louder).toBeLessThan(0.006);
    const before = voice.hear(room(0.002), DT).noise;
    expect(feed(voice, hum(300, 0.2), 60).noise).toBe(before);
  });

  it('never learns a loud sound it cannot read as the room: an unread hum or speech leaves the gate where it is', () => {
    const voice = listening();
    const before = voice.hear(room(), DT).gate;
    expect(feed(voice, { rms: 0.1, clarity: 0.5, hz: null }, 300).gate).toBeCloseTo(before, 6);
  });

  it('starts afresh when the microphone goes off', () => {
    const voice = listening();
    feed(voice, hum(300), 12);
    expect(voice.hear(null, DT)).toMatchObject({ hz: null, calibrating: false });
    expect(voice.hear(hum(300), DT).calibrating).toBe(true);
  });

  it('reads the tuning on every frame, so a retune applies at once', () => {
    const tuning = { ...VOICE };
    const voice = newVoice(tuning);
    for (let t = 0; t < VOICE.calibrationSeconds + DT; t += DT) voice.hear(room(0.004), DT);
    expect(feed(voice, hum(300, 0.01), 12).hz).toBeNull();
    tuning.marginDb = 6;
    expect(feed(voice, hum(300, 0.01), 12).hz).toBeCloseTo(300);
  });
});
