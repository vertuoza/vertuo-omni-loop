import { BOARD_ZONE } from '../dashboard/board/period';
import type { KitToken } from './terminal-tokens.contract';

// Terminal tokens on your own profile (PRD 1628 s4, spec section 5; the `profile` screen's draft): the
// words, what a row says of a token, where Make a token sends the browser, and the section's state in
// the page, apart from React so it is tested on its own.
//
// Make a token is the sign-in round trip of section 2: a plain form to /ask/signin with `purpose=token`,
// the name, the days, the workspace's slug and the way back to this profile (src/ask/kit-token.ts reads
// them). The callback keeps the token made for this browser in a cookie no script reads; back here, the
// page asks POST /api/ask/token/made for it once, which clears it, so a reload never shows it again.

export const TERMINAL_LINE = {
  title: 'Terminal tokens',
  intro: 'Sign in where no browser opens.',
  name: 'Name',
  namePlaceholder: 'cloud-agent',
  expiresIn: 'Expires in',
  make: 'Make a token',
  limit: 'You hold 20 tokens already: revoke one to make another.',
  revoke: 'Revoke',
  keep: 'Keep',
  shownOnce: 'shown once',
  copy: 'Copy',
  copied: 'Copied',
  paste: 'Paste as',
  pasteVariable: 'OMNI_TOKEN=',
  pasteWhere: 'in your environment.',
  neverUsed: 'Never used',
  demo: 'Demo: no token here signs anything in.',
} as const;

/** The expiries a kit token may have, in days, and the one chosen first. */
export const TOKEN_DAYS = [30, 90, 365] as const;
export type TokenDays = (typeof TOKEN_DAYS)[number];
export const DEFAULT_DAYS: TokenDays = 90;
export const TOKEN_NAME_MAX = 40;

/** Where the round trip sends the browser, and what it carries. */
export const SIGNIN_PATH = '/ask/signin';

/** The fields Make a token's form sends besides the name and the days: the purpose, the workspace's
 * slug and the way back, your own profile. */
export const tokenFormFields = (workspace: string, back: string) => ({ purpose: 'token', workspace, back });

/** The sign-in page for a token named `name`, of `days` days, in `workspace`, coming back to `back`. */
export function tokenSignInHref(name: string, days: TokenDays, workspace: string, back: string): string {
  return `${SIGNIN_PATH}?${new URLSearchParams({ ...tokenFormFields(workspace, back), name, days: String(days) }).toString()}`;
}

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: BOARD_ZONE, day: 'numeric', month: 'short' });
const dayMonth = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : DAY_MONTH.format(at);
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const madeLabel = (t: Pick<KitToken, 'createdAt'>) => `Made ${dayMonth(t.createdAt)}`;
export const expiresLabel = (iso: string) => `Expires ${dayMonth(iso)}`;

/** When the token last signed a terminal in: minutes, then hours, then the day; or never. */
export function usedLabel(t: Pick<KitToken, 'lastUsedAt'>, now: number): string {
  if (t.lastUsedAt === null) return TERMINAL_LINE.neverUsed;
  const ago = now - Date.parse(t.lastUsedAt);
  if (Number.isNaN(ago)) return `Used ${t.lastUsedAt}`;
  if (ago < MINUTE) return 'Used just now';
  if (ago < HOUR) return `Used ${Math.floor(ago / MINUTE)} min ago`;
  if (ago < 24 * HOUR) return `Used ${Math.floor(ago / HOUR)} h ago`;
  return `Used ${dayMonth(t.lastUsedAt)}`;
}

/** Newest first, as the list shows them. */
export const newestFirst = (tokens: readonly KitToken[]): KitToken[] =>
  [...tokens].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));

// ── The section's state in the page ─────────────────────────────────────────

/** The token just made, shown once. */
export interface ShownToken {
  name: string;
  token: string;
  expiresAt: string;
}

export interface TerminalState {
  /** Null when the tokens could not be read. */
  tokens: KitToken[] | null;
  /** Your live tokens, both scopes together, and the limit; null when unknown. */
  live: number | null;
  limit: number;
  shown: ShownToken | null;
  copied: boolean;
  /** The token whose Revoke waits for its confirmation. */
  confirming: string | null;
  busy: boolean;
  refusal: string | null;
}

export type TerminalAction =
  | { type: 'shown'; shown: ShownToken; listed?: KitToken }
  | { type: 'copied' }
  | { type: 'confirm'; id: string }
  | { type: 'keep' }
  | { type: 'busy' }
  | { type: 'revoked'; id: string }
  | { type: 'refused'; message: string };

export const LIMIT = 20;

export const initialTerminalState = (start: { tokens: KitToken[] | null; live: number | null; limit?: number }): TerminalState => ({
  tokens: start.tokens ? newestFirst(start.tokens) : null,
  live: start.live,
  limit: start.limit ?? LIMIT,
  shown: null,
  copied: false,
  confirming: null,
  busy: false,
  refusal: null,
});

/** Whether Make a token says the limit is reached. */
export const atLimit = (state: Pick<TerminalState, 'live' | 'limit'>) => state.live !== null && state.live >= state.limit;

export function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'shown': {
      const { listed } = action;
      if (!listed) return { ...state, shown: action.shown, copied: false };
      return {
        ...state, shown: action.shown, copied: false,
        tokens: state.tokens && [listed, ...state.tokens.filter((t) => t.id !== listed.id)],
        live: state.live === null ? null : state.live + 1,
      };
    }
    case 'copied':
      return { ...state, copied: true };
    case 'confirm':
      return { ...state, confirming: action.id, refusal: null };
    case 'keep':
      return { ...state, confirming: null };
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'revoked': {
      const had = state.tokens?.some((t) => t.id === action.id) ?? false;
      return {
        ...state, busy: false, confirming: null,
        tokens: state.tokens && state.tokens.filter((t) => t.id !== action.id),
        live: state.live === null || !had ? state.live : Math.max(0, state.live - 1),
      };
    }
    case 'refused':
      return { ...state, busy: false, confirming: null, refusal: action.message };
  }
}
