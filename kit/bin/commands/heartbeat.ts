// `omni heartbeat [--end | --claimed]` — tells the Omni page this session is working (PRD 757's spec,
// "The heartbeat"). The plugin's `PostToolUse` hook runs it after every tool call, and its `SessionEnd`
// hook runs it with `--end`. It reads the hook's JSON on stdin (`session_id`, `cwd`); when stdin carries
// no `session_id` (empty, or a terminal), the session id is the resolver's (PRD 1831):
// `OMNI_SESSION_ID`, then `CLAUDE_CODE_SESSION_ID`, then the id stored for the checkout.
//
// Every other `omni` command starts it as a detached child with `--claimed` (PRD 1831, `../omni.ts`),
// once it has claimed the session's window itself: the child sends without claiming it again.
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
import { spawn as spawnProcess } from 'node:child_process';
import { askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import type { JsonObject } from '../../lib/ask/schema.ts';
import type { Env, Exec, FreeCommand, FreeIo, Vars } from '../io.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { beatsAfter, claimWindow, forgetWindow, HEARTBEAT_LIMIT_MS, readWork, startHeartbeat, windowDue } from '../../lib/ask/heartbeat.ts';
import type { HeartbeatSpawn } from '../../lib/ask/heartbeat.ts';
import { readInput } from '../../lib/ask/hook-input.ts';
import { isSafeId } from '../../lib/ask/local-state.ts';
import { dossierSwitch, loadConfig } from '../../lib/config.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { sessionIdOf } from '../../lib/dossier/session.ts';
import { processUnderTest } from '../../lib/env/read.ts';
import type { AgentSession } from '../../lib/env/read.ts';
import { findRoot } from '../../lib/init/repo.ts';

/** `fetch` held to one deadline shared by every request of the call, the renewal included. */
function withDeadline(fetch: Fetch, ms: number): Fetch {
  const deadline = AbortSignal.timeout(ms);
  return (url: string, init: RequestInit) => fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
}

/** Where this checkout's heartbeats go, or `null` when dossiers are off or this computer is not signed in.
 * Throws outside a repository with the kit. */
function heartbeatTarget(cwd: string, exec: Exec, tokens: TokenStore | undefined) {
  const root = findRoot(cwd, exec);
  const config = loadConfig(root);
  const toggle = dossierSwitch(config);
  const repo = config.repo.slug;
  if (!toggle.on || !repo) return null;
  const host = credentialsHost(toggle.askUrl);
  const store = tokens ?? homeTokens();
  if (!store.read(host)) return null;
  return { root, config, repo, askUrl: toggle.askUrl, host, store };
}

/** How a run treats the window: `end` forgets it, `claimed` finds it claimed by its starter, `beat` claims it. */
type Mode = 'beat' | 'end' | 'claimed';

/** Whether this run sends: `--end` always does, forgetting the session's window; `--claimed` always
 * does, its starter having claimed the window; a beat once a window. */
function sends(home: string, claudeSessionId: string, mode: Mode, now: () => number): boolean {
  if (mode === 'claimed') return true;
  if (mode === 'beat') return claimWindow(home, claudeSessionId, now());
  forgetWindow(home, claudeSessionId);
  return true;
}

/** The folder the session works in: the hook's `cwd`, else the command's. */
const workDir = (input: JsonObject, cwd: string): string => (typeof input.cwd === 'string' && input.cwd ? input.cwd : cwd);

/** What a test hands the heartbeat beyond `main()`'s own. */
type HeartbeatOptions = { stdin?: HookStdin; tokens?: TokenStore | undefined; fetch?: Fetch; now?: () => number };

async function beat({
  mode,
  cwd,
  exec,
  agentSession,
  stdin,
  tokens,
  fetch,
  now,
}: { mode: Mode; cwd: string; exec: Exec; agentSession: AgentSession | null; stdin: HookStdin; tokens: TokenStore | undefined; fetch: Fetch; now: () => number }): Promise<void> {
  const input = await readInput(stdin);
  const claudeSessionId = input?.session_id ?? sessionIdOf(agentSession, mainCheckout(cwd, exec));
  if (!isSafeId(claudeSessionId)) return;
  const target = heartbeatTarget(cwd, exec, tokens);
  if (!target) return;
  const { root, config, repo, askUrl, host, store } = target;
  if (!sends(mainCheckout(cwd, exec) ?? root, claudeSessionId, mode, now)) return;
  const end = mode === 'end';
  const work = end ? null : readWork({ cwd: workDir(input ?? {}, cwd), config, claudeSessionId, exec });
  const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch: withDeadline(fetch, HEARTBEAT_LIMIT_MS), callMs: HEARTBEAT_LIMIT_MS });
  await client.heartbeat({ claudeSessionId, repo, work, ended: end });
}

