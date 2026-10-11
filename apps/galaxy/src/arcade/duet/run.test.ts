import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { RULES } from './rules';
import { BANNER_SECONDS, CHAPTERS, newRun, press, step, waveOf, wavesIn, type Run, type RunEvent } from './run';
import { route } from './waves';

// OMNI DUET's run (PRD 1633): the ready screen, START into play, B back to the room, and the orbs turned
// in fixed steps whatever the frame rate (slice 2); the waves, the hits, the chapters and the score
// (slice 3).

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
    expect(CHAPTERS[run.chapter]).toEqual({ numeral: 'I', name: 'DRIFT' });
    expect(CHAPTERS.map((c) => `${c.numeral} · ${c.name}`)).toEqual(['I · DRIFT', 'II · SLIDE', 'III · SPIN', 'IV · STORM']);
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
    for (const [i, c] of CHAPTERS.entries()) {
      expect(run.chapter, c.name).toBe(i);
      run = i < CHAPTERS.length - 1 ? clearChapter(run) : run;
    }
    while (waveOf(run)) run = pilot(run).run;
    expect(run.score).toBe(10 * run.passed);
    expect(run.passed).toBe(CHAPTERS.length * 10);
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
