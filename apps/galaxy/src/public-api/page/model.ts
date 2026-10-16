import type { ApiKey } from '../keys/api-keys.contract';

// Settings › API keys' model (PRD 2022 s1; the `api-keys` screen of the design library): the page's
// situations, the panel's state and how each action changes it, and the words a key's row says. Pure,
// so the page's states are tested without a browser.

export const API_KEYS_HREF = '/app/settings/api-keys';
export const API_REFERENCE_HREF = '/docs/api';

/** Who the page is drawn for: the situations every settings page has, or the keys. */
export type ApiKeysPageView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'keys'; source: ApiKeysSource; owner: boolean; keys: ApiKey[]; tracked: string[] };

/** Where the panel's calls go: the demo's memory, or the routes for this workspace. */
export type ApiKeysSource = { kind: 'demo' } | { kind: 'database'; workspace: string };

/** The key just made: shown once, until the page is left or reloaded. */
export interface MadeShown {
  name: string;
  secret: string;
  curl: string;
}

export interface ApiKeysState {
  keys: ApiKey[];
  /** The New key form: closed, or open with what is typed and picked. */
  form: { open: boolean; name: string; all: boolean; repos: string[] };
  made: MadeShown | null;
  /** The key whose Revoke waits for its second click. */
  confirming: string | null;
  busy: boolean;
  refusal: string | null;
  copied: boolean;
}

export type ApiKeysAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'name'; name: string }
  | { type: 'all'; all: boolean }
  | { type: 'repo'; repo: string; on: boolean }
  | { type: 'busy' }
  | { type: 'made'; key: ApiKey; secret: string; origin: string }
  | { type: 'confirm'; id: string }
  | { type: 'cancel' }
  | { type: 'revoked'; id: string }
  | { type: 'refused'; message: string }
  | { type: 'copied' };

const CLOSED_FORM: ApiKeysState['form'] = { open: false, name: '', all: true, repos: [] };

export function initialApiKeysState(keys: readonly ApiKey[]): ApiKeysState {
  return { keys: [...keys], form: CLOSED_FORM, made: null, confirming: null, busy: false, refusal: null, copied: false };
}

/** The `curl` the key just made is shown with: the PRDs' list, with the key as its bearer. */
export const curlOf = (origin: string, secret: string) =>
  `curl ${origin.replace(/\/+$/, '')}/api/v1/prds \\\n  -H "Authorization: Bearer ${secret}"`;

/** Whether the form may be sent: a name, and at least one repository unless All is picked. */
export const canMake = (state: ApiKeysState) =>
  !state.busy && state.form.name.trim() !== '' && (state.form.all || state.form.repos.length > 0);

/** The repositories the form sends: none for All, the picked ones otherwise. */
export const reposOf = (form: ApiKeysState['form']) => (form.all ? [] : [...form.repos].sort());

export function apiKeysReducer(state: ApiKeysState, action: ApiKeysAction): ApiKeysState {
  switch (action.type) {
    case 'open':
      return { ...state, form: { ...CLOSED_FORM, open: true }, refusal: null };
    case 'close':
      return { ...state, form: CLOSED_FORM, refusal: null };
    case 'name':
      return { ...state, form: { ...state.form, name: action.name } };
    case 'all':
      return { ...state, form: { ...state.form, all: action.all } };
    case 'repo': {
      const repos = state.form.repos.filter((r) => r !== action.repo);
      return { ...state, form: { ...state.form, repos: action.on ? [...repos, action.repo] : repos } };
    }
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'made':
      return {
        ...state,
        keys: [action.key, ...state.keys.filter((k) => k.id !== action.key.id)],
        form: CLOSED_FORM,
        made: { name: action.key.name, secret: action.secret, curl: curlOf(action.origin, action.secret) },
        busy: false,
        copied: false,
      };
    case 'confirm':
      return { ...state, confirming: action.id, refusal: null };
    case 'cancel':
      return { ...state, confirming: null };
    case 'revoked':
      return { ...state, keys: state.keys.filter((k) => k.id !== action.id), confirming: null, busy: false };
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
    case 'copied':
      return { ...state, copied: true };
  }
}

/** A key as the table shows it: its prefix and its last four characters. */
export const maskedKey = (key: Pick<ApiKey, 'lastFour'>) => `oma_…${key.lastFour}`;

/** A repository's chip: its name, its owner left to the tooltip. */
export const repoChip = (repo: string) => repo.slice(repo.indexOf('/') + 1);

/** Who made the key: their login, else their name, else someone. */
export const makerOf = (key: Pick<ApiKey, 'maker'>) => (key.maker.login ? `@${key.maker.login}` : key.maker.name ?? 'someone');

/** A date as the table says it: `15 Oct 2026`. */
export function dayOf(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** When the key was last used: Never, a moment ago, minutes, hours or days ago, then the day. */
export function lastUsedOf(iso: string | null, now: Date): string {
  if (iso === null) return 'Never';
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return iso;
  const minutes = Math.floor((now.getTime() - at) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} ${days === 1 ? 'day' : 'days'} ago` : dayOf(iso);
}
