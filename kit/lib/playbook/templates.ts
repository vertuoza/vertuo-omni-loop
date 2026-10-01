// @ts-nocheck
/**
 * **The kit defaults** (PRD #45, slice s2) — the one loader for the kit's templates. The templates
 * folder mirrors the front door: its `README.md` is the front door's page, which `omni kb init`
 * writes, and `playbook/<form>.md` is one template per form, the decisions form included, whose
 * slot bodies are the kit defaults `resolveForm` shows through a section a repository left blank.
 *
 * ```text
 * kit/templates/
 *   README.md                  the front door's page
 *   playbook/<form>.md         one per form of FORMS
 * ```
 *
 * The defaults travel inside the bundle, so a repository that runs `omni` needs no other file:
 * `kit/build.ts` reads the folder with {@link readTemplates} and defines `__OMNI_TEMPLATES__` as
 * its JSON. From source, the same paths are read from the folder itself. Either way a template is
 * asked for by its path, and the text is the file's, byte for byte.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORM_IDS } from './forms.ts';

/* global __OMNI_TEMPLATES__ */
const BUNDLED = typeof __OMNI_TEMPLATES__ === 'undefined' ? null : JSON.parse(__OMNI_TEMPLATES__);

/** The front door's page, under the templates folder. */
export const FRONT_DOOR_TEMPLATE = 'README.md';

/** The kit's templates folder, when running from source. */
function templatesDir() {
  return fileURLToPath(new URL('../../templates/', import.meta.url));
}

/** Every file under `dir`, as `{ <posix path under dir>: text }`, in code-point order of the
 * names, so a build is the same on every machine. */
export function readTemplates(dir = templatesDir()) {
  const out = {};
  const walk = (sub) => {
    const entries = readdirSync(join(dir, sub), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const path = sub ? posix.join(sub, entry.name) : entry.name;
      if (entry.isDirectory()) walk(path);
      else out[path] = readFileSync(join(dir, path), 'utf8');
    }
  };
  walk('');
  return out;
}

/** One template's text, by its path under the templates folder: the bundle's copy, else the file. */
function templateText(path) {
  if (BUNDLED) {
    if (!Object.hasOwn(BUNDLED, path)) throw new Error(`the bundle carries no template ${path}`);
    return BUNDLED[path];
  }
  return readFileSync(join(templatesDir(), path), 'utf8');
}

/** The path of form `id`'s template under the templates folder. */
export function templatePath(id) {
  if (!FORM_IDS.includes(id)) throw new Error(`the kit has no form "${id}"`);
  return `playbook/${id}.md`;
}

/** The text of the kit's template for form `id`: what `resolveForm` takes as `template`. */
export function formTemplate(id) {
  return templateText(templatePath(id));
}

/** The text of the front door's page, `{config:<key>}` placeholders unfilled. */
export function frontDoorTemplate() {
  return templateText(FRONT_DOOR_TEMPLATE);
}
