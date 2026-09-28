// The arcade's sound: an SNES-flavoured Web Audio engine, generated on the fly (no audio files).
// Two pulse leads (25% and 12.5% duty), a triangle bass, noise drums, and one shared echo that gives
// the "room". Browsers only allow sound after a key or a tap, so the context is created by `unlock()`
// on the first action, and any music asked for before that starts then.
import { freqOf, parseSong, SONGS, stepSeconds, type SongName, type Voice } from './score';

export type Sfx =
  | 'move' | 'select' | 'back' | 'start' | 'tab'
  | 'coin' | 'type' | 'erase' | 'buzz' | 'tick' | 'random' | 'linked' | 'away'
  // Entropy Invaders: a bolt fired, an alien hit, the hero hit, a wave cleared, the game over.
  | 'fire' | 'hit' | 'hurt' | 'wave' | 'over';

type Wave = 'p25' | 'p12' | OscillatorType;

const VOICE_WAVE: Record<Voice, Wave> = { lead: 'p25', harm: 'p12', bass: 'triangle', drums: 'sine' };
const VOICE_GAIN: Record<Voice, number> = { lead: 0.045, harm: 0.028, bass: 0.11, drums: 1 };
const MASTER = 0.8;

let ac: AudioContext | null = null;
let master: GainNode;
let echo: GainNode;
let waves: { p25: PeriodicWave; p12: PeriodicWave };
let noise: AudioBuffer;
let muted = false;
let bus: GainNode | null = null;
let current: SongName | null = null;
let pending: SongName | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function pulse(duty: number) {
  const n = 48, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
    im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
  }
  return ac!.createPeriodicWave(re, im);
}

/** Creates (or resumes) the audio context. Call it from a key press or a tap. */
export function unlock() {
  if (typeof window === 'undefined') return;
  if (ac) { if (ac.state === 'suspended') void ac.resume(); return; }
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac = new Ctor();
  } catch {
    ac = null;
    return;
  }
  master = ac.createGain();
  master.gain.value = muted ? 0 : MASTER;
  master.connect(ac.destination);
  // The SNES "room": a short feedback delay, low-passed, under everything.
  const delay = ac.createDelay(1);
  delay.delayTime.value = 0.18;
  const feedback = ac.createGain();
  feedback.gain.value = 0.3;
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 3000;
  echo = ac.createGain();
  echo.gain.value = 0.32;
  echo.connect(delay); delay.connect(lowpass); lowpass.connect(feedback); feedback.connect(delay); lowpass.connect(master);
  waves = { p25: pulse(0.25), p12: pulse(0.125) };
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  if (pending) { const p = pending; pending = null; music(p); }
}

function note(dest: AudioNode, f: number, t: number, dur: number, wave: Wave, gain: number, { vib = 0, slideTo = 0 } = {}) {
  const ctx = ac!;
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (wave === 'p25' || wave === 'p12') o.setPeriodicWave(waves[wave]); else o.type = wave;
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  if (vib) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = f * vib;
    lfo.connect(depth); depth.connect(o.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.1);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(gain * 0.7, t + Math.min(dur, 0.09));
  g.gain.setValueAtTime(gain * 0.7, t + Math.max(0.01, dur - 0.03));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.08);
}

function hiss(dest: AudioNode, t: number, dur: number, { type = 'bandpass' as BiquadFilterType, freq = 2000, q = 1, gain = 0.2 } = {}) {
  const ctx = ac!;
  const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise;
  src.loop = true;
  filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter); filter.connect(g); g.connect(dest);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

function drum(dest: AudioNode, token: string, t: number, k: number) {
  if (token === 'k') note(dest, 150, t, 0.12, 'sine', 0.5 * k, { slideTo: 40 });
  else if (token === 's') hiss(dest, t, 0.12, { freq: 1800, q: 0.8, gain: 0.28 * k });
  else if (token === 'h') hiss(dest, t, 0.04, { type: 'highpass', freq: 7000, gain: 0.12 * k });
  else if (token === 'c') hiss(dest, t, 0.9, { type: 'highpass', freq: 5000, gain: 0.18 * k });
}

const parsed = new Map<SongName, ReturnType<typeof parseSong>>();
function schedule(name: SongName, dest: AudioNode, t0: number) {
  const song = SONGS[name];
  if (!parsed.has(name)) parsed.set(name, parseSong(song));
  const { notes, steps } = parsed.get(name)!;
  const step = stepSeconds(song.bpm);
  const gains: Partial<Record<Voice, number>> = 'gains' in song ? song.gains : {};
  for (const n of notes) {
    const t = t0 + n.step * step, gain = gains[n.voice] ?? VOICE_GAIN[n.voice];
    if (n.voice === 'drums') drum(dest, n.token, t, gain);
    else {
      const dur = n.steps * step * 0.92;
      note(dest, freqOf(n.token)!, t, dur, VOICE_WAVE[n.voice], gain, { vib: n.voice === 'lead' && dur > 0.3 ? 0.006 : 0 });
    }
  }
  return steps * step;
}

