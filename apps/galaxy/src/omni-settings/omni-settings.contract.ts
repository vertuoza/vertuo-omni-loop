// The Omni settings area's contract (PRD 2417, s3): what the page serves a repository of its
// workspace's settings repository, as the kit's own schema (kit/lib/omni-settings/schema.ts), so
// `omni sync` and this area read one shape.
import { z } from 'zod';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';

export { SettingsPlaybookSchema, type SettingsPlaybook, type SettingsFile } from 'omni-loop/kit/lib/omni-settings/schema.ts';

/** One page of the tech playbook as the Omni page shows it (PRD 2417, s6): its form, its text, and
 * whose it is: the settings repository's own file, or the kit's first default. */
export type PlaybookPage = { form: string; text: string; source: 'settings' | 'kit' };

/** The tech playbook of a workspace's settings repository, page by page: the repository the workspace
 * names (null with none, set even when the Omni app could not read it: issue 2538), the commit read
 * (null when none was), and why no page is listed when the reason is not null. */
export type PlaybookPagesView = {
  repository: string | null;
  commit: string | null;
  reason: string | null;
  pages: PlaybookPage[];
  choice: RepositoryChoice;
};

/** Where the settings repository stands for a workspace (PRD 2543): the one its owner chose (owner/name,
 * lower case, null while none is), its plan repository as owner/name (null when none is named), and the
 * repositories it lists, in Settings › Repositories' order: the only ones the owner may choose from. */
export type RepositoryChoice = { chosen: string | null; plan: string | null; listed: string[] };

// A workspace owner's change to a page (PRD 2417, s7): what the page sends, and what the route answers.
// Nothing here is stored: the text goes into a pull request in the settings repository, and only the
// pull request's number and link come back.

/** Where the page sends a change. */
export const PLAYBOOK_PROPOSAL_ROUTE = '/api/omni-settings/proposal';

/** The most characters a page's text may hold: what the read keeps of one page. */
export const MAX_PAGE_CHARS = 200_000;

/** A change the page sends: the workspace, the page's form, and its whole new text. */
export const PlaybookEditSchema = z.strictObject({
  workspace: z.string().min(1).max(64),
  form: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(64),
  text: z.string().max(MAX_PAGE_CHARS).refine((text) => text.trim() !== '', 'a page holds some text'),
});
export type PlaybookEdit = z.infer<typeof PlaybookEditSchema>;

/** The route's answer to a change: the pull request opened in the settings repository. */
export const PlaybookProposedSchema = z.strictObject({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  pullRequest: z.strictObject({ number: PrNumberSchema, url: z.url() }),
});
export type PlaybookProposed = z.infer<typeof PlaybookProposedSchema>;

// An owner's choice of the settings repository (PRD 2543, s3): what the page sends, and what the route
// answers. The choice is stored by the database's own owner-only function; nothing else is kept here.

/** Where the page sends a choice. */
export const SETTINGS_REPOSITORY_ROUTE = '/api/omni-settings/settings-repository';

const REPOSITORY_NAME = /^[\w.-]+\/[\w.-]+$/;

/** A choice the page sends: the workspace and the repository's full name, null to clear the choice. */
export const SettingsRepositoryChoiceSchema = z.strictObject({
  workspace: z.string().min(1).max(64),
  repository: z.string().max(200).regex(REPOSITORY_NAME).nullable(),
});
export type SettingsRepositoryChoice = z.infer<typeof SettingsRepositoryChoiceSchema>;

/** The route's answer to a choice: the repository now stored, or null once the choice is cleared. */
export const SettingsRepositoryChosenSchema = z.strictObject({ repository: z.string().regex(REPOSITORY_NAME).nullable() });
