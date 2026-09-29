/**
 * **`omni check kb`** (PRD #45, slice s3) — grades the playbook's forms. A form that points at
 * nothing, or claims a shape the kit does not have, fails; a form that is only unfinished warns,
 * because a hole never blocks delivery. Every line names the file the reader should open.
 *
 * Fails on:
 * - front matter that does not parse, lacks a key or holds another, a malformed slot marker or a
 *   slot used twice (the parser's own errors), or front matter naming another form than its file's;
 * - a `form-version` newer than the kit's template for that form: this kit cannot read it;
 * - a `points-to`, `index`, `See:` or `evidence` path that does not exist;
 * - a slot id the form's template does not define;
 * - a required slot whose marker is missing, except in a pointer form, whose target is the form.
 *
 * Warns on:
 * - each `TODO(human)` question;
 * - a blank required slot of a core form that is not a pointer: the kit default applies;
 * - an `evidence` file whose `git hash-object` no longer starts with the recorded hex;
 * - a missing form file: the kit defaults apply;
 * - each old spelling the parser still reads (`terraformed:`, `by: terraform`, PRD #68), once per
 *   place it appears.
 *
 * A path is read from the repository's root, except in an imported copy's context (PRD 522), whose
 * paths name files of its target and are never looked up. Which slots a form has, and which are required, is
 * its template's say, never its own markers'.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FORMS, parseForm, readForm } from './forms.mjs';
import { staleEvidence } from './status.mjs';
import { formTemplate } from './templates.mjs';

/** One form's grade: `{ state, violations, warnings }`, each line naming `file`. */
function gradeForm({ id, kind }, { ctx, exec }) {
  const read = readForm(id, { ctx });
  const { file } = read;
  if (!read.exists) return { state: 'missing', violations: [], warnings: [`${file}: missing — the kit defaults apply; \`omni kb init\` writes it`] };
  if (!read.ok) return { state: 'invalid', violations: read.errors, warnings: [] };

  const { form } = read;
  const kit = parseForm(formTemplate(id)).form;
  // An imported copy's paths name files of its target, never of this disk (PRD 522).
  const gone = (path) => !ctx.copyOf && !existsSync(join(ctx.root, path));
  const violations = [];
  const warnings = [];

  if (form.id !== id) violations.push(`${file}: front matter says form: ${form.id}, but this is the ${id} form's file`);
  if (form.formVersion > kit.formVersion) {
    violations.push(`${file}: form-version ${form.formVersion} is newer than this kit's ${kit.formVersion} for the ${id} form — upgrade the kit`);
  }
  if (form.pointsTo !== null && gone(form.pointsTo)) violations.push(`${file}: points-to ${form.pointsTo} does not exist`);
  if (form.index !== null && gone(form.index)) violations.push(`${file}: index ${form.index} does not exist`);
  for (const { path, hash, now, exists } of staleEvidence(form.evidence, { ctx, exec })) {
    if (!exists) violations.push(`${file}: evidence ${path} does not exist`);
    else if (now === null) warnings.push(`${file}: evidence ${path}@${hash} could not be hashed`);
    else warnings.push(`${file}: evidence ${path}@${hash} is stale — the file has changed since (now ${now.slice(0, 7)})`);
  }

  for (const { where, old, now } of form.oldSpellings) warnings.push(`${file}: ${where} says ${old} — the old spelling; write ${now}`);

  const pointer = form.state === 'pointer';
  for (const slot of form.slots) {
    const kitSlot = kit.slots.find((entry) => entry.id === slot.id);
    if (!kitSlot) {
      violations.push(`${file}: slot "${slot.id}" is not a slot of the ${id} form — its slots are ${kit.slots.map((entry) => entry.id).join(', ')}`);
    }
    if (slot.body.kind === 'pointer' && gone(slot.body.see.path)) violations.push(`${file}: "## ${slot.heading}" See: ${slot.body.see.path} does not exist`);
    if (kitSlot?.required && kind === 'core' && !pointer && slot.body.kind === 'empty') {
      warnings.push(`${file}: required slot "${slot.id}" is blank — the kit default applies`);
    }
    for (const question of slot.body.questions) warnings.push(`${file}: "## ${slot.heading}" TODO(human): ${question}`);
  }
  if (!pointer) {
    for (const kitSlot of kit.slots.filter((entry) => entry.required && !form.slots.some((slot) => slot.id === entry.id))) {
      violations.push(`${file}: required slot "${kitSlot.id}" has no marker — want "## ${kitSlot.heading}", then <!-- slot: ${kitSlot.id} · required -->`);
    }
  }
  return { state: form.state, violations, warnings };
}

/**
 * The whole grade of the playbook at `ctx`: `{ violations, warnings, forms: [{ form, state }] }`,
 * the forms in the kit's order, `state` `missing` or `invalid` when the file is not there or does
 * not parse. `exec` runs `git hash-object` for the evidence.
 */
export function gradePlaybook({ ctx, exec }) {
  const violations = [];
  const warnings = [];
  const forms = FORMS.map((entry) => {
    const grade = gradeForm(entry, { ctx, exec });
    violations.push(...grade.violations);
    warnings.push(...grade.warnings);
    return { form: entry.id, state: grade.state };
  });
  return { violations, warnings, forms };
}
