// "A filled form", defined once (PRD 893): a Markdown file under a repository's `paths.playbook`
// (the kit's default layout when its config names none) whose front matter says `state: filled`.
// `omni targets` reads the forms through `gh api` (plan-repo/targets.mjs), `omni init` through git
// at the default branch (init/installed.mjs); both judge each text here. Nothing here throws: front
// matter it cannot read is no filled form, and a config it cannot read names the default layout.
import { parse } from 'yaml';

export const DEFAULT_PLAYBOOK = '.omni-loop/knowledge/playbook';
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
// The date key before /omni:invade was named (forms.mjs reads both).
const OLD_DATE_KEY = 'terraformed';

/** A form text's front matter as an object, `null` when it has none or it is not valid YAML. */
function frontMatter(text) {
  const block = FRONT_MATTER.exec(text ?? '');
  if (!block) return null;
  try {
    const data = parse(block[1]);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** The playbook folder a config text names, the default layout's when it names none. */
export function playbookOf(configText) {
  try {
    const playbook = parse(configText)?.paths?.playbook;
    return typeof playbook === 'string' && playbook.trim() ? playbook.replace(/\/+$/, '') : DEFAULT_PLAYBOOK;
  } catch {
    return DEFAULT_PLAYBOOK;
  }
}

/** Whether a form's text says `state: filled`. */
export const isFilled = (text) => frontMatter(text)?.state === 'filled';

/** The `invaded:` date a form's text carries, as `YYYY-MM-DD`, or `null`. */
export function invadedOn(text) {
  const data = frontMatter(text);
  const date = data?.invaded ?? data?.[OLD_DATE_KEY] ?? null;
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return typeof date === 'string' && date.trim() ? date.trim() : null;
}
