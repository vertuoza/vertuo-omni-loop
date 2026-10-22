import { describe, expect, it, vi } from 'vitest';
import { MIC_REASON, MIC_REQUIRED, readyLines, type PongHud } from '../scenes/pong.ts';
import { createPong } from './art';
import { fakeMic, settle } from './mic.fake';
import { AUDIO_CONSTRAINTS, browserMic, refusalOf, type MicBrowser } from './mic';
import { PITCH, VOICE } from './rules';

// PULSAR VOLLEY's microphone (PRD 2101): the browser's, behind the PitchSource port, and what each answer
// does to the ready screen, through a fake one.

/** A stand-in for the browser: a stream of one track, an audio graph that hears a sine, and what was asked of them. */
function browser({ secure = true, media = true, refuse = null as string | null, hz = 220 } = {}) {
  const clock = { t: 0 };
  const sound = { amp: 0.5 };
  const filters: { type: string; hz: number }[] = [];
  const node = (): unknown => ({ connect: (next: unknown) => next });
  const track = { stopped: 0, listeners: [] as (() => void)[], stop() { this.stopped++; }, addEventListener(_: string, f: () => void) { this.listeners.push(f); } };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const asked: MediaStreamConstraints[] = [];
  const audio = { closed: 0, fftSize: 0, resumed: 0 };
  const env: MicBrowser = {
    secure,
    media: media
      ? {
          getUserMedia: (c?: MediaStreamConstraints) => {
            asked.push(c ?? {});
            return refuse ? Promise.reject(Object.assign(new Error(refuse), { name: refuse })) : Promise.resolve(stream);
          },
        }
      : undefined,
    audio: () => ({
      sampleRate: 48000,
      createAnalyser: () => ({
        set fftSize(n: number) { audio.fftSize = n; },
        getFloatTimeDomainData: (out: Float32Array) => { out.forEach((_, i) => { out[i] = sound.amp * Math.sin((2 * Math.PI * hz * i) / 48000); }); },
      }) as unknown as AnalyserNode,
      createMediaStreamSource: () => node() as MediaStreamAudioSourceNode,
      createBiquadFilter: () => {
        const f = { type: '', hz: 0 };
        filters.push(f);
        return { ...(node() as object), set type(t: string) { f.type = t; }, frequency: { set value(v: number) { f.hz = v; } } } as unknown as BiquadFilterNode;
      },
      resume: () => { audio.resumed++; return Promise.resolve(); },
      close: () => { audio.closed++; return Promise.resolve(); },
    }),
    now: () => clock.t,
  };
  return { env, track, asked, audio, clock, filters, sound };
}

