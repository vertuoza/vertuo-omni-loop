/**
 * **The curated first default** (PRD 2417, s1): the tech playbook the kit ships for a settings
 * repository to start from — how an AI agent answers a review (fix, push back, ask), what done
 * means, what is green before a push, and how a bug becomes a pull request. Each page is a form the
 * forms' own parser reads, every section filled, with an `owner:` line (`./page.ts`).
 *
 * The pages are kit templates (`kit/templates/omni-settings/`, laid out as the settings folder is,
 * `./layout.ts`), so they travel inside the bundle as every kit default does. They are no level of
 * the tree by themselves: a repository reads them only once its settings repository holds them, and
 * the Omni page shows them beside the settings repository's own pages (through `./curated-forms.ts`,
 * which an app bundler can take).
 */
import { kitTemplate } from '../playbook/templates.ts';
import { curatedFrom } from './curated-forms.ts';
import type { SettingsFile } from './schema.ts';

export { CURATED_FORMS } from './curated-forms.ts';

/** The curated default, one settings file per form of `CURATED_FORMS`, each its template's text. */
export function curatedDefault(): SettingsFile[] {
  return curatedFrom(kitTemplate);
}
