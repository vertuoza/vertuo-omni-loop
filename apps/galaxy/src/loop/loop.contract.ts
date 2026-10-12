// What the loop's read routes answer (PRD 1665, s1; ADR-0095): the facts the kit decides on, in the
// loop's own words (a *change*, never a pull request), as zod schemas. Nothing here is GitHub's: only
// ./github.ts knows the host. Browser-safe: zod and the kit's id schemas only.
//
//   GET /api/loop/changes?repo=<owner/name>&base=<b>|head=<h>|label=<l>&state=all|open
//     → 200 { changes: [Change] }, at most 200, newest first
//   GET /api/loop/changes/<n>?repo=<owner/name>
//     → 200 Change & { lastCommitAt, files: [path] }
//
// A refusal is `{ error }` in plain words (ADR-0029): 400 a malformed query, 401 no valid sign-in,
// 403 a repository the caller's workspace does not own (checked before any call to the host), 404 no
// such change, 424 the Omni app cannot read the repository (with its install link), 429 the host's
// budget for the repository is spent (saying when it refills), 503 no database or no app here, 500 the
// host failed.
import { z } from 'zod';
import { PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** The most changes one list answers. */
export const MAX_CHANGES = 200;

/** `owner/name`. */
export const RepoSchema = z.string().max(200).regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/, 'owner/name');

/** A change's state: a draft is open but not asked for review; a merged change is closed by its merge. */
const ChangeStateSchema = z.enum(['open', 'draft', 'merged', 'closed']);
export type ChangeState = z.infer<typeof ChangeStateSchema>;

export const ChangeSchema = z.strictObject({
  number: PrNumberSchema,
  title: z.string(),
  head: z.string(),
  base: z.string(),
  state: ChangeStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().nullable(),
  labels: z.array(z.string()),
  body: z.string(),
  url: z.url(),
  author: z.string().nullable(),
});
export type Change = z.infer<typeof ChangeSchema>;

export const ChangesSchema = z.strictObject({ changes: z.array(ChangeSchema).max(MAX_CHANGES) });

/** One change, with when its head was last committed and the paths it touches. */
export const ChangeDetailSchema = ChangeSchema.extend({
  lastCommitAt: z.string().nullable(),
  files: z.array(z.string()),
});
export type ChangeDetail = z.infer<typeof ChangeDetailSchema>;

/** A list's query: one repository, filtered by any of base, head and label; open only unless `all`. */
export const ChangesQuerySchema = z.strictObject({
  repo: RepoSchema,
  base: z.string().min(1).max(255).optional(),
  head: z.string().min(1).max(255).optional(),
  label: z.string().min(1).max(100).optional(),
  state: z.enum(['all', 'open']).default('open'),
});
export type ChangesQuery = z.infer<typeof ChangesQuerySchema>;

/** A refusal, in plain words. */
export const LoopRefusalSchema = z.strictObject({ error: z.string() });
