// `omni dossier`'s verbs on a product PRD (PRD 1548 s2): a product PRD (`mobile-12`) is a dossier with no
// home repository, so its files move through these verbs, never through a folder of the delivery tree.
//
// - `push --product <key> --new [--from <dir>] [--title "<title>"]` creates the product's next PRD and
//   prints its id, `mobile-12`, then its link and the versions added. It sends the files of `<dir>`
//   (`../../lib/dossier/product-prd.ts`, `readFilesFolder`), titled after the spec there, or `--title`.
// - `push <key>-<n> [--from <dir>] [--title "<title>"]` saves the edited files of `<dir>` as new versions
//   of that PRD, printing the same three lines. With no title to give it, the PRD keeps the one its page
//   has, read first.
// - `get <key>-<n> <kind>` writes the latest version of one of a PRD's kinds (spec, plan, before-after,
//   voice) to a new scratch folder, outside every repository, under its file name, and prints its path
//   then `sha256 <hash>`. The hash is the kit's own of the content, and a content that does not hash as
//   the server says is refused. Each version read is kept as the last-read copy `omni prd <id> --show`
//   answers from while the server is down; `get` never does: while the server is down it holds, exit 1.
//
// Each sends the repository it runs from (`repo.slug`, when set), which only chooses between two of the
// caller's workspaces holding the key. Exit 1 is one line, as every other verb's (`off`, `no sign-in`,
// `unreachable`, `refused (<status>)`, `none`, `held · …`, `too large: <file>`); exit 2 a usage error.
import { AskCallError } from '../../lib/ask/client.ts';
import type { askClient } from '../../lib/ask/client.ts';
import { field } from '../../lib/ask/schema.ts';
import { UNREACHABLE_LINE } from '../../lib/approval/approval.ts';
import type { ArtifactKind } from '../../lib/dossier/folder.ts';
import { sha256 } from '../../lib/dossier/folder.ts';
import { isPrdKind, parseLatest, PRD_KINDS, readFilesFolder, rememberLatest, writeScratch } from '../../lib/dossier/product-prd.ts';
import { isProductPrdId, parsePrdId, parseProductPrdId, productPrdParts } from '../../lib/ids.ts';
import type { ProductPrdId } from '../../lib/ids.ts';
import { println, usageError } from '../args.ts';
import type { Out } from '../io.ts';

/** A verb on a product PRD, read from the arguments: a push to the product keyed `key`'s PRD `seq`, or to
 * its next one, created, when `seq` is null; or a get of one kind of PRD `id`. */
export type ProductCall =
  | { verb: 'push'; key: string; seq: number | null; from: string | null; title: string | null }
  | { verb: 'get'; id: ProductPrdId; kind: ArtifactKind };

/** What a product PRD's verb is handed once the context, the client and the sign-in are known. */
export type ProductIo = {
  repo: string | null;
  client: ReturnType<typeof askClient>;
  /** The main checkout, where the last-read copies are kept. */
  home: string;
  /** The scratch space `get` writes in: the system's, unless a test gives its own. */
  scratch: string | undefined;
  stdout: Out;
  stderr: Out;
  now: () => number;
};

export const PRODUCT_USAGE =
  'omni dossier push --product <key> --new [--from <dir>] [--title "<title>"] | omni dossier push <key>-<n> [--from <dir>] [--title "<title>"] | omni dossier get <key>-<n> <kind>';

/** The flags only a product PRD's verbs take. */
type ProductFlags = { product?: string; from?: string; title?: string; new?: true };

/** `value` read as a product PRD's id, or the usage error that names it. */
function productIdArg(value: string | undefined): ProductPrdId | null {
  if (value === undefined || /^\d+$/.test(value)) return null;
  let id;
  try {
    id = parsePrdId(value);
  } catch (error) {
    throw usageError(`omni dossier: ${error instanceof Error ? error.message : String(error)}`);
  }
  return isProductPrdId(id) ? id : null;
}

/** A product's key, as `--product` names one with `--new`, or the usage error. */
function keyArg(value: string | undefined): string {
  const key = value?.trim() ?? '';
  try {
    return productPrdParts(parseProductPrdId(`${key}-1`)).key;
  } catch {
    throw usageError(`omni dossier: --product with --new is a product's key, lowercase kebab-case as mobile, got "${key}".`);
  }
}

const productUsage = () => usageError(`usage: ${PRODUCT_USAGE}`);

/** `get <key>-<n> <kind>`, read. */
function getCallOf(rest: readonly string[]): ProductCall {
  const [first, kind, ...more] = rest;
  const id = productIdArg(first);
  if (!id || !isPrdKind(kind) || more.length > 0) throw usageError(`usage: omni dossier get <key>-<n> <${PRD_KINDS.join('|')}>`);
  return { verb: 'get', id, kind };
}

