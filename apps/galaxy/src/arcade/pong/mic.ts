// The microphone, behind a port: the one file that calls getUserMedia and Web Audio. The sound is read
// frame by frame in the browser and never recorded, stored or sent.
import { analyse } from './pitch';
import { PITCH, VOICE, type VoiceTuning } from './rules';
import { newVoice } from './voice';

/** What asking for the microphone gave: on, refused (or an insecure page), no microphone, or stopped before it answered. */
export type MicOpened = 'on' | 'blocked' | 'missing' | 'stopped';

/** Where the game reads the voice's pitch from. */
export interface PitchSource {
  open(): Promise<MicOpened>;
  /** The steady pitch heard now, in Hz, or null: silence, the room, or the microphone off. */
  pitch(): number | null;
  /** Stops the microphone's track: the browser's recording light goes out. */
  stop(): void;
  /** Called when the track ends by itself (unplugged, taken by another app). */
  onEnded(listener: () => void): void;
}

/** The browser's echo cancellation, noise suppression and auto gain bend the pitch the steering reads. */
export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
};

const MISSING = new Set(['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError', 'NotReadableError']);

/** Why getUserMedia refused: no device to give is `missing`; anything else the browser said no to is `blocked`. */
export function refusalOf(err: unknown): 'blocked' | 'missing' {
  const name = typeof err === 'object' && err !== null && 'name' in err ? err.name : null;
  return typeof name === 'string' && MISSING.has(name) ? 'missing' : 'blocked';
}

/** The parts of the browser the microphone needs, handed in so a test can stand in for them. */
export interface MicBrowser {
  secure: boolean;
  media: Pick<MediaDevices, 'getUserMedia'> | undefined;
  audio: () => Pick<AudioContext, 'sampleRate' | 'createMediaStreamSource' | 'createAnalyser' | 'createBiquadFilter' | 'resume' | 'close'>;
  /** Seconds, for the time between two reads. */
  now: () => number;
}

const fromWindow = (): MicBrowser => ({
  secure: window.isSecureContext,
  // Missing on an insecure page, whatever the DOM types say.
  media: 'mediaDevices' in navigator ? navigator.mediaDevices : undefined,
  audio: () => new AudioContext(),
  now: () => performance.now() / 1000,
});

interface Open {
  stream: MediaStream;
  ctx: ReturnType<MicBrowser['audio']>;
  analyser: Pick<AnalyserNode, 'getFloatTimeDomainData'>;
  samples: Float32Array<ArrayBuffer>;
}

/** The longest gap between two reads counted as such: a tab back from the background starts afresh. */
const MAX_GAP = 0.25;

export function browserMic(browser: () => MicBrowser = fromWindow, tuning: Readonly<VoiceTuning> = VOICE): PitchSource {
  let live: Open | null = null;
  let voice = newVoice(tuning);
  let lastRead: number | null = null;
  let now = () => 0;
  let asks = 0;
  let ended: () => void = () => {};
  const close = (o: Open) => {
    for (const track of o.stream.getTracks()) track.stop();
    void o.ctx.close().catch(() => {});
  };
  return {
    async open() {
      const ask = ++asks;
      const b = browser();
      now = b.now;
      if (!b.secure || !b.media) return 'blocked';
      let stream: MediaStream;
      try { stream = await b.media.getUserMedia(AUDIO_CONSTRAINTS); } catch (err) { return refusalOf(err); }
      const ctx = b.audio();
      // Safari, and Chrome when the answer came long after the click, start the context suspended: it would hear silence.
      void ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = PITCH.frame;
      // A band-pass over the voice's range: the room's rumble and hiss never reach the pitch.
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = PITCH.highpassHz;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = PITCH.lowpassHz;
      ctx.createMediaStreamSource(stream).connect(highpass).connect(lowpass).connect(analyser);
      const opened: Open = { stream, ctx, analyser, samples: new Float32Array(PITCH.frame) };
      if (ask !== asks) { close(opened); return 'stopped'; }
      if (live) close(live);
      live = opened;
      voice = newVoice(tuning);
      lastRead = null;
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => { if (live === opened) { live = null; close(opened); ended(); } });
      }
      return 'on';
    },
    pitch() {
      if (!live) return null;
      live.analyser.getFloatTimeDomainData(live.samples);
      const t = now();
      const dt = lastRead === null ? 0 : Math.min(MAX_GAP, Math.max(0, t - lastRead));
      lastRead = t;
      return voice.hear(analyse(live.samples, live.ctx.sampleRate, tuning.clarityFloor), dt).hz;
    },
    stop() {
      asks++;
      if (live) close(live);
      live = null;
    },
    onEnded(listener) { ended = listener; },
  };
}
