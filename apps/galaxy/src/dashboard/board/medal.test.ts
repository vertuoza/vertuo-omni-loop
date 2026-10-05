import { describe, expect, it } from 'vitest';
import { medalSvg } from './medal';

describe('medalSvg (issue 958)', () => {
  it('draws a pixel medal on a ribbon for each of the top three, each in its own metal', () => {
    const [gold, silver, bronze] = [1, 2, 3].map((rank) => medalSvg(rank));
    for (const svg of [gold, silver, bronze]) {
      expect(svg).toMatch(/^<svg [^>]*shape-rendering="crispEdges"/);
      expect(svg).not.toContain('role="img"');
      expect(svg).not.toContain('<title>');
    }
    expect(gold).toContain('#f5c518');
    expect(silver).toContain('#d3d7e6');
    expect(bronze).toContain('#d0844a');
  });

  it('draws no medal past third place', () => {
    expect(medalSvg(4)).toBeNull();
    expect(medalSvg(12)).toBeNull();
  });
});
