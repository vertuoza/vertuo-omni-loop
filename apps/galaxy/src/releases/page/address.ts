// Where /releases lives (PRD 262): its path, and its canonical address, the one search engines and
// link previews keep whichever deployment served the page (a preview's included). The host is the
// galaxy app's production address, the Omni Loop home every signature links to: its own domain since
// PRD 983. The vercel.app host keeps serving every page; only the canonical address moved.

/** The galaxy app's production address. */
export const SITE = 'https://www.omni-loop.xyz';

export const RELEASES_PATH = '/releases';

/** The page's canonical address. */
export const RELEASES_URL = `${SITE}${RELEASES_PATH}`;
