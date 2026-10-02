// `omni credits [--repo <owner/name>] [--since <YYYY-MM>] [--list] [--json]` — counts what OmniMan,
// the loop's signature (PRD #99), worked on across the organisation that owns `repo.slug`: his pull
// requests, his PRD issues, what his bot account opened and the co-authored commits on default
// branches. `--repo` narrows it to one repository, `--since` to what was created from that month on.
// It reads GitHub on demand through the `gh` login (`kit/lib/credits/reader.ts`), classifies what it
// read (`classify.mjs`) and prints the report (`report.mjs`); it stores nothing. `--list` adds one line
// per item after the report, oldest first. `--json` prints the whole report as one JSON document
// instead — the scope, the totals, every item with its reasons, the commits and the warnings — and
// then holds the list itself. A search at GitHub's 1,000-result cap still prints the report, with one
// warning line on stderr naming the query (in the document, under `--json`). A `gh` that is missing
// or logged out, or rate limited, exits 2 with one line saying so.
import { creditCommits, creditItems, summarize } from '../../lib/credits/classify.ts';
import { GitHubUnreadable, readCredits, unreadable } from '../../lib/credits/reader.ts';
import { creditsList, creditsReport } from '../../lib/credits/report.ts';
import { botLogin } from '../../lib/signature.ts';
import { githubEnv } from '../github.ts';
import { parseArgs, println, repoSlug, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni credits [--repo <owner/name>] [--since <YYYY-MM>] [--list] [--json]';
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** The one line `omni credits` exits 2 with when `gh` cannot be read. */
const ghUsageError = (cause: Error) => usageError(`omni credits: ${cause.message}`);

export const credits: Command = {
  run: synchronous((args: string[], { ctx, stdout, stderr, exec, env }: CommandIo): number => {
    const { positional, flags } = parseArgs('credits', args, { values: ['repo', 'since'], booleans: ['list', 'json'] });
    if (positional.length) throw usageError(USAGE);
    const slug = repoSlug('credits', ctx, flags.repo);
    const since = flags.since ?? null;
    if (since !== null && !MONTH.test(since)) throw usageError(`omni credits: --since must be YYYY-MM, got "${since}".`);
    const repo = flags.repo ?? null;
    const owner = slug.split('/')[0] ?? '';
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

    const items = creditItems({ prs: read.prs, issues: read.issues, commits: read.commits, labels, signature, since });
    const commits = signature ? creditCommits(read.commits) : null;
    const summary = summarize(items, { commits, app: signature !== null && botLogin(signature.email) !== null });
    const name = signature?.name ?? null;

    if (flags.json) {
      const doc = { name, scope: { owner, repo, since }, totals: summary, items, commits: commits ?? [], warnings: read.warnings };
      println(stdout, JSON.stringify(doc, null, 2));
      return 0;
    }
    for (const line of creditsReport({ name, scope: repo ?? owner, since, summary })) println(stdout, line);
    if (flags.list && items.length) {
      println(stdout);
      for (const line of creditsList(items)) println(stdout, line);
    }
    for (const warning of read.warnings) println(stderr, `warning: ${warning}`);
    return 0;
  }),
};