/** `push --product <key> --new` or `push <key>-<n>`, read; null for a push of anything else. */
function pushCallOf(rest: readonly string[], flags: ProductFlags): ProductCall | null {
  const files = { from: flags.from?.trim() || null, title: flags.title?.trim() || null };
  if (flags.new) {
    if (rest.length > 0) throw productUsage();
    return { verb: 'push', key: keyArg(flags.product), seq: null, ...files };
  }
  const id = rest.length === 1 ? productIdArg(rest[0]) : null;
  if (!id) return null;
  if (flags.product !== undefined) throw productUsage();
  return { verb: 'push', ...productPrdParts(id), ...files };
}

/** The verb on a product PRD the arguments name, or null when they name none (a PRD of the repository,
 * a fix, a concept). A product PRD's flags on any other verb are a usage error. */
export function productCallOf(verb: string, rest: readonly string[], flags: ProductFlags): ProductCall | null {
  const call = verb === 'get' ? getCallOf(rest) : verb === 'push' ? pushCallOf(rest, flags) : null;
  if (!call && (flags.new || flags.from !== undefined || flags.title !== undefined)) throw productUsage();
  return call;
}

/** The one line a failed call is reported with. */
function failure(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  return error.status === null ? 'unreachable' : `refused (${error.status})`;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** `added: spec v2 · unchanged: plan`, as `omni dossier push` prints it. */
type AddedLine = (reply: { added?: unknown; unchanged?: unknown }) => string;

type PushCall = Extract<ProductCall, { verb: 'push' }>;
type Folder = ReturnType<typeof readFilesFolder>;

/** The title a push gives the PRD: the one it was handed, else the spec's, else, for a PRD already made,
 * the one its page has. A PRD to create with none is a usage error. */
async function titleOf({ key, seq, title }: PushCall, folder: Folder, { client, repo }: ProductIo): Promise<string> {
  const given = title ?? folder.title;
  if (given) return given;
  if (seq === null) throw usageError('omni dossier push --new: give it a title, with --title or a spec.md whose front matter has one.');
  const kept = field(await client.findProductDossier({ key, seq, repo }), 'title');
  if (!isText(kept)) throw new AskCallError('no title in the reply', { status: 500 });
  return kept;
}

/** The push's reply as three lines, the files too large to send after them. */
function reportPush(result: unknown, folder: Folder, { stdout, stderr }: ProductIo, addedLine: AddedLine): number {
  const prdId = field(result, 'prdId');
  const url = field(result, 'url');
  if (!isText(prdId) || !isText(url)) {
    println(stderr, 'refused (no product PRD in the reply)');
    return 1;
  }
  println(stdout, prdId);
  println(stdout, url);
  println(stdout, addedLine({ added: field(result, 'added'), unchanged: field(result, 'unchanged') }));
  for (const { path } of folder.tooLarge) println(stderr, `too large: ${path}`);
  return folder.tooLarge.length ? 1 : 0;
}

async function push(call: PushCall, io: ProductIo, addedLine: AddedLine): Promise<number> {
  const folder = call.from ? readFilesFolder(call.from) : { title: null, artifacts: [], tooLarge: [] };
  const { key, seq } = call;
  let result: unknown;
  try {
    const title = await titleOf(call, folder, io);
    result = await io.client.pushProductDossier({ key, seq, repo: io.repo, title, artifacts: folder.artifacts.map(({ kind, content }) => ({ kind, content })) });
  } catch (error) {
    println(io.stderr, failure(error));
    return 1;
  }
  return reportPush(result, folder, io, addedLine);
}

async function get(call: Extract<ProductCall, { verb: 'get' }>, { client, repo, home, scratch, stdout, stderr, now }: ProductIo): Promise<number> {
  const { key, seq } = productPrdParts(call.id);
  let body: unknown;
  try {
    body = await client.getDossier({ key, seq, kind: call.kind, repo });
  } catch (error) {
    if (!(error instanceof AskCallError)) throw error;
    println(stderr, error.status === null ? `held · ${UNREACHABLE_LINE}` : error.status === 404 ? 'none' : `refused (${error.status})`);
    return 1;
  }
  const latest = parseLatest(body);
  if (!latest || latest.kind !== call.kind) {
    println(stderr, 'refused (malformed reply)');
    return 1;
  }
  const hash = sha256(latest.content);
  if (hash !== latest.sha256) {
    println(stderr, `refused (the ${call.kind} does not hash as the server says)`);
    return 1;
  }
  rememberLatest(home, call.id, latest, new Date(now()).toISOString());
  println(stdout, writeScratch(call.id, latest, scratch));
  println(stdout, `sha256 ${hash}`);
  return 0;
}

/** Runs a verb on a product PRD. */
export function runProductCall(call: ProductCall, io: ProductIo, addedLine: AddedLine): Promise<number> {
  return call.verb === 'get' ? get(call, io) : push(call, io, addedLine);
}
