// `omni dossier open "<title>" | push <n> | link <n> | status` — a PRD's dossier on the Omni page (PRD 216's
// spec, "The kit"): its artifacts, every version of each, uploaded with the terminal's sign-in.
//
// - `open` opens a draft for this repository, sending the Claude session id `CLAUDE_CODE_SESSION_ID`
//   gives when it is set, prints the draft's link, and records the draft in the main checkout's
//   `.omni-loop/local/dossiers.json` (`../../lib/dossier/local.ts`).
// - `push <n>` sends whichever of PRD n's `spec.md`, `plan.md`, `before-after.html` and `voice.json`
//   (PRD 822, as the `voice` artifact) exist, whole,
//   with the spec's title. It names the draft to number when one is recorded for it
//   (`../../lib/dossier/draft.ts`), prints the dossier's link and the versions it added, and records
//   the draft as numbered. A draft the server no longer has is forgotten, and the push goes by the key.
// - `link <n>` prints PRD n's link (PRD 413): it asks the app by the repository and the number, so it
//   works on a machine that never opened or pushed the dossier, and prints `none` when the app has
//   none. Only when the app cannot be reached does it fall back to a numbered entry for n in the local
//   record. It writes nothing.
// - `status` prints `on` with the switch's source, or `off` with the reason, and calls nothing.
// - `--kind visual|bug` (PRD 627), on `push` and `link`: issue n's fix instead of PRD n. `push` reads
//   the fix's folder (`../../lib/dossier/folder.ts`, `readFixFolder`), titles it after its issue (asked
//   of `gh`; the folder's topic when that fails) and sends its kind; no draft is chosen or recorded, a
//   fix never having one. `link` asks for the fix's dossier, with no fallback to the local record, which
//   holds PRDs only. `--kind prd`, or no `--kind`, is the PRD's call, sent exactly as before.
//
// It never blocks the skill that runs it: every call has the contract's 5-second limit and one token
// refresh, and anything that stops it is exit 1 with one line — `off`, `no sign-in (omni signin)`,
// `unreachable`, `refused (<status>)`, `refused (403): <the server's reason>` or `too large: <file>`.
// Exit 2 is the kit not installed here, a config that does not read, or arguments it cannot run.
//
// It runs before a context exists, like `ask`, so that a test can hand it `tokens` (the token store),
// `home` (where the real one lives), `fetch` and `callMs`; it loads the context itself.
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { field } from '../../lib/ask/schema.ts';
import type { Context } from '../../lib/context.ts';
import type { FixKind, TooLarge } from '../../lib/dossier/folder.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { dossierSwitch } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { chooseDraft } from '../../lib/dossier/draft.ts';
import { fixTitle, readDossierFolder, readFixFolder, TITLE_MAX } from '../../lib/dossier/folder.ts';
import { forgetDraft, mainCheckout, markNumbered, readDossiers, recordDraft } from '../../lib/dossier/local.ts';
import { isOneOf } from '../../lib/narrow.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';
import type { Env, Exec, FreeCommand, FreeIo, Out } from '../io.ts';

/** What a test hands `omni dossier` beyond `main()`'s own. */
type DossierOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  now?: () => number;
};

/** What each verb is handed once the context, the client and the sign-in are known. */
type VerbIo = {
  ctx: Context;
  repo: string;
  client: ReturnType<typeof askClient>;
  exec: Exec;
  home: string | null;
  claudeSessionId: string | null;
  stdout: Out;
  stderr: Out;
  now: () => number;
};

const USAGE = 'usage: omni dossier open "<title>" | omni dossier push <n> [--kind prd|visual|bug] | omni dossier link <n> [--kind prd|visual|bug] | omni dossier status';
const KINDS = ['prd', 'visual', 'bug'] as const;
/** How long asking GitHub for a fix's issue title may take. */
const ISSUE_TITLE_MS = 5000;
const NO_SIGN_IN = 'no sign-in (omni signin)';

/** The Claude session id this terminal runs in, or null: sent only when it could be a real one. */
function claudeSessionOf(env: Env | undefined): string | null {
  const id = typeof env?.CLAUDE_CODE_SESSION_ID === 'string' ? env.CLAUDE_CODE_SESSION_ID.trim() : '';
  return id.length >= 1 && id.length <= TITLE_MAX ? id : null;
}

/** The one line a failed call is reported with: a 403 carries the server's reason (PRD 459), when it
 * gave one — which workspace owns the repository, or how to get one. */
