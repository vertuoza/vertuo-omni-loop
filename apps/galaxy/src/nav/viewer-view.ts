// What the app shell shows of the person looking (PRD 438): the value the server's viewer read
// (viewer.ts) hands the sidebar and the top bar, safe to import from the browser.

export interface ViewerView {
  signedIn: boolean;
  /** The person's name, for the user menu. */
  name: string | null;
  /** Their GitHub login. */
  login: string | null;
  avatarUrl: string | null;
  /** The workspace they joined first, as a label under the crest. */
  workspaceName: string | null;
  /** How many questions wait under For me; null when it could not be read. */
  forMe: number | null;
}

export const SIGNED_OUT_VIEWER: ViewerView = { signedIn: false, name: null, login: null, avatarUrl: null, workspaceName: null, forMe: null };
