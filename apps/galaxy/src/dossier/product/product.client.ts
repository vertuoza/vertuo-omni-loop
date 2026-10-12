import { PRODUCT_ROUTE, ProductErrorSchema, ProductPickSchema, ProductSetSchema, type ProductPick, type ProductRef } from './product.contract';

// The PRD page's Product picker's calls from the browser (PRD 1364 s7; ADR-0095): the app's
// /api/dossiers/product route, every answer parsed with src/dossier/product/product.contract.ts. No
// Supabase client: the sign-in cookie goes with each request. A read the person may not make (signed
// out, or a PRD they do not read) is null, and the picker hides; any other failure throws. A change
// answers the product set, or the route's own words (`locked` when an approval is in force).

/** The browser's fetch, or a stub in a test. */
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

type ProductChange = { ok: true; product: ProductRef | null } | { ok: false; locked: boolean; error: string };

export function productClient(fetchFn: Fetch = (url, init) => fetch(url, init)) {
  return {
    /** What the picker shows, or null when the person may not see it. */
    async read(dossier: string): Promise<ProductPick | null> {
      const answer = await fetchFn(`${PRODUCT_ROUTE}?dossier=${encodeURIComponent(dossier)}`, {
        headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin',
      });
      if (answer.status === 401 || answer.status === 404) return null;
      if (!answer.ok) throw new Error(`read the PRD's product: ${answer.status}`);
      return ProductPickSchema.parse(await answer.json());
    },

    /** Changes the PRD's product to `product`, or to none. */
    async change(dossier: string, product: string | null): Promise<ProductChange> {
      let answer: Response;
      try {
        answer = await fetchFn(PRODUCT_ROUTE, {
          method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ dossier, product }),
        });
      } catch {
        return { ok: false, locked: false, error: 'The product was not changed. Check your connection and try again.' };
      }
      const body: unknown = await answer.json().catch(() => null);
      if (answer.ok) return { ok: true, product: ProductSetSchema.parse(body).product };
      const refusal = ProductErrorSchema.safeParse(body);
      return {
        ok: false,
        locked: answer.status === 409,
        error: refusal.success ? refusal.data.error : `The product was not changed (${answer.status}). Try again.`,
      };
    },
  };
}
