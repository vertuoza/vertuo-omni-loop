import { describe, expect, it } from 'vitest';
import { LINGO } from '../lingo';
import { heading, html, text } from './render';
import { StrategyGuide } from './StrategyGuide';

// The strategy guide (PRD 285, s5): seven levels, each naming the practice the loop builds in, and the
// LOOP LINGO sidebar glossing the loop terms HOME uses, read from the lingo module.

const levels = (markup: string) =>
  [...markup.matchAll(/<li class="home-stage[^"]*">([\s\S]*?)<\/li>/g)].map(([, li]) => text(li));

const sidebar = (markup: string) => {
  const aside = markup.match(/<aside\b[^>]*class="home-lingo"[^>]*>([\s\S]*?)<\/aside>/);
  if (!aside) throw new Error('no LOOP LINGO sidebar');
  return aside[1];
};

describe('the strategy guide', () => {
  it('opens on its own h2', () => {
    expect(heading(html(StrategyGuide()))).toBe('Strategy guide: the loop, level by level');
  });

  it('walks the seven levels in order, SET UP to the KNOWLEDGE bonus, in the spec\'s words', () => {
    expect(levels(html(StrategyGuide()))).toEqual([
      '1-1 SET UP omni invade reads your repository and writes its harness: how you test, build, review and release. You merge it as one pull request of docs.',
      '1-2 BRAINSTORM You and Claude turn an idea into a brief, the PRD, with a before/after page. A person approves it before any code exists.',
      '1-3 PLAN The PRD is cut into thin slices, each with the files it may touch, grouped in waves that are built side by side.',
      '1-4 BUILD One agent per slice, each on its own branch, test-first, each with its own pull request.',
      '1-5 OUTBOX Every decision an agent took without asking is written down. You answer once, at the end.',
      '1-6 SHIP The feature\'s pull request is ready once its checks pass. A person reviews and merges it, never an agent.',
      '★ BONUS KNOWLEDGE The decisions you settle land in the knowledge base, so the next loop knows more.',
    ]);
  });

  it('names the command in code, not in prose', () => {
    expect(html(StrategyGuide())).toContain('<code>omni invade</code>');
  });

  it('keeps OmniMan running the path', () => {
    expect(html(StrategyGuide())).toMatch(/<[a-z]+ [^>]*data-pose="omni-run"[^>]*>/);
  });

  it('holds a LOOP LINGO sidebar: its h3, then the five terms and their glosses, in the loop\'s order', () => {
    const aside = sidebar(html(StrategyGuide()));
    expect(text(aside.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1])).toBe('Loop lingo');
    const terms = [...aside.matchAll(/<dt>([\s\S]*?)<\/dt>/g)].map(([, t]) => text(t));
    const glosses = [...aside.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map(([, d]) => text(d));
    expect(terms).toEqual(['HARNESS', 'PRD', 'SLICE', 'WAVE', 'OUTBOX']);
    expect(glosses).toEqual(LINGO.map((e) => e.gloss));
  });

  it('puts the sidebar beside the map, in the same row as it', () => {
    const markup = html(StrategyGuide());
    const board = markup.match(/<div class="home-guide">([\s\S]*)<\/div>/);
    expect(board).not.toBeNull();
    expect(board![1]).toMatch(/<ol class="home-map">[\s\S]*<aside\b[^>]*class="home-lingo"/);
  });
});