function skipLine(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  return error.status === 403 && error.reason ? `refused (403): ${error.reason}` : `refused (${error.status})`;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** One added version of the push's reply, `{ kind, version }`, or `null` when it is not one. */
function versionOf(entry: unknown): { kind: string; version: number } | null {
  const kind = field(entry, 'kind');
  const version = field(entry, 'version');
  return isText(kind) && typeof version === 'number' && Number.isInteger(version) ? { kind, version } : null;
}

/** `added: spec v2 · unchanged: before-after, plan`, from the push's reply. */
export function addedLine({ added, unchanged }: { added?: unknown; unchanged?: unknown }): string {
  const got = Array.isArray(added) ? added.flatMap((a: unknown) => versionOf(a) ?? []) : [];
  const kept = Array.isArray(unchanged) ? unchanged.filter(isText) : [];
  const parts = [`added: ${got.length ? got.map(({ kind, version }) => `${kind} v${version}`).join(', ') : 'none'}`];
  if (kept.length) parts.push(`unchanged: ${kept.join(', ')}`);
  return parts.join(' · ');
}

async function open(title: string, { ctx, repo, client, home, claudeSessionId, stdout, stderr, now }: VerbIo): Promise<number> {
  let draft: unknown;
  try {
    draft = await client.openDossier({ title, repo, claudeSessionId });
  } catch (error) {
    println(stderr, skipLine(error));
    return 1;
  }
  const id = field(draft, 'id');
  const url = field(draft, 'url');
  if (!isText(id) || !isText(url)) {
    println(stderr, 'refused (no dossier in the reply)');
    return 1;
  }
  recordDraft(home ?? ctx.root, { id, url, claudeSessionId, prd: null, openedAt: new Date(now()).toISOString() });
  println(stdout, url);
  return 0;
}

/** Issue n's title, as `gh` reads it, or null when it cannot: the push then titles the fix after its folder. */
function issueTitle(issue: number, { ctx, repo, exec }: Pick<VerbIo, 'ctx' | 'repo' | 'exec'>): string | null {
  try {
    const title = exec('gh', ['issue', 'view', String(issue), '--repo', repo, '--json', 'title', '--jq', '.title'], {
      cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: ISSUE_TITLE_MS,
    });
    return typeof title === 'string' && title.trim() ? title.trim() : null;
  } catch {
    return null;
  }
}

/** The dossier's link and the versions the push added, or the one line that says why not. */
function reportPush(result: unknown, tooLarge: readonly TooLarge[], { stdout, stderr }: Pick<VerbIo, 'stdout' | 'stderr'>): number {
  const url = field(result, 'url');
  if (!isText(field(result, 'id')) || !isText(url)) {
    println(stderr, 'refused (no dossier in the reply)');
    return 1;
  }
  println(stdout, url);
  println(stdout, addedLine({ added: field(result, 'added'), unchanged: field(result, 'unchanged') }));
  for (const { path } of tooLarge) println(stderr, `too large: ${path}`);
  return tooLarge.length ? 1 : 0;
}

/** Issue n's fix of `kind`: its folder, sent with its kind. No draft: a fix never has one. */
async function pushFix(issue: number, kind: FixKind, { ctx, repo, client, exec, stdout, stderr }: VerbIo): Promise<number> {
  const folder = readFixFolder(ctx, kind, issue);
  if (!folder) throw usageError(`omni dossier push: issue ${issue} has no ${kind} fix folder.`);
  // Titled after its issue, asked of GitHub only once the folder is there; after the folder when it cannot.
  const title = fixTitle(issueTitle(issue, { ctx, repo, exec }), folder.title);
  let result;
  try {
    result = await client.pushDossier({ repo, prd: issue, kind, title, artifacts: folder.artifacts.map(({ kind: k, content }) => ({ kind: k, content })) });
  } catch (error) {
    println(stderr, skipLine(error));
    return 1;
  }
  return reportPush(result, folder.tooLarge, { stdout, stderr });
}

async function push(prd: number, { ctx, repo, client, home, claudeSessionId, stdout, stderr }: VerbIo): Promise<number> {
  const folder = readDossierFolder(ctx, prd);
  if (!folder) throw usageError(`omni dossier push: PRD ${prd} has no inbox or shipped folder.`);
  const where = home ?? ctx.root;
  const draft = chooseDraft(readDossiers(where), { prd, claudeSessionId });
  const body = { repo, prd, title: folder.title, artifacts: folder.artifacts.map(({ kind, content }) => ({ kind, content })) };

  let result: unknown;
  try {
    result = await client.pushDossier({ ...body, draftId: draft?.id ?? null });
  } catch (error) {
    if (!(draft && error instanceof AskCallError && error.status === 404)) {
      println(stderr, skipLine(error));
      return 1;
    }
    // The draft is gone (its opener deleted it): the push reaches PRD n's dossier by its key.
    try {
      result = await client.pushDossier({ ...body, draftId: null });
    } catch (again) {
      println(stderr, skipLine(again));
      return 1;
    }
    forgetDraft(where, draft.id);
  }
  const id = field(result, 'id');
  const url = field(result, 'url');
  if (!isText(id) || !isText(url)) return reportPush(result, [], { stdout, stderr });
  if (draft && readDossiers(where).some((entry) => entry.id === draft.id)) {
    markNumbered(where, draft.id, { prd, id, url });
  }
  return reportPush(result, folder.tooLarge, { stdout, stderr });
}

/** The last link this computer recorded for PRD n, or null. It records PRDs only: a fix has none. */
function recordedLink(home: string | null, prd: number, kind: string) {
  if (!home || kind !== 'prd') return null;
  return readDossiers(home).filter((entry) => entry.prd === prd).at(-1) ?? null;
}

async function link(prd: number, kind: string, { repo, client, home, stdout, stderr }: VerbIo): Promise<number> {
  let found: unknown;
  try {
    found = await client.findDossier({ repo, prd, kind });
  } catch (error) {
    if (!(error instanceof AskCallError)) throw error;
    if (error.status === 404) {
      println(stderr, 'none');
      return 1;
    }
    // The app cannot be reached: a link this computer recorded for PRD n is the best there is.
    const recorded = error.status === null ? recordedLink(home, prd, kind) : null;
    if (!recorded) {
      println(stderr, skipLine(error));
      return 1;
    }
    found = recorded;
  }
  const url = field(found, 'url');
  if (!isText(url)) {
    println(stderr, 'refused (no dossier in the reply)');
    return 1;
  }
  println(stdout, url);
  return 0;
}

/** The kind `--kind` names (prd when it names none); only push and link take one. */
function kindOf(flag: string | undefined, numbered: boolean): 'prd' | FixKind {
  if (flag === undefined) return 'prd';
  if (!numbered || !isOneOf(KINDS, flag)) throw usageError(USAGE);
  return flag;
}

export const dossier = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, stderr, exec, env, tokens, home, fetch = globalThis.fetch, callMs, now = Date.now }: FreeIo & DossierOptions,
  ) {
    const { positional, flags } = parseArgs('dossier', args, { values: ['kind'] });
    const [verb = '', ...rest] = positional;
    const [first = ''] = rest;
    const title = verb === 'open' && rest.length === 1 ? first.trim().slice(0, TITLE_MAX) : '';
    const numbered = ['push', 'link'].includes(verb);
    const runnable = (verb === 'status' && rest.length === 0) || (numbered && rest.length === 1) || title.length > 0;
    if (!runnable) throw usageError(USAGE);
    const kind = kindOf(flags.kind, numbered);
    if (verb === 'link' && !/^[1-9]\d*$/.test(String(rest[0]))) throw usageError(USAGE);
    const prd = numbered ? positiveInt(`dossier ${verb}`, '<n>', rest[0]) : null;

    const ctx = loadContext(cwd, { exec });
    const toggle = dossierSwitch(ctx.config);
    if (verb === 'status') {
      println(stdout, `${toggle.on ? 'on' : 'off'} (${toggle.reason})`);
      return 0;
    }
    if (!toggle.on) {
      println(stderr, 'off');
      return 1;
    }
    const repo = ctx.config.repo.slug;
    if (!repo) throw usageError(`omni dossier: no repository slug — set repo.slug in the config.`);

    const host = credentialsHost(toggle.askUrl);
    const store = tokens ?? homeTokens(home ? { home } : undefined);
    if (!store.read(host)) {
      println(stderr, NO_SIGN_IN);
      return 1;
    }
    const client = askClient({ baseUrl: toggle.askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) });
    const options: VerbIo = { ctx, repo, client, exec, home: mainCheckout(ctx.root, exec), claudeSessionId: claudeSessionOf(env), stdout, stderr, now };
    // `prd` is a number for `push` and `link`, the two verbs that read it, and null for `open`.
    if (prd === null) return open(title, options);
    if (verb === 'link') return link(prd, kind, options);
    if (verb === 'push' && kind !== 'prd') return pushFix(prd, kind, options);
    return push(prd, options);
  },
} satisfies FreeCommand;
