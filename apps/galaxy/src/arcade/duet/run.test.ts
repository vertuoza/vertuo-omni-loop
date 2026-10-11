import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { RULES } from './rules';
import { BANNER_SECONDS, CHAPTER_TITLES, ENDLESS_POINTS, newRun, pause, press, step, WAVE_POINTS, waveOf, wavesIn, type Run, type RunEvent } from './run';
import { blocksAt, ring, route, struck } from './waves';

// OMNI DUET's run (PRD 1633): the ready screen, START into play, B back to the room, and the orbs turned
// in fixed steps whatever the frame rate (slice 2); the waves, the hits, the chapters and the score
// (slice 3); endless mode, the pause and every way a run ends (slice 4).

const held = (...actions: Action[]): ReadonlySet<Action> => new Set(actions);
const playing = (): Run => press(newRun({ seed: 7 }), 'start').run;

/** `frames` frames of `dt` seconds each, with `buttons` held throughout. */
function stepped(run: Run, buttons: ReadonlySet<Action>, dt: number, frames: number): Run {
  let r = run;
  for (let i = 0; i < frames; i++) r = step(r, buttons, dt).run;
  return r;
}

describe('a new run', () => {
  it('waits on the ready screen of chapter I · DRIFT, with three lives and no score', () => {
    const run = newRun({ seed: 7 });
    expect(run).toMatchObject({ phase: 'ready', chapter: 0, lives: 3, score: 0, seed: 7, angle: 0, carry: 0 });
    expect(CHAPTER_TITLES[run.chapter]).toEqual({ numeral: 'I', name: 'DRIFT' });
    expect(CHAPTER_TITLES.map((c) => `${c.numeral} · ${c.name}`)).toEqual(['I · DRIFT', 'II · SLIDE', 'III · SPIN', 'IV · STORM']);
  });

  it('does not turn the orbs before START: nothing moves on the ready screen', () => {
    const run = newRun({ seed: 7 });
    const { run: after, events } = step(run, held('left'), 0.05);
    expect(after).toBe(run);
    expect(events).toEqual([]);
  });
});

describe('the presses', () => {
  it('starts play on START, and only on START', () => {
    const run = newRun({ seed: 7 });
    for (const action of ['a', 'left', 'right', 'up', 'down', 'select'] as const) {
      const pressed = press(run, action);
      expect(pressed.run, action).toBe(run);
      expect(pressed.events, action).toEqual([]);
    }
    const { run: next, events } = press(run, 'start');
    expect(next.phase).toBe('play');
    expect(events).toEqual(['start']);
  });

  it('leaves for the room on B from the first ready screen, with no score', () => {
    const { run, events } = press(newRun({ seed: 7 }), 'b');
    expect(events).toEqual(['leave']);
    expect(run.score).toBe(0);
  });
});

