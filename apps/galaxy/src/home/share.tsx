import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { COLOURS, logoSvg } from '@omni/design';

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
  // No og:url: without a fixed origin it would print as a bare `/`. The image's own address takes the
  // deployment's origin from Next (VERCEL_PROJECT_PRODUCTION_URL on Vercel).
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', siteName: 'Omni Loop' },
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

/** A handful of fixed stars, as [left %, top %, size px, colour]: the same field on every build. */
const STARS: readonly (readonly [number, number, number, string])[] = [
  [4, 8, 4, COLOURS.white], [13, 71, 3, COLOURS.cyan], [21, 18, 3, COLOURS.white], [29, 88, 4, COLOURS.yellow],
  [37, 6, 3, COLOURS.cyan], [46, 93, 3, COLOURS.white], [58, 11, 4, COLOURS.white], [66, 84, 3, COLOURS.cyan],
  [74, 4, 3, COLOURS.yellow], [83, 76, 4, COLOURS.white], [91, 15, 3, COLOURS.white], [96, 58, 4, COLOURS.cyan],
  [8, 44, 3, COLOURS.yellow], [93, 36, 3, COLOURS.white], [52, 78, 3, COLOURS.yellow], [17, 94, 3, COLOURS.white],
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
