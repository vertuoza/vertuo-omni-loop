// `omni comment --prd <n> (--pr <n> [--result f] | --branch <b> [--ref] [--base] [--labels]
// [--slack-note f] [--title] [--owner-slack-id] [--owner-login] [--pr-comment f]) [--repo]` — the two
// outbox comments (the feature pull request's, then the PRD issue's) and the Slack note file. Each
// comment reads the PRD's outbox through its outbox store (PRD 1548, s6).
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-comment.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { writeFileSync } from 'node:fs';
import { rangeChanges } from '../../lib/git.ts';
import { maybeWriteSlackNote, readPrCommentResult, slackOwner } from '../../lib/outbox/comment.ts';
import { outboxStore } from '../../lib/outbox/stores.ts';
import { githubClientFor } from '../github.ts';
import { errorMessage, inRoot, list, parseArgs, prArg, prdArg, println, repoSlug, usageError } from '../args.ts';
import type { NameStatus } from '../../lib/git.ts';
import type { Command, CommandIo } from '../io.ts';

const USAGE =
  'usage: omni comment --prd <n> --branch <feature-branch> [--repo <owner/name>] [--base <ref>] [--ref <sha>] ' +
  '[--labels <a,b>] [--slack-note <file>] [--title <t>] [--owner-slack-id <id>] [--owner-login <login>] [--pr-comment <file>]' +
  ' | omni comment --prd <n> --pr <n> [--repo <owner/name>] [--result <file>]';

export const comment: Command = {
  async run(args: string[], { ctx, stdout, exec, env }: CommandIo): Promise<number> {
    const { positional, flags } = parseArgs('comment', args, {
      values: ['prd', 'pr', 'repo', 'result', 'branch', 'ref', 'base', 'labels', 'slack-note', 'title', 'owner-slack-id', 'owner-login', 'pr-comment'],
    });
    if (positional.length) throw usageError(USAGE);
    const prd = prdArg('comment', '--prd', flags.prd);
    const repo = repoSlug('comment', ctx, flags.repo);
    const [owner = '', name = ''] = repo.split('/');
    const store = outboxStore(ctx);

    // `--pr` writes the plain-words comment on the feature pull request itself; its absence writes
    // the PRD-issue comment.
    if (flags.pr !== undefined) {
      const pr = prArg('comment', '--pr', flags.pr);
      const result = await store.prComment(prd, githubClientFor(ctx, { repo, issue: pr, exec, env }));
      println(
        stdout,
        `omni comment: ${result.action} pull request comment #${result.id ?? '?'} on PR #${pr} — ` +
          `${result.openCount} open question(s), ${result.answeredCount} answered, ` +
          `${result.adoptedCount} adopted (${result.newAdoptedCount} new).`,
      );
      // What the PRD-issue run needs for the Slack note: where this comment lives, and how many
      // adopted items it listed for the first time. Read back by `readPrCommentResult`.
      if (flags.result) {
        const { htmlUrl, adoptedCount, newAdoptedCount } = result;
        writeFileSync(inRoot(ctx, flags.result), `${JSON.stringify({ htmlUrl, adoptedCount, newAdoptedCount })}\n`);
      }
      return 0;
    }

    const branch = flags.branch;
    if (!branch) throw usageError(USAGE);
    const ref = flags.ref ?? branch;
    let changes: NameStatus[] = [];
    if (flags.base) {
      try {
        changes = rangeChanges({ ctx, base: flags.base, exec });
      } catch (error) {
        throw usageError(errorMessage(error).split('\n')[0] ?? '');
      }
    }
    const result = await store.issueComment(
      { prd, owner, repo: name, branch, ref, changes, labels: list(flags.labels) },
      githubClientFor(ctx, { repo, issue: prd, exec, env }),
    );
    println(
      stdout,
      `omni comment: ${result.action} comment #${result.id ?? '?'} on issue #${prd} — ` +
        `${result.itemCount} open item(s), ${result.unaccountedCount} unaccounted change(s), ` +
        `${result.newCount} new.`,
    );

    maybeWriteSlackNote({
      ctx,
      prd,
      title: flags.title ?? null,
      owner: slackOwner({ slackId: flags['owner-slack-id'] ?? null, login: flags['owner-login'] ?? null }),
      result,
      prComment: readPrCommentResult(flags['pr-comment'] ? inRoot(ctx, flags['pr-comment']) : null),
      path: flags['slack-note'] ? inRoot(ctx, flags['slack-note']) : null,
    });
    return 0;
  },
};
