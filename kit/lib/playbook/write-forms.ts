// @ts-nocheck
/**
 * **The blank forms** (PRD #45, slice s3) — what `omni kb init` lays down: every missing form, the
 * front door's page, and, when the front door is the knowledge folder, the empty `product/`
 * registers, because `omni check knowledge` grades any knowledge folder that exists and requires
 * those three files. It never changes a file that exists.
 *
 * A blank form is its template without the kit's text: the front matter (`state: blank`), the
 * title, the opener, and every slot's heading and marker over an empty body. No kit default is
 * ever copied into a repository, so a kit upgrade upgrades every section a repository left blank.
 *
 * Two forms are written as pointers instead (`state: pointer`, no section: the target is the whole
 * form): the decisions form when `paths.adr` is not the front door's `adr/`, and the glossary form
 * when `paths.glossary` is set. The front door's page is the kit's, its `{config:<key>}`
 * placeholders filled from the config. The kit's own provenance line stays in the kit.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { stringify } from 'yaml';
import { LAYER_FILES, productDir } from '../knowledge/registers.ts';
import { DECISIONS_FORM, FORMS, parseForm } from './forms.ts';
import { fillConfig } from './resolve.ts';
import { formTemplate, frontDoorTemplate } from './templates.ts';

/** The kit's provenance line, and the blank lines after it. */
const PROVENANCE = /^<!-- Ported from .*-->\n+/gm;

/** An empty register's title, by its file. */
const REGISTER_TITLES = { 'principles.md': 'Product principles', 'rules.md': 'Product rules', 'invariants.md': 'Product invariants' };

/** `path` without `./`, doubled or trailing slashes, so two spellings of one folder compare equal. */
function samePath(a, b) {
  const clean = (path) => posix.normalize(path).replace(/\/+$/, '');
  return clean(a) === clean(b);
}

/** The path form `id` is written to point at, or `null` when it is written blank. */
function pointerTarget(id, ctx) {
  if (id === DECISIONS_FORM && !samePath(ctx.config.paths.adr, `${ctx.layout.frontDoor}/adr`)) return ctx.config.paths.adr;
  if (id === 'glossary' && ctx.config.paths.glossary !== null) return ctx.config.paths.glossary;
  return null;
}

/** The text of form `id` as `omni kb init` writes it: blank, or a pointer (see the module note). */
export function blankForm(id, { ctx }) {
  const kit = parseForm(formTemplate(id), { file: `kit template ${id}` });
  if (!kit.ok) throw new Error(`the kit's template for ${id} does not parse:\n${kit.errors.join('\n')}`);
  const { formVersion, title, opener, slots } = kit.form;
  const target = pointerTarget(id, ctx);
  const frontMatter = { form: id, 'form-version': formVersion, state: target ? 'pointer' : 'blank', 'points-to': target, evidence: [], invaded: null };
  const lines = ['---', stringify(frontMatter).trimEnd(), '---', '', `# ${title}`, ''];
  if (opener) lines.push(opener, '');
  if (!target) {
    for (const slot of slots) lines.push(`## ${slot.heading}`, `<!-- slot: ${slot.id} · ${slot.required ? 'required' : 'optional'} -->`, '');
  }
  return lines.join('\n');
}

/** The front door's page: the kit's, filled from the config. */
function frontDoorPage(ctx) {
  return fillConfig(frontDoorTemplate().replace(PROVENANCE, ''), ctx.config).text;
}

/**
 * Writes every file of the playbook that is missing under `ctx.root`: the front door's page, the
 * playbook's forms, the decisions form, then the empty registers when the front door is the
 * knowledge folder. `[{ path, wrote }]`, one per file, in that order: `wrote` is `false` for a file
 * that was already there and was left exactly as it was.
 */
export function writeForms({ ctx }) {
  const { frontDoor, knowledgeRoot } = ctx.layout;
  const byFolder = [...FORMS.filter(({ id }) => id !== DECISIONS_FORM), ...FORMS.filter(({ id }) => id === DECISIONS_FORM)];
  const planned = [
    { path: `${frontDoor}/README.md`, text: () => frontDoorPage(ctx) },
    ...byFolder.map(({ id }) => ({ path: ctx.layout.formPath(id), text: () => blankForm(id, { ctx }) })),
  ];
  if (samePath(frontDoor, knowledgeRoot)) {
    for (const name of Object.keys(LAYER_FILES)) {
      planned.push({ path: `${productDir(ctx)}/${name}`, text: () => `# ${REGISTER_TITLES[name]}\n\nNone yet.\n` });
    }
  }
  return planned.map(({ path, text }) => {
    const absolute = join(ctx.root, path);
    if (existsSync(absolute)) return { path, wrote: false };
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, text());
    return { path, wrote: true };
  });
}
