// The events of the `omni/approved` check (PRD 1612), and the shape of their data: one schema each,
// which a function parses `event.data` through before it reads it.
//
// The check itself runs on the outbox check's event (every handled pull request action, ../webhook/)
// and on `APPROVED_CHECK_EVENT`, one per open pull request of a PRD whose approved label changed. That
// label change arrives as `APPROVED_LABEL_EVENT`, which names a PRD, not a pull request: the
// `approved-rerun` function finds the PRD's open pull requests and sends one `APPROVED_CHECK_EVENT` each.
import { z } from 'zod';
import { PrNumberSchema, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** One pull request whose `omni/approved` check is to run again. */
export const APPROVED_CHECK_EVENT = 'omni-loop/approved.check.requested';

/** A PRD's issue gained or lost the approved label (`issues.labeled` / `issues.unlabeled`). */
export const APPROVED_LABEL_EVENT = 'omni-loop/approved.label.changed';

/** The installation and repository every event carries. */
const SourceSchema = z.looseObject({
  installationId: z.number(),
  owner: z.string(),
  repo: z.string(),
  repository: z.string(),
  trigger: z.string().optional(),
});

/** A pull request to check: the outbox check's event data reads as one too (its head is read fresh). */
export const ApprovedCheckDataSchema = SourceSchema.extend({ prNumber: PrNumberSchema, headSha: z.string().optional() });

/** A PRD, in the repository of its issue, whose approved label changed. */
export const ApprovedLabelDataSchema = SourceSchema.extend({ prd: PrdNumberSchema });

export type ApprovedCheckData = z.infer<typeof ApprovedCheckDataSchema>;
export type ApprovedLabelData = z.infer<typeof ApprovedLabelDataSchema>;

export type ApprovedCheckRequest = { name: typeof APPROVED_CHECK_EVENT; data: ApprovedCheckData };
export type ApprovedLabelRequest = { name: typeof APPROVED_LABEL_EVENT; data: ApprovedLabelData };