/** Plays a song (looping ones loop), fading out whatever played before. `null` stops the music. */
export function music(name: SongName | null) {
  if (!ac) { pending = name; return; }
  if (name === current) return;
  clearTimeout(timer);
  if (bus) {
    const old = bus;
    old.gain.setTargetAtTime(0, ac.currentTime, 0.06);
    setTimeout(() => old.disconnect(), 400);
  }
  bus = null;
  current = name;
  if (!name) return;
  const mine = ac.createGain();
  mine.connect(master); mine.connect(echo);
  bus = mine;
  const song = SONGS[name];
  const run = (t0: number) => {
    if (bus !== mine || !ac) return;
    const length = schedule(name, mine, t0);
    const ahead = Math.max(0, (t0 + length - ac.currentTime - 0.4) * 1000);
    if ('loop' in song && song.loop) timer = setTimeout(() => run(t0 + length), ahead);
    else timer = setTimeout(() => { if (bus === mine) current = null; }, length * 1000);
  };
  run(ac.currentTime + 0.06);
}

// ── Each mascot's motif, played when the cursor lands on a fleet that flies it ──

const MOTIFS: Record<string, (o: AudioNode, t: number) => void> = {
  beaver(o, t) { // two woody knocks and a hop
    hiss(o, t, 0.05, { freq: 900, q: 6, gain: 0.7 });
    hiss(o, t + 0.12, 0.05, { freq: 800, q: 6, gain: 0.7 });
    note(o, freqOf('C3')!, t + 0.26, 0.1, 'triangle', 0.2);
    note(o, freqOf('G3')!, t + 0.38, 0.16, 'triangle', 0.2);
  },
  octopod(o, t) { // a bubbly rising arpeggio
    ['C5', 'E5', 'G5', 'B5', 'D6'].forEach((n, i) => note(o, freqOf(n)!, t + i * 0.055, 0.07, 'p12', 0.05, { vib: 0.03 }));
  },
  picsou(o, t) { // ka-ching
    note(o, freqOf('B5')!, t, 0.06, 'square', 0.04);
    note(o, freqOf('E6')!, t + 0.07, 0.34, 'square', 0.04);
    note(o, freqOf('E7')!, t + 0.09, 0.3, 'sine', 0.02);
  },
  cia(o, t) { // a muted minor spy line
    note(o, freqOf('E4')!, t, 0.13, 'p25', 0.05);
    note(o, freqOf('G4')!, t + 0.16, 0.13, 'p25', 0.05);
    note(o, freqOf('F#4')!, t + 0.32, 0.3, 'p25', 0.05, { vib: 0.01 });
  },
  pirate(o, t) { // yo-ho, and a cannon
    for (const [n, at, len] of [['D5', 0, 0.15], ['A4', 0.18, 0.26]] as const) {
      note(o, freqOf(n)!, t + at, len, 'triangle', 0.16);
      note(o, freqOf(n)!, t + at, len, 'p12', 0.03);
    }
    hiss(o, t + 0.5, 0.4, { type: 'lowpass', freq: 220, gain: 1.4 });
    note(o, 90, t + 0.5, 0.25, 'sine', 0.45, { slideTo: 35 });
  },
};

const PENTATONIC = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'];
/** A fleet without a written motif gets one from its name: three notes, the same every time. */
export function motifNotes(fleet: string): string[] {
  let h = 2166136261;
  for (const c of fleet) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return [0, 1, 2].map((i) => PENTATONIC[(h >>> (i * 5)) % PENTATONIC.length]);
}

function out() {
  const g = ac!.createGain();
  g.connect(master); g.connect(echo);
  setTimeout(() => g.disconnect(), 3000);
  return g;
}

/** The mascot whose written motif a fleet plays (PRD 400: keyed by mascot, never by name), or null. */
export function writtenMotif(f: { name: string; mascot: string | null }): string | null {
  return f.mascot && Object.hasOwn(MOTIFS, f.mascot) ? f.mascot : null;
}

