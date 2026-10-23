/**
 * **The curated first default's shape** (PRD 2417): which forms it sets, where each page lies under
 * the kit's templates folder, and how the pages are read into settings files, from a reader handed in.
 *
 * It never imports the templates loader, so an app bundler can take it: the loader finds the kit's
 * templates folder through `new URL(…, import.meta.url)`, which a bundler resolves at build time and
 * cannot (the Omni page's build refuses it). The kit reads the pages through the loader
 * (`./curated.ts`); the Omni page reads the same files from its checkout.
 */
import { defined } from '../narrow.ts';
import { formRelativePath } from './layout.ts';
import type { SettingsFile } from './schema.ts';

/** The forms the curated default sets, in the order they are shown. */
export const CURATED_FORMS: readonly string[] = Object.freeze(['review', 'definition-of-done', 'verification', 'bug-fixing']);

/** The kit's templates folder for the settings repository. */
const CURATED_DIR = 'omni-settings';

/** Where form `form`'s curated page lies under the kit's templates folder. */
export function curatedPath(form: string): string {
  return `${CURATED_DIR}/${defined(formRelativePath(form), `the curated form ${form}`)}`;
}

/** The curated default, one settings file per form of {@link CURATED_FORMS}, each read by `read`
 * from its path under the kit's templates folder. */
export function curatedFrom(read: (path: string) => string): SettingsFile[] {
  return CURATED_FORMS.map((form) => ({ form, text: read(curatedPath(form)) }));
}