describe('the turn in play', () => {
  it('turns the pair anticlockwise under ◀ and clockwise under ▶, at 1.75 turns a second', () => {
    const left = stepped(playing(), held('left'), 1 / 60, 30);
    expect(left.angle).toBeCloseTo(Math.PI * 2 * 1.75 * 0.5, 9);
    const right = stepped(playing(), held('right'), 1 / 60, 30);
    expect(right.angle).toBeCloseTo(-Math.PI * 2 * 1.75 * 0.5, 9);
    expect(stepped(playing(), held('left', 'right'), 1 / 60, 30).angle).toBe(0);
    expect(stepped(playing(), held(), 1 / 60, 30).angle).toBe(0);
  });

  it('plays fixed 1/60 s steps and carries the remainder to the next call', () => {
    const half = step(playing(), held('left'), RULES.subStep / 2).run;
    expect(half.angle).toBe(0);
    expect(half.carry).toBeCloseTo(RULES.subStep / 2, 12);
    const whole = step(half, held('left'), RULES.subStep / 2).run;
    expect(whole.angle).toBeCloseTo(Math.PI * 2 * 1.75 * RULES.subStep, 12);
    expect(whole.carry).toBeCloseTo(0, 12);
  });

  it('caps a long frame at 50 ms: a stalled tab never plays a second at once', () => {
    const slow = step(playing(), held('left'), 1).run;
    const capped = step(playing(), held('left'), RULES.maxDt).run;
    expect(slow.angle).toBe(capped.angle);
    expect(slow.angle).toBeCloseTo(Math.PI * 2 * 1.75 * 3 * RULES.subStep, 12);
  });

  it('gives the same angle stepped at 1/60 s and at 1/120 s, for the same inputs', () => {
    const script: [Action[], number][] = [[['left'], 0.5], [[], 0.25], [['right'], 0.75], [['left', 'right'], 0.25], [['left'], 1]];
    const play = (dt: number) => script.reduce((r, [buttons, seconds]) => stepped(r, held(...buttons), dt, Math.round(seconds / dt)), playing());
    const at60 = play(1 / 60), at120 = play(1 / 120);
    expect(at120.angle).toBe(at60.angle);
    expect(at60.angle).not.toBe(0);
  });

  it('keeps a short trail of where the warm orb was, newest first', () => {
    const run = stepped(playing(), held('left'), 1 / 60, 20);
    expect(run.trail).toHaveLength(RULES.trail);
    expect(run.trail[0]).toBeLessThan(run.angle);
    for (let i = 1; i < run.trail.length; i++) expect(run.trail[i]).toBeLessThan(run.trail[i - 1] ?? Infinity);
  });
});

// Slice 3: the chapters, the hits and the score.

const turnHeld = (dir: -1 | 0 | 1): ReadonlySet<Action> => (dir === 1 ? held('left') : dir === -1 ? held('right') : held());

/** Plays the run's wave one sub-step a frame along a way through it, from where the orbs stand. */
function pilot(run: Run, dt = RULES.subStep): { run: Run; events: RunEvent[] } {
  const wave = waveOf(run);
  if (!wave) throw new Error('no wave falls');
  const turns = route(wave, run.angle);
  if (!turns) throw new Error(`no way through chapter ${run.chapter + 1}, wave ${run.wave + 1}`);
  const frames = Math.round(RULES.subStep / dt);
  let r = run;
  const events: RunEvent[] = [];
  for (const dir of turns) for (let f = 0; f < frames; f++) { const s = step(r, turnHeld(dir), dt); r = s.run; events.push(...s.events); }
  return { run: r, events };
}

/** Holds the orbs still until something happens: a pass, a hit, or nothing in a minute. */
function holdStill(run: Run): { run: Run; events: RunEvent[] } {
  let r = run;
  for (let i = 0; i < 3600; i++) {
    const s = step(r, held(), RULES.subStep);
    r = s.run;
    if (s.events.length) return { run: r, events: [...s.events] };
  }
  return { run: r, events: [] };
}

/** Plays the whole of the run's chapter, then waits out the next chapter's banner. */
function clearChapter(run: Run): Run {
  let r = run;
  const chapter = r.chapter;
  while (r.chapter === chapter && r.phase === 'play') r = pilot(r).run;
  while (r.phase === 'chapter') r = step(r, held(), RULES.subStep).run;
  return r;
}

describe('the waves in play', () => {
  it('lets chapter I\'s first wave pass orbs held still, and adds 10 once it is below the circle', () => {
    const { run, events } = holdStill(playing());
    expect(events).toEqual(['pass']);
    expect(run).toMatchObject({ phase: 'play', chapter: 0, wave: 1, tick: 0, score: 10, passed: 1, lives: 3 });
    expect(wavesIn(run)).toBe(10);
  });

  it('counts each wave once: the next steps of the next wave add nothing', () => {
    const once = holdStill(playing()).run;
    const after = step(step(once, held(), RULES.subStep).run, held(), RULES.subStep);
    expect(after.run.score).toBe(10);
    expect(after.events).toEqual([]);
  });

  it('lets the blocks fall at the wave\'s speed, one sub-step at a time', () => {
    const run = stepped(playing(), held(), RULES.subStep, 30);
    expect(run.tick).toBe(30);
  });
});