/** A fleet's motif: its mascot's written one, or three notes from its name. */
export function motif(f: { name: string; mascot: string | null }) {
  if (!ac) return;
  const o = out(), t = ac.currentTime + 0.01;
  const written = writtenMotif(f);
  if (written) return MOTIFS[written](o, t);
  motifNotes(f.name).forEach((n, i) => note(o, freqOf(n)!, t + i * 0.1, i === 2 ? 0.24 : 0.09, 'p25', 0.045));
}

/** A sound effect. */
export function sfx(name: Sfx) {
  if (!ac) return;
  const o = out(), t = ac.currentTime + 0.01;
  switch (name) {
    case 'move': note(o, 660, t, 0.04, 'square', 0.035); break;
    case 'tick': note(o, 880, t, 0.025, 'p12', 0.04); break;
    case 'tab': note(o, 520, t, 0.03, 'square', 0.035); note(o, 780, t + 0.03, 0.03, 'square', 0.035); break;
    case 'select': note(o, 523, t, 0.06, 'square', 0.04); note(o, 784, t + 0.06, 0.08, 'square', 0.04); break;
    case 'back': note(o, 392, t, 0.05, 'square', 0.04); note(o, 262, t + 0.05, 0.08, 'square', 0.04); break;
    case 'start':
      [523, 659, 784, 1047].forEach((f, i) => note(o, f, t + i * 0.07, 0.1, 'square', 0.04));
      note(o, 1568, t + 0.3, 0.25, 'triangle', 0.05);
      break;
    case 'coin': note(o, freqOf('B5')!, t, 0.07, 'square', 0.045); note(o, freqOf('E6')!, t + 0.08, 0.4, 'square', 0.045); break;
    case 'type': note(o, 1320, t, 0.025, 'p12', 0.05); break;
    case 'erase': note(o, 440, t, 0.04, 'p25', 0.04); note(o, 330, t + 0.04, 0.05, 'p25', 0.04); break;
    case 'buzz': note(o, 110, t, 0.22, 'square', 0.05); note(o, 104, t, 0.22, 'square', 0.04); break;
    case 'random': for (let i = 0; i < 8; i++) note(o, 400 + Math.random() * 900, t + i * 0.03, 0.03, 'p12', 0.04); break;
    case 'linked':
      note(o, freqOf('B5')!, t, 0.07, 'square', 0.04);
      note(o, freqOf('E6')!, t + 0.08, 0.2, 'square', 0.04);
      ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => note(o, freqOf(n)!, t + 0.3 + i * 0.08, 0.3, 'sine', 0.05));
      break;
    case 'away': [300, 500, 700].forEach((f, i) => note(o, f, t + i * 0.09, 0.08, 'p12', 0.035)); break;
    case 'fire': note(o, 1400, t, 0.09, 'p12', 0.035, { slideTo: 500 }); break;
    case 'hit':
      hiss(o, t, 0.16, { freq: 1200, q: 0.7, gain: 0.3 });
      note(o, 300, t, 0.1, 'square', 0.035, { slideTo: 90 });
      break;
    case 'hurt':
      hiss(o, t, 0.6, { type: 'lowpass', freq: 600, gain: 0.9 });
      note(o, 220, t, 0.5, 'square', 0.05, { slideTo: 40 });
      break;
    case 'wave': ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => note(o, freqOf(n)!, t + i * 0.06, 0.09, 'p25', 0.045)); break;
    case 'over':
      ['G4', 'E4', 'C4', 'G3'].forEach((n, i) => note(o, freqOf(n)!, t + i * 0.22, i === 3 ? 0.7 : 0.2, 'p25', 0.05, { vib: i === 3 ? 0.02 : 0 }));
      note(o, freqOf('C2')!, t + 0.66, 0.7, 'triangle', 0.12);
      break;
  }
}

// The formation's march: four bass notes going down, one per step, round and round. The steps come
// faster as the formation thins out and each wave starts, so the march speeds up with it.
const MARCH = ['C2', 'Bb1', 'Ab1', 'G1'];

/** The formation's `step`-th march step: its note of the marching bass. */
export function march(step: number) {
  if (!ac) return;
  const o = out(), t = ac.currentTime + 0.01;
  note(o, freqOf(MARCH[((step % MARCH.length) + MARCH.length) % MARCH.length])!, t, 0.09, 'triangle', 0.16);
}

/** Mutes music and effects with a short fade. */
export function setMuted(m: boolean) {
  muted = m;
  if (ac) master.gain.setTargetAtTime(m ? 0 : MASTER, ac.currentTime, 0.04);
}

/** The old one-call API: unlock, respect the mute, play an effect. */
export function play(name: Sfx, isMuted: boolean) {
  unlock();
  if (isMuted !== muted) setMuted(isMuted);
  sfx(name);
}
