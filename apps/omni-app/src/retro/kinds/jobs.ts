// The jobs of one workflow run, every page of them: the CI kind reads every attempt's, the
// after-merge kind only the latest attempt's.
import { PER_PAGE, paginate } from '../github.ts';
import type { Octokit } from '../retro.types.ts';
import { JobsPageSchema } from './schema.ts';
import type { Job } from './schema.ts';

const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs';

/** Every job of the run `runId`: of its latest attempt (`latest`), or of every attempt (`all`). */
export function runJobs(octokit: Octokit, { owner, repo, runId, filter }: { owner: string | undefined; repo: string | undefined; runId: number; filter: 'latest' | 'all' }): Promise<Job[]> {
  return paginate((page: number) =>
    octokit
      .request(JOBS, { owner, repo, run_id: runId, filter, per_page: PER_PAGE, page })
      .then(({ data }) => JobsPageSchema.parse(data).jobs ?? []),
  );
}
