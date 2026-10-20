// The route that marks a concept done or reopens it (PRD 2213, s3), named apart so the page's button can
// import it without the server code behind it.
export const CONCEPT_DONE_ROUTE = '/api/concepts/done';

/** The words a refused call carries (`{error}`), else `fallback`. */
export async function refusalWords(answer: Response, fallback: string): Promise<string> {
  const body: unknown = await answer.json().catch(() => null);
  const words = typeof body === 'object' && body !== null && 'error' in body ? body.error : null;
  return typeof words === 'string' ? words : fallback;
}
