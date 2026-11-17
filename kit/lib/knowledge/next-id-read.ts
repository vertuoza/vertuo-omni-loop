// Reads the places `omni kb next-id` numbers past (PRD 3015): the working tree, the default branch
// as last fetched, and the head of every open pull request into it, read through `gh` and `git`.
// A place that cannot be read is named in `unread`, never thrown: the verb is advice, it never blocks.
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import { messageOf } from '../narrow.ts';
import { knowledgeAt } from '../git.ts';
import { readKnowledge, type KnowledgeSource } from './registers.ts';
import type { IdSet } from './next-id.ts';

type Where = { root: string; layout: { knowledgeRoot: string } };

/** The places read, and what could not be: `base` and `pulls` hold why, `null` when read. */
export type PlacesRead = { sets: IdSet[]; base: string | null; pulls: string | null };

const PullsSchema = z.array(z.object({ number: z.number().int().positive() }));

function idsOf(ctx: Where, source: KnowledgeSource | null): string[] {
  return source === null ? [] : readKnowledge({ ctx, source }).entries.map((entry) => entry.id);
}

function git(ctx: Where, args: readonly string[], exec: ExecText): string {
  return exec('git', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function gh(ctx: Where, args: readonly string[], exec: ExecText): string {
  return exec('gh', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The ids of the tree, of `<remote>/<default>`, and of each open pull request into the default branch. */
export function readPlaces({
  ctx,
  tree,
  remote,
  defaultBranch,
  exec,
}: {
  ctx: Where;
  tree: readonly string[];
  remote: string;
  defaultBranch: string;
  exec: ExecText;
}): PlacesRead {
  const sets: IdSet[] = [{ where: 'tree', ids: tree }];
  let base: string | null = null;
  try {
    sets.push({ where: 'base', ids: idsOf(ctx, knowledgeAt({ ctx, ref: `${remote}/${defaultBranch}`, exec })) });
  } catch (error) {
    base = messageOf(error).split('\n')[0] ?? 'unreadable';
  }
  let pulls: string | null = null;
  try {
    const listed = PullsSchema.parse(
      JSON.parse(gh(ctx, ['pr', 'list', '--base', defaultBranch, '--state', 'open', '--json', 'number', '--limit', '200'], exec)),
    );
    const failed: string[] = [];
    for (const { number } of listed) {
      try {
        git(ctx, ['fetch', '--quiet', remote, `pull/${number}/head`], exec);
        const ref = git(ctx, ['rev-parse', 'FETCH_HEAD'], exec).trim();
        sets.push({ where: `#${number}`, ids: idsOf(ctx, knowledgeAt({ ctx, ref, exec })) });
      } catch (error) {
        failed.push(`#${number}: ${(messageOf(error).split('\n')[0] ?? 'unreadable').trim()}`);
      }
    }
    if (failed.length > 0) pulls = failed.join('; ');
  } catch (error) {
    pulls = (messageOf(error).split('\n')[0] ?? 'unreadable').trim();
  }
  return { sets, base, pulls };
}
