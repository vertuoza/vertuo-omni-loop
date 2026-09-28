import { describe, expect, it } from 'vitest';
import { heading, html, text } from './render';
import { StrategyGuide } from './StrategyGuide';

describe('the strategy guide', () => {
  it('opens on its own h2', () => {
    expect(heading(html(StrategyGuide()))).toBe('Strategy guide: the loop, level by level');
  });

  it('walks the loop\'s levels in order, with OmniMan running the path', () => {
    const markup = html(StrategyGuide());
    const levels = [...markup.matchAll(/<li class="home-stage[^"]*">([\s\S]*?)<\/li>/g)].map(([, li]) => text(li));
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.at(-1)).toMatch(/^★ BONUS KNOWLEDGE /);
    expect(markup).toMatch(/<[a-z]+ [^>]*data-pose="omni-run"[^>]*>/);
  });
});
