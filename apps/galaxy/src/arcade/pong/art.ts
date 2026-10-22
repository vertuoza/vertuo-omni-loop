// PULSAR VOLLEY as the arcade drives it (PRD 2101): the ready screen and the match, its court drawn on the
// canvas. ◀ ▶ set the limit, kept in the browser; A asks for the microphone; once it is on, START plays
// the match, steered each frame by what the voice's pitch makes of it. START pauses and only START
// resumes; a pause stops the microphone and resuming asks for it again. A track that ends by itself
// pauses the match as MIC LOST. The move into `over` is told once, whichever way it came.
import type { Action } from '../keys';
import type { FrameState } from '../scenes/common.ts';
import type { MicState, PongGame, PongHud, PongPhase, PongPressed } from '../scenes/pong.ts';
import { end, newMatch, paddleX, step, type Match } from './match';
import type { PitchSource } from './mic';
import { limitHz, loadOptions, optionsPress, saveOptions, type OptionsStore, type PongOptions } from './options';
import { BAND_HZ, MATCH } from './rules';
import { steerOf, type Steer } from './steer';

export interface PongSetup {
  mic: PitchSource;
  /** Where the limit is kept: the browser's storage unless a test hands its own. */
  store?: () => OptionsStore;
  /** Each match's seed: a random one unless a test hands its own. */
  seed?: () => number;
}

const randomSeed = (): number => Math.floor(Math.random() * 2 ** 31);

/** The field's place on the grid: scaled to fit whole, centred. */
function courtOn(grid: { w: number; h: number }) {
  const k = Math.min(grid.w / MATCH.field.w, grid.h / MATCH.field.h);
  return { k, x: (grid.w - MATCH.field.w * k) / 2, y: (grid.h - MATCH.field.h * k) / 2 };
}

/** The steering sign in pixels: ▲ and ▼ as four rows widening toward their base, · as one square. */
function drawSign(ctx: CanvasRenderingContext2D, steer: Steer, x: number, y: number) {
  if (steer === 'still') { ctx.fillRect(x + 3, y - 1, 2, 2); return; }
  for (let row = 0; row < 4; row++) {
    const dy = steer === 'up' ? row : 3 - row;
    ctx.fillRect(x + 3 - row, y - 2 + dy, 2 * row + 2, 1);
  }
}

/** Where the match is drawn: the paddles' centres, the ball (none before a match or once it is over), and the steering sign (only in play). */
interface Court { player: number; ai: number; ball: { x: number; y: number } | null; sign: Steer | null }

/** The court on the whole grid: the centre line, the field's edges when the grid is wider, both paddles, the ball and the steering sign. */
function drawCourt(ctx: CanvasRenderingContext2D, s: FrameState, court: Court) {
  const { w, h } = s.grid;
  const c = courtOn(s.grid);
  const px = (v: number) => Math.round(c.x + v * c.k);
  const py = (v: number) => Math.round(c.y + v * c.k);
  const size = (v: number) => Math.max(1, Math.round(v * c.k));
  ctx.fillStyle = s.theme.dim;
  for (let y = 4; y < h; y += 16) ctx.fillRect(Math.floor(w / 2) - 1, y, 2, 8);
  if (c.x >= 2) { ctx.fillRect(Math.round(c.x) - 2, 0, 2, h); ctx.fillRect(Math.round(c.x + MATCH.field.w * c.k), 0, 2, h); }
  const pw = size(MATCH.paddle.w), ph = size(MATCH.paddle.h);
  const playerLeft = px(paddleX('player') - MATCH.paddle.w / 2);
  ctx.fillStyle = s.theme.cyan;
  ctx.fillRect(playerLeft, py(court.player - MATCH.paddle.h / 2), pw, ph);
  ctx.fillStyle = s.theme.plasma;
  ctx.fillRect(px(paddleX('ai') - MATCH.paddle.w / 2), py(court.ai - MATCH.paddle.h / 2), pw, ph);
  if (court.ball) {
    ctx.fillStyle = s.theme.white;
    ctx.fillRect(px(court.ball.x - MATCH.ball / 2), py(court.ball.y - MATCH.ball / 2), size(MATCH.ball), size(MATCH.ball));
  }
  if (court.sign) {
    ctx.fillStyle = s.theme.cyan;
    drawSign(ctx, court.sign, playerLeft + pw + 4, py(court.player));
  }
}

