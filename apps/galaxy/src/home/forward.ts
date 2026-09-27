// HOME took `/` from the arcade (PRD 261), so the arcade's deep links, bookmarked and still written
// by the rest of the app (`/#chart` from /knowledge, `/#menu` from the app's Game mode), would land on
// HOME. HOME sends each on to the game at /play with the same hash, before it paints; any other hash
// stays on HOME. A hash never reaches the server, so this runs in the browser, as the inline script
// below.
import { DEEP_LINKS } from '../arcade/deep-link';

/** Where the game lives since HOME took `/`. */
export const PLAY = '/play';

/** The hashes that name an arcade screen: a screen by its name, or a planet by its PRD number. */
const ARCADE_HASH = new RegExp(`^#(?:${DEEP_LINKS.join('|')}|planet-\\d+)$`);

/** The address a hash on HOME goes on to, or null when it stays on HOME. */
export function forwardOf(hash: string): string | null {
  return ARCADE_HASH.test(hash) ? `${PLAY}${hash}` : null;
}

/** The same rule, as the script HOME runs before its first paint. */
export const FORWARD_SCRIPT =
  `if(${ARCADE_HASH}.test(location.hash))location.replace('${PLAY}'+location.hash);`;
