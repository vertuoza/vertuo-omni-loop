// Where /releases lives (PRD 262): its path, and its canonical address, the one search engines and
// link previews keep whichever deployment served the page (a preview's included). The host is the
// galaxy app's production address, the Omni Loop home every signature links to.

/** The galaxy app's production address. */
export const SITE = 'https://vertuo-omni-loop-galaxy.vercel.app';

export const RELEASES_PATH = '/releases';

/** The page's canonical address. */
export const RELEASES_URL = `${SITE}${RELEASES_PATH}`;
