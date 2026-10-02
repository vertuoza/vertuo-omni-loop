import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.ts';
import { sure } from '../../arcade/sure';
import { EXAMPLE_FLEETS } from './fleets';
import { Game } from './Game';
import { heading, html, text } from './render';

// The game: build your fleet (PRD 971, s4): HOME's own example fleets in three beats, and the loop's
// real counts folded in as its proof.
describe('the game', () => {
  // As the build would count them: two counters read, one out of reach.
  const markup = html(Game({ scores: { prdsShipped: 21, slicesMerged: 134, decisionsAdopted: '—' } }));
  const beats = markup.split('<li class="home-game-beat">').slice(1);

  it('opens on its own h2, then the lead', () => {
    expect(heading(markup)).toBe('The game: build your fleet');
    const line = /<p class="home-lead">([\s\S]*?)<\/p>/.exec(markup)?.[1] ?? '';
    expect(text(line)).toBe('Ship value to your customers, and score for your fleet while you do.');
  });

  it('walks three numbered beats: create your fleet, ship value, climb the leaderboard', () => {
    const heads = [...markup.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map(([, h]) => text(sure(h, 'a heading')));
    expect(heads).toEqual(['CREATE YOUR FLEET', 'SHIP VALUE', 'CLIMB THE LEADERBOARD']);
    expect(markup).toContain('<ol class="home-game-beats">');
    expect(beats).toHaveLength(3);
  });

  it('deals one flipping card per example fleet, each a button with its mascot drawn', () => {
    const cards = [...markup.matchAll(/<button [^>]*class="home-card"[^>]*>[\s\S]*?<\/button>/g)].map(([b]) => b);
    expect(cards).toHaveLength(EXAMPLE_FLEETS.length);
    EXAMPLE_FLEETS.forEach((f, i) => {
      const card = sure(cards[i], `the card of ${f.label}`);
      expect(text(card)).toContain(f.label);
      expect(text(card)).toContain(f.motto);
      expect(card).toMatch(/type="button"/);
      expect(card).toMatch(/aria-pressed="false"/);
      expect(card).toContain('data-flip=""');
      expect(card).toContain(`--fleet:${f.color}`);
      expect(card).toMatch(/<span class="home-card-front">[\s\S]*?<svg [\s\S]*?<span class="home-card-name">/);
      expect(card).toContain(`aria-label="${f.label}'s mascot"`);
    });
    expect(beats[0]).toContain('class="home-card"');
  });

  it('names no fleet of the demo galaxy', () => {
    for (const name of ['BUILDERS', 'INKLINGS', 'COINERS', 'NIGHT OWLS', 'CORSAIRS', 'CAPES']) expect(text(markup)).not.toContain(name);
  });

  it('says how points come, every number read from the rulebook', () => {
    const closes = Object.values(RULEBOOK.woundClose);
    expect(text(sure(beats[1], 'the second beat'))).toBe(
      `SHIP VALUE A secured zone scores ${RULEBOOK.zoneSecured}. A rescue scores ${RULEBOOK.rescue}. `
      + `Closing Entropy (an unanswered question, stuck work, a shipped bug) scores ${Math.min(...closes)} to ${Math.max(...closes)}, by its kind.`,
    );
  });

  it('ranks the example fleets by points, labelled EXAMPLE', () => {
    const board = /<ol class="home-board">([\s\S]*?)<\/ol>/.exec(sure(beats[2], 'the third beat'))?.[1] ?? '';
    const rows = [...board.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, r]) => text(sure(r, 'a row')));
    const ranked = [...EXAMPLE_FLEETS].sort((a, b) => b.points - a.points);
    expect(rows).toEqual(ranked.map((f, i) => `${i + 1} ${f.label} ${f.points}`));
    expect(ranked.map((f) => f.label), 'the list is not already in rank order').not.toEqual(EXAMPLE_FLEETS.map((f) => f.label));
    expect(beats[2]).toContain('<span class="home-example">EXAMPLE</span>');
  });

  it('shows the loop\'s real counts under THE LOOP BUILT THIS, and — for one it could not read', () => {
    const third = sure(beats[2], 'the third beat');
    const proof = third.slice(third.indexOf('class="home-game-proof"'));
    expect(text(`<div ${proof}`)).toMatch(/^THE LOOP BUILT THIS /);
    const scores = [...proof.matchAll(/<div class="home-score">([\s\S]*?)<\/div>/g)].map(([, s]) => text(sure(s, 'a score')));
    expect(scores).toEqual(['FEATURES SHIPPED 21', 'SLICES MERGED 134', 'DECISIONS ADOPTED —']);
    expect(text(proof)).toContain('Counted from Omni Loop\'s own shipped work, each time this page is built.');
  });

  it('flips under reduced motion with a crossfade, never a turn', () => {
    const css = readFileSync(new URL('./Game.css', import.meta.url), 'utf8');
    const still = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map(([, b]) => b).join('\n');
    expect(still).toMatch(/\.home-card-in[^{]*\{[^}]*transform: none/);
    expect(still).toMatch(/opacity/);
  });
});
