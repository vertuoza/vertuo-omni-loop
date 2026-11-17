/**
 * **One cause, one fingerprint** (PRD 2980, spec "2. `/omni:repair`").
 *
 * A repair's retro names its class, its place (a file, a command or a skill) and the error's signature. The fingerprint hashes
 * the three after normalising the place and the signature: line numbers, hashes, times, temporary paths and the numbers inside a
 * message are dropped, so one cause gives one fingerprint whichever run met it. A mission repairs one fingerprint at most 3
 * times in a round.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

/** A fingerprint as stored and sent: a sha256, in lowercase hex. */
export const FingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/, 'a fingerprint is 64 lowercase hex characters');

/** The four ways a repair takes, by what caused the failure. */
export const REPAIR_CLASSES = ['code', 'omni-loop', 'flake', 'person'] as const;

/** A repair's class: `code` (the work's own code), `omni-loop` (the kit, a skill, the runner), `flake`, or `person`. */
export type RepairClass = (typeof REPAIR_CLASSES)[number];

/** What a failure's fingerprint is made of. */
export type Cause = { class: RepairClass; place: string; signature: string };

/** What a run changes in a cause's words, each shape and what it becomes, in order: a temporary path before its numbers. */
const VARYING: readonly [RegExp, string][] = [
  [/(?:\/private)?\/(?:tmp|var\/folders)\/\S*/g, '<tmp>'],
  [/\S*\/_temp\/\S*/g, '<tmp>'],
  [/[A-Za-z]:\\\S*\\(?:Temp|tmp)\\\S*/g, '<tmp>'],
  [/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, '<time>'],
  [/\b\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/g, '<time>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  [/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/gi, '<hash>'],
  [/:\d+(?::\d+)?\b/g, ''],
  [/\b(line) \d+\b/gi, '$1'],
  [/\d+(?:\.\d+)?/g, '#'],
  [/\s+/g, ' '],
];

/** A cause's words with what changes from run to run dropped: the same failure reads the same. */
export function normaliseCause(text: string): string {
  return VARYING.reduce((out, [shape, replacement]) => out.replace(shape, replacement), text).trim();
}

/** The fingerprint of a cause: the sha256 of its class, its normalised place and its normalised signature. */
export function fingerprint(cause: Cause): string {
  const text = [cause.class, normaliseCause(cause.place), normaliseCause(cause.signature)].join('\n');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