describe('a hit', () => {
  it('costs a life, restarts the chapter from its first wave, and shows the ready screen', () => {
    const passedOne = holdStill(playing()).run; // wave 2 is a block on the left, where the warm orb stands still
    const { run, events } = holdStill(passedOne);
    expect(events).toEqual(['hit']);
    expect(run).toMatchObject({ phase: 'ready', chapter: 0, wave: 0, tick: 0, lives: 2, score: 0, passed: 1, carry: 0 });
  });

  it('moves nothing until START: no wave falls and the orbs do not turn on the ready screen', () => {
    const { run } = holdStill(holdStill(playing()).run);
    const waited = step(run, held('left'), RULES.maxDt);
    expect(waited.run).toBe(run);
    const started = press(run, 'start');
    expect(started.events).toEqual(['start']);
    expect(started.run.phase).toBe('play');
  });

  it('sets the score back to what it was when the chapter began, never to zero', () => {
    let run = clearChapter(playing());
    expect(run).toMatchObject({ phase: 'play', chapter: 1, wave: 0, score: 100, chapterScore: 100 });
    run = pilot(run).run;
    run = pilot(run).run;
    expect(run.score).toBe(120);
    let hit: { run: Run; events: RunEvent[] } = { run, events: [] };
    while (!hit.events.includes('hit')) hit = holdStill(hit.run.phase === 'ready' ? press(hit.run, 'start').run : hit.run);
    expect(hit.run).toMatchObject({ phase: 'ready', chapter: 1, wave: 0, score: 100, lives: 2 });
  });

  it('ends the run once the last life is lost: nothing moves, A plays again from chapter I, B leaves', () => {
    let run = playing();
    let events: RunEvent[] = [];
    while (!events.includes('over')) {
      const s = holdStill(run.phase === 'ready' ? press(run, 'start').run : run);
      run = s.run;
      events = s.events;
    }
    expect(events).toEqual(['hit', 'over']);
    expect(run).toMatchObject({ phase: 'over', lives: 0, score: 0 });
    expect(step(run, held('left'), RULES.maxDt).run).toBe(run);
    expect(press(run, 'start').events).toEqual([]);
    expect(press(run, 'b').events).toEqual(['leave']);
    const again = press(run, 'a');
    expect(again.events).toEqual(['again']);
    expect(again.run).toEqual(newRun({ seed: run.seed }));
  });
});

describe('the chapters, one after another', () => {
  it('shows the next chapter\'s banner for 2 seconds after a chapter\'s last wave, and nothing falls meanwhile', () => {
    let run = playing();
    const events: RunEvent[] = [];
    while (run.chapter === 0) { const s = pilot(run); run = s.run; events.push(...s.events); }
    expect(events.filter((e) => e === 'pass')).toHaveLength(10);
    expect(events.at(-1)).toBe('chapter');
    expect(run).toMatchObject({ phase: 'chapter', chapter: 1, wave: 0, tick: 0, score: 100 });
    const banner = Math.round(BANNER_SECONDS / RULES.subStep);
    const before = stepped(run, held('left'), RULES.subStep, banner - 1);
    expect(before).toMatchObject({ phase: 'chapter', tick: 0, wave: 0 });
    expect(before.angle).not.toBe(run.angle); // the orbs still turn under the banner
    const after = step(before, held(), RULES.subStep).run;
    expect(after).toMatchObject({ phase: 'play', tick: 0 });
    expect(step(after, held(), RULES.subStep).run.tick).toBe(1);
  });

  it('plays chapters I to IV in turn, scoring 10 a wave', () => {
    let run = playing();
    for (const [i, c] of CHAPTER_TITLES.entries()) {
      expect(run.chapter, c.name).toBe(i);
      run = i < CHAPTER_TITLES.length - 1 ? clearChapter(run) : run;
    }
    while (!run.endless) run = pilot(run).run;
    expect(run.score).toBe(10 * run.passed);
    expect(run.passed).toBe(CHAPTER_TITLES.length * 10);
    expect(run.lives).toBe(3);
  });
});

