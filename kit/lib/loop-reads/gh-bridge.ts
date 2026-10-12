// A board's reads through `gh` (PRD 1665, s3): a bridge, and only for the callers of `buildBoard`
// that still read GitHub themselves — `omni next`, `omni care` and the status line's refresh — until
// their own slices (s4, s5) hand them the Omni page's `LoopReads`, and s6's guard deletes this file.
// `omni board` never uses it. It runs the very `gh` calls the board ran before: one `gh pr list`
// without `commits` (that field alone can blow GitHub's GraphQL node limit), and one
// `gh pr view <n> --json commits` per change whose head commit date the stale-claim rule needs.
// What `gh` throws for a repository holds that repository only, with the first line it said.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import { PrNumberSchema } from '../ids.ts';
import { propertyOf } from '../narrow.ts';
import type { LoopChange, LoopChangeState } from './contract.ts';
import { LoopReadError } from './port.ts';
import type { BoardReads, ChangesQuery } from './port.ts';

const PR_FIELDS = ['number', 'title', 'headRefName', 'baseRefName', 'state', 'isDraft', 'mergedAt', 'body', 'labels', 'updatedAt', 'createdAt'];

const GhPrSchema = z.looseObject({
  number: PrNumberSchema.optional(),
  title: z.string().optional(),
  headRefName: z.string().optional(),
  baseRefName: z.string().optional(),
  state: z.string().optional(),
  isDraft: z.boolean().optional(),
  mergedAt: z.string().nullish(),
  body: z.string().optional(),
  labels: z.array(z.union([z.string(), z.looseObject({ name: z.string().nullish() })]).nullish()).nullish(),
  updatedAt: z.string().optional(),
  createdAt: z.string().nullish(),
});
type GhPr = z.infer<typeof GhPrSchema>;

const GhCommitsSchema = z.looseObject({
  commits: z.array(z.looseObject({ committedDate: z.string().nullish(), authoredDate: z.string().nullish() })).nullish(),
});

/** A `gh` pull request's state in the loop's words: merged by either field, a draft only while open. */
function stateOf(pr: GhPr): LoopChangeState {
  if (pr.state === 'MERGED' || pr.mergedAt) return 'merged';
  if (pr.state === 'OPEN') return pr.isDraft ? 'draft' : 'open';
  return 'closed';
}

function changeOf(pr: GhPr & { number: LoopChange['number'] }, repo: string): LoopChange {
  return {
    number: pr.number,
    title: pr.title ?? '',
    head: pr.headRefName ?? '',
    base: pr.baseRefName ?? '',
    state: stateOf(pr),
    createdAt: pr.createdAt ?? '',
    updatedAt: pr.updatedAt ?? '',
    mergedAt: pr.mergedAt ?? null,
    labels: (pr.labels ?? []).flatMap((label) => {
      const name = typeof label === 'string' ? label : label?.name;
      return name ? [name] : [];
    }),
    body: pr.body ?? '',
    url: `https://github.com/${repo}/pull/${pr.number}`,
    author: null,
  };
}

/** What a process wrote, as text: a string as it is, a buffer decoded, nothing for anything else. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  return Buffer.isBuffer(value) ? value.toString() : '';
}

/** What gh said when it could not read a repository, as one line. */
function ghReason(error: unknown): string {
  const lines = `${textOf(propertyOf(error, 'stderr'))}\n${textOf(propertyOf(error, 'message'))}`.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines[0] ?? 'gh could not read it';
}

/** A board's reads through `gh`, run with `exec` in `env` (the `gh` environment, when one is set). */
export function ghBoardReads({ exec, env }: { exec: ExecText; env: Record<string, string | undefined> | undefined }): BoardReads {
  const options: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', ...(env ? { env } : {}) };
  const gh = (args: string[]): string => {
    try {
      return exec('gh', args, options);
    } catch (error) {
      throw new LoopReadError(ghReason(error), 'repository');
    }
  };
  return {
    changes: async ({ repo, base, head, label, state = 'open' }: ChangesQuery) => {
      const narrowing = head !== undefined ? ['--head', head] : label !== undefined ? ['--label', label] : base !== undefined ? ['--base', base] : [];
      const raw = gh(['pr', 'list', '--repo', repo, '--json', PR_FIELDS.join(','), '--state', state, '--limit', '200', ...narrowing]);
      const prs = z.array(GhPrSchema).parse(JSON.parse(raw));
      return prs.flatMap((pr) => (pr.number === undefined ? [] : [changeOf({ ...pr, number: pr.number }, repo)]));
    },
    lastCommitAt: async (repo, number) => {
      const raw = gh(['pr', 'view', String(number), '--repo', repo, '--json', 'commits']);
      const last = (GhCommitsSchema.parse(JSON.parse(raw)).commits ?? []).at(-1);
      return last?.committedDate ?? last?.authoredDate ?? null;
    },
  };
}
