// The GitHub calls of the plan archive (PRD 2011 s17): the App's installation on the repository, the
// repository's `archived` flag, and the one write, `PATCH /repos/{owner}/{repo}` with `archived`. Every
// call goes through `octokit.request(route, params)`, the installation's budgeted client (PRD 902) or the
// App's own. Nothing here touches a branch or a pull request: archiving merges nothing (N-PRODUCT-15).
import { z } from 'zod';

export type Request = { request(route: string, params?: Record<string, unknown>): Promise<{ data: unknown }> };

const InstallationSchema = z.looseObject({ id: z.number().int().positive() });
const RepositorySchema = z.looseObject({ archived: z.boolean() });

const INSTALLATION = 'GET /repos/{owner}/{repo}/installation';
const REPOSITORY = 'GET /repos/{owner}/{repo}';
const EDIT = 'PATCH /repos/{owner}/{repo}';

/** The status of a refusal GitHub answered, or null for anything else (a network failure, a bug). */
export function statusOf(error: unknown): number | null {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
  return typeof status === 'number' ? status : null;
}

/** The App's installation on the repository; null when the App is not installed there (404). */
export async function installationOf(app: Request, owner: string, repo: string): Promise<number | null> {
  try {
    return InstallationSchema.parse((await app.request(INSTALLATION, { owner, repo })).data).id;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/** Whether GitHub says the repository is archived. */
export async function isArchived(octokit: Request, owner: string, repo: string): Promise<boolean> {
  return RepositorySchema.parse((await octokit.request(REPOSITORY, { owner, repo })).data).archived;
}

/** Archives the repository, or unarchives it. Needs the App's `administration: write` permission. */
export async function setArchived(octokit: Request, owner: string, repo: string, archived: boolean): Promise<void> {
  await octokit.request(EDIT, { owner, repo, archived });
}
