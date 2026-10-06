// What `playbook/filled.ts` reads out of a repository's files, as schemas: the one key of its
// `.omni-loop/config.yml` that places the playbook, and the keys of a form's front matter that say
// whether it is filled and when. Each names only those keys and lets every other through; a value
// they refuse is read as missing, never as an error.
import { z } from 'zod';

/** What a config is read for: its playbook folder, when it names one. */
export const PlaybookConfigSchema = z.looseObject({ paths: z.looseObject({ playbook: z.unknown().optional() }).nullish() });

/** What a form's front matter is read for: its state, and its `invaded:` date (or the old `terraformed:`). */
export const FilledFrontMatterSchema = z.looseObject({ state: z.unknown().optional(), invaded: z.unknown().optional(), terraformed: z.unknown().optional() });
export type FilledFrontMatter = z.infer<typeof FilledFrontMatterSchema>;
