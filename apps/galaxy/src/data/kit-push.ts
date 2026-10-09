// What the kit's pushes share (src/loop/api.ts, src/roadmap/api.ts): the fields each checks the same
// way, the plain-words refusal (ADR-0029), and the receiving of a push: a database here, a signed-in
// caller, and a JSON body within its size.
import { z } from 'zod';
import { authenticate, type TokenCheck } from '../ask/auth';

/** A trimmed line, never empty, of `max` characters at most. */
export const Line = (max: number) => z.string().trim().min(1).max(max);

/** A web address of 500 characters at most. */
export const WebLink = z.string().max(500).regex(/^https?:\/\/\S+$/, 'a web address');

/** A moment, as an ISO date-time with its offset. */
export const When = z.iso.datetime({ offset: true });

/** A refusal, `{error}` in plain words, never cached. */
export const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

/**
 * What a push sent, read by `schema`, or the first problem zod found, in one line naming the field.
 * `noun` names what is pushed, capitalised with its article ("An idea").
 */
export function bodyOf<S extends z.ZodType>(schema: S, sent: unknown, noun: string): z.output<S> | { problem: string } {
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) return { problem: 'The body must be a JSON object.' };
  const parsed = schema.safeParse(sent);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  if (issue?.code === 'unrecognized_keys') return { problem: `${noun} does not carry ${issue.keys.join(', ')}.` };
  return { problem: `${noun}'s \`${issue?.path.join('.') ?? ''}\` is malformed: ${issue?.message ?? 'see the contract'}.` };
}

/** What a push sent, read as JSON, or the refusal its size or its syntax earns. */
async function sentOf(request: Request, maxBytes: number): Promise<{ sent: unknown } | Response> {
  const tooLarge = () => refuse(413, `A push carries ${maxBytes / 1024} KiB at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return tooLarge();
  try {
    const sent: unknown = JSON.parse(text);
    return { sent };
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
}

/**
 * A push received: what it sent, and a client acting as its caller — or the refusal it earns: 503
 * (`unavailable`) with no database here, the sign-in's refusal, 413 over `maxBytes`, 400 not JSON.
 */
export async function receivePush<C extends TokenCheck>(
  request: Request,
  connect: ((token: string) => C) | null,
  { unavailable, maxBytes }: { unavailable: string; maxBytes: number },
): Promise<{ sent: unknown; client: () => C } | Response> {
  if (!connect) return refuse(503, unavailable);
  const auth = await authenticate(request.headers.get('authorization'), connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const read = await sentOf(request, maxBytes);
  if (read instanceof Response) return read;
  return { sent: read.sent, client: () => connect(auth.caller.token) };
}
