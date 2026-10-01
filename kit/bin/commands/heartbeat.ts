// `omni heartbeat [--end]` — tells the Omni page this Claude session is working (PRD 757's spec, "The
// heartbeat"). The plugin's `PostToolUse` hook runs it after every tool call, and its `SessionEnd`
// hook runs it with `--end`. It reads the hook's JSON on stdin (`session_id`, `cwd`).
//
// - It sends only when this computer is signed in to `ask.url` and dossiers are on
//   (`dossier.enabled` true, `ask.url` set). Ask mode on or off makes no difference.
// - Without `--end`, it sends `POST /api/ask/heartbeat {claudeSessionId, repo, work}` at most once per
//   minute per Claude session (`../../lib/ask/heartbeat.ts`); a run inside the window does no
//   network work. `work` is what the work finder names.
// - With `--end`, it sends `{claudeSessionId, repo, work: null, ended: true}` once, and forgets the
//   session's window.
// - The call has a 2-second limit in all and no retry. It prints nothing and exits 0, whatever
//   happens: no config, no sign-in, a server that is down, older than the call, or refusing it.
//
// It runs before a context exists, like `ask`; a test also passes `stdin` (a string), `tokens` (the
// token store), `fetch` and `now`.
import { askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import type { JsonObject } from '../../lib/ask/schema.ts';
import type { Exec, FreeCommand, FreeIo } from '../io.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { claimWindow, forgetWindow, HEARTBEAT_LIMIT_MS, readWork } from '../../lib/ask/heartbeat.ts';
import { readInput } from '../../lib/ask/hook-input.ts';
import { isSafeId } from '../../lib/ask/local-state.ts';
import { dossierSwitch, loadConfig } from '../../lib/config.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { findRoot } from '../../lib/init/repo.ts';

/** `fetch` held to one deadline shared by every request of the call, the renewal included. */
function withDeadline(fetch: Fetch, ms: number): Fetch {
  const deadline = AbortSignal.timeout(ms);
  return (url: string, init: RequestInit = {}) => fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
}

/** Where this checkout's heartbeats go, or `null` when dossiers are off or this computer is not signed in. */
function targetOf(cwd: string, exec: Exec, tokens: TokenStore | undefined) {
  const root = findRoot(cwd, exec);
  const config = loadConfig(root);
  const toggle = dossierSwitch(config);
  const repo = config.repo?.slug;
  if (!toggle.on || !repo) return null;
  const host = credentialsHost(toggle.askUrl);
  const store = tokens ?? homeTokens();
  if (!store.read(host)) return null;
  return { root, config, repo, askUrl: toggle.askUrl, host, store };
}

/** Whether this run sends: `--end` always does, forgetting the session's window; a beat once a window. */
function claimed(home: string, claudeSessionId: string, end: boolean, now: () => number): boolean {
  if (!end) return claimWindow(home, claudeSessionId, now());
  forgetWindow(home, claudeSessionId);
  return true;
}

/** The folder the session works in: the hook's `cwd`, else the command's. */
const workDir = (input: JsonObject, cwd: string): string => (typeof input.cwd === 'string' && input.cwd ? input.cwd : cwd);

/** What a test hands the heartbeat beyond `main()`'s own. */
type HeartbeatOptions = { stdin?: HookStdin; tokens?: TokenStore | undefined; fetch?: Fetch; now?: () => number };

async function beat({
  end,
  cwd,
  exec,
  stdin,
  tokens,
  fetch,
  now,
}: { end: boolean; cwd: string; exec: Exec; stdin: HookStdin; tokens: TokenStore | undefined; fetch: Fetch; now: () => number }): Promise<void> {
  const input = await readInput(stdin);
  const claudeSessionId = input?.session_id;
  if (!isSafeId(claudeSessionId)) return;
  const target = targetOf(cwd, exec, tokens);
  if (!target) return;
  const { root, config, repo, askUrl, host, store } = target;
  if (!claimed(mainCheckout(cwd, exec) ?? root, claudeSessionId, end, now)) return;
  const work = end || !input ? null : readWork({ cwd: workDir(input, cwd), config, claudeSessionId, exec });
  const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch: withDeadline(fetch, HEARTBEAT_LIMIT_MS), callMs: HEARTBEAT_LIMIT_MS });
  await client.heartbeat({ claudeSessionId, repo, work, ended: end });
}

export const heartbeat = {
  withoutContext: true,
  async run(args: string[], { cwd, exec, stdin = process.stdin, tokens, fetch = globalThis.fetch, now = Date.now }: FreeIo & HeartbeatOptions) {
    if (args.some((arg) => arg !== '--end')) return 0;
    try {
      await beat({ end: args.includes('--end'), cwd, exec, stdin, tokens, fetch, now });
    } catch {
      // The page misses one heartbeat; the tool call goes on.
    }
    return 0;
  },
} satisfies FreeCommand;