const IDLE_COURT: Court = { player: MATCH.field.h / 2, ai: MATCH.field.h / 2, ball: null, sign: null };

export function createPong({ mic, store, seed = randomSeed }: PongSetup): PongGame {
  let options: PongOptions = loadOptions(store);
  let micState: MicState = 'off';
  let hz: number | null = null;
  let steer: Steer = 'still';
  let asks = 0;
  let phase: PongPhase = 'ready';
  let match: Match | null = null;

  const quiet = () => { hz = null; steer = 'still'; };
  const stopMic = () => {
    asks++;
    mic.stop();
    micState = 'off';
    quiet();
  };
  mic.onEnded(() => {
    if (micState !== 'on') return;
    micState = 'off';
    quiet();
    if (phase === 'play') phase = 'lost';
  });

  /** Asks for the microphone; once it is on, a match waiting on it (paused, or MIC LOST) plays on. */
  const ask = () => {
    const mine = ++asks;
    micState = 'asking';
    void mic.open().then((opened) => {
      if (mine !== asks) return;
      micState = opened === 'stopped' ? 'off' : opened;
      if (micState === 'on' && (phase === 'paused' || phase === 'lost')) phase = 'play';
    });
  };
  const pause = () => { phase = 'paused'; stopMic(); };
  const quit = (): PongPressed => {
    if (!match) return { leave: false };
    const ended = end(match);
    match = ended.match;
    phase = 'over';
    return ended.events.includes('over') ? { leave: false, over: true } : { leave: false };
  };

  const stay = (): PongPressed => ({ leave: false });
  const setLimit = (action: 'left' | 'right'): PongPressed => {
    const next = optionsPress(options, action);
    if (next !== options) { options = next; saveOptions(options, store); }
    if (micState === 'on') steer = steerOf(hz, limitHz(options));
    return stay();
  };
  /** Asks for the microphone, unless it is on or already being asked for. */
  const askAgain = (): PongPressed => {
    if (micState !== 'on' && micState !== 'asking') ask();
    return stay();
  };
  const startMatch = (): PongPressed => {
    if (micState === 'on') { match = newMatch({ seed: seed() }); phase = 'play'; }
    return stay();
  };
  const hold = (): PongPressed => { pause(); return stay(); };
  const again = (): PongPressed => { phase = 'ready'; match = null; return { leave: false, again: true }; };
  const leave = (): PongPressed => { stopMic(); return { leave: true }; };
  /** What each press does in each phase; a press it does not name does nothing. */
  const presses: Record<PongPhase, Partial<Record<Action, () => PongPressed>>> = {
    ready: { left: () => setLimit('left'), right: () => setLimit('right'), a: askAgain, start: startMatch, b: leave },
    play: { start: hold },
    paused: { start: askAgain, select: quit },
    lost: { a: askAgain, select: quit },
    over: { a: again, b: leave },
  };

  /** The pitch heard now and what the steering makes of it, while the microphone is on. */
  const listen = () => {
    if (micState !== 'on') return;
    const heard = mic.pitch();
    hz = heard === null ? null : Math.round(heard);
    steer = steerOf(heard, limitHz(options));
  };
  const court = (): Court => {
    if (!match || phase === 'ready') return IDLE_COURT;
    return { player: match.player, ai: match.ai, ball: match.phase === 'over' ? null : match.ball, sign: phase === 'play' ? steer : null };
  };

  return {
    step(dt: number) {
      listen();
      if (phase !== 'play' || !match) return { over: false };
      const played = step(match, steer, dt);
      match = played.match;
      if (!played.events.includes('over')) return { over: false };
      phase = 'over';
      return { over: true };
    },
    press(action: Action) {
      return presses[phase][action]?.() ?? { leave: false };
    },
    pause() {
      if (phase === 'play') { pause(); return; }
      if (micState !== 'off') stopMic();
    },
    close: stopMic,
    hud(): PongHud {
      const meter = phase === 'ready';
      return {
        phase, limit: options.limit, limitHz: limitHz(options), band: BAND_HZ, mic: micState,
        steer: meter ? steer : 'still', hz: meter ? hz : null,
        score: match?.score ?? 0, lives: match?.lives ?? MATCH.lives,
      };
    },
    draw(ctx: CanvasRenderingContext2D, s: FrameState) { drawCourt(ctx, s, court()); },
  };
}
