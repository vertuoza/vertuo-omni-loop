import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { COLOURS, logoSvg } from '@omni/design';
import { HOME_METADATA, SHARE_CARD, shareCard } from './share';

// HOME shared as the ad (PRD 261, s6): a link to `/` previews with the page's title, its
// description and an Open Graph image showing the crest and JOIN THE LOOP! on the starfield.
describe('HOME\'s metadata', () => {
  it('titles the page after the ad and describes the loop in the pitch\'s words', () => {
    expect(HOME_METADATA.title).toEqual({ absolute: 'OMNI LOOP · JOIN THE LOOP!' });
    expect(HOME_METADATA.description).toMatch(/Hand a PRD to the loop\./);
    expect(HOME_METADATA.description).toMatch(/review and merge/);
  });

  it('gives a shared link the same title and description, as a large image card', () => {
    expect(HOME_METADATA.openGraph).toMatchObject({
      title: 'OMNI LOOP · JOIN THE LOOP!', description: HOME_METADATA.description, type: 'website',
    });
    expect(HOME_METADATA.openGraph).not.toHaveProperty('url');
    expect(HOME_METADATA.twitter).toMatchObject({
      card: 'summary_large_image', title: 'OMNI LOOP · JOIN THE LOOP!', description: HOME_METADATA.description,
    });
  });
});

describe('the share card', () => {
  const html = renderToStaticMarkup(shareCard());

  it('is the size every network previews without cropping', () => {
    expect(SHARE_CARD).toEqual({ width: 1200, height: 630, alt: expect.stringMatching(/JOIN THE LOOP!/) });
  });

  it('draws JOIN THE LOOP! on the starfield', () => {
    expect(html).toContain('JOIN THE LOOP!');
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
