import { describe, expect, it } from 'vitest';
import { newRun, STAGE_SECONDS } from './rules';
import { hearEvent, newSession, pauseSession, pressSession, type Session } from './session';

// A game of Super Omni World as the arcade holds it around the Phaser scene (PRD 817): the presses
// the scene does not read (START, SELECT, B on a screen), what the scene reports, and a pause from
// outside.

const ready = newSession();
const play: Session = { ...ready, phase: 'play' };
const paused: Session = { ...play, phase: 'paused' };
const clear: Session = { ...play, phase: 'clear' };
const over: Session = { ...play, lives: 0, phase: 'over' };

describe('a new game', () => {
  it('starts on 1-1\'s ready screen, with a new run', () => {
    expect(ready).toEqual({ ...newRun(), phase: 'ready' });
  });
});

describe('pressSession', () => {
  it('starts play on START from the ready screen, goes back on B, and waits for anything else', () => {
    expect(pressSession(ready, 'start', 'ready')).toEqual({ session: play });
    expect(pressSession(ready, 'b', 'ready')).toEqual({ session: ready, leave: true });
    for (const a of ['a', 'left', 'right', 'select'] as const) expect(pressSession(ready, a, 'ready'), a).toEqual({ session: ready });
  });

  it('leaves A, B and the arrows to the scene while playing, and pauses on START', () => {
    for (const a of ['a', 'b', 'left', 'right', 'up', 'down', 'select'] as const) expect(pressSession(play, a, 'ready'), a).toEqual({ session: play });
    expect(pressSession(play, 'start', 'ready')).toEqual({ session: paused });
  });

  it('resumes on START from the pause, and leaves for the room on SELECT or B', () => {
    expect(pressSession(paused, 'start', 'ready')).toEqual({ session: play });
    expect(pressSession(paused, 'select', 'ready')).toEqual({ session: paused, leave: true });
    expect(pressSession(paused, 'b', 'ready')).toEqual({ session: paused, leave: true });
    expect(pressSession(paused, 'a', 'ready')).toEqual({ session: paused });
  });

  it('leaves for the room from the stage clear and the game over on A, B or START', () => {
    for (const s of [clear, over]) {
      for (const a of ['a', 'b', 'start'] as const) expect(pressSession(s, a, 'ready'), `${s.phase} ${a}`).toEqual({ session: s, leave: true });
      expect(pressSession(s, 'left', 'ready')).toEqual({ session: s });
    }
  });

  it('retries the import on A when Phaser did not load, and goes back on B', () => {
    expect(pressSession(ready, 'a', 'failed')).toEqual({ session: ready, retry: true });
    expect(pressSession(ready, 'b', 'failed')).toEqual({ session: ready, leave: true });
    expect(pressSession(ready, 'start', 'failed')).toEqual({ session: ready });
  });

  it('lets B go back while Phaser is still on its way, and nothing else', () => {
    expect(pressSession(ready, 'b', 'loading')).toEqual({ session: ready, leave: true });
    expect(pressSession(ready, 'start', 'loading')).toEqual({ session: ready });
  });
});

describe('hearEvent', () => {
  it('scores a coin and a stomp while playing', () => {
    expect(hearEvent(play, 'coin')).toEqual({ ...play, score: 10, coins: 1 });
    expect(hearEvent(play, 'stomp')).toEqual({ ...play, score: 50 });
  });

  it('counts the clock down a second at a time', () => {
    expect(hearEvent(play, 'second')).toEqual({ ...play, time: STAGE_SECONDS - 1 });
  });

  it('shows the stage clear at the flag, once, with the time bonus', () => {
    expect(hearEvent(play, 'flag')).toEqual({ ...clear, score: 10 * STAGE_SECONDS });
    expect(hearEvent(clear, 'flag')).toBe(clear);
  });

  it.each(['hurt', 'pit'] as const)('after a %s, puts the stage back on its ready screen, a life fewer and the score kept', (e) => {
    const scored = { ...play, score: 90, coins: 2, time: 12 };
    expect(hearEvent(scored, e)).toEqual({ ...scored, lives: 2, time: STAGE_SECONDS, phase: 'ready' });
  });

  it('puts the stage back on its ready screen when the clock runs out', () => {
    expect(hearEvent({ ...play, time: 1 }, 'second')).toEqual({ ...play, lives: 2, time: STAGE_SECONDS, phase: 'ready' });
  });

  it('shows the game over when the last life is lost', () => {
    expect(hearEvent({ ...play, lives: 1, score: 340 }, 'pit')).toEqual({ ...play, lives: 0, score: 340, phase: 'over' });
  });

  it('hears nothing off play: a late event on a screen changes nothing', () => {
    for (const s of [ready, paused, clear, over]) {
      for (const e of ['coin', 'stomp', 'hurt', 'pit', 'flag', 'second'] as const) expect(hearEvent(s, e), `${s.phase} ${e}`).toBe(s);
    }
  });
});

describe('pauseSession', () => {
  it('pauses a game in play, and leaves any other screen as it is', () => {
    expect(pauseSession(play)).toEqual(paused);
    for (const s of [ready, paused, clear, over]) expect(pauseSession(s)).toBe(s);
  });
});
