// The newcomer's setup facts (PRD 1990, spec section 3): the Omni plugin and the HUD plugin
// installed, and this computer signed in to the Omni page; the fourth step, `main` pulled, is the
// main check's. The plugins are read from `claude plugin list --json`, once per run (the kit check
// reads the same list through `claudePlugins`); the sign-in from the store `omni signin` keeps.
//
// Nothing here throws: no `claude` on the PATH skips the two plugin steps, a `claude` that fails or
// runs out of time (10 s) leaves them counted done, so a failure never holds a person in setup.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { z } from 'zod';
import { credentials, credentialsHost } from '../ask/credentials.ts';
import { processOmniToken, processUnderTest } from '../env/read.ts';
import { HUD_PLUGIN } from '../init/settings.ts';
import { MARKETPLACE, PLUGIN } from '../init/steps.ts';
import { propertyOf } from '../narrow.ts';
import type { Gatherer, GatherIo, SetupFacts, Unchecked } from './facts.ts';

/** How long `claude plugin list` may take. */
const CLAUDE_BUDGET_MS = 10_000;

/** The Omni plugin's id, as `claude plugin list` names it. */
export const OMNI_PLUGIN_ID = `${PLUGIN}@${MARKETPLACE}`;

/** The HUD plugin's id, as `claude plugin list` names it. */
export const HUD_PLUGIN_ID = HUD_PLUGIN;

const PluginListSchema = z.array(z.looseObject({ id: z.unknown(), version: z.unknown().optional() }).nullable().catch(null));

/** The installed plugins by id (their version, `null` when the list gives none), or why there is no list. */
export type ClaudePlugins = { readonly installed: ReadonlyMap<string, string | null> } | Unchecked;

const memo = new WeakMap<GatherIo, ClaudePlugins | null>();

/** The plugins of a `claude plugin list --json` answer, or why it does not read. */
function pluginsOfList(text: string): ClaudePlugins {
  const parsed = PluginListSchema.safeParse(JSON.parse(text));
  if (!parsed.success) return { notChecked: 'claude plugin list was unreadable' };
  const installed = new Map<string, string | null>();
  for (const entry of parsed.data) {
    if (entry && typeof entry.id === 'string') installed.set(entry.id, typeof entry.version === 'string' && entry.version !== '' ? entry.version : null);
  }
  return { installed };
}

/** What a failed `claude plugin list` leaves: `null` for no command, else why it was not read. */
function afterFailure(error: unknown): ClaudePlugins | null {
  const code = propertyOf(error, 'code');
  if (code === 'ENOENT') return null;
  return { notChecked: code === 'ETIMEDOUT' ? 'timed out' : 'claude plugin list failed' };
}

/** `claude plugin list --json`, read once per run: `null` without a `claude` command. */
export function claudePlugins(io: GatherIo): ClaudePlugins | null {
  const held = memo.get(io);
  if (held !== undefined) return held;
  const options: ExecFileSyncOptionsWithStringEncoding = { cwd: io.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: CLAUDE_BUDGET_MS };
  let read: ClaudePlugins | null;
  try {
    read = pluginsOfList(io.exec('claude', ['plugin', 'list', '--json'], options));
  } catch (error) {
    read = afterFailure(error);
  }
  memo.set(io, read);
  return read;
}

/**
 * Whether this computer is signed in to the Omni page `askUrl` names: a stored sign-in that has not
 * expired (an access token past its `expires_at` still holds while a refresh token can renew it), or
 * a kit token in the environment. No `askUrl` means no page to sign in to: counted signed in.
 */
export function isSignedIn({ askUrl, home, now }: { askUrl: string | null; home?: string | undefined; now: number }): boolean {
  if (askUrl === null) return true;
  if (home === undefined && processOmniToken() !== null) return true;
  try {
    const entry = credentials({ home }).read(credentialsHost(askUrl));
    if (!entry) return false;
    const at = entry.expires_at;
    if (typeof at !== 'number') return true;
    if ((at < 1e12 ? at * 1000 : at) > now) return true;
    return typeof entry.refresh_token === 'string' && entry.refresh_token !== '';
  } catch {
    return false;
  }
}

/** The three steps of the setup, read from the plugin list and the sign-in store. */
export function setupFactsOf(io: GatherIo, { home }: { home?: string | undefined } = {}): SetupFacts {
  const list = claudePlugins(io);
  const plugin = (id: string): { done: boolean; fix: string } => {
    const fix = `/plugin install ${id}`;
    return list === null || 'notChecked' in list ? { done: true, fix } : { done: list.installed.has(id), fix };
  };
  return {
    claude: list !== null,
    plugin: plugin(OMNI_PLUGIN_ID),
    hud: plugin(HUD_PLUGIN_ID),
    signedIn: isSignedIn({ askUrl: io.config.ask.url, home, now: io.now }),
  };
}

/** The setup when nothing is read: every step done. */
const ALL_DONE: SetupFacts = {
  claude: true,
  plugin: { done: true, fix: `/plugin install ${OMNI_PLUGIN_ID}` },
  hud: { done: true, fix: `/plugin install ${HUD_PLUGIN_ID}` },
  signedIn: true,
};

/** The setup's gatherer. Under vitest it starts no `claude` and reads no sign-in: a test of the whole command reads every step done. */
export const setupFacts: Gatherer<SetupFacts> = (io) => Promise.resolve(processUnderTest() ? ALL_DONE : setupFactsOf(io));
