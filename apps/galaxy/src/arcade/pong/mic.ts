// The microphone, behind a port: the one file that calls getUserMedia and Web Audio. The sound is read
// frame by frame in the browser and never recorded, stored or sent.
import { pitchOf } from './pitch';
import { PITCH } from './rules';

/** What asking for the microphone gave: on, refused (or an insecure page), no microphone, or stopped before it answered. */
export type MicOpened = 'on' | 'blocked' | 'missing' | 'stopped';

/** Where the game reads the voice's pitch from. */
export interface PitchSource {
  open(): Promise<MicOpened>;
  /** The pitch heard now, in Hz, or null: silence, noise, or the microphone off. */
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
  audio: () => Pick<AudioContext, 'sampleRate' | 'createMediaStreamSource' | 'createAnalyser' | 'close'>;
}

const fromWindow = (): MicBrowser => ({
  secure: window.isSecureContext,
  // Missing on an insecure page, whatever the DOM types say.
  media: 'mediaDevices' in navigator ? navigator.mediaDevices : undefined,
  audio: () => new AudioContext(),
});

interface Open {
  stream: MediaStream;
  ctx: ReturnType<MicBrowser['audio']>;
  analyser: Pick<AnalyserNode, 'getFloatTimeDomainData'>;
  samples: Float32Array<ArrayBuffer>;
}

export function browserMic(browser: () => MicBrowser = fromWindow): PitchSource {
  let live: Open | null = null;
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
      if (!b.secure || !b.media) return 'blocked';
      let stream: MediaStream;
      try { stream = await b.media.getUserMedia(AUDIO_CONSTRAINTS); } catch (err) { return refusalOf(err); }
      const ctx = b.audio();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = PITCH.frame;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const opened: Open = { stream, ctx, analyser, samples: new Float32Array(PITCH.frame) };
      if (ask !== asks) { close(opened); return 'stopped'; }
      if (live) close(live);
      live = opened;
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => { if (live === opened) { live = null; close(opened); ended(); } });
      }
      return 'on';
    },
    pitch() {
      if (!live) return null;
      live.analyser.getFloatTimeDomainData(live.samples);
      return pitchOf(live.samples, live.ctx.sampleRate);
    },
    stop() {
      asks++;
      if (live) close(live);
      live = null;
    },
    onEnded(listener) { ended = listener; },
  };
}
