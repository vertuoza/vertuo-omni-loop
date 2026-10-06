// "A filled form", defined once (PRD 893): a Markdown file under a repository's `paths.playbook`
// (the kit's default layout when its config names none) whose front matter says `state: filled`.
// `omni targets` reads the forms through `gh api` (plan-repo/targets.ts), `omni init` through git
// at the default branch (init/installed.ts); both judge each text here. Nothing here throws: front
// matter it cannot read is no filled form, and a config it cannot read names the default layout.
import { parse } from 'yaml';
import { FilledFrontMatterSchema, PlaybookConfigSchema } from './schema.ts';
import type { FilledFrontMatter } from './schema.ts';

export const DEFAULT_PLAYBOOK = '.omni-loop/knowledge/playbook';
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** A form text's front matter, `null` when it has none or it is not a YAML object. */
function frontMatter(text: string | null | undefined): FilledFrontMatter | null {
  const block = FRONT_MATTER.exec(text ?? '');
  if (!block) return null;
  try {
    const read = FilledFrontMatterSchema.safeParse(parse(block[1] ?? ''));
    return read.success ? read.data : null;
  } catch {
    return null;
  }
}

/** The playbook folder a config text names, the default layout's when it names none. */
export function playbookOf(configText: string): string {
  try {
    const read = PlaybookConfigSchema.safeParse(parse(configText));
    const playbook = read.success ? read.data.paths?.playbook : undefined;
    return typeof playbook === 'string' && playbook.trim() ? playbook.replace(/\/+$/, '') : DEFAULT_PLAYBOOK;
  } catch {
    return DEFAULT_PLAYBOOK;
  }
}

/** Whether a form's text says `state: filled`. */
export const isFilled = (text: string | null | undefined): boolean => frontMatter(text)?.state === 'filled';

/** The `invaded:` date a form's text carries (or its old `terraformed:` spelling), as `YYYY-MM-DD`, or `null`. */
export function invadedOn(text: string | null | undefined): string | null {
  const data = frontMatter(text);
  const date = data?.invaded ?? data?.terraformed ?? null;
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return typeof date === 'string' && date.trim() ? date.trim() : null;
}
