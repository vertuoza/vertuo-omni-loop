// `omni hold <owner/repo>#<n> [--json]` (PRD 2746) — whether a consumer pull request may be marked ready.
// Reads the pull request's body through `gh`, takes each `Merge after <owner/repo>#<n>` line, asks `gh`
// for each provider's state and prints one row per provider, then the verdict as the last line:
// `clear` (exit 0), `held: …`, `fail: …` or `not judged: …` (exit 1). A provider `gh` cannot read is
// never clear. A merged provider whose default branch's config declares `merge-after.served` (s3) is a
// `probe` row naming each hook (exit 0 when only probes are left); `--json` hands each hook's text with
// its inputs filled. It runs nothing of the provider and writes nothing.
import { z } from 'zod';
import { exitOf, mergeAfterLines, parsePullRef, ProviderStateSchema, refText, rowLine, rowOf, verdictOf } from '../../lib/hold/hold.ts';
import type { HoldRow, PullRef, Verdict } from '../../lib/hold/hold.ts';
import { readProbes, type FileRead, type ProbeRead } from '../../lib/hold/probe.ts';
import { messageOf, propertyOf } from '../../lib/narrow.ts';
import { plainText } from '../../lib/outbox/plain-text.ts';
import { parseArgs, println, usageError } from '../args.ts';
import { githubEnv } from '../github.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni hold <owner/repo>#<n> [--json]';
const BodySchema = z.object({ body: z.string().nullable() });

type Io = Pick<CommandIo, 'ctx' | 'exec' | 'env'>;

/** Why a `gh` call failed, in one line: its stderr, else the error's message. */
function failure(error: unknown): string {
  const text = plainText(propertyOf(error, 'stderr')).trim() || messageOf(error).trim();
  return text.split('\n')[0] ?? 'gh failed';
}

/** `gh pr view` of `ref`, asking for `fields`, as the JSON text. */
function view(ref: PullRef, fields: string, { ctx, exec, env }: Io): string {
  const ghEnv = githubEnv(ctx, { exec, env });
  return exec('gh', ['pr', 'view', String(ref.number), '--repo', ref.repo, '--json', fields], { encoding: 'utf8', ...(ghEnv ? { env: ghEnv } : {}) });
}

type Provider = z.infer<typeof ProviderStateSchema> | { failure: string };

/** The provider's state and merge commit, or why it could not be read. */
function readProvider(ref: PullRef, io: Io): Provider {
  try {
    return ProviderStateSchema.parse(JSON.parse(view(ref, 'state,mergedAt,mergeCommit', io)));
  } catch (error) {
    return { failure: failure(error) };
  }
}

/** A file of `repo`'s default branch, raw, through `gh api`; GitHub's 404 is a file it does not hold. */
function readFile(repo: string, path: string, { ctx, exec, env }: Io): FileRead {
  const ghEnv = githubEnv(ctx, { exec, env });
  try {
    const args = ['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/contents/${path}`];
    return { text: exec('gh', args, { encoding: 'utf8', ...(ghEnv ? { env: ghEnv } : {}) }) };
  } catch (error) {
    const why = failure(error);
    return /\bHTTP 404\b/.test(why) ? { missing: true } : { failure: why };
  }
}

/** The row of `provider`: for a merged one, with the probe its repository declares, read and never run. */
function providerRow(provider: PullRef, consumer: PullRef, io: Io): HoldRow {
  const read = readProvider(provider, io);
  if ('failure' in read || read.state !== 'MERGED') return rowOf(provider, read);
  const inputs = { provider: refText(provider), pr: String(provider.number), 'merge-sha': read.mergeCommit?.oid ?? '', consumer: refText(consumer) };
  const probe: ProbeRead = readProbes(provider.repo, inputs, (path) => readFile(provider.repo, path, io));
  return rowOf(provider, read, probe);
}

/** The consumer's body, or why it could not be read. */
function readBody(ref: PullRef, io: Io): { body: string } | { failure: string } {
  try {
    return { body: BodySchema.parse(JSON.parse(view(ref, 'body', io))).body ?? '' };
  } catch (error) {
    return { failure: failure(error) };
  }
}

function print(io: CommandIo, consumer: PullRef, rows: readonly HoldRow[], verdict: Verdict, json: boolean): void {
  if (json) {
    println(io.stdout, JSON.stringify({ consumer: refText(consumer), rows, verdict }));
    return;
  }
  for (const row of rows) println(io.stdout, rowLine(row));
  println(io.stdout, verdict.line);
}

export const hold: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional, flags } = parseArgs('hold', args, { booleans: ['json'] });
    const consumer = parsePullRef(positional[0] ?? '');
    if (positional.length !== 1 || consumer === null) throw usageError(USAGE);
    const json = flags.json === true;
    const read = readBody(consumer, io);
    if ('failure' in read) {
      const verdict: Verdict = { kind: 'not judged', line: `not judged: could not read ${refText(consumer)}: ${read.failure}` };
      print(io, consumer, [], verdict, json);
      return 1;
    }
    const providers = mergeAfterLines(read.body, consumer.repo);
    if (providers.length === 0) {
      print(io, consumer, [], { kind: 'clear', line: 'clear · no Merge after line' }, json);
      return 0;
    }
    const rows = providers.map((provider) => providerRow(provider, consumer, io));
    const verdict = verdictOf(rows);
    print(io, consumer, rows, verdict, json);
    return exitOf(verdict);
  }),
};
