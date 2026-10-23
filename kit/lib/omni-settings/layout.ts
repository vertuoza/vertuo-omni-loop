/**
 * **Where a settings repository keeps its tech playbook** (PRD 2417, s1). The workspace's settings
 * repository (its plan repository when it has one, else a repository the workspace names) holds the
 * Omni settings level of the knowledge tree in one folder, `.omni-loop/settings/`, laid out as a
 * knowledge folder is, so the local copy of it (`levelFolder('omni settings')`) mirrors it path for
 * path:
 *
 * ```text
 * .omni-loop/settings/
 *   playbook/<form>.md        one per form it sets, every form but the decisions form
 *   adr/README.md             the decisions form, beside the decision records
 * ```
 *
 * It sits beside the repository's own knowledge, never inside it: a plan repository's own playbook
 * is the plan repository level, and its settings folder is the level above every repository.
 */
import { DECISIONS_FORM, FORM_IDS } from '../playbook/forms.ts';

/** The settings folder, relative to the settings repository's root. */
export const SETTINGS_DIR = '.omni-loop/settings';

/** Where form `form` lies under a folder laid out as a knowledge folder is; `null` for a form the
 * kit does not have. */
export function formRelativePath(form: string): string | null {
  if (!FORM_IDS.includes(form)) return null;
  return form === DECISIONS_FORM ? 'adr/README.md' : `playbook/${form}.md`;
}

/** Where form `form` lies in the settings repository; `null` for a form the kit does not have. */
export function settingsFilePath(form: string): string | null {
  const relative = formRelativePath(form);
  return relative === null ? null : `${SETTINGS_DIR}/${relative}`;
}

/** The form a path of the settings repository holds, or `null` for a path that holds none. */
export function formOfSettingsPath(path: string): string | null {
  return FORM_IDS.find((form) => settingsFilePath(form) === path) ?? null;
}
