// What `gh api` answers about a plan repository's target, as `omni targets` and `omni plan moved`
// read it (PRD 725, s10); the YAML shapes read out of the target's files are playbook/schema.ts's
// (PRD 893). Each schema names only the fields the readers use and lets every other field through:
// GitHub sends many more.
import { z } from 'zod';

/** `repos/<owner>/<name>`: the repository. */
export const GhRepositorySchema = z.looseObject({ default_branch: z.string() });

/** One entry of `repos/<owner>/<name>/contents/<dir>`. */
export const GhContentEntrySchema = z.looseObject({ type: z.string(), name: z.string(), path: z.string() });

/** One changed file of a compare. */
const GhCompareFileSchema = z.looseObject({
  filename: z.string(),
  previous_filename: z.string().optional(),
});

/** `repos/<owner>/<name>/compare/<base>...<head>`. */
export const GhCompareSchema = z.looseObject({
  ahead_by: z.number().optional(),
  files: z.array(GhCompareFileSchema).optional(),
});

export type GhRepository = z.infer<typeof GhRepositorySchema>;
export type GhContentEntry = z.infer<typeof GhContentEntrySchema>;
export type GhCompare = z.infer<typeof GhCompareSchema>;
export type GhCompareFile = z.infer<typeof GhCompareFileSchema>;

/** A refused answer's first issue, its field first: `files.0.filename: Invalid input…`. */
export function firstIssue(error: z.ZodError): string {
  const [issue] = error.issues;
  if (issue === undefined) return error.message;
  const field = issue.path.length > 0 ? issue.path.join('.') : '(answer)';
  return `${field}: ${issue.message}`;
}
