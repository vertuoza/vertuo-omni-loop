// One parse that fails by the first field that is wrong (PRD 725): a value read from the outside
// (`gh`, GitHub, an Inngest event, Supabase) parsed with the kit's messages, or an error that names
// what answered and the field: `<shape>: 0.number: Expected number, received string`.
import type { z } from 'zod';
import { KIT_MESSAGES } from './messages.ts';

/** `value` parsed by `schema`; else an error, `shape` then the first wrong field's path and message. */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown, shape: string): z.infer<S> {
  const parsed = schema.safeParse(value, { error: KIT_MESSAGES });
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue && issue.path.length ? `${issue.path.join('.')}: ` : '';
  throw new Error(`${shape}: ${field}${issue?.message ?? 'invalid'}`);
}
