// The business routes' answers (PRD 748): JSON never cached, a refusal as `{error}` in plain words
// (ADR-0029). Shared by the read, the citation log and the rival suggestions.
const NO_STORE = { 'cache-control': 'no-store' } as const;

/** A JSON answer with `status`, never cached. */
export function reply(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/** A refusal: `status` and the reason in plain words. */
export function refuse(status: number, error: string): Response {
  return reply(status, { error });
}
