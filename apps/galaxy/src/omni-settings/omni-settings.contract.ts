// The Omni settings area's contract (PRD 2417, s3): what the page serves a repository of its
// workspace's settings repository, as the kit's own schema (kit/lib/omni-settings/schema.ts), so
// `omni sync` and this area read one shape.
export { SettingsPlaybookSchema, type SettingsPlaybook, type SettingsFile } from 'omni-loop/kit/lib/omni-settings/schema.ts';

/** One page of the tech playbook as the Omni page shows it (PRD 2417, s6): its form, its text, and
 * whose it is: the settings repository's own file, or the kit's first default. */
export type PlaybookPage = { form: string; text: string; source: 'settings' | 'kit' };

/** The tech playbook of a workspace's settings repository, page by page: the repository and commit
 * read (null with none), and why no page is listed when the reason is not null. */
export type PlaybookPagesView = { repository: string | null; commit: string | null; reason: string | null; pages: PlaybookPage[] };
