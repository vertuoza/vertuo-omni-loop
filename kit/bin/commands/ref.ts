// `omni ref <issue> --title "<title>" [--repo <owner/name>] [--json]` (PRD 2648) — the title and link a
// pull request for issue <issue> carries, by the config's `pr.ref`. Reads the issue's body through `gh`,
// takes the first valid `<!-- omni-ref: <ref> -->` marker and prints `title: <title>` and
// `link: <link|none>` (`{ ref, title, link }` with --json, `ref` null with no marker). A title that
// already reads as the format is printed unchanged. With `pr.ref` null the title is unchanged and the
// link none. An issue `gh` cannot read exits 1 with one line naming it.
//
// `--repo <owner/name>` (#2658) is for a pull request opened in another repository (`/omni:pr --repo`):
// the issue stays this repository's, and the format is the `pr.ref` that repository commits on its
// default branch, read through `gh api`. A repository that commits no config formats nothing; one whose
// config `gh` cannot read, or that does not read, exits 1 with one line.
import { z } from 'zod';
import { ConfigError, parseConfig } from '../../lib/config.ts';
import { propertyOf } from '../../lib/narrow.ts';
import { plainText } from '../../lib/outbox/plain-text.ts';
import { formatLink, formatTitle, readRef } from '../../lib/ref/ref.ts';
import type { RefFormat } from '../../lib/ref/ref.ts';
import { issueArg, parseArgs, println, repoSlug, usageError } from '../args.ts';
import type { IssueNumber } from '../../lib/ids.ts';
import { githubEnv } from '../github.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni ref <issue> --title "<title>" [--repo <owner/name>] [--json]';
const CONFIG = '.omni-loop/config.yml';
const IssueBodySchema = z.object({ body: z.string().nullable() });

type Io = Pick<CommandIo, 'ctx' | 'exec' | 'env'>;

/** `gh` with the GitHub environment this repository uses. */
function gh(args: string[], { ctx, exec, env }: Io): string {
  const ghEnv = githubEnv(ctx, { exec, env });
  return exec('gh', args, { encoding: 'utf8', ...(ghEnv ? { env: ghEnv } : {}) });
}

/** The body of issue `issue`, read through `gh`; `null` when `gh` cannot read it. */
function issueBody(issue: IssueNumber, io: Io): string | null {
  try {
    const slug = io.ctx.config.repo.slug;
    const raw = gh(['issue', 'view', String(issue), ...(slug === null ? [] : ['--repo', slug]), '--json', 'body'], io);
    return IssueBodySchema.parse(JSON.parse(raw)).body ?? '';
  } catch {
    return null;
  }
}

/** Whether `gh` failed on a 404: its stderr, or the error's message, says `HTTP 404`. */
function notFound(error: unknown): boolean {
  return /HTTP 404/.test(`${plainText(propertyOf(error, 'stderr'))}\n${plainText(propertyOf(error, 'message'))}`);
}

/** The format a pull request takes: this repository's `pr.ref`, or, with `--repo`, the target's. */
function formatOf(target: string | null, io: Io): { format: RefFormat | null } | { error: string } {
  return target === null ? { format: io.ctx.config.pr.ref ?? null } : targetFormat(target, io);
}

/** The `pr.ref` repository `repo` commits on its default branch: `null` with no config there; a line when it cannot be read. */
function targetFormat(repo: string, io: Io): { format: RefFormat | null } | { error: string } {
  let text: string;
  try {
    text = gh(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/contents/${CONFIG}`], io);
  } catch (error) {
    if (notFound(error)) return { format: null };
    return { error: `omni ref: ${repo}'s ${CONFIG} cannot be read through gh.` };
  }
  try {
    // A target may run another kit: its config is migrated, and the keys this kit does not know are left out.
    return { format: parseConfig(text, `${repo}:${CONFIG}`, { migrate: true, ignoreUnknownKeys: true }).pr.ref ?? null };
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return { error: `omni ref: ${error.message.split('\n')[0] ?? ''}` };
  }
}

/** Prints the title and the link for `found` in `format`: two lines, or one JSON object with `--json`. */
function print(io: CommandIo, format: RefFormat | null, found: string | null, title: string, json: boolean): void {
  const formatted = formatTitle(format, found, title);
  const link = formatLink(format, found);
  if (json) {
    println(io.stdout, JSON.stringify({ ref: found, title: formatted, link }));
    return;
  }
  println(io.stdout, `title: ${formatted}`);
  println(io.stdout, `link: ${link ?? 'none'}`);
}

export const ref: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional, flags } = parseArgs('ref', args, { values: ['title', 'repo'], booleans: ['json'] });
    if (positional.length !== 1 || flags.title === undefined) throw usageError(USAGE);
    const issue = issueArg('ref', 'the issue', positional[0]);
    const target = flags.repo === undefined ? null : repoSlug('ref', io.ctx, flags.repo);
    const body = issueBody(issue, io);
    const read = body === null ? { error: `omni ref: issue #${issue} cannot be read through gh.` } : formatOf(target, io);
    if ('error' in read) {
      println(io.stderr, read.error);
      return 1;
    }
    print(io, read.format, readRef(body ?? ''), flags.title, flags.json === true);
    return 0;
  }),
};
