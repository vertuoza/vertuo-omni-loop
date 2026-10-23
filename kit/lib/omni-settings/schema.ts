/**
 * **What a settings repository serves** (PRD 2417, s1): the workspace's tech playbook at the Omni
 * settings level of the knowledge tree, as schemas the kit, the Omni page's route and its views share.
 *
 * The settings repository keeps its tech playbook as a knowledge folder is laid out
 * (`./layout.ts`): `playbook/<form>.md` under `.omni-loop/settings/`. The route reads those files
 * at one commit and answers {@link SettingsPlaybookSchema}; `omni sync` hands its `files` and where
 * they came from ({@link SettingsSourceSchema}) to the copy's writer (`./copy.ts`).
 *
 * A file's text is only checked here for being text: whether it is a form the kit reads is the
 * writer's question, which skips and names a file that is not, so one bad page never refuses the
 * rest. This file imports nothing but zod, so a browser module may import it.
 */
import { z } from 'zod';

/** A form's id as a file name: lower case words joined by `-`, never a path. */
const FORM_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** A repository's `owner/name`. */
const SLUG = /^[\w.-]+\/[\w.-]+$/;

/** A git commit, abbreviated or in full. */
const COMMIT = /^[0-9a-f]{7,40}$/;

/** One playbook file of the settings repository: the form it is, and its text as committed. */
export const SettingsFileSchema = z.object({ form: z.string().regex(FORM_NAME, 'a form id, lower case words joined by -'), text: z.string() }).strict();
export type SettingsFile = z.infer<typeof SettingsFileSchema>;

/** Where a set of files came from: the settings repository, the commit read, and when it was read. */
export const SettingsSourceSchema = z
  .object({ repository: z.string().regex(SLUG, 'owner/name'), commit: z.string().regex(COMMIT, 'a git commit'), readAt: z.iso.datetime() })
  .strict();
export type SettingsSource = z.infer<typeof SettingsSourceSchema>;

/**
 * What the Omni page answers for a repository's tech playbook at the Omni settings level: the
 * workspace's settings repository, the commit read, and each playbook file under its settings
 * folder. With no settings repository (`repository` and `commit` null), or one holding no file,
 * `files` is empty and `reason` says why; `reason` is null only when files were read.
 */
export const SettingsPlaybookSchema = z
  .object({
    repository: z.string().regex(SLUG, 'owner/name').nullable(),
    commit: z.string().regex(COMMIT, 'a git commit').nullable(),
    files: z.array(SettingsFileSchema),
    reason: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((reply, context) => {
    if ((reply.repository === null) !== (reply.commit === null)) {
      context.addIssue({ code: 'custom', path: ['commit'], message: 'a commit is read from a settings repository: both are set, or neither' });
    }
    if (reply.repository === null && reply.files.length > 0) {
      context.addIssue({ code: 'custom', path: ['files'], message: 'no settings repository holds no file' });
    }
    if (reply.files.length === 0 && reply.reason === null) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'an empty list says why' });
    }
    if (reply.files.length > 0 && reply.reason !== null) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'only an empty list carries a reason' });
    }
  });
export type SettingsPlaybook = z.infer<typeof SettingsPlaybookSchema>;
