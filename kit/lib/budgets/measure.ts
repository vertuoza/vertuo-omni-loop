// The context measure (PRD 1679): how many bytes each thing every agent session reads holds, as the
// session reads it. A target is one of:
//
// | target           | what it is                                                                  |
// |------------------|-----------------------------------------------------------------------------|
// | `briefing`       | what `omni kb show briefing` prints                                         |
// | `form:<name>`    | each other playbook form as `omni kb show <name>` prints it, pointers expanded |
// | `context:<path>` | each file `paths.context` names                                             |
// | `session`        | `briefing` plus every `context:` target: what a session loads before its first step |
//
// Bytes, never tokens (D2): the same number on every machine and model. Skills, ADRs and registers
// are not measured (D10). A target that cannot be measured (a context file missing, a pointer that
// leads nowhere, a form that does not parse) is a measurement error naming why, never a guess; and
// `session` is one too when any of its parts is.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { briefingLaws } from '../knowledge/briefing-laws.ts';
import { DECISIONS_FORM, FORM_IDS } from '../playbook/forms.ts';
import { levelOf, readDecisions } from '../playbook/decisions.ts';
import type { Decisions } from '../playbook/decisions.ts';
import { resolveForm } from '../playbook/resolve.ts';
import type { ResolvedForm } from '../playbook/resolve.ts';
import { formTemplate } from '../playbook/templates.ts';

/** The form every session loads first, measured as its own target. */
export const BRIEFING = 'briefing';
/** The target that sums what a session loads before its first step. */
export const SESSION = 'session';

/** What the measure reads of a context. */
type Ctx = Pick<Context, 'root' | 'layout' | 'config'>;

/** One target's size in bytes, or why it could not be measured. */
export type Measure = { target: string; bytes: number } | { target: string; error: string };

/** How many records `omni kb show decisions` prints without `--all`: the highest numbers (PRD 1951). */
const LATEST_RECORDS = 20;

/**
 * The decision records as `omni kb show decisions` prints them: the latest `LATEST_RECORDS`, then a
 * live count of the older ones naming `--all`, or with `all` every one; every shared number whatever
 * its age; then the next free number.
 */
function recordLines({ dir, records, shared, next }: Decisions, all: boolean): string[] {
  const lines = [`## Records  [read live from ${dir}]`];
  if (records.length === 0) lines.push('No decision records yet.');
  // A level tag shows only once another level contributes a record (PRD 2416): else the lines are as ever.
  const tagged = records.some((record) => levelOf(record) !== 'repo');
  const own = records.filter((record) => levelOf(record) === 'repo');
  const inherited = records.filter((record) => levelOf(record) !== 'repo');
  const older = all ? 0 : Math.max(0, own.length - LATEST_RECORDS);
  lines.push(
    ...[...own.slice(older), ...inherited].map(
      (record) => `${record.number}  ${record.title ?? record.file}${tagged ? `  [${levelOf(record)}]` : ''}`,
    ),
  );
  if (older > 0) lines.push(`… ${older} older records: omni kb show decisions --all`);
  lines.push(...shared.map(({ number, files }) => `! ${number} is used by ${files.length} records: ${files.join(', ')}`));
  lines.push(`Next free number: ${next}`);
  return lines;
}

/**
 * One resolved form as `omni kb show <form>` prints it, without its last newline: its title, its file
 * and state, then each section under its label, then — for the decisions form — the records, and —
 * for the briefing — its laws section (PRD 1726). The command prints this text, so the measure and
 * what a session reads are one. The records are the latest `LATEST_RECORDS` unless `all` (PRD 1951).
 */
export function formShowText(
  resolved: ResolvedForm,
  records: Decisions | null,
  laws: readonly string[] | null = null,
  { all = false }: { all?: boolean } = {},
): string {
  const lines = [`# ${resolved.title}`, `${resolved.file} · ${resolved.state}`];
  for (const section of resolved.sections) {
    lines.push('', section.slot === null ? section.label : `## ${section.heading}  ${section.label}`);
    if (section.text) lines.push(section.text);
    // A hole shows the kit default, then its questions; repository text already holds its own.
    if (section.source === 'hole') lines.push(...section.questions.map((question) => `TODO(human): ${question}`));
  }
  if (records) lines.push('', ...recordLines(records, all));
  if (laws) lines.push('', ...laws);
  return lines.join('\n');
}

/** A problem `resolveForm` reports that leaves the form's text standing: a kit default's unset key. */
const harmless = (problem: string): boolean => problem.startsWith('kit default ');

/** One form, measured as `omni kb show` prints it, its trailing newline counted. */
function measureForm(ctx: Ctx, form: string): Measure {
  const target = form === BRIEFING ? BRIEFING : `form:${form}`;
  const resolved = resolveForm(form, { ctx, template: formTemplate(form) });
  const broken = resolved.problems.filter((problem) => !harmless(problem));
  if (broken.length > 0) return { target, error: broken.join('; ') };
  const records = form === DECISIONS_FORM ? readDecisions({ ctx }) : null;
  const laws = form === BRIEFING ? briefingLaws(ctx).lines : null;
  return { target, bytes: Buffer.byteLength(`${formShowText(resolved, records, laws)}\n`, 'utf8') };
}

/** One `paths.context` file, measured as it lies on disk. */
function measureContext(ctx: Ctx, path: string): Measure {
  const target = `context:${path}`;
  const file = join(ctx.root, path);
  if (!existsSync(file) || !statSync(file).isFile()) return { target, error: `${path} does not exist` };
  return { target, bytes: readFileSync(file).byteLength };
}

/** `briefing` plus every `context:` target, or an error naming each part that could not be measured. */
function measureSession(parts: readonly Measure[]): Measure {
  const failed = parts.filter((part) => 'error' in part).map(({ target }) => target);
  if (failed.length > 0) return { target: SESSION, error: `cannot sum ${failed.join(', ')}` };
  return { target: SESSION, bytes: parts.reduce((sum, part) => sum + ('bytes' in part ? part.bytes : 0), 0) };
}

/**
 * Every target of the repository at `ctx`, in a fixed order: `briefing`, each other form in the kit's
 * order, each context file in the config's order, then `session`.
 */
export function measureContextBudget({ ctx }: { ctx: Ctx }): Measure[] {
  const briefing = measureForm(ctx, BRIEFING);
  const forms = FORM_IDS.filter((form) => form !== BRIEFING).map((form) => measureForm(ctx, form));
  const contexts = ctx.config.paths.context.map((path) => measureContext(ctx, path));
  return [briefing, ...forms, ...contexts, measureSession([briefing, ...contexts])];
}
