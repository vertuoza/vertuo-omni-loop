// `omni replies --prd <n> --pr <n> [--repo owner/name] [--post]` — reads the numbered replies on the
// feature pull request, settles what they answer, and (with --post) posts the next round.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-replies.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { readReplies, summarize } from '../../lib/outbox/replies.ts';
import { githubClientFor } from '../github.ts';
import { propertyOf } from '../../lib/narrow.ts';
import { parseArgs, positiveInt, println, repoSlug, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

export const replies: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec, env }: CommandIo): number => {
    const { positional, flags } = parseArgs('replies', args, { values: ['prd', 'pr', 'repo'], booleans: ['post'] });
    if (positional.length) throw usageError('usage: omni replies --prd <n> --pr <n> [--repo <owner/name>] [--post]');
    const prd = positiveInt('replies', '--prd', flags.prd);
    const pr = positiveInt('replies', '--pr', flags.pr);
    const repo = repoSlug('replies', ctx, flags.repo);
    const post = flags.post === true;

    const result = readReplies({ ctx, prd, pr, post }, githubClientFor(ctx, { repo, issue: pr, exec, env }));
    println(stdout, summarize(result));
    if (result.round) {
      if (result.round.posted) {
        const url = propertyOf(result.round.posted, 'html_url');
        println(stdout, `Posted outbox round ${result.round.number}: ${typeof url === 'string' ? url : ''}`);
      } else {
        println(stdout, `\nOutbox round ${result.round.number} (not posted — pass --post):\n`);
        println(stdout, result.round.body);
      }
    }
    return result.failed.length > 0 ? 1 : 0;
  }),
};
