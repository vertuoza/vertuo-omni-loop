import type { ApiKey } from '../keys/api-keys.contract';

// Settings › API keys' model (PRD 2022 s1; the `api-keys` screen of the design library): the page's
// situations, the panel's state and how each action changes it, and the words a key's row says. Pure,
// so the page's states are tested without a browser.
//
// A key's GitHub App (PRD 2433 s5) adds the attach form (opened from a key's row, above the table, beside
// the New key form: one open at a time) and Remove asked twice. The private key an owner chooses lives in
// the form's state alone: the page never draws it, and cancelling or attaching drops it.

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

/** The private key file an owner chose: its name, and its text, held only until the App is attached or the form closed. */
export interface ChosenFile {
  name: string;
  text: string;
}

/** The attach form: the key it is for, the App ID as typed, and the private key file chosen, if any. */
export interface AttachForm {
  id: string;
  name: string;
  appId: string;
  file: ChosenFile | null;
}

export interface ApiKeysState {
  keys: ApiKey[];
  /** The New key form: closed, or open with what is typed and picked. */
  form: { open: boolean; name: string; all: boolean; repos: string[] };
  /** The attach form of a key's GitHub App, or null when it is closed. */
  attach: AttachForm | null;
  made: MadeShown | null;
  /** The key whose Revoke waits for its second click. */
  confirming: string | null;
  /** The key whose Remove (its GitHub App) waits for its second click. */
  removing: string | null;
  busy: boolean;
  refusal: string | null;
  copied: boolean;
}

/** What a key's GitHub App does to the panel: the attach form's life, and Remove asked twice. */
export type GithubAppAction =
  | { type: 'attach-open'; key: Pick<ApiKey, 'id' | 'name'> }
  | { type: 'attach-close' }
  | { type: 'attach-id'; appId: string }
  | { type: 'attach-file'; file: ChosenFile | null }
  | { type: 'attached'; id: string; slug: string }
  | { type: 'remove-confirm'; id: string }
  | { type: 'remove-cancel' }
  | { type: 'removed'; id: string };

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
  | { type: 'copied' }
  | GithubAppAction;

const CLOSED_FORM: ApiKeysState['form'] = { open: false, name: '', all: true, repos: [] };

export function initialApiKeysState(keys: readonly ApiKey[]): ApiKeysState {
  return { keys: [...keys], form: CLOSED_FORM, attach: null, made: null, confirming: null, removing: null, busy: false, refusal: null, copied: false };
}

/** The `curl` the key just made is shown with: the PRDs' list, with the key as its bearer. */
export const curlOf = (origin: string, secret: string) =>
  `curl ${origin.replace(/\/+$/, '')}/api/v1/prds \\\n  -H "Authorization: Bearer ${secret}"`;

/** Whether the form may be sent: a name, and at least one repository unless All is picked. */
export const canMake = (state: ApiKeysState) =>
  !state.busy && state.form.name.trim() !== '' && (state.form.all || state.form.repos.length > 0);

/** The repositories the form sends: none for All, the picked ones otherwise. */
export const reposOf = (form: ApiKeysState['form']) => (form.all ? [] : [...form.repos].sort());

/** What the form says when the browser cannot read the private key file that was chosen. */
export const FILE_UNREADABLE = 'Couldn’t read that file. Choose it again.';

/** The App ID as GitHub shows it: digits only, as the keys' routes read it. */
const APP_ID = /^[0-9]{1,15}$/;

/** Whether the attach form may be sent: an App ID of digits, and a private key file with something in it. */
export const canAttach = (state: ApiKeysState) =>
  !state.busy && state.attach !== null && APP_ID.test(state.attach.appId.trim()) && state.attach.file !== null && state.attach.file.text.trim() !== '';

/** The keys with one key's GitHub App set, or taken off (null). */
const withApp = (keys: readonly ApiKey[], id: string, githubApp: ApiKey['githubApp']): ApiKey[] =>
  keys.map((k) => (k.id === id ? { ...k, githubApp } : k));

/** The attach form with one field set; with no form open, nothing to set and nothing changes. */
const withAttach = (state: ApiKeysState, field: Partial<AttachForm>): ApiKeysState =>
  (state.attach ? { ...state, attach: { ...state.attach, ...field } } : state);

/** Every action of a key's GitHub App, keyed so the compiler names the one a new action forgets. */
const GITHUB_APP_ACTIONS: Record<GithubAppAction['type'], true> = {
  'attach-open': true,
  'attach-close': true,
  'attach-id': true,
  'attach-file': true,
  attached: true,
  'remove-confirm': true,
  'remove-cancel': true,
  removed: true,
};

const isGithubAppAction = (action: ApiKeysAction): action is GithubAppAction => Object.hasOwn(GITHUB_APP_ACTIONS, action.type);

/** How a key's GitHub App changes the panel: the attach form opens, fills, closes or lands, and Remove is asked twice. */
function githubAppReducer(state: ApiKeysState, action: GithubAppAction): ApiKeysState {
  switch (action.type) {
    case 'attach-open':
      return {
        ...state,
        attach: { id: action.key.id, name: action.key.name, appId: '', file: null },
        form: CLOSED_FORM,
        confirming: null,
        removing: null,
        refusal: null,
      };
    case 'attach-close':
      return { ...state, attach: null, refusal: null };
    case 'attach-id':
      return withAttach(state, { appId: action.appId });
    case 'attach-file':
      return withAttach(state, { file: action.file });
    case 'attached':
      return { ...state, keys: withApp(state.keys, action.id, { slug: action.slug, lastTokenAt: null }), attach: null, busy: false, refusal: null };
    case 'remove-confirm':
      return { ...state, removing: action.id, confirming: null, refusal: null };
    case 'remove-cancel':
      return { ...state, removing: null };
    case 'removed':
      return { ...state, keys: withApp(state.keys, action.id, null), removing: null, busy: false };
  }
}

export function apiKeysReducer(state: ApiKeysState, action: ApiKeysAction): ApiKeysState {
  if (isGithubAppAction(action)) return githubAppReducer(state, action);
  switch (action.type) {
    case 'open':
      return { ...state, form: { ...CLOSED_FORM, open: true }, attach: null, refusal: null };
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
      return { ...state, confirming: action.id, removing: null, refusal: null };
    case 'cancel':
      return { ...state, confirming: null };
    case 'revoked':
      return {
        ...state,
        keys: state.keys.filter((k) => k.id !== action.id),
        attach: state.attach?.id === action.id ? null : state.attach,
        confirming: null,
        removing: null,
        busy: false,
      };
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

/** What an owner reads under a key's App slug: the day it last minted a token, or that it has not yet. */
export function lastTokenOf(iso: string | null | undefined): string {
  if (!iso) return 'no token yet';
  return `last token ${dayOf(iso)}`;
}
