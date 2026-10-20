import { ArchiveAnswerSchema, ArchiveErrorSchema, archiveRoute, restoreRoute, type ArchiveAnswer } from './product-archive.contract';

// The product home's Archive and Restore from the browser (PRD 2232 s1; ADR-0095): the routes under
// /app/products/<id>, every answer parsed with product-archive.contract.ts. No Supabase client: the
// sign-in cookie goes with each request. Each call answers the product as it was left, or the route's
// own words.

/** The browser's fetch, or a stub in a test. */
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type ArchiveResult = { ok: true; product: ArchiveAnswer } | { ok: false; message: string };

export interface ProductArchivePort {
  archive(): Promise<ArchiveResult>;
  restore(): Promise<ArchiveResult>;
}

const OFFLINE = 'Nothing changed. Check your connection and try again.';

export function productArchiveClient(product: string, fetchFn: Fetch = (url, init) => fetch(url, init)): ProductArchivePort {
  async function call(url: string): Promise<ArchiveResult> {
    let answer: Response;
    try {
      answer = await fetchFn(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    } catch {
      return { ok: false, message: OFFLINE };
    }
    const body: unknown = await answer.json().catch(() => null);
    if (answer.ok) {
      const parsed = ArchiveAnswerSchema.safeParse(body);
      return parsed.success ? { ok: true, product: parsed.data } : { ok: false, message: `Nothing changed (${String(answer.status)}). Reload the page.` };
    }
    const refusal = ArchiveErrorSchema.safeParse(body);
    return { ok: false, message: refusal.success ? refusal.data.error : `Nothing changed (${String(answer.status)}). Try again.` };
  }
  return {
    archive: () => call(archiveRoute(product)),
    restore: () => call(restoreRoute(product)),
  };
}
