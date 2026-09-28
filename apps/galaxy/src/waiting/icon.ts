import { logoSvg, OMNI_LOOP } from '@omni/design';

// The browser tab's icon (PRD 499, s3): while something waits, the crest (app/icon.ts's own drawing)
// with a red dot in its top-right corner, as an inline SVG data URL, so no new file is served; at 0,
// the crest's own URL, as the page rendered it.

const DOT = '<path fill="#ff2d3d" d="M12 0h3v1h-3zM11 1h5v3h-5zM12 4h3v1h-3z"/>';

/** The crest with the red dot, as a data URL. */
export const DOTTED_ICON = `data:image/svg+xml,${encodeURIComponent(logoSvg(OMNI_LOOP.icon).replace(/<\/svg>$/, `${DOT}</svg>`))}`;

/** The icon's URL for the count: the dotted crest above 0, `crest` (the page's own icon) at 0. */
export const iconHref = (count: number, crest: string): string => (count > 0 ? DOTTED_ICON : crest);
