// `omni bug <n> [--base <ref>] [--body-file <file>]` — the proof step of a bug fix (PRD #556), run on
// its fix branch, shaped like `omni visual`: one folder under `<paths.delivery>/bugs/` for issue <n>,
// holding a complete bug.md whose reproduction file the range `<base>..HEAD` changes, and every commit
// of that range signed, and (PRD 1342) every change to a law the range makes answered in the folder's
// outbox, and (PRD 2100) the pull request's body carrying its `## Proof` (`kit/lib/bug/proof-body.ts`):
// the body in `--body-file`, else the open pull request of the current branch, read through `gh`.
// Prints `ok`, or `not ok` then one `- ` line per failed check (`kit/lib/bug/verdict.ts`). It runs no
// test. `--base` defaults to `<repo.remote>/<repo.defaultBranch>`; a bad ref, or a `--body-file` that
// cannot be read, is a usage error, exit 2.
//
// `omni bug film <n> --before <file> --after <file> [--out <dir>]` (PRD 1972) makes the before/after GIF
// and the run's folder: see `./bug-film.ts`.
//
// `omni bug check --product <key> <file>` and `omni bug push --product <key> (--new | --bug <n>) <file>`
// (PRD 2011, s6) are the same grade and the push for a bug record born on the server, a dossier of its
// product with no issue and no folder: `<file>` is its bug.md anywhere. A check grades the rows against
// the product's own repositories, which the app answers (`../../lib/bug/product.ts`), never
// `plan.targets`; a push checks first, so a row outside the product is refused by name and nothing is
// written. It prints the bug's id (`mobile-B74`). Without `--product` every verb runs exactly as before.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { gradeBugFile, bugSeqArg, bugPushedLines, pushProductBug } from '../../lib/bug/product.ts';
import { openPullRequest, proofFaults } from '../../lib/bug/proof-body.ts';
import type { ProofSource } from '../../lib/bug/proof-body.ts';
import { bugVerdict } from '../../lib/bug/verdict.ts';
import { formatFailure, formatPass } from '../../lib/check-report.ts';
import { isProductKey } from '../../lib/product/checkout.ts';
import { issueArg, parseArgs, println, readUserFile, usageError } from '../args.ts';
import { fixLaws, loggedPaths, rangeBase, rangeCommits } from '../branch-range.ts';
import { synchronous } from '../synchronous.ts';
import { loadContext } from '../../lib/context.ts';
import type { CommandIo, FreeCommand, FreeIo, Out } from '../io.ts';
import { film } from './bug-film.ts';

/** What a test injects to reach the app: the sign-in, its home, the fetch and the call timeout. */
type BugOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined; callMs?: number | undefined };

const USAGE = [
  'usage: omni bug <n> [--base <ref>] [--body-file <file>]',
  '       omni bug film <n> --before <file> --after <file> [--out <dir>]',
  '       omni bug check --product <key> <file>',
  '       omni bug push --product <key> (--new | --bug <n>) <file>',
].join('\n');

