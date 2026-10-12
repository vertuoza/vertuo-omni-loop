import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { DuetOverlay } from './duet.tsx';
import { sameDuetHud, type DuetHud, type DuetStatus } from './duet.ts';

// The line a wave begins with (issue 1692), kept apart from duet.test.ts, which proves BR-PRODUCT-101.

const PLAYING: DuetHud = {
  phase: 'play', chapter: { numeral: 'I', name: 'DRIFT' }, endless: false, wave: 1, waves: 10, lives: 3, score: 0, passed: 0, started: false,
};

const text = (status: DuetStatus, grid: Grid, form: 'full' | 'handheld', hud: DuetHud) =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(DuetOverlay, { status, hud, send: null })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the line a wave begins with', () => {
  it('shows the wave\'s line in the middle of the playfield as it begins, over the HUD, and tells a text layer with a line apart', () => {
    const withLine: DuetHud = { ...PLAYING, line: 'Two lights, one turn.' };
    expect(text('ready', WIDE, 'full', withLine)).toBe('SCORE 0 WAVE CH I · 1/10 LIVES ×3 Two lights, one turn.');
    expect(text('ready', TALL, 'handheld', withLine)).toBe('SCORE 0 WAVE CH I · 1/10 LIVES ×3 Two lights, one turn.');
    expect(sameDuetHud(withLine, PLAYING)).toBe(false);
  });
});
