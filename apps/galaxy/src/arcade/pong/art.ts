// OMNI PONG as the arcade drives it (PRD 2101): the ready screen's game, its court drawn on the canvas.
// ◀ ▶ set the limit, kept in the browser; A asks for the microphone; once it is on, each step reads the
// pitch and what the steering makes of it, for the pitch meter. The microphone is stopped on a pause from
// outside and when the scene closes, and its track ending by itself turns it off.
import type { Action } from '../keys';
import type { FrameState } from '../scenes/common.ts';
import type { MicState, PongGame, PongHud } from '../scenes/pong.ts';
import type { PitchSource } from './mic';
import { limitHz, loadOptions, optionsPress, saveOptions, type OptionsStore, type PongOptions } from './options';
import { BAND_HZ } from './rules';
import { steerOf, type Steer } from './steer';

export interface PongSetup {
  mic: PitchSource;
  /** Where the limit is kept: the browser's storage unless a test hands its own. */
  store?: () => OptionsStore;
}

/** The court's paddles, as shares of the grid: their height, their width in pixels and their gap from the side. */
const PADDLE = { h: 0.18, w: 4, gap: 12 } as const;

export function createPong({ mic, store }: PongSetup): PongGame {
  let options: PongOptions = loadOptions(store);
  let micState: MicState = 'off';
  let hz: number | null = null;
  let steer: Steer = 'still';
  let asks = 0;

  const quiet = () => { hz = null; steer = 'still'; };
  const stopMic = () => {
    asks++;
    mic.stop();
    micState = 'off';
    quiet();
  };
  mic.onEnded(() => { if (micState === 'on') { micState = 'off'; quiet(); } });

  const ask = () => {
    const mine = ++asks;
    micState = 'asking';
    void mic.open().then((opened) => {
      if (mine !== asks) return;
      micState = opened === 'stopped' ? 'off' : opened;
    });
  };

  return {
    step() {
      if (micState !== 'on') return;
      const heard = mic.pitch();
      hz = heard === null ? null : Math.round(heard);
      steer = steerOf(heard, limitHz(options));
    },
    press(action: Action) {
      if (action === 'b') { stopMic(); return { leave: true }; }
      if (action === 'left' || action === 'right') {
        const next = optionsPress(options, action);
        if (next !== options) { options = next; saveOptions(options, store); }
        if (micState === 'on') steer = steerOf(hz, limitHz(options));
        return { leave: false };
      }
      if (action === 'a' && micState !== 'on' && micState !== 'asking') ask();
      return { leave: false };
    },
    pause() { if (micState !== 'off') stopMic(); },
    close: stopMic,
    hud(): PongHud {
      return { phase: 'ready', limit: options.limit, limitHz: limitHz(options), band: BAND_HZ, mic: micState, steer, hz };
    },
    draw(ctx: CanvasRenderingContext2D, s: FrameState) {
      const { w, h } = s.grid;
      ctx.fillStyle = s.theme.dim;
      for (let y = 4; y < h; y += 16) ctx.fillRect(Math.floor(w / 2) - 1, y, 2, 8);
      const ph = Math.round(h * PADDLE.h), top = Math.round((h - ph) / 2);
      ctx.fillStyle = s.theme.cyan;
      ctx.fillRect(PADDLE.gap, top, PADDLE.w, ph);
      ctx.fillStyle = s.theme.plasma;
      ctx.fillRect(w - PADDLE.gap - PADDLE.w, top, PADDLE.w, ph);
    },
  };
}
