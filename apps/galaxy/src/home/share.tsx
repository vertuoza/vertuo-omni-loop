import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { COLOURS, logoSvg } from '@omni/design';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { siteUrl } from '../seo/seo';

// HOME shared as the ad (PRD 261, reworded by PRD 285): what a link to `/` previews as. The page's
// title and description, and the Open Graph card: the crest and AGENTS SHIP. YOU STEER. on the
// starfield. `app/page.tsx` exports the
// metadata and `app/opengraph-image.tsx` renders the card; both are thin, so the words and the
// drawing are tested here.

const TITLE = 'OMNI LOOP · AGENTS SHIP. YOU STEER.';
/** What the loop is and who owns what, in the spec's words (PRD 285, Sharing). */
const DESCRIPTION =
  'The delivery framework for coding agents. Agents plan, build test-first and open the pull requests; '
  + 'your team owns the product and the rules, and sees every decision.';

export const HOME_METADATA = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  // The canonical address and og:url name the site's one address whichever host served the page
  // (PRD 983); the image's address resolves on the root layout's metadataBase, the same address.
  alternates: { canonical: siteUrl('/') },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', siteName: 'Omni Loop', url: siteUrl('/') },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
} satisfies Metadata;

/** The card's size (the one every network previews uncropped) and its words for a screen reader. */
export const SHARE_CARD = {
  width: 1200,
  height: 630,
  alt: 'The Omni Loop crest over AGENTS SHIP. YOU STEER., on a starfield',
} as const;

/** The crest's full form at a whole-number scale, as an image source the card renderer reads. */
const CREST_SCALE = 7;
const crestSrc = () =>
  `data:image/svg+xml;base64,${Buffer.from(logoSvg('full', { scale: CREST_SCALE, title: null })).toString('base64')}`;

/** The star colours, each a token the design package defines. */
const [WHITE, CYAN, YELLOW] = [defined(COLOURS.white, 'the white token'), defined(COLOURS.cyan, 'the cyan token'), defined(COLOURS.yellow, 'the yellow token')];

/** A handful of fixed stars, as [left %, top %, size px, colour]: the same field on every build. */
const STARS: readonly (readonly [number, number, number, string])[] = [
  [4, 8, 4, WHITE], [13, 71, 3, CYAN], [21, 18, 3, WHITE], [29, 88, 4, YELLOW],
  [37, 6, 3, CYAN], [46, 93, 3, WHITE], [58, 11, 4, WHITE], [66, 84, 3, CYAN],
  [74, 4, 3, YELLOW], [83, 76, 4, WHITE], [91, 15, 3, WHITE], [96, 58, 4, CYAN],
  [8, 44, 3, YELLOW], [93, 36, 3, WHITE], [52, 78, 3, YELLOW], [17, 94, 3, WHITE],
];

/** The Open Graph card, as the element `ImageResponse` draws (flexbox and inline styles only). */
export function shareCard(): ReactElement {
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', position: 'relative', backgroundColor: COLOURS.starfield,
        borderBottom: `16px solid ${COLOURS['ad-purple']}`,
      }}
    >
      {STARS.map(([left, top, size, colour]) => (
        <div
          key={`${left}-${top}`}
          style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: size, height: size, backgroundColor: colour }}
        />
      ))}
      <img src={crestSrc()} alt="Omni Loop" width={122 * CREST_SCALE} height={18 * CREST_SCALE} />
      <div style={{ display: 'flex', marginTop: 36, fontSize: 30, letterSpacing: 2, color: COLOURS.red }}>
        THE DELIVERY FRAMEWORK FOR CODING AGENTS
      </div>
      {/* The headline on two lines, as the poster sets it: one line would not fit 1200 px at this size. */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 8, fontSize: 104,
          lineHeight: 1.05, fontWeight: 700, color: COLOURS.yellow, transform: 'skewX(-10deg)',
          textShadow: `6px 6px 0 ${COLOURS['ad-purple']}`,
        }}
      >
        <div style={{ display: 'flex' }}>AGENTS SHIP.</div>
        <div style={{ display: 'flex' }}>YOU STEER.</div>
      </div>
    </div>
  );
}