describe('the browser\'s microphone', () => {
  it('asks for the voice as it is: echo cancellation, noise suppression and auto gain off', async () => {
    const b = browser();
    const mic = browserMic(() => b.env);
    expect(await mic.open()).toBe('on');
    expect(b.asked).toEqual([AUDIO_CONSTRAINTS]);
    expect(AUDIO_CONSTRAINTS.audio).toEqual({ echoCancellation: false, noiseSuppression: false, autoGainControl: false });
    expect(b.audio.fftSize).toBe(PITCH.frame);
  });

  it('band-passes the voice\'s range before the analyser', async () => {
    const b = browser();
    await browserMic(() => b.env).open();
    expect(b.filters).toEqual([{ type: 'highpass', hz: PITCH.highpassHz }, { type: 'lowpass', hz: PITCH.lowpassHz }]);
    expect(b.audio.resumed).toBe(1);
  });

  it('listens to the room first, then reads a steady pitch from the analyser, and nothing once stopped', async () => {
    const b = browser({ hz: 220 });
    const mic = browserMic(() => b.env, { ...VOICE, calibrationSeconds: 0.1 });
    expect(mic.pitch()).toBeNull();
    b.sound.amp = 0.001;
    await mic.open();
    for (let i = 0; i < 10; i++) { b.clock.t += 1 / 60; expect(mic.pitch()).toBeNull(); }
    b.sound.amp = 0.5;
    for (let i = 0; i < 10; i++) { b.clock.t += 1 / 60; mic.pitch(); }
    expect(mic.pitch()).toBeCloseTo(220, -1);
    mic.stop();
    expect(b.track.stopped).toBe(1);
    expect(b.audio.closed).toBe(1);
    expect(mic.pitch()).toBeNull();
  });

  it('says blocked on an insecure page, or with no mediaDevices, without asking', async () => {
    for (const b of [browser({ secure: false }), browser({ media: false })]) {
      expect(await browserMic(() => b.env).open()).toBe('blocked');
      expect(b.asked).toEqual([]);
    }
  });

  it('says blocked when the browser refuses, and missing when there is no microphone to give', async () => {
    expect(await browserMic(() => browser({ refuse: 'NotAllowedError' }).env).open()).toBe('blocked');
    expect(await browserMic(() => browser({ refuse: 'SecurityError' }).env).open()).toBe('blocked');
    expect(await browserMic(() => browser({ refuse: 'NotFoundError' }).env).open()).toBe('missing');
    expect(refusalOf(Object.assign(new Error(), { name: 'NotReadableError' }))).toBe('missing');
    expect(refusalOf('no reason')).toBe('blocked');
  });

  it('stops a microphone that answers after it was stopped, and says so', async () => {
    const b = browser();
    const mic = browserMic(() => b.env);
    const asking = mic.open();
    mic.stop();
    expect(await asking).toBe('stopped');
    expect(b.track.stopped).toBe(1);
    expect(mic.pitch()).toBeNull();
  });

  it('tells when its track ends by itself, and stops reading', async () => {
    const b = browser();
    const mic = browserMic(() => b.env);
    const ended = vi.fn();
    mic.onEnded(ended);
    await mic.open();
    for (const f of b.track.listeners) f();
    expect(ended).toHaveBeenCalledOnce();
    expect(mic.pitch()).toBeNull();
  });
});

describe('each answer on the ready screen', () => {
  const store = () => ({ getItem: () => null, setItem: () => {} });
  const lines = (hud: PongHud) => readyLines(hud);

  it('granted: the meter, and START to play', async () => {
    const game = createPong({ mic: fakeMic('on'), store });
    game.press('a');
    await settle();
    expect(game.hud().mic).toBe('on');
    expect(lines(game.hud())).toEqual({ kind: 'meter', pitch: '◀ PITCH · MID ▶', call: 'PLAY' });
  });

  it('refused, or on an insecure page: MIC REQUIRED · MIC BLOCKED IN THE BROWSER, and A to ask again', async () => {
    const game = createPong({ mic: fakeMic('blocked'), store });
    game.press('a');
    await settle();
    expect(lines(game.hud())).toEqual({ kind: 'refused', warn: MIC_REQUIRED, why: 'MIC BLOCKED IN THE BROWSER', call: 'ASK AGAIN' });
  });

  it('not found: MIC REQUIRED · NO MIC FOUND', async () => {
    const game = createPong({ mic: fakeMic('missing'), store });
    game.press('a');
    await settle();
    expect(lines(game.hud())).toMatchObject({ kind: 'refused', why: MIC_REASON.missing });
    expect(MIC_REASON.missing).toBe('NO MIC FOUND');
  });

  it('stops the microphone on leaving, on a pause from outside and on closing', async () => {
    const mic = fakeMic('on');
    const game = createPong({ mic, store });
    game.press('a');
    await settle();
    game.pause();
    expect(mic.stops).toBe(1);
    expect(game.hud().mic).toBe('off');
    game.press('a');
    await settle();
    expect(game.hud().mic).toBe('on');
    expect(game.press('b')).toEqual({ leave: true });
    expect(mic.stops).toBe(2);
    expect(mic.on).toBe(false);
    game.close();
    expect(mic.stops).toBe(3);
  });

  it('turns the meter off when the track ends by itself, and A asks again', async () => {
    const mic = fakeMic('on');
    const game = createPong({ mic, store });
    game.press('a');
    await settle();
    mic.end();
    expect(game.hud().mic).toBe('off');
    game.press('a');
    expect(mic.asked).toBe(2);
  });
});