export const heartbeat = {
  withoutContext: true,
  async run(args: string[], { cwd, exec, vars, stdin = process.stdin, tokens, fetch = globalThis.fetch, now = Date.now }: FreeIo & HeartbeatOptions) {
    if (args.length > 1 || args.some((arg) => arg !== '--end' && arg !== '--claimed')) return 0;
    const mode: Mode = args[0] === '--end' ? 'end' : args[0] === '--claimed' ? 'claimed' : 'beat';
    try {
      await beat({ mode, cwd, exec, agentSession: vars.agentSession, stdin, tokens, fetch, now });
    } catch {
      // The page misses one heartbeat; the tool call goes on.
    }
    return 0;
  },
} satisfies FreeCommand;

/** What a test hands the heartbeat a command sends: what starts the child, the clock and the token store. */
export type HeartbeatSeams = { spawn?: HeartbeatSpawn; now?: () => number; tokens?: TokenStore };

/** What starts the child: the test's, else `spawn`, except under vitest, where nothing starts. */
const spawnOf = (seams: HeartbeatSeams): HeartbeatSpawn | null => seams.spawn ?? (processUnderTest() ? null : spawnProcess);

/** The token store: the test's, else the kit token's or this computer's sign-in. */
const tokensOf = (seams: HeartbeatSeams, vars: Vars): TokenStore => seams.tokens ?? homeTokens({ omniToken: vars.omniToken?.token ?? null });

/** The session whose window is due now, with the main checkout that keeps it, or `null`. Writes nothing. */
function dueSession(cwd: string, exec: Exec, vars: Vars, now: number): { home: string; sessionId: string } | null {
  const home = mainCheckout(cwd, exec);
  if (home === null) return null;
  const sessionId = sessionIdOf(vars.agentSession, home);
  return isSafeId(sessionId) && windowDue(home, sessionId, now) ? { home, sessionId } : null;
}

/**
 * The heartbeat any `omni` command sends (PRD 1831), run by `main()` after the command: when `argv` is
 * a command that beats, the switch is on, the session's window is due, dossiers are on and the
 * computer signed in, it claims the window and starts `omni heartbeat --claimed` (`script`), detached.
 * Never throws, never prints, never waits. With no `spawn` handed, nothing starts under vitest,
 * whatever environment the test hands `main()`.
 */
export function sendHeartbeat(
  argv: readonly string[],
  { cwd, exec, env, vars, script, seams }: { cwd: string; exec: Exec; env: Env; vars: Vars; script: string; seams: HeartbeatSeams },
): void {
  try {
    const spawn = spawnOf(seams);
    if (!spawn || !vars.heartbeat || !beatsAfter(argv)) return;
    const now = (seams.now ?? Date.now)();
    const due = dueSession(cwd, exec, vars, now);
    if (!due || !heartbeatTarget(cwd, exec, tokensOf(seams, vars))) return;
    if (claimWindow(due.home, due.sessionId, now)) startHeartbeat({ spawn, script, cwd, env });
  } catch {
    // No beat this time: the command ran, printed and exits as it does without one.
  }
}
