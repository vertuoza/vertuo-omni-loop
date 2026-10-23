// The Omni settings area's contract (PRD 2417, s3): what the page serves a repository of its
// workspace's settings repository, as the kit's own schema (kit/lib/omni-settings/schema.ts), so
// `omni sync` and this area read one shape.
import { z } from 'zod';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';

export { SettingsPlaybookSchema, type SettingsPlaybook, type SettingsFile } from 'omni-loop/kit/lib/omni-settings/schema.ts';

/** One page of the tech playbook as the Omni page shows it (PRD 2417, s6): its form, its text, and
 * whose it is: the settings repository's own file, or the kit's first default. */
export type PlaybookPage = { form: string; text: string; source: 'settings' | 'kit' };

/** The tech playbook of a workspace's settings repository, page by page: the repository and commit
 * read (null with none), and why no page is listed when the reason is not null. */
export type PlaybookPagesView = { repository: string | null; commit: string | null; reason: string | null; pages: PlaybookPage[] };

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
