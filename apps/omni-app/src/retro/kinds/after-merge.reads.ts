// The reads the after-merge kind shares between the plan repository's bugs and a multi-repository
// PRD's fix plans (PRD 72, PRD 1130): a pull request's files reduced to change blocks, a read GitHub
// may refuse, and the window a date falls within. What GitHub will not let the app read is named,
// never guessed; any other failure is thrown, so Inngest retries the step.
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { PER_PAGE, paginate } from '../github.ts';
import { changeBlocks } from './churn-lines.ts';
import type { Block } from './churn-lines.ts';
import type { Octokit } from './index.ts';
import { ChangedFileSchema } from './schema.ts';
import type { ChangedFile } from './schema.ts';

/** One file a fix changed, its patch reduced to change blocks (`null` when GitHub sent none). */
export type FixFile = { path: string; previous: string | null; blocks: Block[] | null };

/** A window of time, its ends included. */
export type Window = { from: string; to: string };

/** A repository as a read names it. */
export type Repo = { owner: string | undefined; repo: string | undefined };

/** What `readOrRefused` gives: the value read, or the status GitHub refused it with. */
export type Read<T> = { value: T; status: null } | { value: null; status: number };

const FILES = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files';

/** What GitHub answers for what it will not let the app read, or no longer has. */
const UNREADABLE: ReadonlySet<unknown> = new Set([403, 404, 410]);

/** Whether `at` falls within the window, its ends included. */
export function within(window: Window, at: string | null | undefined): at is string {
  if (!at) return false;
  const time = Date.parse(at);
  return time >= Date.parse(window.from) && time <= Date.parse(window.to);
}

/** A pull request's files, each patch reduced to its change blocks (`null` when GitHub sent none). */
export async function listFiles(octokit: Octokit, { owner, repo, number }: Repo & { number: PrNumber }): Promise<FixFile[]> {
  const files: ChangedFile[] = await paginate((page: number) =>
    octokit.request(FILES, { owner, repo, pull_number: number, per_page: PER_PAGE, page }).then(({ data }) => ChangedFileSchema.array().parse(data)),
  );
  return files.map((file) => ({
    path: file.filename,
    previous: file.previous_filename ?? null,
    blocks: typeof file.patch === 'string' ? changeBlocks(file.patch) : null,
  }));
}

/** What `read` returns, or the status when GitHub will not let the app read it. Anything else is thrown, so Inngest retries. */
export async function readOrRefused<T>(read: () => Promise<T>): Promise<Read<T>> {
  try {
    return { value: await read(), status: null };
  } catch (error) {
    const status = statusOf(error);
    if (typeof status === 'number' && UNREADABLE.has(status)) return { value: null, status };
    throw error;
  }
}

/** The HTTP status a failed request carries, when it carries one. */
function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}
