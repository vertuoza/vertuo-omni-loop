/**
 * **The public report of an Omni Loop bug** (PRD 2980, spec "3. An Omni Loop bug is reported, scrubbed").
 *
 * When a repair finds that Omni Loop itself failed (the kit, a skill, the runner), the App files a report on the Omni Loop
 * repository, which is public. `scrub()` builds it from fixed fields only: the kit version, the command or skill, the error's class,
 * its message with every path, repository name, login, email, URL and token-shaped string removed, and the fingerprint. When
 * anything that still looks sensitive is left, it refuses and returns no report: a report that cannot be proven clean is never
 * sent (never#5, never#11, never#12).
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { FingerprintSchema, type RepairClass } from './fingerprint.ts';
import { RepairClassSchema } from './retro.ts';
import { REMOVALS, maskTokens, sensitiveShape } from './sensitive.ts';

/** The longest message a public report carries. */
const MESSAGE_MAX = 300;

/** A kit version: `0.0.659`, `1.2.0-rc.1`. */
const KitVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/, 'a kit version');

/** A command as a report names it: a skill (`/omni:yolo`) or an `omni` command (`omni runner work`), never its arguments. */
const CommandSchema = z.string().regex(/^(?:\/omni:[a-z][a-z0-9-]*|omni(?: [a-z][a-z0-9-]*){1,2})$/, 'a skill or an omni command');

/** The leading skill or `omni` command of a command line, without its arguments. */
const COMMAND = /^(?:\/omni:[a-z][a-z0-9-]*|omni(?: (?!-)[a-z][a-z0-9-]*){1,2}(?= |$))/;

/** A public report: fixed fields only, its message clean. */
export const PublicReportSchema = z.object({
  kitVersion: KitVersionSchema,
  command: CommandSchema,
  class: RepairClassSchema,
  message: z
    .string()
    .min(1)
    .max(MESSAGE_MAX)
    .refine((text) => sensitiveShape(text) === null, 'a public message holds no path, repository, login, email, URL or token'),
  fingerprint: FingerprintSchema,
});

/** A public report of an Omni Loop bug. */
export type PublicReport = z.infer<typeof PublicReportSchema>;

/** What `scrub()` is given: the fixed fields, and the names the caller knows its workspace by (owner, repositories, logins). */
export type ScrubInput = {
  kitVersion: string;
  command: string;
  class: RepairClass;
  message: string;
  fingerprint: string;
  known?: readonly string[] | undefined;
};

/** A report, or why there is none. */
export type Scrubbed = { ok: true; report: PublicReport } | { ok: false; reason: string };

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with each known name removed wherever it stands, whatever its case, the longest first. */
function removeKnown(text: string, known: readonly string[]): string {
  const names = [...new Set(known.map((name) => name.trim()).filter((name) => name.length > 0))].sort((a, b) => b.length - a.length);
  return names.reduce((out, name) => out.replace(new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`, 'gi'), '<name>'), text);
}

/**
 * The message's words with every sensitive shape removed, on one line: the tokens first, then each shape whole (an email, a URL,
 * a path), and the known names last, so a name inside an email never leaves the rest of the address behind.
 */
function scrubMessage(message: string, known: readonly string[]): string {
  const masked = maskTokens(message.replace(/\s+/g, ' ').trim());
  return removeKnown(REMOVALS.reduce((out, [, shape, replacement]) => out.replace(shape, replacement), masked), known);
}

/** `text` cut to the longest message a report carries. */
const cut = (text: string): string => (text.length <= MESSAGE_MAX ? text : `${text.slice(0, MESSAGE_MAX - 1).trimEnd()}…`);

/** The public report of an Omni Loop bug, built from fixed fields only, or why none can be sent. */
export function scrub(input: ScrubInput): Scrubbed {
  if (!KitVersionSchema.safeParse(input.kitVersion).success) return { ok: false, reason: 'the kit version is not a version' };
  const command = COMMAND.exec(input.command.trim())?.[0];
  if (command === undefined) return { ok: false, reason: 'the command is not a skill or an omni command' };
  if (!FingerprintSchema.safeParse(input.fingerprint).success) return { ok: false, reason: 'the fingerprint is not one' };
  const message = scrubMessage(input.message, input.known ?? []);
  if (message.length === 0) return { ok: false, reason: 'the message is empty' };
  const left = sensitiveShape(message);
  if (left !== null) return { ok: false, reason: `the message still holds ${left} after scrubbing` };
  return { ok: true, report: { kitVersion: input.kitVersion, command, class: input.class, message: cut(message), fingerprint: input.fingerprint } };
}
