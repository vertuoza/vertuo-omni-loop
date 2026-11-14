import type { z } from 'zod';
import { refuse } from '../business-api/reply';
import { SEARCH_CATEGORIZE_SECRET_VAR, SEARCH_CATEGORIZE_SIGNATURE_HEADER } from '../search-categorize/route';
import { verifySignature } from '../stages/event/event';

// The two signed routes of the eval set (PRD omni-loop-8 s3) are signed as POST /api/search/categorize is:
// an HMAC-SHA256 over the exact body, `sha256=<hex>` in x-omni-signature-256, under SEARCH_CATEGORIZE_SECRET.
// This reads one: the body when it is signed and of the schema's shape, else the refusal to send. The body is
// never logged (it holds a question, L-GDPR-2).

/** The body's cap: a question of 2000 characters, two ids, and up to 20 entry ids. */
const MAX_BODY_BYTES = 16 * 1024;

export async function readSigned<T>(
  request: Request,
  secret: string | undefined,
  schema: z.ZodType<T>,
  shape: string,
  log: (line: string) => void,
  route: string,
): Promise<{ body: T } | { refusal: Response }> {
  if (!secret) {
    log(`${route}: ${SEARCH_CATEGORIZE_SECRET_VAR} is not set on this deployment, every call is refused`);
    return { refusal: refuse(401, 'This search route is not open here.') };
  }
  const text = await request.text();
  if (!verifySignature(secret, text, request.headers.get(SEARCH_CATEGORIZE_SIGNATURE_HEADER))) return { refusal: refuse(401, 'Bad signature.') };
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { refusal: refuse(413, `A call carries ${MAX_BODY_BYTES / 1024} KiB at most.`) };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { refusal: refuse(400, 'The body must be JSON.') };
  }
  const body = schema.safeParse(json);
  if (!body.success) return { refusal: refuse(400, `The body must be ${shape}.`) };
  return { body: body.data };
}

export const why = (error: unknown): string => (error instanceof Error ? (error.message.split('\n')[0] ?? '') : 'unknown error');
