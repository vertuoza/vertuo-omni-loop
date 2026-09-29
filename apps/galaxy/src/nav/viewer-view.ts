// What the app shell shows of the person looking (PRD 438): the value the server's viewer read
// (viewer.ts) hands the sidebar and the top bar, safe to import from the browser.
import type { WaitingView } from '../waiting/view';

export interface ViewerView {
  signedIn: boolean;
  /** The person's name, for the user menu. */
  name: string | null;
  /** Their GitHub login. */
  login: string | null;
  avatarUrl: string | null;
  /** Their arcade hero in the current workspace, as a decorative pixel SVG tinted in their fleet's
   * colour (PRD 652); null when they have none or it could not be read, and the menu shows the avatar. */
  heroSvg: string | null;
  /** The workspace they joined first, as a label under the crest. */
  workspaceName: string | null;
  /** What waits for them (PRD 499): the Questions part as the page rendered it, for the waiting
   * provider; null when signed out. */
  waiting: WaitingView | null;
}

export const SIGNED_OUT_VIEWER: ViewerView = { signedIn: false, name: null, login: null, avatarUrl: null, heroSvg: null, workspaceName: null, waiting: null };
