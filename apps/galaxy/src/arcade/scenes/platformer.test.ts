import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { newSession, type Session } from '../platformer/session';
import type { ScreenStatus } from '../platformer/PlatformerScreen';
import { PlatformerOverlay } from './platformer.tsx';
import { TALL_SCENES } from './platformer.ts';

// Super Omni World's text layer (PRD 817): what shows over the game on each of its screens.

const text = (session: Session, status: ScreenStatus = 'ready', grid: Grid = WIDE, form: 'full' | 'handheld' = 'full') =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } },
    createElement(PlatformerOverlay, { session, status })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the platformer\'s text layer', () => {
  it('is laid out on the tall grid on the Game Boy held upright', () => {
    expect(TALL_SCENES).toEqual(['platformer']);
    expect(gridFor('handheld', 'platformer')).toBe(TALL);
    expect(gridFor('full', 'platformer')).toBe(WIDE);
  });

  it('shows the stage and the way to pause while playing', () => {
    expect(text(newSession())).toBe('WORLD 1-1 ENTER PAUSE');
    expect(text(newSession(), 'ready', TALL, 'handheld')).toBe('WORLD 1-1 START PAUSE');
  });

  it('shows the pause with the controls, the way to resume and the way back to the room', () => {
    const shown = text({ ...newSession(), phase: 'paused' });
    expect(shown).toContain('PAUSED');
    expect(shown).toContain('HOLD B TO RUN');
    expect(shown).toContain('ENTER RESUME');
    expect(shown).toContain('B GAME ROOM');
  });

  it('shows the stage clear when the hero reaches the flag', () => {
    expect(text({ ...newSession(), phase: 'clear' })).toBe('WORLD 1-1 STAGE CLEAR WORLD 1-1 A GAME ROOM');
  });

  it('shows only the way back while Phaser loads, and the retry when it did not load', () => {
    expect(text(newSession(), 'loading')).toBe('B GAME ROOM');
    expect(text(newSession(), 'failed')).toBe('A RETRY B GAME ROOM');
  });
});
