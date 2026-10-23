/**
 * **How a section is resolved** (PRD #45, slice s1). Three layers per slot, top wins: a pointer,
 * then the repository's section, then the kit default. Each section says where it came from:
 *
 * | the repository section is…        | it resolves to…                                   | label                            |
 * |-----------------------------------|---------------------------------------------------|----------------------------------|
 * | filled                            | the repository text                               | `[repo]`, `[repo · by human]`, `[repo · verified <date>]` |
 * | a `See: <path>` line              | the page it names                                 | `[→ <path>]`                     |
 * | empty                             | the kit default for that slot                     | `[kit default]`                  |
 * | holding `TODO(human)` lines       | the kit default, then each open question          | `[hole]`                         |
 * | in a form with `state: pointer`   | the whole target: a file's text; a folder's `index`, else its Markdown file list | `[→ <path>]` |
 * | in a form file that is missing    | the kit default for every slot                    | `[kit default]`                  |
 *
 * A kit default made only of `TODO(human)` lines (PRD 1369: the design form's `product` and
 * `system`, which only the repository can answer) is no default: a section that falls through to
 * it is a `[hole]` holding the kit's questions, and a repository's own questions replace them.
 *
 * The kit default is passed in: the text of the kit's template for the form, which parses with
 * the same parser and whose slot bodies are the defaults. This module reads no template itself.
 * The sections come in the template's order, under its headings; a slot the template does not
 * define is the check's to report, not this module's to show.
 *
 * A kit default may name a config value as `{config:<key>}`, filled from `ctx.config`. A key the
 * config does not hold, or one holding no single value (unset, a list, a section), is left visible
 * as written and reported: an honest placeholder, never a guess. The repository's own text is
 * never filled.
 *
 * Nothing here throws on a repository's content: a dead pointer or a form that does not parse is
 * reported in `problems`, one `file: detail` line each, and the kit default shows through.
 *
 * **The knowledge tree** (PRD 2416). Between the repository and the kit default sit the levels the
 * tree reads bottom-up (`../knowledge-tree/levels.ts`): the plan repository's copy, then the Omni
 * settings' copy. Where the repository has no answer for a slot (its section empty, holding only
 * `TODO(human)` lines, or its form file missing or unparsable), the nearest level whose section holds
 * text answers it, tagged `[plan repo]` or `[omni settings]`; only when none does is it the kit
 * default. A repository hole keeps its questions, and the level's text shows in place of the kit
 * default, tagged `[hole · <level>]`. A level's section that is empty, holds only `TODO(human)` lines
 * or is a `See:` line (whose path names the other repository's file, not this disk's) is no answer,
 * and neither is a level's pointer form: the next level is read. A level's text is never filled from
 * the config: it is a repository's own text. A level whose copy is absent is skipped, so a repository
 * with no copy resolves exactly as it did before the tree.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { levelCopies } from '../knowledge-tree/levels.ts';
import type { CopyLevel, LevelCopy } from '../knowledge-tree/levels.ts';
import { defined } from '../narrow.ts';
import { parseForm, readForm } from './forms.ts';
import type { Form, FormState, Slot } from './forms.ts';

/** A config value by its key: its text, or why it holds none. */
type ConfigValue = { ok: true; text: string } | { ok: false; reason: string };

/** A `{config:<key>}` placeholder left as written, and why. */
export type Unresolved = { key: string; reason: string };

/** Where a resolved section came from: `plan-repo` and `omni-settings` are levels of the tree. */
export type SectionSource = 'repo' | 'pointer' | 'kit' | 'hole' | 'plan-repo' | 'omni-settings';

/** The source a section answered by a level's copy carries. */
const LEVEL_SOURCE: Readonly<Record<CopyLevel, SectionSource>> = Object.freeze({ 'plan repo': 'plan-repo', 'omni settings': 'omni-settings' });

/** One resolved section: `slot` is `null` for a pointer form's one section. */
export type Section = {
  slot: string | null;
  heading: string | null;
  source: SectionSource;
  label: string;
  text: string;
  questions: string[];
};

/** A form resolved over its template, as `omni kb show` prints it. */
export type ResolvedForm = {
  form: string;
  file: string;
  state: FormState | 'missing' | 'invalid';
  title: string | null;
  sections: Section[];
  problems: string[];
};

/** What resolving reads of a context. */
type Ctx = Pick<Context, 'root' | 'layout' | 'config'>;

const CONFIG_PLACEHOLDER = /\{config:([^{}\s]+)\}/g;

/** One config value by its dotted key, walked as `omni config <key>` walks it. */
function configValue(config: unknown, key: string): ConfigValue {
  let value: unknown = config;
  for (const part of key.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
      return { ok: false, reason: 'names no config key' };
    }
    const next: unknown = Reflect.get(value, part);
    value = next;
  }
  if (['string', 'number', 'boolean'].includes(typeof value)) return { ok: true, text: String(value) };
  if (value === null) return { ok: false, reason: 'is not set in the config' };
  return { ok: false, reason: 'holds no single value' };
}

