// `omni prd <key>-<n> [--show <kind>]` (PRD 1548 s2): a product PRD (`mobile-12`), which lives on the
// server and in no repository, read from the Omni page.
//
// - Without `--show`: one lookup (`GET /api/dossiers?product=&prd=`) answers its title, its page, its
//   product and its approval in force, which `readProductApproval` judges; its stage is read as a ◆ PRD's
//   is (`productPrdState`). It prints `PRD <id> — <title>`, `state:`, `birthplace: server`, one `approval:`
//   line per line the reading says, `page:` and `product:`. While the server is down it prints the held
//   reading and exits 0, as `omni prd <n>` does for a ◆ PRD; a PRD the page has not is exit 1.
// - With `--show <kind>`: the latest version of that kind (`GET /api/dossiers/get`), read-only, under one
//   line `<kind> of PRD <id> · v<k> · as of <time>`, the time it was read; each read is kept as the
//   last-read copy (`../../lib/dossier/product-prd.ts`), which answers while the server is down, marked
//   `as of` its earlier time. With neither, it holds, exit 1. No gate reads that copy.
//
// Both need dossiers on and a sign-in, and say which is missing, exit 1.
import { AskCallError } from '../../lib/ask/client.ts';
import type { Fetch } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { readProductApproval } from '../../lib/approval/approval.ts';
import { productPrdState } from '../../lib/approval/prd-state.ts';
import { dossierSwitch } from '../../lib/config.ts';
import type { Context } from '../../lib/context.ts';
import type { ArtifactKind } from '../../lib/dossier/folder.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { lastRead, parseLatest, rememberLatest } from '../../lib/dossier/product-prd.ts';
import type { Latest } from '../../lib/dossier/product-prd.ts';
import { productPrdParts } from '../../lib/ids.ts';
import type { ProductPrdId } from '../../lib/ids.ts';
import type { GateOptions } from '../../lib/delivery/prd.ts';
import { println } from '../args.ts';
import type { Exec, Out } from '../io.ts';

type ProductPrdIo = Omit<GateOptions, 'fetch'> & { fetch: Fetch; ctx: Context; exec: Exec; stdout: Out; stderr: Out; now: () => number };

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The signed-in client of the Omni page, or the line that says why there is none. */
function clientOf({ ctx, tokens, home, fetch, callMs }: ProductPrdIo) {
  const toggle = dossierSwitch(ctx.config);
  if (!toggle.on) return { why: `a product PRD lives on the Omni page, and dossiers are off here (${toggle.reason})` };
  const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
  return client ? { client } : { why: 'no sign-in (omni signin)' };
}

/** Product PRD `id`: where it stands, its page and its product. */
async function lookup(id: ProductPrdId, client: NonNullable<ReturnType<typeof signedInClient>>, io: ProductPrdIo): Promise<number> {
  const { key, seq } = productPrdParts(id);
  let found: unknown = null;
  let missing = false;
  const approval = await readProductApproval(id, async () => {
    try {
      found = await client.findProductDossier({ key, seq, repo: io.ctx.config.repo.slug });
    } catch (error) {
      missing = error instanceof AskCallError && error.status === 404;
      throw error;
    }
    return found;
  });
  if (missing) {
    println(io.stderr, `omni prd: no PRD ${id} on the Omni page.`);
    return 1;
  }
  const state = productPrdState(id, approval);
  const title = field(found, 'title');
  const url = field(found, 'url');
  const product = field(found, 'product');
  println(io.stdout, [
    `PRD ${id}${isText(title) ? ` — ${title}` : ''}`,
    `state: ${state.state}`,
    'birthplace: server',
    ...approval.lines.map((line) => `approval: ${line}`),
    ...(isText(url) ? [`page: ${url}`] : []),
    ...(found === null ? [] : [`product: ${isText(product) ? product : 'none'}`]),
  ].join('\n'));
  return 0;
}

/** The header line of a version `--show` prints. */
const showLine = (id: ProductPrdId, latest: Pick<Latest, 'kind' | 'version'>, at: string, cached: boolean) =>
  `${latest.kind} of PRD ${id} · v${latest.version} · as of ${at}${cached ? ' · last-read copy, server unreachable' : ''}`;

/** A `--show` whose call failed: none for a kind with no version; while the server is down, the last-read
 * copy, marked as of when it was read, or held when there is none. */
function failedShow(error: unknown, id: ProductPrdId, kind: ArtifactKind, where: string, io: ProductPrdIo): number {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === 404) {
    println(io.stderr, `omni prd: PRD ${id} has no ${kind} on the Omni page.`);
    return 1;
  }
  const copy = error.status === null ? lastRead(where, id, kind) : null;
  if (copy) {
    io.stdout.write(`${showLine(id, copy, copy.readAt, true)}\n\n${copy.content}`);
    return 0;
  }
  println(io.stderr, error.status === null ? `omni prd: held · server unreachable · no last-read copy of ${kind}` : `omni prd: refused (${error.status})`);
  return 1;
}

/** Product PRD `id`'s latest `kind`, read-only, as of when it was read. */
async function show(id: ProductPrdId, kind: ArtifactKind, client: NonNullable<ReturnType<typeof signedInClient>>, io: ProductPrdIo): Promise<number> {
  const { key, seq } = productPrdParts(id);
  const where = mainCheckout(io.ctx.root, io.exec) ?? io.ctx.root;
  let body: unknown;
  try {
    body = await client.getDossier({ key, seq, kind, repo: io.ctx.config.repo.slug });
  } catch (error) {
    return failedShow(error, id, kind, where, io);
  }
  const latest = parseLatest(body);
  if (!latest || latest.kind !== kind) {
    println(io.stderr, 'omni prd: refused (malformed reply)');
    return 1;
  }
  const at = new Date(io.now()).toISOString();
  rememberLatest(where, id, latest, at);
  io.stdout.write(`${showLine(id, latest, at, false)}\n\n${latest.content}`);
  return 0;
}

/** `omni prd <key>-<n> [--show <kind>]`. */
export async function productPrd(id: ProductPrdId, kind: ArtifactKind | null, io: ProductPrdIo): Promise<number> {
  const signedIn = clientOf(io);
  if ('why' in signedIn) {
    println(io.stderr, `omni prd: ${signedIn.why}`);
    return 1;
  }
  return kind === null ? lookup(id, signedIn.client, io) : show(id, kind, signedIn.client, io);
}
