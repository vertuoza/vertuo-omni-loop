// `omni replies --prd <n> --pr <n> [--repo owner/name] [--post]` — reads the numbered replies on the
// feature pull request, settles what they answer, and (with --post) posts the next round. It reads
// and settles the PRD's outbox through its outbox store (PRD 1548, s6).
// Ported from nimbus-brain@c4a210122:scripts/outbox-replies.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { summarize } from '../../lib/outbox/replies.ts';
import { outboxStore } from '../../lib/outbox/stores.ts';
import { githubClientFor } from '../github.ts';
import { propertyOf } from '../../lib/narrow.ts';
import { parseArgs, prArg, prdArg, println, repoSlug, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';

export const replies: Command = {
  async run(args: string[], { ctx, stdout, exec, env }: CommandIo): Promise<number> {
    const { positional, flags } = parseArgs('replies', args, { values: ['prd', 'pr', 'repo'], booleans: ['post'] });
    if (positional.length) throw usageError('usage: omni replies --prd <n> --pr <n> [--repo <owner/name>] [--post]');
    const prd = prdArg('replies', '--prd', flags.prd);
    const pr = prArg('replies', '--pr', flags.pr);
    const repo = repoSlug('replies', ctx, flags.repo);
    const post = flags.post === true;

    const result = await outboxStore(ctx).replies({ prd, pr, post }, githubClientFor(ctx, { repo, issue: pr, exec, env }));
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
  },
};