/**
 * Fills every `{config:<key>}` in `text` from `config`. `{ text, unresolved: [{ key, reason }] }`:
 * a placeholder that cannot be filled stays in `text` exactly as written.
 */
export function fillConfig(text: string, config: unknown): { text: string; unresolved: Unresolved[] } {
  const unresolved: Unresolved[] = [];
  const filled = text.replace(CONFIG_PLACEHOLDER, (placeholder: string, key: string) => {
    const value = configValue(config, key);
    if (value.ok) return value.text;
    unresolved.push({ key, reason: value.reason });
    return placeholder;
  });
  return { text: filled, unresolved };
}

/**
 * The text a repository path shows: a file's text; a folder's `index` when one is given, else the
 * folder's Markdown files, one path a line. `{ text, missing }`, `missing` naming the path that
 * does not exist.
 */
function readTarget(path: string, index: string | null, { ctx }: { ctx: Pick<Context, 'root'> }): { text: string; missing: string | null } {
  const absolute = join(ctx.root, path);
  if (!existsSync(absolute)) return { text: '', missing: path };
  if (!statSync(absolute).isDirectory()) return { text: readFileSync(absolute, 'utf8').trim(), missing: null };
  if (index) return readTarget(index, null, { ctx });
  const dir = path.replace(/\/+$/, '');
  const pages = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
  return { text: pages.join('\n'), missing: null };
}

/** A heading's anchor as GitHub writes it: lower case, punctuation dropped, spaces to hyphens. */
function headingAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Each heading of `lines` with its line index, its depth and its anchor; a fenced code block holds none. */
function headingsOf(lines: string[]): { index: number; depth: number; anchor: string }[] {
  const headings: { index: number; depth: number; anchor: string }[] = [];
  let fenced = false;
  for (const [index, line] of lines.entries()) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) headings.push({ index, depth: heading[1]?.length ?? 0, anchor: headingAnchor(heading[2] ?? '') });
  }
  return headings;
}

/**
 * The section of `text` whose heading's anchor is `anchor`: that heading and every line under it,
 * its own subsections included, up to the next heading of its level or higher. `null` when no
 * heading has that anchor.
 */
function sectionOf(text: string, anchor: string): string | null {
  const lines = text.split('\n');
  const headings = headingsOf(lines);
  const start = headings.find((heading) => heading.anchor === anchor);
  if (!start) return null;
  const end = headings.find((heading) => heading.index > start.index && heading.depth <= start.depth);
  return lines.slice(start.index, end?.index).join('\n').trim();
}

/** A `See: <path>[#anchor]` slot: the page it names, or only the section its anchor names. */
function resolvePointer(
  base: { slot: string; heading: string },
  see: { path: string; anchor: string | null },
  { ctx, heading, file, problems }: { ctx: Ctx; heading: string; file: string; problems: string[] },
): Section {
  const { path, anchor } = see;
  const target = readTarget(path, null, { ctx });
  const pointer = anchor ? `${path}#${anchor}` : path;
  const label = `[→ ${pointer}]`;
  if (target.missing) {
    problems.push(`${file}: "## ${heading}" See: ${path} does not exist`);
    return { ...base, source: 'pointer', label, text: '', questions: [] };
  }
  if (!anchor) return { ...base, source: 'pointer', label, text: target.text, questions: [] };
  const section = sectionOf(target.text, anchor);
  if (section === null) problems.push(`${file}: "## ${heading}" See: ${pointer} names no heading of ${path}`);
  return { ...base, source: 'pointer', label, text: section ?? '', questions: [] };
}

/** `[repo]`, `[repo · by human]`, `[repo · verified <date>]`, or both. */
function repoLabel(slot: Slot): string {
  const parts = ['repo'];
  if (slot.by === 'human') parts.push('by human');
  if (slot.verified) parts.push(`verified ${slot.verified}`);
  return `[${parts.join(' · ')}]`;
}

/** One level's form, read from its copy. */
type LevelForm = { level: CopyLevel; form: Form };

/** The form `formId` of each copy in `levels`, bottom-up; a copy whose form is missing or a pointer
 * is left out, and one whose form does not parse is left out and reported. */
function levelForms(formId: string, levels: readonly LevelCopy[], problems: string[]): LevelForm[] {
  return levels.flatMap(({ level, ctx }) => {
    const read = readForm(formId, { ctx });
    if (!read.exists) return [];
    if (!read.ok) {
      problems.push(...read.errors);
      return [];
    }
    return read.form.state === 'pointer' ? [] : [{ level, form: read.form }];
  });
}

/** The nearest level whose slot `slotId` holds text: its level and that slot's body, or `null`. */
function levelAnswer(slotId: string, levels: readonly LevelForm[]): { level: CopyLevel; text: string; questions: string[] } | null {
  for (const { level, form } of levels) {
    const body = form.slots.find((slot) => slot.id === slotId)?.body;
    if (body?.kind === 'text') return { level, text: body.text, questions: body.questions };
  }
  return null;
}

