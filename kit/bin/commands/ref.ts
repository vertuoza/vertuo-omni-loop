// `omni ref <issue> --title "<title>" [--json]` (PRD 2648) — the title and link a pull request for
// issue <issue> carries, by the config's `pr.ref`. Reads the issue's body through `gh`, takes the
// first valid `<!-- omni-ref: <ref> -->` marker and prints `title: <title>` and `link: <link|none>`
// (`{ ref, title, link }` with --json, `ref` null with no marker). A title that already reads as the
// format is printed unchanged. With `pr.ref` null the title is unchanged and the link none. An issue
// `gh` cannot read exits 1 with one line naming it.
import { z } from 'zod';
import { formatLink, formatTitle, readRef } from '../../lib/ref/ref.ts';
import { issueArg, parseArgs, println, usageError } from '../args.ts';
import type { IssueNumber } from '../../lib/ids.ts';
import { githubEnv } from '../github.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni ref <issue> --title "<title>" [--json]';
const IssueBodySchema = z.object({ body: z.string().nullable() });

/** The body of issue `issue`, read through `gh`; `null` when `gh` cannot read it. */
function issueBody(issue: IssueNumber, { ctx, exec, env }: Pick<CommandIo, 'ctx' | 'exec' | 'env'>): string | null {
  try {
    const slug = ctx.config.repo.slug;
    const ghEnv = githubEnv(ctx, { exec, env });
    const raw = exec('gh', ['issue', 'view', String(issue), ...(slug === null ? [] : ['--repo', slug]), '--json', 'body'], {
      encoding: 'utf8',
      ...(ghEnv ? { env: ghEnv } : {}),
    });
    return IssueBodySchema.parse(JSON.parse(raw)).body ?? '';
  } catch {
    return null;
  }
}

export const ref: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional, flags } = parseArgs('ref', args, { values: ['title'], booleans: ['json'] });
    if (positional.length !== 1 || flags.title === undefined) throw usageError(USAGE);
    const issue = issueArg('ref', 'the issue', positional[0]);
    const body = issueBody(issue, io);
    if (body === null) {
      println(io.stderr, `omni ref: issue #${issue} cannot be read through gh.`);
      return 1;
    }
    const format = io.ctx.config.pr.ref ?? null;
    const found = readRef(body);
    const title = formatTitle(format, found, flags.title);
    const link = formatLink(format, found);
    if (flags.json) {
      println(io.stdout, JSON.stringify({ ref: found, title, link }));
    } else {
      println(io.stdout, `title: ${title}`);
      println(io.stdout, `link: ${link ?? 'none'}`);
    }
    return 0;
  }),
};
