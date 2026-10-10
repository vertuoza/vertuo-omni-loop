import { authenticate, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { ProductTargetsSchema } from './product-repositories.contract';
import type { ProductRepositoriesService } from './product-repositories.service';

// The product links' HTTP edge for the kit (PRD 1364, s4; ADR-0095), as a plain function of a Request,
// so it is tested with a fake service and the route stays one line:
//
//   GET /api/products/targets?repo=<owner/name>&product=<name>   → 200 {product: {name}, targets}
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

/** The query's plan repository and product name, as given. */
const queryOf = (query: URLSearchParams) => ({ repo: query.get('repo') ?? '', product: (query.get('product') ?? '').trim() });

/** GET: the links of the product the query names, as the kit's targets. */
export async function readProductTargets(request: Request, deps: ProductTargetsDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Products are not available here: this deployment has no database.');
  const { repo, product } = queryOf(new URL(request.url).searchParams);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  if (repo.length > 200 || !REPO.test(repo) || product === '' || product.length > 200) return refuse(400, BAD_QUERY);
  try {
    const found = await deps.connect(auth.caller.token).service.targets(repo, product);
    if (found.kind === 'unlisted') return refuse(404, `No workspace of yours lists ${repo}.`);
    if (found.kind === 'no-product') return refuse(404, `No product ${product} in the workspace of ${repo}.`);
    if (found.kind === 'ambiguous') return refuse(409, `${found.count} products are named ${product} in the workspaces that list ${repo}.`);
    return reply(200, ProductTargetsSchema.parse(found.reply));
  } catch (error) {
    deps.log(`product-repositories: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, NOT_READ);
  }
}
