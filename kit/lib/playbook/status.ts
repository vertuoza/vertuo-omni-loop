// @ts-nocheck
/**
 * **The map of the playbook, derived every time** (PRD #45, slice s3) — what `omni kb status`
 * prints: each form, its state, its open questions, its stale evidence and where it reads from.
 * There is no map file to keep: this reads the forms, the kit's templates and git each time.
 *
 * **Stale evidence.** A filled form lists the files it was filled from as `<path>@<hex>`, the first
 * hex of the file's `git hash-object` when it was read. An entry is stale when the file is gone, or
 * its hash no longer starts with the recorded hex: the form may no longer say what the file does.
 *
 * **Source.** Where a form reads from, as a whole: `pointer` for a pointer form, or one whose every
 * section the repository answers is a `See:` line; `repo` when at least one section holds the
 * repository's own text; `kit` when no section comes from the repository (a missing, invalid or
 * blank form, or one holding only open questions).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { registerCounts } from '../knowledge/registers.ts';
import { FORMS, readForm } from './forms.ts';
import { resolveForm } from './resolve.ts';
import { formTemplate } from './templates.ts';

/** `path`'s `git hash-object`, or `null` when git cannot hash it. */
function blobHash(path, { ctx, exec }) {
  try {
    return exec('git', ['hash-object', '--', path], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Each of `evidence`'s entries (`[{ path, hash }]`, as the parser reads them) that is stale:
 * `[{ path, hash, now, exists }]`, `now` the file's hash today (`null` when it is gone or git could
 * not hash it).
 */
export function staleEvidence(evidence, { ctx, exec }) {
  const out = [];
  // An imported copy's evidence names files of its target, never of this disk (PRD 522).
  if (ctx.copyOf) return out;
  for (const { path, hash } of evidence) {
    const exists = existsSync(join(ctx.root, path));
    const now = exists ? blobHash(path, { ctx, exec }) : null;
    if (now === null || !now.startsWith(hash)) out.push({ path, hash, now, exists });
  }
  return out;
}

/** `pointer`, `repo` or `kit`: see the module note. */
function formSource(resolved) {
  if (resolved.state === 'pointer') return 'pointer';
  const sources = resolved.sections.map((section) => section.source);
  if (sources.includes('repo')) return 'repo';
  if (sources.includes('pointer')) return 'pointer';
  return 'kit';
}

/**
 * The map: `{ frontDoor, forms: [{ form, kind, file, state, source, sections: [{ slot, source }],
 * questions: [{ slot, question }], stale: [{ path, hash, now }] }], registers: [{ folder, laws,
 * proposals }] }`, the forms in the kit's order, then each register folder's count of laws and of
 * proposed entries (PRD #68).
 * `state` is the form's own, or `missing`, or `invalid` when its file does not parse; a question is
 * every `TODO(human)` line the form holds, in any section.
 */
export function playbookStatus({ ctx, exec }) {
  const forms = FORMS.map(({ id, kind }) => {
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
      questions: (form?.slots ?? []).flatMap((slot) => slot.body.questions.map((question) => ({ slot: slot.id, question }))),
      stale: staleEvidence(form?.evidence ?? [], { ctx, exec }).map(({ path, hash, now }) => ({ path, hash, now })),
    };
  });
  return { frontDoor: ctx.layout.frontDoor, forms, registers: registerCounts({ ctx }) };
}
