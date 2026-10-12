import { authenticate, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { ProductImportRequestSchema, ProductImportSchema, ProductsWhichSchema, ProductTargetsSchema } from './product-repositories.contract';
import type { ProductMissed, ProductRepositoriesService } from './product-repositories.service';

// The product links' HTTP edge for the kit (PRD 1364, s4; ADR-0095), as a plain function of a Request,
// so it is tested with a fake service and the route stays one line:
//
//   GET  /api/products/targets?repo=<owner/name>&product=<name>   → 200 {product: {name}, targets}
//   POST /api/products/import {repo, product, targets}             → 200 {product, added, changed, unchanged}
//   GET  /api/products/which?repo=<owner/name>                     → 200 {products: [{name}]}
//
// `omni product import` and `omni product which` call the last two (s5).
//
// `omni targets` calls it with the terminal's sign-in (a bearer token) when the config names
// `plan.product`. The sign-in is checked first: signed out, 401, and no read runs. The read then runs
// as the caller's access token, never a service key, so row-level security decides what they see. The
// reply is checked against the kit's own schema before it leaves. Refusals follow ADR-0029, each
// `{error}` in plain words (src/product-repositories/product-repositories.contract.ts).

/** A client acting as one access token: the Auth server's check and the reads as that person. */
type CallerClient = TokenCheck & { service: ProductRepositoriesService };

export type ProductTargetsDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  log: (line: string) => void;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;
const BAD_QUERY = 'Name the plan repository as `repo=owner/name` and the product as `product=<name>`.';
const NOT_READ = 'The targets could not be read. Try again.';

const BAD_BODY = 'The body must be {"repo": "owner/name", "product": "<name>", "targets": [...]}, each target as plan.targets has it.';
const BAD_REPO = 'Name the repository as `repo=owner/name`.';
const MAX_BODY_BYTES = 256 * 1024;
const NOT_IMPORTED = 'The targets could not be imported. Try again.';
const NO_DATABASE = 'Products are not available here: this deployment has no database.';

/** The status a refused link write answers: not an owner, or a field or repository the database refuses. */
const REFUSED: Partial<Record<string, number>> = { '42501': 403, P0002: 422, '22023': 422 };

/** The import a request's body asks for, or null when it is malformed. */
async function importOf(request: Request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    const parsed = ProductImportRequestSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The answer when no one product answers the name. */
function missed(found: ProductMissed, repo: string, product: string): Response {
  if (found.kind === 'unlisted') return refuse(404, `No workspace of yours lists ${repo}.`);
  if (found.kind === 'no-product') return refuse(404, `No product ${product} in the workspace of ${repo}.`);
  return refuse(409, `${found.count} products are named ${product} in the workspaces that list ${repo}.`);
}

/** The query's plan repository and product name, as given. */
const queryOf = (query: URLSearchParams) => ({ repo: query.get('repo') ?? '', product: (query.get('product') ?? '').trim() });

/** GET: the links of the product the query names, as the kit's targets. */
export async function readProductTargets(request: Request, deps: ProductTargetsDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, NO_DATABASE);
  const { repo, product } = queryOf(new URL(request.url).searchParams);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  if (repo.length > 200 || !REPO.test(repo) || product === '' || product.length > 200) return refuse(400, BAD_QUERY);
  try {
    const found = await deps.connect(auth.caller.token).service.targets(repo, product);
    if (found.kind !== 'ok') return missed(found, repo, product);
    return reply(200, ProductTargetsSchema.parse(found.reply));
  } catch (error) {
    deps.log(`product-repositories: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, NOT_READ);
  }
}

/** POST: a plan repository's targets, written into the product the body names. */
export async function importProductTargets(request: Request, deps: ProductTargetsDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const asked = await importOf(request);
  if (!asked) return refuse(400, BAD_BODY);
  try {
    const done = await deps.connect(auth.caller.token).service.importTargets(asked);
    if (done.kind === 'ok') return reply(200, ProductImportSchema.parse(done.reply));
    if (done.kind !== 'refused') return missed(done, asked.repo, asked.product);
    const status = REFUSED[done.code ?? ''];
    if (status === undefined) throw new Error(`write a link of ${asked.product}: ${done.message}`);
    return refuse(status, done.message);
  } catch (error) {
    deps.log(`product-repositories: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, NOT_IMPORTED);
  }
}

/** GET: the products the queried repository is in. */
export async function readProductsOf(request: Request, deps: ProductTargetsDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, NO_DATABASE);
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  if (repo.length > 200 || !REPO.test(repo)) return refuse(400, BAD_REPO);
  try {
    return reply(200, ProductsWhichSchema.parse(await deps.connect(auth.caller.token).service.productsOf(repo)));
  } catch (error) {
    deps.log(`product-repositories: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, 'The products could not be read. Try again.');
  }
}
