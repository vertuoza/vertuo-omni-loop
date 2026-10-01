// A pitch's default music (PRD 859's spec, "The music, default voice"): a 30-second WAV made in code, the
// same bytes every time for an audience, so there is no file to license and no key. Inside gets a
// chiptune loop (square-wave arpeggios, a triangle bass, a noise hat); Customers an upbeat synth loop (a
// detuned saw pad, a plucked lead, a sine bass and a kick). Both walk C, G, Am, F, one chord a bar.
//
// Everything is plain arithmetic on the sample index, with no clock and no random source: the noise is a
// fixed linear-feedback shift register, so the same audience always gives the same bytes.

export const MUSIC = Object.freeze({ seconds: 30, rate: 44100, channels: 2 });

/** C, G, Am, F as MIDI notes, one chord a bar. */
const PROGRESSION = Object.freeze([
  [48, 52, 55],
  [43, 47, 50],
  [45, 48, 52],
  [41, 45, 48],
]);

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const phase = (t, freq) => (t * freq) % 1;
const square = (t, freq, duty = 0.5) => (phase(t, freq) < duty ? 1 : -1);
const triangle = (t, freq) => 4 * Math.abs(phase(t, freq) - 0.5) - 1;
const saw = (t, freq) => 2 * phase(t, freq) - 1;
const sine = (t, freq) => Math.sin(2 * Math.PI * freq * t);

/** Where sample `t` (seconds) falls at `bpm`: the chord, and the position inside a beat's `steps`th. */
function grid(t, bpm, steps) {
  const beat = 60 / bpm;
  const step = beat / steps;
  const index = Math.floor(t / step);
  return { chord: PROGRESSION[Math.floor(t / (beat * 4)) % PROGRESSION.length], index, at: t - index * step, beatAt: t % beat };
}

/** A 15-bit noise register, as the old consoles had: one value per step, the same for every run. */
function noiseTable(length) {
  const out = new Float32Array(length);
  let register = 0x4001;
  for (let index = 0; index < length; index += 1) {
    const bit = (register ^ (register >> 1)) & 1;
    register = (register >> 1) | (bit << 14);
    out[index] = register & 1 ? 1 : -1;
  }
  return out;
}

/** Inside: a chiptune at 150 bpm. Returns the [left, right] sample at `t`. */
function chiptune(noise) {
  return (t, n) => {
    const sixteenth = grid(t, 150, 4);
    const tones = sixteenth.chord;
    const arp = hz(tones[sixteenth.index % tones.length] + 24);
    const lead = square(t, arp, 0.25) * Math.exp(-sixteenth.at * 9) * 0.22;
    const eighth = grid(t, 150, 2);
    const bass = triangle(t, hz(eighth.chord[0] - 12)) * 0.3;
    const offBeat = eighth.index % 2 === 1;
    const hat = offBeat ? noise[Math.floor(n / 4) % noise.length] * Math.exp(-eighth.at * 60) * 0.12 : 0;
    const pan = sixteenth.index % 2 === 0 ? 0.65 : 0.35;
    return [lead * pan + bass + hat, lead * (1 - pan) + bass + hat];
  };
}

/** Customers: an upbeat synth at 112 bpm. Returns the [left, right] sample at `t`. */
function synth() {
  return (t) => {
    const eighth = grid(t, 112, 2);
    const tones = eighth.chord;
    const padL = tones.reduce((sum, note) => sum + saw(t, hz(note + 12) * 0.997), 0) * 0.045;
    const padR = tones.reduce((sum, note) => sum + saw(t, hz(note + 12) * 1.003), 0) * 0.045;
    const pluck = sine(t, hz(tones[eighth.index % tones.length] + 24)) * Math.exp(-eighth.at * 7) * 0.2;
    const bass = sine(t, hz(tones[0] - 12)) * (0.5 + 0.5 * Math.exp(-eighth.at * 5)) * 0.22;
    const sweep = 50 + 90 * Math.exp(-eighth.beatAt * 30);
    const kick = Math.sin(2 * Math.PI * sweep * eighth.beatAt) * Math.exp(-eighth.beatAt * 12) * 0.3;
    const pan = eighth.index % 2 === 0 ? 0.7 : 0.3;
    return [padL + pluck * pan + bass + kick, padR + pluck * (1 - pan) + bass + kick];
  };
}

const VOICES = Object.freeze({ inside: () => chiptune(noiseTable(32767)), customers: () => synth() });

/** The 44-byte header of a 16-bit PCM WAV holding `frames` frames. */
function wavHeader(frames) {
  const { rate, channels } = MUSIC;
  const data = frames * channels * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data, 40);
  return header;
}

const toInt16 = (value) => Math.round(Math.max(-1, Math.min(1, value)) * 32767);

/**
 * The audience's default music as a WAV file's bytes: 30 s, 44.1 kHz, 16-bit stereo, the same bytes
 * every time for an audience.
 * @param {'customers' | 'inside'} audience
 * @returns {Buffer}
 */
export function pitchMusic(audience) {
  const voice = VOICES[audience];
  if (!voice) throw new RangeError(`music is for customers or inside, not ${String(audience)}`);
  const sample = voice();
  const frames = MUSIC.seconds * MUSIC.rate;
  const body = Buffer.alloc(frames * MUSIC.channels * 2);
  for (let n = 0; n < frames; n += 1) {
    const [left, right] = sample(n / MUSIC.rate, n);
    body.writeInt16LE(toInt16(left), n * 4);
    body.writeInt16LE(toInt16(right), n * 4 + 2);
  }
  return Buffer.concat([wavHeader(frames), body]);
}