/** What resolving one slot reads, beside the slots themselves. */
type SlotIo = { ctx: Ctx; formId: string; file: string; levels: readonly LevelForm[]; problems: string[] };

/** The kit default for `kitSlot`, filled from the config; `holes` are the repository's own open
 * questions for it, `null` when it asks none. */
function kitDefault(kitSlot: Slot, holes: string[] | null, { ctx, formId, problems }: Omit<SlotIo, 'file' | 'levels'>): Section {
  const base = { slot: kitSlot.id, heading: kitSlot.heading };
  const kit = fillConfig(kitSlot.body.text, ctx.config);
  for (const { key, reason } of kit.unresolved) {
    problems.push(`kit default ${formId}#${kitSlot.id}: {config:${key}} ${reason}`);
  }
  const kitHoles = kitSlot.body.kind === 'holes';
  if (holes) return { ...base, source: 'hole', label: '[hole]', text: kitHoles ? '' : kit.text, questions: holes };
  if (kitHoles) return { ...base, source: 'hole', label: '[hole]', text: '', questions: kitSlot.body.questions };
  return { ...base, source: 'kit', label: '[kit default]', text: kit.text, questions: [] };
}

/** A slot the repository does not answer: the nearest level's text, else the kit default. `holes`
 * are the repository's own open questions for it, `null` when it asks none. */
function fallThrough(kitSlot: Slot, holes: string[] | null, io: SlotIo): Section {
  const answer = levelAnswer(kitSlot.id, io.levels);
  if (!answer) return kitDefault(kitSlot, holes, io);
  const base = { slot: kitSlot.id, heading: kitSlot.heading };
  if (holes) return { ...base, source: 'hole', label: `[hole · ${answer.level}]`, text: answer.text, questions: holes };
  return { ...base, source: LEVEL_SOURCE[answer.level], label: `[${answer.level}]`, text: answer.text, questions: answer.questions };
}

/** One slot, resolved from the repository's slot (or `null`), then the levels', over the template's. */
function resolveSlot(kitSlot: Slot, repoSlot: Slot | null, io: SlotIo): Section {
  const base = { slot: kitSlot.id, heading: kitSlot.heading };
  const body = repoSlot?.body ?? null;
  if (repoSlot !== null && body?.kind === 'text') {
    return { ...base, source: 'repo', label: repoLabel(repoSlot), text: body.text, questions: body.questions };
  }
  if (repoSlot !== null && body?.kind === 'pointer') {
    return resolvePointer(base, body.see, { ctx: io.ctx, heading: repoSlot.heading, file: io.file, problems: io.problems });
  }
  return fallThrough(kitSlot, body?.kind === 'holes' ? body.questions : null, io);
}

/**
 * Resolves the form `formId` of the repository at `ctx`, over `template`, the text of the kit's
 * template for it.
 *
 * `{ form, file, state, title, sections: [{ slot, heading, source, label, text, questions }],
 * problems }`: `state` is the form's own (`blank`, `filled`, `pointer`), or `missing` when its file
 * is not there, or `invalid` when it does not parse; `source` is `repo`, `pointer`, `kit`, `hole`,
 * or the level of the tree that answered it, `plan-repo` or `omni-settings`. A pointer form
 * resolves to one section, its whole target, with `slot: null`.
 */
export function resolveForm(formId: string, { ctx, template }: { ctx: Ctx; template: string }): ResolvedForm {
  const kit = parseForm(template, { file: `kit template ${formId}` });
  if (!kit.ok) throw new Error(`the kit's template for ${formId} does not parse:\n${kit.errors.join('\n')}`);

  const read = readForm(formId, { ctx });
  const { file } = read;
  const problems: string[] = [];
  let repo: Form | null = null;
  let state: ResolvedForm['state'] = 'missing';
  if (read.exists && read.ok) {
    repo = read.form;
    state = repo.state;
  } else if (read.exists) {
    state = 'invalid';
    problems.push(...read.errors);
  }
  const title = repo?.title ?? kit.form.title;

  if (repo?.state === 'pointer') {
    const target = readTarget(defined(repo.pointsTo, `the points-to of ${file}`), repo.index, { ctx }); // a pointer form always names points-to (its schema refuses one without)
    if (target.missing) problems.push(`${file}: ${target.missing === repo.pointsTo ? 'points-to' : 'index'} ${target.missing} does not exist`);
    const section: Section = { slot: null, heading: title, source: 'pointer', label: `[→ ${repo.pointsTo}]`, text: target.text, questions: [] };
    return { form: formId, file, state, title, sections: [section], problems };
  }

  const levels = levelForms(formId, levelCopies({ ctx }), problems);
  const sections = kit.form.slots.map((kitSlot) => {
    const repoSlot = repo?.slots.find((slot) => slot.id === kitSlot.id) ?? null;
    return resolveSlot(kitSlot, repoSlot, { ctx, formId, file, levels, problems });
  });
  return { form: formId, file, state, title, sections, problems };
}
