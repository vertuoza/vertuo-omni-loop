// What the runner reads of T3 Code's own files on its machine (PRD 2537, s4), as T3 0.1.x keeps them
// under its home, `~/.t3`:
//
// - `userdata/server-runtime.json`: the running server's pid and origin (`http://127.0.0.1:<port>`).
//   T3 is running when the file names a process that lives.
// - `userdata/settings.json`: the provider instances, each with its `driver` (`claudeAgent`, `codex`,
//   `opencode`…), whether it is `enabled`, and a Claude instance's `config.homePath`, its own Claude
//   folder (`~/.claude` when it names none). T3's default instances are named after their driver.
// - `caches/<instance>.json`: each instance's last status, its `auth.status` among it.
//
// Only those fields are read: an instance's sign-in (an email, a workspace) never leaves here. A file
// that is missing or does not parse reads as nothing, never as a crash.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { field } from '../../ask/schema.ts';

/** One provider instance of T3: its driver, whether it runs Claude, is enabled and signed in, and where a Claude one keeps its transcripts. */
export type T3Instance = { id: string; driver: string; claude: boolean; enabled: boolean; signedIn: boolean; projects: string | null };

/** The driver of T3's Claude instances. */
const CLAUDE_DRIVER = 'claudeAgent';

/** T3's home on this machine: `~/.t3`. */
export const t3HomeOf = (home: string = homedir()): string => join(home, '.t3');

/** The JSON a file holds, or `undefined` when it is missing or does not parse. */
function jsonAt(path: string): unknown {
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return value;
  } catch {
    return undefined;
  }
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Whether the process `pid` lives on this machine (one that refuses a signal lives too). */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM';
  }
}

/** The origin of the T3 server running from `t3Home`, or `null` when none runs. */
export function t3Origin(t3Home: string, alive: (pid: number) => boolean = processAlive): string | null {
  const state = jsonAt(join(t3Home, 'userdata', 'server-runtime.json'));
  const pid = field(state, 'pid');
  const origin = textOf(field(state, 'origin'));
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0 || origin === '') return null;
  return alive(pid) ? origin : null;
}

/** A Claude folder named in T3's settings: `~` is the home, a relative path is taken from the home too. */
function claudeFolder(homePath: string, home: string): string {
  if (homePath === '') return join(home, '.claude');
  if (homePath === '~') return home;
  return homePath.startsWith('~/') ? join(home, homePath.slice(2)) : resolve(home, homePath);
}

/** The instance `id` of the T3 home `t3Home`, `home` the person's; `null` when T3 knows none by that id. */
export function t3Instance(t3Home: string, home: string, id: string): T3Instance | null {
  const instances = field(jsonAt(join(t3Home, 'userdata', 'settings.json')), 'providerInstances');
  const configured = typeof instances === 'object' && instances !== null && Object.hasOwn(instances, id) ? field(instances, id) : undefined;
  const status = jsonAt(join(t3Home, 'caches', `${id}.json`));
  if (configured === undefined && status === undefined) return null;
  const driver = textOf(field(configured, 'driver')) || id;
  const claude = driver === CLAUDE_DRIVER;
  return {
    id,
    driver,
    claude,
    enabled: field(configured, 'enabled') !== false && field(status, 'enabled') !== false,
    signedIn: field(field(status, 'auth'), 'status') === 'authenticated',
    projects: claude ? join(claudeFolder(textOf(field(field(configured, 'config'), 'homePath')), home), 'projects') : null,
  };
}

/** The Claude folders the instances `ids` keep their transcripts in, once each, in order. */
export function t3ClaudeProjects(t3Home: string, home: string, ids: readonly string[]): string[] {
  const folders = ids.flatMap((id) => t3Instance(t3Home, home, id)?.projects ?? []);
  return [...new Set(folders)];
}
