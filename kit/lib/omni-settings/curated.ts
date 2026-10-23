/**
 * **The curated first default** (PRD 2417, s1): the tech playbook the kit ships for a settings
 * repository to start from — how an AI agent answers a review (fix, push back, ask), what done
 * means, what is green before a push, and how a bug becomes a pull request. Each page is a form the
 * forms' own parser reads, every section filled, with an `owner:` line (`./page.ts`).
 *
 * The pages are kit templates (`kit/templates/omni-settings/`, laid out as the settings folder is,
 * `./layout.ts`), so they travel inside the bundle as every kit default does. They are no level of
 * the tree by themselves: a repository reads them only once its settings repository holds them, and
 * the Omni page shows them beside the settings repository's own pages.
 */
import { kitTemplate } from '../playbook/templates.ts';
import { defined } from '../narrow.ts';
import { formRelativePath } from './layout.ts';
import type { SettingsFile } from './schema.ts';

/** The forms the curated default sets, in the order they are shown. */
export const CURATED_FORMS: readonly string[] = Object.freeze(['review', 'definition-of-done', 'verification', 'bug-fixing']);

/** The kit's templates folder for the settings repository. */
const CURATED_DIR = 'omni-settings';

/** The curated default, one settings file per form of {@link CURATED_FORMS}, each its template's text. */
export function curatedDefault(): SettingsFile[] {
  return CURATED_FORMS.map((form) => ({ form, text: kitTemplate(`${CURATED_DIR}/${defined(formRelativePath(form), `the curated form ${form}`)}`) }));
}
