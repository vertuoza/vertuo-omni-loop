// A saved step too big for one row, saved in parts (#2786). The job ledger refuses a step whose value is over
// 1 MB (background_job_save()), and what some steps gather grows with the work they read: the retro's step
// "gather-ci" keeps every red CI run's log tail, so a delivery red on many commits gathers more than 1 MB.
//
// `savedStepInParts` saves a value that fits as `savedStep` does, under the step's own id, unchanged. A value
// over `PART_BYTES` is cut, as JSON text, into parts of at most `PART_BYTES` each, every part saved as a step of
// its own (`<id>:part-<hash>-<k>`), and the step `id` itself saves only a head naming them: how many, and the
// hash of the whole text. The parts are saved before the head, so a head read back always finds its parts; a
// run that stopped between two parts made them again, and a value made differently on that run (a new CI run
// since) gets a new hash, so its parts never mix with the ones saved before. Nothing is left out: the value
// read back is the value made, whatever its size, and a retry never reads it again from GitHub.
//
// `PART_BYTES` is half the ledger's cap: the ledger measures a value as Postgres prints its jsonb, which adds
// a space after each `:` and `,` of the JSON, so a value of n bytes of JSON prints under 2n.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseOrThrow } from 'omni-loop/kit/lib/schema/parse-or-throw.ts';
import { asSaved, type StepRun } from './saved-step.ts';

/** The JSON a step's value, or one of its parts, holds at most: half the ledger's 1 MB a step. */
export const PART_BYTES = 524_288;

const PARTS = 'omni:parts';
const HeadSchema = z.strictObject({ [PARTS]: z.strictObject({ hash: z.string().min(1), count: z.number().int().positive() }) });
type Head = z.infer<typeof HeadSchema>[typeof PARTS];

/**
 * The step `id` run with `fn`, as `savedStep` runs it, its value saved in parts of at most `budget` bytes of
 * JSON when it is bigger, then read back whole and parsed by `schema`.
 */
export async function savedStepInParts<T>(
  step: StepRun,
  id: string,
  schema: z.ZodType<T>,
  fn: () => NoInfer<T> | Promise<NoInfer<T>>,
  budget = PART_BYTES,
): Promise<T> {
  const saved = await step.run(id, async () => {
    const text = JSON.stringify(asSaved(await fn()));
    if (Buffer.byteLength(text) <= budget) return JSON.parse(text) as unknown;
    const hash = hashOf(text);
    const parts = partsOf(text, budget);
    for (const [index, part] of parts.entries()) await step.run(partId(id, hash, index), () => part);
    return { [PARTS]: { hash, count: parts.length } };
  });
  const head = HeadSchema.safeParse(saved);
  const value = head.success ? await joined(step, id, head.data[PARTS]) : saved;
  return parseOrThrow(schema, value, `The step "${id}" came back in an unexpected shape`);
}

/**
 * `text` cut into parts of at most `budget` bytes each once saved as a JSON string, its quotes and escapes
 * counted, never inside a character: joined, they are `text`.
 */
export function partsOf(text: string, budget: number): string[] {
  const parts: string[] = [];
  let start = 0;
  let size = QUOTES;
  for (let index = 0; index < text.length; ) {
    const code = text.codePointAt(index) ?? 0;
    const cost = bytesOf(code);
    if (size + cost > budget && index > start) {
      parts.push(text.slice(start, index));
      start = index;
      size = QUOTES;
    }
    size += cost;
    index += code > 0xffff ? 2 : 1;
  }
  parts.push(text.slice(start));
  return parts;
}

/** The two quotes around a JSON string. */
const QUOTES = 2;

/** The bytes one character takes in a JSON string, as UTF-8: an escape for a quote, a backslash or a control character. */
function bytesOf(code: number): number {
  if (code === 0x22 || code === 0x5c) return 2;
  if (code < 0x20 || (code >= 0xd800 && code <= 0xdfff)) return 6;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  return code < 0x10000 ? 3 : 4;
}

/** The value the parts of the step `id` make, once joined; an error naming the step when one is missing or changed. */
async function joined(step: StepRun, id: string, { hash, count }: Head): Promise<unknown> {
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await step.run(partId(id, hash, index), () => {
      throw new Error(`The step "${id}" has no part ${String(index + 1)} of ${String(count)} saved.`);
    });
    if (typeof part !== 'string') throw new Error(`The step "${id}" came back with its part ${String(index + 1)} of ${String(count)} not text.`);
    parts.push(part);
  }
  const text = parts.join('');
  if (hashOf(text) !== hash) throw new Error(`The step "${id}" came back with parts that do not make the value saved.`);
  return JSON.parse(text) as unknown;
}

/** The id of part `index` (from 0) of the step `id`, whose whole text has the hash `hash`. */
function partId(id: string, hash: string, index: number): string {
  return `${id}:part-${hash}-${String(index + 1)}`;
}

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