describe('the same run at any frame rate', () => {
  it('gives the same run, waves and score stepped at 1/60 s and at 1/120 s', () => {
    const play = (dt: number) => {
      let run = playing();
      for (let i = 0; i < 12; i++) run = run.phase === 'chapter' ? stepped(run, held(), dt, Math.round(BANNER_SECONDS / dt)) : pilot(run, dt).run;
      return run;
    };
    const at60 = play(1 / 60), at120 = play(1 / 120);
    expect(at120).toEqual(at60);
    expect(at60.score).toBeGreaterThan(100);
  });
});

// Slice 4: endless mode, the pause, and every way a run ends.

/** Waits out a banner, holding nothing. */
function pastBanner(run: Run): Run {
  let r = run;
  while (r.phase === 'chapter') r = step(r, held(), RULES.subStep).run;
  return r;
}

/**
 * The clean run, flown through every wave without a hit: the run as each wave begins to fall, the
 * forty chapter waves then the first `endless` endless ones. Computed once: runs are values.
 */
let flown: Run[] | null = null;
const ENDLESS_FLOWN = 50;
function cleanRun(): Run[] {
  if (flown) return flown;
  const starts: Run[] = [];
  let run = playing();
  while (starts.length < CHAPTER_TITLES.length * 10 + ENDLESS_FLOWN) {
    run = pastBanner(run);
    starts.push(run);
    run = pilot(run).run;
  }
  starts.push(pastBanner(run));
  flown = starts;
  return starts;
}

const atEndless = (): Run => cleanRun()[CHAPTER_TITLES.length * 10] ?? playing();

/**
 * Turns the orbs into the wave now falling: the first bin a block covers that they can reach in time,
 * with a bin either side covered too, so the hit lands whatever the float error. Then holds still.
 */
function crash(run: Run): { run: Run; events: RunEvent[] } {
  const wave = waveOf(run);
  if (!wave) throw new Error('no wave falls');
  const { bins, move } = ring();
  const start = ((Math.round((run.angle / (Math.PI * 2)) * bins) % bins) + bins) % bins;
  const covered = (b: number, tick: number) => struck((((b % bins) + bins) % bins / bins) * Math.PI * 2, blocksAt(wave, tick));
  const hidden = (b: number, tick: number) => covered(b, tick) && covered(b - 1, tick) && covered(b + 1, tick);
  for (let tick = 1; tick < 3600; tick++) {
    for (let k = -tick; k <= tick; k++) {
      if (hidden(start + k * move, tick)) return flyInto(run, tick, k);
    }
  }
  throw new Error('no block to crash into');
}

/** Turns the orbs `k` moves (anticlockwise when positive) then holds still, until a hit or `tick` + 60 sub-steps. */
function flyInto(run: Run, tick: number, k: number): { run: Run; events: RunEvent[] } {
  let r = run;
  const events: RunEvent[] = [];
  for (let i = 0; i < tick + 60 && !events.includes('hit'); i++) {
    const s = step(r, turnHeld(i < Math.abs(k) ? (Math.sign(k) as -1 | 1) : 0), RULES.subStep);
    r = s.run;
    events.push(...s.events);
  }
  if (!events.includes('hit')) throw new Error(`the crash at chapter ${run.chapter + 1}, wave ${run.wave + 1} missed`);
  return { run: r, events };
}

