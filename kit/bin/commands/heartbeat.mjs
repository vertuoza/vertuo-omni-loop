// `omni heartbeat [--end]` — tells the Omni page this Claude session is working (PRD 757's spec, "The
// heartbeat"). The plugin's `PostToolUse` hook runs it after every tool call, and its `SessionEnd`
// hook runs it with `--end`. It reads the hook's JSON on stdin (`session_id`, `cwd`).
//
// - It sends only when this computer is signed in to `ask.url` and dossiers are on
//   (`dossier.enabled` true, `ask.url` set). Ask mode on or off makes no difference.
// - Without `--end`, it sends `POST /api/ask/heartbeat {claudeSessionId, repo, work}` at most once per
//   minute per Claude session (`../../lib/ask/heartbeat.mjs`); a run inside the window does no
//   network work. `work` is what the work finder names.
// - With `--end`, it sends `{claudeSessionId, repo, work: null, ended: true}` once, and forgets the
//   session's window.
// - The call has a 2-second limit in all and no retry. It prints nothing and exits 0, whatever
//   happens: no config, no sign-in, a server that is down, older than the call, or refusing it.
//
// It runs before a context exists, like `ask`; a test also passes `stdin` (a string), `tokens` (the
// token store), `fetch` and `now`.
import { askClient } from '../../lib/ask/client.mjs';
import { homeTokens } from '../../lib/ask/client-tokens.mjs';
import { credentialsHost } from '../../lib/ask/credentials.mjs';
import { claimWindow, forgetWindow, HEARTBEAT_LIMIT_MS, readWork } from '../../lib/ask/heartbeat.mjs';
import { isSafeId } from '../../lib/ask/local-state.mjs';
import { dossierSwitch, loadConfig } from '../../lib/config.mjs';
import { mainCheckout } from '../../lib/dossier/local.mjs';
import { findRoot } from '../../lib/init/repo.mjs';

/** The hook's input: stdin parsed as a JSON object, or `null`. A terminal is never read. */
async function readInput(stdin) {
  let text = '';
  if (typeof stdin === 'string') {
    text = stdin;
  } else {
    if (!stdin || stdin.isTTY) return null;
    stdin.setEncoding?.('utf8');
    for await (const chunk of stdin) text += chunk;
  }
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** `fetch` held to one deadline shared by every request of the call, the renewal included. */
function withDeadline(fetch, ms) {
  const deadline = AbortSignal.timeout(ms);
  return (url, init = {}) => fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
}

async function beat({ end, cwd, exec, stdin, tokens, fetch, now }) {
  const input = await readInput(stdin);
  const claudeSessionId = input?.session_id;
  if (!isSafeId(claudeSessionId)) return;
  const root = findRoot(cwd, exec);
  const config = loadConfig(root);
  const toggle = dossierSwitch(config);
  const repo = config.repo?.slug;
  if (!toggle.on || !repo) return;
  const host = credentialsHost(toggle.askUrl);
  const store = tokens ?? homeTokens();
  if (!store.read(host)) return;
  const home = mainCheckout(cwd, exec) ?? root;
  if (end) forgetWindow(home, claudeSessionId);
  else if (!claimWindow(home, claudeSessionId, now())) return;
  const where = typeof input.cwd === 'string' && input.cwd ? input.cwd : cwd;
  const work = end ? null : readWork({ cwd: where, config, claudeSessionId, exec });
  const client = askClient({ baseUrl: toggle.askUrl, host, tokens: store, fetch: withDeadline(fetch, HEARTBEAT_LIMIT_MS), callMs: HEARTBEAT_LIMIT_MS });
  await client.heartbeat({ claudeSessionId, repo, work, ended: end });
}

export const heartbeat = {
  withoutContext: true,
  async run(args, { cwd, exec, stdin = process.stdin, tokens, fetch = globalThis.fetch, now = Date.now }) {
    if (args.some((arg) => arg !== '--end')) return 0;
    try {
      await beat({ end: args.includes('--end'), cwd, exec, stdin, tokens, fetch, now });
    } catch {
      // The page misses one heartbeat; the tool call goes on.
    }
    return 0;
  },
};
