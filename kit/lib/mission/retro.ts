/**
 * **A milestone retro** (PRD 3065, spec "3. A milestone retro: `/omni:mission-retro`") and its record line.
 *
 * `/omni:mission-retro` writes what went well and what to change at a milestone (a roadmap of the mission's scope delivered, or the
 * mission delivered), 1 to 5 sentences each, every sentence citing an event, a PRD, a pull request or a repair; never a log excerpt,
 * a credential or a person's words. It ends on one line the App reads back from the job's log, as it reads `omni repair:`:
 *
 *   omni retro: {"v":1,"mission":12,"milestone":"2950"|"mission","retro":{…},"file":"<path>"|null,"items":[…]}
 *
 * The last such line wins; a log with none, or whose last one does not read whole, is unreadable (`Retro skipped: <why>`).
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { MissionItemSchema } from './item.ts';
import { CitedSentencesSchema } from './retro-cited.ts';

/** What the line starts with. */
const RETRO_LINE = 'omni retro: ';

/** The time stamp a runner's log puts before a line. */
const STAMP = /^\d{2}:\d{2}:\d{2} /;

/** A milestone retro: what went well and what to change. */
export const MissionRetroSchema = z.strictObject({
  wentWell: CitedSentencesSchema,
  toChange: CitedSentencesSchema,
});

/** A milestone: a roadmap's number, or the mission itself. */
const MilestoneSchema = z.union([z.literal('mission'), z.string().regex(/^[1-9]\d*$/, 'a roadmap number or "mission"')]);

/** A path inside the mission folder: relative, with no way out. */
const FileSchema = z
  .string()
  .min(1)
  .max(300)
  .refine((path) => !path.startsWith('/') && !path.split('/').includes('..') && !/[\r\n\\]/.test(path), 'a path inside the mission folder');

const RetroRecordSchema = z.strictObject({
  v: z.literal(1),
  mission: z.number().int().positive(),
  milestone: MilestoneSchema,
  retro: MissionRetroSchema,
  file: FileSchema.nullable(),
  items: z.array(MissionItemSchema),
});

/** What a milestone retro job wrote for its mission. */
export type RetroRecord = z.infer<typeof RetroRecordSchema>;

/** A retro's record, or why the job's log gave none. */
export type RetroRead = { readable: true; record: RetroRecord } | { readable: false; reason: 'missing' | 'malformed' };

/** The record as its one line. */
export const retroRecordLine = (record: RetroRecord): string => `${RETRO_LINE}${JSON.stringify(record)}`;

/** The last `omni retro:` record a job's log holds: readable when it reads whole, unreadable when missing or malformed. */
export function retroLine(log: string): RetroRead {
  const last = log
    .split('\n')
    .map((raw) => raw.trim().replace(STAMP, ''))
    .findLast((line) => line.startsWith(RETRO_LINE));
  if (last === undefined) return { readable: false, reason: 'missing' };
  let json: unknown;
  try {
    json = JSON.parse(last.slice(RETRO_LINE.length));
  } catch {
    return { readable: false, reason: 'malformed' };
  }
  const parsed = RetroRecordSchema.safeParse(json);
  return parsed.success ? { readable: true, record: parsed.data } : { readable: false, reason: 'malformed' };
}