describe('endless mode', () => {
  it('follows chapter IV\'s last wave: the ENDLESS · ×2 banner, then its first wave', () => {
    const before = cleanRun()[CHAPTER_TITLES.length * 10 - 1];
    if (!before) throw new Error('no last wave');
    const { run, events } = pilot(before);
    expect(events.slice(-2)).toEqual(['pass', 'endless']);
    expect(run).toMatchObject({ phase: 'chapter', endless: true, wave: 0, tick: 0, score: 400, passed: 40 });
    const after = pastBanner(run);
    expect(after).toMatchObject({ phase: 'play', endless: true, wave: 0 });
    expect(waveOf(after)).toBeDefined();
  });

  it('adds 20 for each endless wave passed, once', () => {
    expect(ENDLESS_POINTS).toBe(20);
    expect(WAVE_POINTS).toBe(10);
    const start = atEndless();
    const { run, events } = pilot(start);
    expect(events).toEqual(['pass']);
    expect(run).toMatchObject({ endless: true, wave: 1, score: start.score + 20, passed: start.passed + 1 });
    const ten = cleanRun()[CHAPTER_TITLES.length * 10 + 10];
    expect(ten?.score).toBe(400 + 10 * 20);
  });

  it('never runs out of waves', () => {
    const last = cleanRun().at(-1);
    expect(last).toMatchObject({ endless: true, wave: ENDLESS_FLOWN, phase: 'play' });
    expect(last && waveOf(last)).toBeDefined();
  });

  it('costs a life on a hit, begins the wave hit again with the score it began with, and waits on the ready screen', () => {
    const start = cleanRun()[CHAPTER_TITLES.length * 10 + 3];
    if (!start) throw new Error('no fourth endless wave');
    const { run, events } = crash(start);
    expect(events).toEqual(['hit']);
    expect(run).toMatchObject({ phase: 'ready', endless: true, wave: 3, tick: 0, lives: 2, score: start.score });
    expect(step(run, held('left'), RULES.maxDt).run).toBe(run);
    const again = press(run, 'start');
    expect(again.run).toMatchObject({ phase: 'play', endless: true, wave: 3 });
  });

  it('plays the same at 60 and at 120 frames a second', () => {
    const play = (dt: number) => {
      let run = atEndless();
      for (let i = 0; i < 4; i++) run = pilot(run, dt).run;
      return run;
    };
    expect(play(1 / 120)).toEqual(play(1 / 60));
  });
});

describe('the pause', () => {
  it('pauses on START in play: nothing moves, and only START resumes', () => {
    const run = stepped(playing(), held(), RULES.subStep, 20);
    const { run: paused, events } = press(run, 'start');
    expect(events).toEqual(['pause']);
    expect(paused.phase).toBe('paused');
    expect(step(paused, held('left'), RULES.maxDt).run).toBe(paused);
    for (const action of ['a', 'b', 'left', 'right', 'up', 'down'] as const) expect(press(paused, action).run, action).toBe(paused);
    const resumed = press(paused, 'start');
    expect(resumed.events).toEqual(['resume']);
    expect(resumed.run).toMatchObject({ phase: 'play', tick: 20 });
  });

  it('pauses from outside (a blurred window, a hidden tab, the scene left), and only START resumes', () => {
    const run = stepped(playing(), held(), RULES.subStep, 20);
    const { run: paused, events } = pause(run);
    expect(events).toEqual(['pause']);
    expect(paused.phase).toBe('paused');
    expect(pause(paused).run).toBe(paused);
    expect(press(paused, 'start').run.phase).toBe('play');
  });

  it('pauses a chapter\'s banner, and resumes it where it was', () => {
    const banner = cleanRun()[9] && pilot(cleanRun()[9] as Run).run;
    if (!banner) throw new Error('no banner');
    expect(banner.phase).toBe('chapter');
    const paused = pause(stepped(banner, held(), RULES.subStep, 10)).run;
    expect(paused.phase).toBe('paused');
    const resumed = press(paused, 'start').run;
    expect(resumed).toMatchObject({ phase: 'chapter', banner: banner.banner - 10 });
  });

  it('leaves a ready screen and a game over as they are: there is nothing to pause', () => {
    const ready = newRun({ seed: 7 });
    expect(pause(ready)).toEqual({ run: ready, events: [] });
  });
});

