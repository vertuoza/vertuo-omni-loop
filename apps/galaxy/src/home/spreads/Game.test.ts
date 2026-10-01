import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { demoFleets } from '../../data/load-galaxy';
import { Game } from './Game';
import { heading, html, text } from './render';

// The demo world's fleets are read on the server: the test reads them the same way.
vi.mock('server-only', () => ({}));

describe('the game', () => {
  const markup = html(Game({ fleets: demoFleets() }));

  it('opens on its own h2, then a line that names Entropy', () => {
    expect(heading(markup)).toBe('The game: Entropy you can see');
    const line = /<p class="home-lead">([\s\S]*?)<\/p>/.exec(markup)?.[1] ?? '';
    expect(text(line)).toBe('Every feature is a planet your teams terraform together. Unanswered questions, stuck work and shipped bugs are Entropy: they cost the owning fleet points until someone closes them.');
  });

  it('deals one flipping card per demo fleet that is not retired, each a button', () => {
    const cards = [...markup.matchAll(/<button [^>]*class="home-card"[^>]*>[\s\S]*?<\/button>/g)].map(([b]) => b);
    const live = demoFleets().filter((f) => !f.retired);
    expect(cards).toHaveLength(live.length);
    live.forEach((f, i) => {
      expect(text(cards[i]!)).toContain(f.label);
      expect(text(cards[i]!)).toContain(f.motto);
      expect(cards[i]).toMatch(/type="button"/);
      expect(cards[i]).toMatch(/aria-pressed="false"/);
      expect(cards[i]).toContain('data-flip=""');
      expect(cards[i]).toContain(`--fleet:${f.color}`);
    });
    for (const f of demoFleets().filter((d) => d.retired)) expect(text(markup)).not.toContain(f.label);
    for (const name of ['BEAVER', 'OCTOPOD', 'PICSOU', 'C.I.A.', 'PIRATES', 'INVINCIBLE']) expect(text(markup)).not.toContain(name);
  });

  it('flips under reduced motion with a crossfade, never a turn', () => {
    const css = readFileSync(new URL('./Game.css', import.meta.url), 'utf8');
    const still = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map(([, b]) => b).join('\n');
    expect(still).toMatch(/\.home-card-in[^{]*\{[^}]*transform: none/);
    expect(still).toMatch(/opacity/);
  });
});
