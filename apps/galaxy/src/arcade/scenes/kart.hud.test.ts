import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WIDE } from '../grid';
import { ScreenContext } from '../Screen';
import { KartOverlay } from './kart.tsx';
import type { KartHud } from './kart.ts';

// OMNI KART's HUD in game frames (PRD 1427, slice 5).

const html = (hud: KartHud) =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud })));
const run = (o: Partial<NonNullable<KartHud['run']>> = {}): KartHud => ({ phase: 'race', beat: null, run: { place: 2, lap: 1, laps: 3, tenths: 123, final: false, item: null, ...o } });
const css = readFileSync(new URL('./kart.css', import.meta.url), 'utf8');

describe('the HUD in game frames', () => {
  it('puts the place, the lap and the time each in a framed panel', () => {
    const panels = (html(run()).match(/<span class="kt-panelbox[^"]*"[^>]*>[^<]*<\/span>/g) ?? []).map((p) => p.replace(/<[^>]+>/g, ''));
    expect(panels).toEqual(['2ND', 'LAP 1/3', '0:12.3', '']);
  });

  it('shows the held item as its icon in a frame of its own, empty when none is held', () => {
    for (const item of ['boost', 'blob', 'orb'] as const) {
      const h = html(run({ item }));
      expect(h).toContain(`data-item="${item}"`);
      expect(h).toContain('kt-icon');
      expect(h).toContain(item.toUpperCase());
    }
    const empty = html(run());
    expect(empty).toContain('kt-empty');
    expect(empty).not.toContain('kt-icon');
  });

  it('shows the countdown large, keyed so each beat pops in again, and GO in its own class', () => {
    expect(html({ phase: 'countdown', beat: '3' })).toContain('class="kt-beat"');
    expect(html({ phase: 'countdown', beat: 'GO' })).toContain('kt-beat kt-go');
  });

  it('pops the countdown and flashes FINAL LAP, and does neither under reduced motion', () => {
    expect(css).toMatch(/\.kt-beat\s*\{[^}]*animation:\s*kt-pop/);
    expect(css).toMatch(/\.kt-final\s*\{[^}]*animation:\s*kt-flash/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.kt-beat[^{]*\{\s*animation:\s*none/);
    expect(reduced).toMatch(/\.kt-final[^{]*\{?[^}]*animation:\s*none/);
  });
});
