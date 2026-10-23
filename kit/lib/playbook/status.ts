/**
 * **The map of the playbook, derived every time** (PRD #45, slice s3) — what `omni kb status`
 * prints: each form, its state, its open questions, its stale evidence and where it reads from.
 * There is no map file to keep: this reads the forms, the kit's templates and git each time.
 *
 * **Stale evidence.** A filled form lists the files it was filled from as `<path>@<hex>`, the first
 * hex of the file's `git hash-object` when it was read. An entry is stale when the file is gone, or
 * its hash no longer starts with the recorded hex: the form may no longer say what the file does.
 * A change to its `"version"` line alone is no change (bug 2278): the release commit bumps it in
 * `package.json` after every merge, and no form says a version.
 *
 * **Source.** Where a form reads from, as a whole: `pointer` for a pointer form, or one whose every
 * section the repository answers is a `See:` line; `repo` when at least one section holds the
 * repository's own text; `kit` when no section comes from the repository (a missing, invalid or
 * blank form, or one holding only open questions).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Context, ExecText } from '../context.ts';
import { LEVELS } from '../knowledge-tree/levels.ts';
import type { Level } from '../knowledge-tree/levels.ts';
import { registerCounts } from '../knowledge/registers.ts';
import { FORMS, readForm } from './forms.ts';
import type { FormSpec } from './forms.ts';
import { resolveForm } from './resolve.ts';
import type { ResolvedForm, SectionSource } from './resolve.ts';

/** What the playbook's map reads of a context: an imported copy's carries `copyOf` (PRD 522). */
export type PlaybookCtx = Pick<Context, 'root' | 'layout' | 'config'> & { copyOf?: string };

/** One stale evidence entry: `now` is the file's hash today, `null` when gone or unhashable. */
export type StaleEvidence = { path: string; hash: string; now: string | null; exists: boolean };

/** Where a form reads from, as a whole. */
type FormSource = 'pointer' | 'repo' | 'kit';

/** How many of a form's sections each level answers (PRD 2416, s2); a level that answers none is absent. */
type LevelCounts = Partial<Record<Level, number>>;

/** The level a section's source names, `null` for a pointer or an open question (no level answers it). */
const SOURCE_LEVEL: Readonly<Partial<Record<SectionSource, Level>>> = Object.freeze({
  repo: 'repo',
  'plan-repo': 'plan repo',
  'omni-settings': 'omni settings',
  kit: 'kit default',
});

/** `sections` counted per level, in the tree's order. */
function levelCounts(sections: readonly { source: SectionSource }[]): LevelCounts {
  const counts: LevelCounts = {};
  for (const level of LEVELS) {
    const n = sections.filter(({ source }) => SOURCE_LEVEL[source] === level).length;
    if (n > 0) counts[level] = n;
  }
  return counts;
}

/** One form's row of the map. */
type FormStatus = {
  form: string;
  kind: FormSpec['kind'];
  file: string;
  state: ResolvedForm['state'];
  source: FormSource;
  sections: { slot: string | null; source: SectionSource }[];
  levels: LevelCounts;
  questions: { slot: string; question: string }[];
  stale: { path: string; hash: string; now: string | null }[];
};
import { formTemplate } from './templates.ts';

/** `path`'s `git hash-object`, or `null` when git cannot hash it. */
function blobHash(path: string, { ctx, exec }: { ctx: Pick<Context, 'root'>; exec: ExecText }): string | null {
  try {
    return exec('git', ['hash-object', '--', path], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** A manifest's `"version": "<v>",` line. */
const VERSION_LINE = /^\s*"version"\s*:\s*"[^"]*",?\s*$/;

/** Whether `path` differs from the blob recorded as `hash` only in its `"version"` lines; `false`
 * when git no longer holds that blob. */
function versionOnly(path: string, hash: string, { ctx, exec }: { ctx: Pick<Context, 'root'>; exec: ExecText }): boolean {
  let before: string;
  try {
    before = exec('git', ['cat-file', 'blob', hash], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return false;
  }
  const was = before.split('\n');
  const is = readFileSync(join(ctx.root, path), 'utf8').split('\n');
  if (was.length !== is.length) return false;
  return was.every((line, i) => line === is[i] || (VERSION_LINE.test(line) && VERSION_LINE.test(is[i] ?? '')));
}

/**
 * Each of `evidence`'s entries (`[{ path, hash }]`, as the parser reads them) that is stale:
 * `[{ path, hash, now, exists }]`, `now` the file's hash today (`null` when it is gone or git could
 * not hash it).
 */
export function staleEvidence(
  evidence: readonly { path: string; hash: string }[],
  { ctx, exec }: { ctx: Pick<PlaybookCtx, 'root' | 'copyOf'>; exec: ExecText },
): StaleEvidence[] {
  const out: StaleEvidence[] = [];
  // An imported copy's evidence names files of its target, never of this disk (PRD 522).
  if (ctx.copyOf) return out;
  for (const { path, hash } of evidence) {
    const exists = existsSync(join(ctx.root, path));
    const now = exists ? blobHash(path, { ctx, exec }) : null;
    if (now !== null && now.startsWith(hash)) continue;
    if (now !== null && versionOnly(path, hash, { ctx, exec })) continue;
    out.push({ path, hash, now, exists });
  }
  return out;
}

/** `pointer`, `repo` or `kit`: see the module note. */
function formSource(resolved: ResolvedForm): FormSource {
  if (resolved.state === 'pointer') return 'pointer';
  const sources = resolved.sections.map((section) => section.source);
  if (sources.includes('repo')) return 'repo';
  if (sources.includes('pointer')) return 'pointer';
  return 'kit';
}

/**
 * The map: `{ frontDoor, forms: [{ form, kind, file, state, source, sections: [{ slot, source }],
 * levels: { <level>: <sections it answers> }, questions: [{ slot, question }], stale: [{ path, hash, now }] }], registers: [{ folder, laws,
 * proposals }] }`, the forms in the kit's order, then each register folder's count of laws and of
 * proposed entries (PRD #68).
 * `state` is the form's own, or `missing`, or `invalid` when its file does not parse; a question is
 * every `TODO(human)` line the form holds, in any section.
 */
export function playbookStatus({ ctx, exec }: { ctx: PlaybookCtx; exec: ExecText }) {
  const forms = FORMS.map(({ id, kind }): FormStatus => {
    const resolved = resolveForm(id, { ctx, template: formTemplate(id) });
    const read = readForm(id, { ctx });
    const form = read.exists && read.ok ? read.form : null;
    return {
      form: id,
      kind,
      file: resolved.file,
      state: resolved.state,
      source: formSource(resolved),
      sections: resolved.sections.map(({ slot, source }) => ({ slot, source })),
      levels: levelCounts(resolved.sections),
      questions: (form?.slots ?? []).flatMap((slot) => slot.body.questions.map((question) => ({ slot: slot.id, question }))),
      stale: staleEvidence(form?.evidence ?? [], { ctx, exec }).map(({ path, hash, now }) => ({ path, hash, now })),
    };
  });
  return { frontDoor: ctx.layout.frontDoor, forms, registers: registerCounts({ ctx }) };
}
