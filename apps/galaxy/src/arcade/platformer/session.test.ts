import { describe, expect, it } from 'vitest';
import { hearEvent, newSession, pauseSession, pressSession, type Session } from './session';

// A game of Super Omni World as the arcade holds it around the Phaser scene (PRD 817): the presses
// the scene does not read (START, SELECT, B on a screen), the flag, and a pause from outside.

const play = newSession();
const paused: Session = { ...play, phase: 'paused' };
const clear: Session = { ...play, phase: 'clear' };

describe('a new game', () => {
  it('starts on 1-1, playing', () => {
    expect(play).toEqual({ stage: '1-1', phase: 'play' });
  });
});

describe('pressSession', () => {
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

  it('leaves for the room from the stage clear on A, B or START', () => {
    for (const a of ['a', 'b', 'start'] as const) expect(pressSession(clear, a, 'ready'), a).toEqual({ session: clear, leave: true });
    expect(pressSession(clear, 'left', 'ready')).toEqual({ session: clear });
  });

  it('retries the import on A when Phaser did not load, and goes back on B', () => {
    expect(pressSession(play, 'a', 'failed')).toEqual({ session: play, retry: true });
    expect(pressSession(play, 'b', 'failed')).toEqual({ session: play, leave: true });
    expect(pressSession(play, 'start', 'failed')).toEqual({ session: play });
  });

  it('lets B go back while Phaser is still on its way, and nothing else', () => {
    expect(pressSession(play, 'b', 'loading')).toEqual({ session: play, leave: true });
    expect(pressSession(play, 'start', 'loading')).toEqual({ session: play });
  });
});

describe('hearEvent', () => {
  it('shows the stage clear at the flag, once', () => {
    expect(hearEvent(play, 'flag')).toEqual(clear);
    expect(hearEvent(clear, 'flag')).toBe(clear);
  });

  it('keeps playing through a fall into a pit: the scene puts the hero back at the start', () => {
    expect(hearEvent(play, 'pit')).toBe(play);
  });
});

describe('pauseSession', () => {
  it('pauses a game in play, and leaves any other screen as it is', () => {
    expect(pauseSession(play)).toEqual(paused);
    expect(pauseSession(paused)).toBe(paused);
    expect(pauseSession(clear)).toBe(clear);
  });
});