/** Grades the fix of issue `<n>` on the current branch; the exit code. */
function grade(args: string[], { ctx, stdout, exec }: CommandIo): number {
  const { positional, flags } = parseArgs('bug', args, { values: ['base', 'body-file'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const issue = issueArg('bug', '<n>', positional[0]);
  const file = flags['body-file'];
  const written: ProofSource | undefined = file === undefined ? undefined : { kind: 'file', body: readUserFile('bug', ctx, file) };
  const base = rangeBase('bug', ctx, flags, exec);
  const verdict = bugVerdict({
    ctx,
    issue,
    changed: loggedPaths(ctx.root, base, exec),
    commits: ctx.config.signature === null ? undefined : rangeCommits(ctx.root, base, exec),
    laws: fixLaws(ctx, issue, base, exec),
    proof: () => proofFaults(written ?? openPullRequest({ root: ctx.root, exec }), issue),
  });
  println(stdout, verdict.ok ? 'ok' : 'not ok');
  for (const failure of verdict.failures) println(stdout, `- ${failure}`);
  return verdict.ok ? 0 : 1;
}

/** Prints the one line a call stops with: exit 1. */
function refuse(stderr: Out, line: string): number {
  println(stderr, line);
  return 1;
}

/** What a product verb is handed: this checkout's context and the injected options. */
type ProductIo = FreeIo & BugOptions & Pick<CommandIo, 'ctx'>;

type ProductArgs = { key: string; file: string; bug: string | null; create: boolean };

/** The usage error a flag combination earns, or null when `check` or `push` may take it. */
function flagFault(verb: 'check' | 'push', flags: { new?: true; bug?: string }): string | null {
  if (verb === 'check') return flags.new === true || flags.bug !== undefined ? 'omni bug check: --new and --bug are for push.' : null;
  if (flags.new === true && flags.bug !== undefined) return 'omni bug push: --new and --bug are two ways to name the bug: give one.';
  return flags.new !== true && flags.bug === undefined ? 'omni bug push: say where it goes: --new for the next bug of the product, or --bug <n>.' : null;
}

function productArgs(verb: 'check' | 'push', rest: string[]): ProductArgs {
  const { positional, flags } = parseArgs(`bug ${verb}`, rest, { values: ['product', 'bug'], booleans: ['new'] });
  const key = flags.product ?? '';
  if (!isProductKey(key)) throw usageError(`omni bug ${verb}: --product "${key}" needs a product key (lowercase kebab-case, as mobile).`);
  if (positional.length !== 1) throw usageError(USAGE);
  const fault = flagFault(verb, flags);
  if (fault !== null) throw usageError(fault);
  return { key, file: positional[0] ?? '', bug: flags.bug ?? null, create: flags.new === true };
}

/** What a product verb starts from: its arguments, the record read, the connection and the grade; or its exit code. */
async function prepare(verb: 'check' | 'push', rest: string[], io: ProductIo) {
  const args = productArgs(verb, rest);
  let record: string;
  try {
    record = readFileSync(resolve(io.ctx.root, args.file), 'utf8');
  } catch {
    return refuse(io.stderr, `${args.file} cannot be read`);
  }
  const askUrl = io.ctx.config.ask.url;
  if (!askUrl) return refuse(io.stderr, 'off');
  const client = signedInClient({ askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs });
  if (!client) return refuse(io.stderr, 'no sign-in (omni signin)');
  const repo = io.ctx.config.repo.slug ?? null;
  return { args, askUrl, client, repo, graded: await gradeBugFile({ key: args.key, repo, record, client }) };
}

async function checkProduct(rest: string[], io: ProductIo): Promise<number> {
  const prepared = await prepare('check', rest, io);
  if (typeof prepared === 'number') return prepared;
  const { args, graded } = prepared;
  const lines = graded.ok ? graded.violations : graded.lines;
  if (lines.length > 0) {
    println(io.stdout, formatFailure(`omni bug check — ${args.file}: violation(s):`, lines.map((line) => `${args.file}: ${line}`)));
    return 1;
  }
  const rows = graded.ok ? graded.rows.length : 0;
  println(io.stdout, formatPass(`omni bug check — ${args.file}: ${rows} Fixes row(s), each in a repository of product ${args.key}.`));
  return 0;
}

async function pushProduct(rest: string[], io: ProductIo): Promise<number> {
  const prepared = await prepare('push', rest, io);
  if (typeof prepared === 'number') return prepared;
  const { args, askUrl, client, repo, graded } = prepared;
  if (!graded.ok) return refuse(io.stderr, graded.lines.join('\n'));
  if (graded.violations.length > 0) {
    return refuse(io.stderr, formatFailure(`omni bug push — ${args.file}: nothing was sent:`, graded.violations.map((line) => `${args.file}: ${line}`)));
  }
  let seq: number | null = null;
  if (!args.create) {
    seq = bugSeqArg(args.key, args.bug ?? '');
    if (seq === null) throw usageError(`omni bug push: --bug "${args.bug}" is not a bug of product ${args.key} (as 74 or ${args.key}-B74).`);
  }
  const sent = await pushProductBug({ key: args.key, seq, repo, graded, askUrl, client });
  if (!sent.ok) return refuse(io.stderr, sent.line);
  println(io.stdout, bugPushedLines(sent.pushed));
  return 0;
}

export const bug = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & BugOptions) {
    if (args[0] === 'check' || args[0] === 'push') {
      if (args.includes('--product')) {
        const productIo = { ...io, ctx: loadContext(io.cwd, { exec: io.exec }) };
        return args[0] === 'check' ? checkProduct(args.slice(1), productIo) : pushProduct(args.slice(1), productIo);
      }
    }
    const commandIo: CommandIo = { ctx: loadContext(io.cwd, { exec: io.exec }), stdout: io.stdout, stderr: io.stderr, exec: io.exec, env: io.env, vars: io.vars };
    return args[0] === 'film' ? synchronous(film)(args.slice(1), commandIo) : synchronous(grade)(args, commandIo);
  },
} satisfies FreeCommand;
