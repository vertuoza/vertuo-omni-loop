import { forMeList, type ForMeRow } from '../../ask/page/question';
import { needsYou, tabsOf, type TabRow } from '../../ask/page/tabs';

// The four counts' own rule (PRD 328): how many of Claude's questions wait for you now, and where the
// Waiting for you tile sends you. Your open sessions count when their newest round is open (readTabs
// gives each session its newest round); a question a teammate shared with you counts while it is open
// (readForMe). Each is counted as the page it links to shows it: a question waits while the page can
// still answer it, so not once the terminal has taken it over (the nine minutes the hook waits) nor
// in a closed session. The tile links to /ask/for-me when at least one waits and every one of them was
// shared with you, since that page lists them all; to /ask, your own sessions, otherwise.

/** Your own sessions' questions, as tabs. */
export const ASK = '/ask';
/** The questions teammates shared with you. */
export const FOR_ME = '/ask/for-me';

/** What waits for you now, and where the tile links. */
export interface Waiting {
  count: number;
  href: typeof ASK | typeof FOR_ME;
}

export function waitingCount(tabs: readonly TabRow[], forMe: readonly ForMeRow[], now: number): Waiting {
  const own = needsYou(tabsOf([...tabs], now));
  const shared = forMeList([...forMe], [], now).length;
  const count = own + shared;
  return { count, href: count > 0 && own === 0 ? FOR_ME : ASK };
}
