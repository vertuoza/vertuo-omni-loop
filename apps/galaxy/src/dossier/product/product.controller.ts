import 'server-only';
import { viewer } from '../../data/viewer';
import { PRODUCT_REFUSALS, ProductChangeSchema, UuidSchema, type ProductRefusal } from './product.contract';
import { productServiceOf, SIGNED_OUT, type ProductService } from './product.service';

// The PRD page's Product picker's routes (PRD 1364 s7; ADR-0095), called by the browser's client
// (src/dossier/product/product.client.ts) in the shapes of src/dossier/product/product.contract.ts:
//
//   GET  /api/dossiers/product?dossier=<id>        what the picker shows: the PRD's product, the
//                                                  workspace's products, and the lock
//   POST /api/dossiers/product {dossier, product}  a member changes the PRD's product, or sets none
//
// The session is checked first, from the request's cookie claims, as viewer() reads them: signed out
// (or the demo, or no database here), 401 and no service runs. Signed in, the service reads and writes as
// that person, so row-level security and dossier_set_product() have the last word: a PRD the caller does
// not read is 404, a product of another workspace 400, a change while an approval is in force 409 in the
// database's own words. A failure is 500, logged.

export type ProductDeps = {
  /** The service as the signed-in person, or null when nobody is signed in. */
  signedIn: () => Promise<ProductService | null>;
  log: (line: string) => void;
};

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_BODY_BYTES = 4 * 1024;
const MALFORMED_BODY = 'The body must be a JSON object: {"dossier": "<id>", "product": "<id>" | null}.';
const MALFORMED_QUERY = 'Name the PRD: ?dossier=<id>.';

const reply = (status: number, body: unknown): Response => Response.json(body, { status, headers: NO_STORE });
const refuse = (kind: ProductRefusal, error: string): Response => reply(PRODUCT_REFUSALS[kind], { error });

/** The change a request asks for, or null when it is malformed. */
async function changeOf(request: Request): Promise<{ dossier: string; product: string | null } | null> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    const parsed = ProductChangeSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The two handlers, on `deps`. */
export function productHandlers(deps: ProductDeps) {
  const failed = (kind: ProductRefusal, error: string, dossier: string): Response => {
    if (kind === 'database') deps.log(`dossier product: ${error} (${dossier})`);
    return refuse(kind, error);
  };

  return {
    get: async (request: Request): Promise<Response> => {
      const service = await deps.signedIn();
      if (!service) return refuse('signed-out', SIGNED_OUT);
      const dossier = UuidSchema.safeParse(new URL(request.url).searchParams.get('dossier'));
      if (!dossier.success) return refuse('malformed', MALFORMED_QUERY);
      const read = await service.read(dossier.data);
      return read.ok ? reply(200, read.value) : failed(read.kind, read.error, dossier.data);
    },

    post: async (request: Request): Promise<Response> => {
      const service = await deps.signedIn();
      if (!service) return refuse('signed-out', SIGNED_OUT);
      const change = await changeOf(request);
      if (!change) return refuse('malformed', MALFORMED_BODY);
      const set = await service.change(change.dossier, change.product);
      return set.ok ? reply(200, set.value) : failed(set.kind, set.error, change.dossier);
    },
  };
}

const live = productHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? productServiceOf(seen.db) : null;
  },
  log: (line) => { console.error(line); },
});

/** GET /api/dossiers/product */
export const getProduct = (request: Request): Promise<Response> => live.get(request);
/** POST /api/dossiers/product */
export const postProduct = (request: Request): Promise<Response> => live.post(request);
