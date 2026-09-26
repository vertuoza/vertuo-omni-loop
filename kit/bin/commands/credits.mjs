// `omni credits [--repo <owner/name>] [--since <YYYY-MM>]` — counts what OmniMan, the loop's
// signature (PRD #99), worked on across the organisation that owns `repo.slug`: `--repo` narrows it to
// one repository, `--since` to what was created from that month on. It reads GitHub on demand through
// the `gh` login (`kit/lib/credits/reader.mjs`), classifies what it read (`classify.mjs`) and prints
// the report (`report.mjs`); it stores nothing. A search at GitHub's 1,000-result cap still prints the
// report, with one warning line on stderr naming the query. A `gh` that is missing or logged out, or
// rate limited, exits 2 with one line saying so.
import { creditPullRequests, summarize } from '../../lib/credits/classify.mjs';
import { GitHubUnreadable, readCredits, unreadable } from '../../lib/credits/reader.mjs';
import { creditsReport } from '../../lib/credits/report.mjs';
import { githubEnv } from '../github.mjs';
import { parseArgs, println, repoSlug, usageError } from '../args.mjs';

const USAGE = 'usage: omni credits [--repo <owner/name>] [--since <YYYY-MM>]';
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** The one line `omni credits` exits 2 with when `gh` cannot be read. */
const ghUsageError = (cause) => usageError(`omni credits: ${cause.message}`);

export const credits = {
  async run(args, { ctx, stdout, stderr, exec, env }) {
    const { positional, flags } = parseArgs('credits', args, { values: ['repo', 'since'] });
    if (positional.length) throw usageError(USAGE);
    const slug = repoSlug('credits', ctx, flags.repo);
    const since = flags.since ?? null;
    if (since !== null && !MONTH.test(since)) throw usageError(`omni credits: --since must be YYYY-MM, got "${since}".`);
    const repo = flags.repo ?? null;
    const owner = slug.split('/')[0];
    const { labels, signature } = ctx.config;

    let ghEnv;
    try {
      ghEnv = githubEnv(ctx, { exec, env });
    } catch (error) {
      throw ghUsageError(unreadable(error));
    }
    let read;
    try {
      read = readCredits({ owner, repo, since, labels, signature, exec, env: ghEnv });
    } catch (error) {
      if (error instanceof GitHubUnreadable) throw ghUsageError(error);
      throw error;
    }

    const items = creditPullRequests({ prs: read.prs, commits: read.commits, labels, signature, since });
    const lines = creditsReport({ name: signature?.name ?? null, scope: repo ?? owner, since, summary: summarize(items) });
    for (const line of lines) println(stdout, line);
    for (const warning of read.warnings) println(stderr, `warning: ${warning}`);
    return 0;
  },
};