describe('every way a run ends', () => {
  const overOnce = (events: readonly RunEvent[]) => events.filter((e) => e === 'over').length;

  it('ends on SELECT on the pause screen, with the score reached', () => {
    const run = pilot(pilot(playing()).run).run;
    const paused = press(run, 'start').run;
    const { run: over, events } = press(paused, 'select');
    expect(events).toEqual(['over']);
    expect(over).toMatchObject({ phase: 'over', score: 20, passed: 2, lives: 3 });
  });

  it('does nothing on SELECT in play: only the pause screen quits', () => {
    const run = playing();
    expect(press(run, 'select').run).toBe(run);
  });

  it('ends on B on a ready screen once play has started, with the score reached', () => {
    const start = cleanRun()[12];
    if (!start) throw new Error('no wave 3 of chapter II');
    const { run: hit } = crash(start);
    expect(hit.phase).toBe('ready');
    const { run: over, events } = press(hit, 'b');
    expect(events).toEqual(['over']);
    expect(over).toMatchObject({ phase: 'over', score: 100, lives: 2 });
  });

  it('leaves with no score on B on the first ready screen', () => {
    const { run, events } = press(newRun({ seed: 7 }), 'b');
    expect(events).toEqual(['leave']);
    expect(run.phase).toBe('ready');
  });

  it('ends at the last life lost', () => {
    let run = playing();
    const events: RunEvent[] = [];
    while (run.phase !== 'over') {
      const s = crash(run.phase === 'ready' ? press(run, 'start').run : run);
      run = s.run;
      events.push(...s.events);
    }
    expect(overOnce(events)).toBe(1);
    expect(run).toMatchObject({ phase: 'over', lives: 0 });
  });

  it('says over once, whichever route led there, and never again once over', () => {
    const paused = press(pilot(playing()).run, 'start').run;
    const { run: over, events } = press(paused, 'select');
    expect(overOnce(events)).toBe(1);
    for (const action of ['start', 'select', 'b', 'left', 'right', 'up', 'down'] as const) expect(overOnce(press(over, action).events), action).toBe(0);
    expect(step(over, held('left'), RULES.maxDt).events).toEqual([]);
    expect(pause(over).events).toEqual([]);
  });

  it('plays again on A from chapter I, with three lives and no score, and B on its first ready screen leaves', () => {
    const over = press(press(pilot(playing()).run, 'start').run, 'select').run;
    const { run, events } = press(over, 'a');
    expect(events).toEqual(['again']);
    expect(run).toMatchObject({ phase: 'ready', chapter: 0, wave: 0, lives: 3, score: 0, endless: false });
    expect(press(run, 'b').events).toEqual(['leave']);
  });
});

describe('no death earns a point', () => {
  // For every wave of the four chapters and the first 50 endless waves: a run hit at that wave, then
  // flown on with the same inputs, never holds a higher score than the clean run at the same point.
  const POINTS = CHAPTER_TITLES.length * 10 + ENDLESS_FLOWN;
  it.each(Array.from({ length: POINTS }, (_, i) => i))('at wave %i of the run', (i) => {
    const clean = cleanRun();
    const start = clean[i], next = clean[i + 1];
    if (!start || !next) throw new Error(`no wave ${i}`);
    const { run: hit } = crash(start);
    expect(hit.score).toBeLessThanOrEqual(start.score);
    // Fly on from the ready screen until the run stands where the clean one did after that wave. A
    // way through found on the check's ring may graze a block at the run's own angle: one more hit,
    // which only ever takes points away too, so the run starts again and flies on.
    const there = (r: Run) => r.endless === next.endless && r.chapter === next.chapter && r.wave === next.wave && r.phase === 'play';
    let run = hit;
    for (let guard = 0; guard < 40 && run.phase !== 'over' && !there(run); guard++) {
      expect(run.score).toBeLessThanOrEqual(next.score);
      run = run.phase === 'ready' ? press(run, 'start').run : pastBanner(pilot(run).run);
    }
    expect(run.phase === 'over' || there(run)).toBe(true);
    expect(run.score).toBeLessThanOrEqual(next.score);
  });
});
