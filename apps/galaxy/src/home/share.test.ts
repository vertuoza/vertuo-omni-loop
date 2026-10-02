import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { COLOURS, logoSvg } from '@omni/design';
import { HOME_METADATA, SHARE_CARD, shareCard } from './share';

const SAYS_THE_HEADLINE: unknown = expect.stringMatching(/AGENTS SHIP\. YOU STEER\./);

// HOME shared as the ad (PRD 261, s6; reworded by PRD 285, s2): a link to `/` previews with the
// page's title, its description and an Open Graph image showing the crest and AGENTS SHIP. YOU
// STEER. on the starfield.
const TITLE = 'OMNI LOOP · AGENTS SHIP. YOU STEER.';
const DESCRIPTION = 'The delivery framework for coding agents. Agents plan, build test-first and open '
  + 'the pull requests; your team owns the product and the rules, and sees every decision.';

describe('HOME\'s metadata', () => {
  it('titles the page after the headline and describes the loop in the spec\'s words', () => {
    expect(HOME_METADATA.title).toEqual({ absolute: TITLE });
    expect(HOME_METADATA.description).toBe(DESCRIPTION);
  });

  it('gives a shared link the same title and description, as a large image card', () => {
    expect(HOME_METADATA.openGraph).toMatchObject({ title: TITLE, description: DESCRIPTION, type: 'website' });
    expect(HOME_METADATA.twitter).toMatchObject({ card: 'summary_large_image', title: TITLE, description: DESCRIPTION });
  });

  it('names its canonical address and og:url on www.omni-loop.xyz, whichever host served it (PRD 983)', () => {
    expect(HOME_METADATA.alternates).toEqual({ canonical: 'https://www.omni-loop.xyz/' });
    expect(HOME_METADATA.openGraph).toMatchObject({ url: 'https://www.omni-loop.xyz/' });
  });

  it('no longer says JOIN THE LOOP! or hands a PRD to the loop', () => {
    const words = JSON.stringify(HOME_METADATA);
    expect(words).not.toContain('JOIN THE LOOP!');
    expect(words).not.toMatch(/Hand a PRD/);
  });
});

describe('the share card', () => {
  const html = renderToStaticMarkup(shareCard());
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('is the size every network previews without cropping, and its alt text says the headline', () => {
    expect(SHARE_CARD).toEqual({ width: 1200, height: 630, alt: SAYS_THE_HEADLINE });
    expect(SHARE_CARD.alt).not.toContain('JOIN THE LOOP!');
  });

  it('draws AGENTS SHIP. YOU STEER. on the starfield, under the poster\'s kicker', () => {
    expect(text).toContain('AGENTS SHIP.');
    expect(text).toContain('YOU STEER.');
    expect(text.indexOf('AGENTS SHIP.')).toBeLessThan(text.indexOf('YOU STEER.'));
    expect(text).toContain('THE DELIVERY FRAMEWORK FOR CODING AGENTS');
    expect(text).not.toContain('JOIN THE LOOP!');
    expect(text).not.toContain('WHILE YOU SLEEP');
    expect(html).toContain(`background-color:${COLOURS.starfield}`);
  });

  it('shows the crest in its full form, drawn by @omni/design', () => {
    const crest = `data:image/svg+xml;base64,${Buffer.from(logoSvg('full', { scale: 7, title: null })).toString('base64')}`;
    expect(html).toContain(`src="${crest}"`);
  });

  it('uses only @omni/design\'s colours', () => {
    const palette = new Set(Object.values(COLOURS).map((c) => c.toLowerCase()));
    const used = [...html.matchAll(/#[0-9a-f]{6}\b/gi)].map(([c]) => c.toLowerCase());
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((c) => !palette.has(c))).toEqual([]);
  });
});
