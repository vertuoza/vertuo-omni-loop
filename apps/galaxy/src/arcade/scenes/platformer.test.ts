import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { newSession, pressSession, type Session } from '../platformer/session';
import type { ScreenStatus } from '../platformer/PlatformerScreen';
import { PlatformerOverlay } from './platformer.tsx';
import { TALL_SCENES } from './platformer.ts';
import { sending, type ScoreSend } from './invaders-score';

// Super Omni World's text layer (PRD 817): what shows over the game on each of its screens.

const text = (session: Session, status: ScreenStatus = 'ready', grid: Grid = WIDE, form: 'full' | 'handheld' = 'full', send: ScoreSend | null = null) =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } },
    createElement(PlatformerOverlay, { session, status, send })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the platformer\'s text layer', () => {
  it('is laid out on the tall grid on the Game Boy held upright', () => {
    expect(TALL_SCENES).toEqual(['platformer']);
    expect(gridFor('handheld', 'platformer')).toBe(TALL);
    expect(gridFor('full', 'platformer')).toBe(WIDE);
  });

  const HUD = 'SCORE 00 000 COINS ×00 LIVES ×3 WORLD 1-1 TIME 300';
  const play: Session = { ...newSession(), phase: 'play' };

  it('shows the score, the coins, the lives, the stage and the time, and the way to pause while playing', () => {
    expect(text(play)).toBe(`${HUD} ENTER PAUSE`);
    expect(text(play, 'ready', TALL, 'handheld')).toBe(`${HUD} START PAUSE`);
    expect(text({ ...play, score: 1240, coins: 7, lives: 2, time: 87 })).toBe('SCORE 01 240 COINS ×07 LIVES ×2 WORLD 1-1 TIME 87 ENTER PAUSE');
  });

  it('opens on the ready screen, the stage and PRESS START, with the lives left', () => {
    expect(text(newSession())).toBe(`${HUD} 1-1 · PRESS START LIVES ×3 ENTER PLAY B GAME ROOM`);
    expect(text(newSession(), 'ready', TALL, 'handheld')).toContain('START PLAY B GAME ROOM');
  });

  it('shows the pause with the controls, the way to resume and the way back to the room', () => {
    const shown = text({ ...play, phase: 'paused' });
    expect(shown).toContain('PAUSED');
    expect(shown).toContain('HOLD B TO RUN');
    expect(shown).toContain('ENTER RESUME');
    expect(shown).toContain('B GAME ROOM');
  });

  it('leaves the game on SELECT from the pause screen', () => {
    const paused: Session = { ...play, phase: 'paused' };
    expect(pressSession(paused, 'select', 'ready')).toEqual({ session: paused, leave: true });
  });

  it('shows the stage clear with the score when the hero reaches the flag, and A going on to the next stage', () => {
    expect(text({ ...play, phase: 'clear', score: 3050 })).toBe('SCORE 03 050 COINS ×00 LIVES ×3 WORLD 1-1 TIME 300 STAGE CLEAR WORLD 1-1 · SCORE 03 050 A NEXT STAGE');
  });

  it('shows WORLD CLEAR after 1-3\'s flag, with the score and where sending it stands', () => {
    const world: Session = { ...play, stage: '1-3', phase: 'world', score: 12400 };
    expect(text(world, 'ready', WIDE, 'full', sending(12400))).toContain('WORLD CLEAR SCORE 12 400 SAVING SCORE… A GAME ROOM');
    expect(text(world, 'ready', WIDE, 'full', { state: 'saved', score: 12400, best: 12400, newBest: true })).toContain('NEW BEST A GAME ROOM');
    expect(text(world, 'ready', WIDE, 'full', { state: 'saved', score: 12400, best: 20000, newBest: false })).toContain('YOUR BEST 20 000 A GAME ROOM');
  });

  it('offers A to retry a score not saved, once, and B to go back', () => {
    const over: Session = { ...play, phase: 'over', lives: 0, score: 420 };
    expect(text(over, 'ready', WIDE, 'full', { state: 'failed', score: 420, tries: 1 })).toContain('SCORE NOT SAVED A RETRY B GAME ROOM');
    expect(text(over, 'ready', WIDE, 'full', { state: 'failed', score: 420, tries: 2 })).toContain('SCORE NOT SAVED A GAME ROOM');
  });

  it('shows the game over with the score once the last life is lost', () => {
    const shown = text({ ...play, phase: 'over', lives: 0, score: 420 });
    expect(shown).toContain('LIVES ×0');
    expect(shown).toContain('GAME OVER WORLD 1-1 · SCORE 00 420 A GAME ROOM');
    expect(text({ ...play, phase: 'over', lives: 0, score: 420 }, 'ready', WIDE, 'full', sending(420))).toContain('SCORE 00 420 SAVING SCORE… A GAME ROOM');
  });

  it('shows only the way back while Phaser loads, and the retry when it did not load', () => {
    expect(text(newSession(), 'loading')).toBe('B GAME ROOM');
    expect(text(newSession(), 'failed')).toBe('A RETRY B GAME ROOM');
  });
});
