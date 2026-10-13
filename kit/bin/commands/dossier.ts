// `omni dossier open "<title>" | push <n> | link <n> | status` — a PRD's dossier on the Omni page (PRD 216's
// spec, "The kit"): its artifacts, every version of each, uploaded with the terminal's sign-in.
//
// - `open` opens a draft for this repository, sending the session id (PRD 1739,
//   `../../lib/dossier/session.ts`): `OMNI_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`, else the id
//   stored for the checkout, else one it generates and stores in the main checkout's
//   `.omni-loop/local/session.json`. It prints the draft's link, and records the draft in the main
//   checkout's `.omni-loop/local/dossiers.json` (`../../lib/dossier/local.ts`).
// - `push <n>` sends whichever of PRD n's `spec.md`, `plan.md`, `before-after.html` and `voice.json`
//   (PRD 822, as the `voice` artifact) exist, whole,
//   with the spec's title. It names the draft to number when one is recorded for it and the session
//   id, read in the same order but never generated (`../../lib/dossier/draft.ts`), prints the dossier's link and the versions it added, and records
//   the draft as numbered. A draft the server no longer has is forgotten, and the push goes by the key.
// - `link <n>` prints PRD n's link (PRD 413): it asks the app by the repository and the number, so it
//   works on a machine that never opened or pushed the dossier, and prints `none` when the app has
//   none. Only when the app cannot be reached does it fall back to a numbered entry for n in the local
//   record. It writes nothing.
// - `status` prints `on` with the switch's source, or `off` with the reason, and calls nothing.
// - `--kind visual|bug` (PRD 627), on `push` and `link`: issue n's fix instead of PRD n. `push` reads
//   the fix's folder (`../../lib/dossier/folder.ts`, `readFixFolder`), titles it after its issue (read
//   through `LoopReads`, PRD 1665: the Omni page; the folder's topic when that fails) and sends its kind; no draft is chosen or recorded, a
//   fix never having one. `link` asks for the fix's dossier, with no fallback to the local record, which
//   holds PRDs only. `--kind prd`, or no `--kind`, is the PRD's call, sent exactly as before.
// - `--kind concept` (PRD 1272), on `push` and `link`: concept n (its issue's number) instead. `push`
//   reads the concept's folder (`readConceptFolder`), titles it after concept.md's front matter, and
//   sends its record, vision tour, boards (a round each) and debate with its kind; no draft, and GitHub
//   is not asked. A concept.md the parser refuses sends nothing: `invalid concept.md: <errors>`, exit 1.
// - `--product <name>` (PRD 1364), on a PRD's `push` only: the product the brainstorm asked for, sent
//   with the push. The server applies the birth rule: on the dossier's first push, in a repository of
//   several products, the one named is the PRD's product; a repository in one product or none decides
//   alone, and a later push never changes it. It prints what a push without it prints. On a fix, a
//   concept or another verb, or blank, it is a usage error, exit 2.
//
// It never blocks the skill that runs it: every call has the contract's 5-second limit and one token
// refresh, and anything that stops it is exit 1 with one line — `off`, `no sign-in (omni signin)`,
// `unreachable`, `refused (<status>)`, `refused (403): <the server's reason>`, `too large: <file>` or
// `invalid concept.md: <errors>`.
// Exit 2 is the kit not installed here, a config that does not read, or arguments it cannot run.
//
// It runs before a context exists, like `ask`, so that a test can hand it `tokens` (the token store),
// `home` (where the real one lives), `fetch` and `callMs`, or `reads`, a `LoopReads` of its own; it
// loads the context itself.
import { AskCallError, type askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { field } from '../../lib/ask/schema.ts';
import type { Context } from '../../lib/context.ts';
import type { FixKind, TooLarge } from '../../lib/dossier/folder.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { dossierSwitch } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { chooseDraft } from '../../lib/dossier/draft.ts';
import { fixTitle, readConceptFolder, readDossierFolder, readFixFolder, TITLE_MAX } from '../../lib/dossier/folder.ts';
import { forgetDraft, mainCheckout, markNumbered, readDossiers, recordDraft } from '../../lib/dossier/local.ts';
import { openSessionId, sessionIdOf } from '../../lib/dossier/session.ts';
import type { AgentSession } from '../../lib/env/read.ts';
import type { IssueNumber, PrdNumber } from '../../lib/ids.ts';
import { omniLoopReads } from '../../lib/loop-reads/omni.ts';
import type { LoopReads } from '../../lib/loop-reads/port.ts';
import { isOneOf } from '../../lib/narrow.ts';
import { issueArg, parseArgs, prdArg, println, usageError } from '../args.ts';
import { PRODUCT_USAGE, productCallOf, runProductCall } from './dossier-product.ts';
import type { ProductCall } from './dossier-product.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';

/** What a test hands `omni dossier` beyond `main()`'s own. */
type DossierOptions = {
  reads?: LoopReads | undefined;
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  now?: () => number;
  /** PRD 1548: the scratch space `get` writes in; the system's when not given. */
  scratch?: string | undefined;
};

/** What each verb is handed once the context, the client and the sign-in are known. */
type VerbIo = {
  ctx: Context;
  repo: string;
  client: ReturnType<typeof askClient>;
  /** The loop's reads: a fix's issue title. */
  reads: LoopReads;
  home: string | null;
  /** The session the variables name, before the stored id (PRD 1739). */
  session: AgentSession | null;
  stdout: Out;
  stderr: Out;
  now: () => number;
};

const USAGE = `usage: omni dossier open "<title>" | omni dossier push <n> [--kind prd|visual|bug|concept] [--product <name>] | omni dossier link <n> [--kind prd|visual|bug|concept] | omni dossier status | ${PRODUCT_USAGE}`;
const KINDS = ['prd', 'visual', 'bug', 'concept'] as const;
/** What a dossier other than a PRD's is of: a fix of its kind, or a concept (PRD 1272), each keyed by its issue. */
type IssueKind = FixKind | 'concept';
/** How long reading a fix's issue title may take. */
const ISSUE_TITLE_MS = 5000;
const NO_SIGN_IN = 'no sign-in (omni signin)';

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

async function open(title: string, { ctx, repo, client, home, session, stdout, stderr, now }: VerbIo): Promise<number> {
  const where = home ?? ctx.root;
  const claudeSessionId = openSessionId(session, where);
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
  recordDraft(where, { id, url, claudeSessionId, prd: null, openedAt: new Date(now()).toISOString() });
  println(stdout, url);
  return 0;
}

/** Issue n's title, as the loop's reads answer it, or null when they cannot: the push then titles the
 * fix after its folder. */
async function issueTitle(issue: IssueNumber, { repo, reads }: Pick<VerbIo, 'repo' | 'reads'>): Promise<string | null> {
  try {
    const title = (await reads.issue(repo, issue)).title.trim();
    return title || null;
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
async function pushFix(issue: IssueNumber, kind: FixKind, { ctx, repo, client, reads, stdout, stderr }: VerbIo): Promise<number> {
  const folder = readFixFolder(ctx, kind, issue);
  if (!folder) throw usageError(`omni dossier push: issue ${issue} has no ${kind} fix folder.`);
  // Titled after its issue, asked of GitHub only once the folder is there; after the folder when it cannot.
  const title = fixTitle(await issueTitle(issue, { repo, reads }), folder.title);
  let result;
  try {
    result = await client.pushDossier({ repo, prd: issue, kind, title, artifacts: folder.artifacts.map(({ kind: k, content }) => ({ kind: k, content })) });
  } catch (error) {
    println(stderr, skipLine(error));
    return 1;
  }
  return reportPush(result, folder.tooLarge, { stdout, stderr });
}

async function push(prd: PrdNumber, product: string | null, { ctx, repo, client, home, session, stdout, stderr }: VerbIo): Promise<number> {
  const folder = readDossierFolder(ctx, prd);
  if (!folder) throw usageError(`omni dossier push: PRD ${prd} has no inbox or shipped folder.`);
  const where = home ?? ctx.root;
  const draft = chooseDraft(readDossiers(where), { prd, claudeSessionId: sessionIdOf(session, where) });
  const body = { repo, prd, title: folder.title, product, artifacts: folder.artifacts.map(({ kind, content }) => ({ kind, content })) };

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
function recordedLink(home: string | null, prd: PrdNumber | IssueNumber, kind: string) {
  if (!home || kind !== 'prd') return null;
  return readDossiers(home).filter((entry) => entry.prd === prd).at(-1) ?? null;
}

/** Concept n's folder, sent with its kind (PRD 1272). No draft, and GitHub is not asked: its title is
 * concept.md's. A concept.md the parser refuses sends nothing. */
async function pushConcept(issue: IssueNumber, { ctx, repo, client, stdout, stderr }: VerbIo): Promise<number> {
  const read = readConceptFolder(ctx, issue);
  if (!read) throw usageError(`omni dossier push: issue ${issue} has no concept folder.`);
  if (!read.ok) {
    println(stderr, `invalid concept.md: ${read.errors.join(' ')}`);
    return 1;
  }
  const { folder } = read;
  let result;
  try {
    result = await client.pushDossier({ repo, prd: issue, kind: 'concept', title: folder.title, artifacts: folder.artifacts.map(({ kind, content }) => ({ kind, content })) });
  } catch (error) {
    println(stderr, skipLine(error));
    return 1;
  }
  return reportPush(result, folder.tooLarge, { stdout, stderr });
}

/** PRD n's link, or with a fix's kind issue n's: a fix's dossier is keyed by its issue, so `prd` is
 * a PRD's number or an issue's. */
async function link(prd: PrdNumber | IssueNumber, kind: string, { repo, client, home, stdout, stderr }: VerbIo): Promise<number> {
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

/** What `push` and `link` name: PRD n, or with `--kind visual|bug|concept` issue n's fix or concept. */
type Named = { kind: 'prd'; prd: PrdNumber } | { kind: IssueKind; issue: IssueNumber };

/** `<n>` read as the kind names it: a PRD's number, or a fix's issue. */
function namedBy(verb: string, kind: 'prd' | IssueKind, value: string | undefined): Named {
  const command = `dossier ${verb}`;
  return kind === 'prd' ? { kind, prd: prdArg(command, '<n>', value) } : { kind, issue: issueArg(command, '<n>', value) };
}

/** The product `--product` names, trimmed (null when it names none); only a PRD's push takes one. */
function productOf(flag: string | undefined, verb: string, kind: 'prd' | IssueKind): string | null {
  if (flag === undefined) return null;
  const product = flag.trim();
  if (verb !== 'push' || kind !== 'prd' || product === '') throw usageError(USAGE);
  return product;
}

/** The kind `--kind` names (prd when it names none); only push and link take one. */
function kindOf(flag: string | undefined, numbered: boolean): 'prd' | IssueKind {
  if (flag === undefined) return 'prd';
  if (!numbered || !isOneOf(KINDS, flag)) throw usageError(USAGE);
  return flag;
}

/** A verb on a product PRD (PRD 1548, `./dossier-product.ts`): it needs dossiers on and a sign-in, but no
 * repository slug, which it sends only when set. */
async function runProduct(
  call: ProductCall,
  { cwd, stdout, stderr, exec, tokens, home, fetch, callMs, now, scratch }: Pick<FreeIo, 'cwd' | 'stdout' | 'stderr' | 'exec'> & DossierOptions & { fetch: Fetch; now: () => number },
): Promise<number> {
  const ctx = loadContext(cwd, { exec });
  const toggle = dossierSwitch(ctx.config);
  if (!toggle.on) {
    println(stderr, 'off');
    return 1;
  }
  const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
  if (!client) {
    println(stderr, NO_SIGN_IN);
    return 1;
  }
  const io = { repo: ctx.config.repo.slug, client, home: mainCheckout(ctx.root, exec) ?? ctx.root, scratch, stdout, stderr, now };
  return runProductCall(call, io, addedLine);
}

export const dossier = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, stderr, exec, vars, reads, tokens, home, fetch = globalThis.fetch, callMs, now = Date.now, scratch }: FreeIo & DossierOptions,
  ) {
    const { positional, flags } = parseArgs('dossier', args, { values: ['kind', 'product', 'from', 'title'], booleans: ['new'] });
    const [verb = '', ...rest] = positional;
    const productCall = productCallOf(verb, rest, flags);
    if (productCall && flags.kind !== undefined) throw usageError(`usage: ${PRODUCT_USAGE}`);
    if (productCall) return runProduct(productCall, { cwd, stdout, stderr, exec, tokens, home, fetch, callMs, now, scratch });
    const [first = ''] = rest;
    const title = verb === 'open' && rest.length === 1 ? first.trim().slice(0, TITLE_MAX) : '';
    const numbered = ['push', 'link'].includes(verb);
    const runnable = (verb === 'status' && rest.length === 0) || (numbered && rest.length === 1) || title.length > 0;
    if (!runnable) throw usageError(USAGE);
    const kind = kindOf(flags.kind, numbered);
    const product = productOf(flags.product, verb, kind);
    if (verb === 'link' && !/^[1-9]\d*$/.test(String(rest[0]))) throw usageError(USAGE);
    const named = numbered ? namedBy(verb, kind, rest[0]) : null;

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

    const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
    if (!client) {
      println(stderr, NO_SIGN_IN);
      return 1;
    }
    const loop = reads ?? omniLoopReads({ askUrl: toggle.askUrl, tokens, home, fetch, callMs: callMs ?? ISSUE_TITLE_MS });
    const options: VerbIo = { ctx, repo, client, reads: loop, home: mainCheckout(ctx.root, exec), session: vars.agentSession, stdout, stderr, now };
    // `named` is set for `push` and `link`, the two verbs that read a number, and null for `open`.
    if (named === null) return open(title, options);
    if (verb === 'link') return link(named.kind === 'prd' ? named.prd : named.issue, named.kind, options);
    if (named.kind === 'concept') return pushConcept(named.issue, options);
    if (named.kind !== 'prd') return pushFix(named.issue, named.kind, options);
    return push(named.prd, product, options);
  },
} satisfies FreeCommand;
