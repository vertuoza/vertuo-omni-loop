import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LINGO } from '../lingo';
import { sure } from '../../arcade/sure';
import { heading, html, text } from './render';
import { KNOWLEDGE, LOOP, MOVERS, StrategyGuide } from './StrategyGuide';

// The strategy guide is the loop (PRD 971, s2): IDEA to RETRO, with the KNOWLEDGE arrow back to IDEA,
// each arrow coloured by who moves the work on, OmniMan running it, and the LOOP LINGO sidebar beside
// the map glossing the loop terms HOME still says.

const css = readFileSync(new URL('./StrategyGuide.css', import.meta.url), 'utf8');

const sidebar = (markup: string) => {
  const aside = markup.match(/<aside\b[^>]*class="home-lingo"[^>]*>([\s\S]*?)<\/aside>/);
  if (!aside) throw new Error('no LOOP LINGO sidebar');
  return sure(aside[1], 'the sidebar\'s content');
};

/** The SVG drawings of the map: the wide one and the one-column one. */
const maps = (markup: string) => [...markup.matchAll(/<svg\b[^>]*class="home-loop-map[^"]*"[^>]*>[\s\S]*?<\/svg>/g)].map(([s]) => s);

describe('the loop', () => {
  it('lists IDEA, PRD, INBOX, OUTBOX, SHIPPED and RETRO, levels 1-1 to 1-6', () => {
    expect(LOOP.map((s) => s.name)).toEqual(['IDEA', 'PRD', 'INBOX', 'OUTBOX', 'SHIPPED', 'RETRO']);
    expect(LOOP.map((s) => s.level)).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6']);
  });

  it('gives each stage its line, in the spec\'s words', () => {
    expect(LOOP.map((s) => s.line)).toEqual([
      'You talk an idea through with Claude. Nothing is written yet.',
      'The idea becomes a brief and a before/after page. A person approves it before any code exists.',
      'Approved and ready to build.',
      'Agents build it in slices, test-first. Every decision they took without asking waits for your answer.',
      'A person reviews and merges the feature, never an agent.',
      'How the delivery went, and what it taught.',
    ]);
  });

  it('names who moves each arrow on: YOU, YOU, AGENTS, YOU, OMNI APP, and RETRO hands back KNOWLEDGE', () => {
    expect(LOOP.map((s) => s.mover)).toEqual(['YOU', 'YOU', 'AGENTS', 'YOU', 'OMNI APP', null]);
    for (const s of LOOP) if (s.mover) expect(MOVERS).toContain(s.mover);
    expect(MOVERS).toEqual(['YOU', 'AGENTS', 'OMNI APP']);
  });

  it('closes on KNOWLEDGE, from RETRO back to IDEA, as the bonus', () => {
    expect(KNOWLEDGE).toEqual({
      from: 'RETRO',
      to: 'IDEA',
      name: 'KNOWLEDGE',
      level: '★ BONUS',
      line: 'What you settled becomes the rules the next idea starts from.',
    });
  });
});

describe('the strategy guide', () => {
  const markup = html(StrategyGuide());

  it('opens on its own h2', () => {
    expect(heading(markup)).toBe('Strategy guide: the loop');
  });

  it('draws the map twice, wide and as one column, each a titled picture', () => {
    const svgs = maps(markup);
    expect(svgs).toHaveLength(2);
    expect(svgs[0]).toContain('home-loop-wide');
    expect(svgs[1]).toContain('home-loop-tall');
    for (const svg of svgs) {
      expect(svg).toMatch(/role="img"/);
      expect(svg).toMatch(/<svg\b[^>]*aria-labelledby="([^"]+)"[\s\S]*<title id="\1">The Omni Loop<\/title>/);
    }
  });

  it('draws one arrow per stage handing on, coloured by its mover, and one dashed KNOWLEDGE arrow from RETRO to IDEA', () => {
    for (const svg of maps(markup)) {
      const arrows = [...svg.matchAll(/<g class="home-loop-arrow ([^"]*)" data-from="([^"]+)" data-to="([^"]+)"/g)]
        .map(([, cls, from, to]) => ({ cls, from, to }));
      expect(arrows).toEqual([
        { cls: 'home-loop-you', from: 'IDEA', to: 'PRD' },
        { cls: 'home-loop-you', from: 'PRD', to: 'INBOX' },
        { cls: 'home-loop-agents', from: 'INBOX', to: 'OUTBOX' },
        { cls: 'home-loop-you', from: 'OUTBOX', to: 'SHIPPED' },
        { cls: 'home-loop-app', from: 'SHIPPED', to: 'RETRO' },
        { cls: 'home-loop-knowledge', from: 'RETRO', to: 'IDEA' },
      ]);
    }
  });

  it('names YOU, AGENTS and OMNI APP in a legend', () => {
    const legend = markup.match(/<ul class="home-loop-legend"[^>]*>([\s\S]*?)<\/ul>/);
    expect(legend).not.toBeNull();
    expect([...sure(sure(legend, 'the legend')[1], 'the legend\'s items').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => sure(text(sure(li, 'a legend item')).split(':')[0], 'a mover').trim()))
      .toEqual(['YOU', 'AGENTS', 'OMNI APP']);
  });

  it('lists the stages and their lines for a screen reader, the KNOWLEDGE bonus last', () => {
    const list = markup.match(/<ol class="home-loop-list">([\s\S]*?)<\/ol>/);
    expect(list).not.toBeNull();
    const items = [...sure(sure(list, 'the list')[1], 'the list\'s items').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => text(sure(li, 'a list item')));
    expect(items).toEqual([
      ...LOOP.map((s) => `${s.level} ${s.name}: ${s.line}`),
      `${KNOWLEDGE.level} ${KNOWLEDGE.name}: ${KNOWLEDGE.line}`,
    ]);
  });

  it('hides that list from the eye only, never from a screen reader', () => {
    expect(css).toMatch(/\.home-loop-list \{[^}]*clip-path: inset\(50%\)/);
    expect(css).not.toMatch(/\.home-loop-list \{[^}]*display: none/);
  });

  it('says every stage line in the DOM text', () => {
    const page = text(markup);
    for (const s of [...LOOP, KNOWLEDGE]) expect(page).toContain(s.line);
  });

  it('keeps OmniMan running the loop, under its caption', () => {
    expect(markup).toMatch(/<[a-z]+ [^>]*data-pose="omni-run"[^>]*>/);
    expect(text(markup)).toContain('OMNIMAN RUNS THE LOOP, ONE LEVEL AT A TIME');
  });

  it('animates OmniMan, and stands him still on IDEA under reduced motion', () => {
    expect(css).toMatch(/\.home-loop-runner \{[^}]*animation: home-loop-run/);
    expect(css).toMatch(/@keyframes home-loop-run\b/);
    const reduce = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(reduce).toMatch(/\.home-loop-runner \{[^}]*animation: none/);
  });

  it('draws the loop as one column below 720px, and the wide map from 720px', () => {
    const narrow = /@media \(max-width: 719px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(narrow).toMatch(/\.home-loop-wide \{[^}]*display: none/);
    expect(narrow).toMatch(/\.home-loop-tall \{[^}]*display: block/);
    expect(css).toMatch(/\.home-loop-tall \{[^}]*display: none/);
  });

  it('holds a LOOP LINGO sidebar: its h3, then the terms HOME still says, in the loop\'s order', () => {
    const aside = sidebar(markup);
    expect(text(sure(sure(aside.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/), 'the sidebar\'s h3')[1], 'the h3\'s text'))).toBe('Loop lingo');
    const terms = [...aside.matchAll(/<dt>([\s\S]*?)<\/dt>/g)].map(([, t]) => text(sure(t, 'a term')));
    const glosses = [...aside.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map(([, d]) => text(sure(d, 'a gloss')));
    expect(terms).toEqual(['PRD', 'SLICE', 'OUTBOX']);
    expect(glosses).toEqual(LINGO.map((e) => e.gloss));
  });

  it('puts the sidebar beside the map, in the same row as it', () => {
    const board = markup.match(/<div class="home-guide">([\s\S]*)<\/div>/);
    expect(board).not.toBeNull();
    expect(sure(board, 'the guide')[1]).toMatch(/<div class="home-loop">[\s\S]*<aside\b[^>]*class="home-lingo"/);
  });
});
