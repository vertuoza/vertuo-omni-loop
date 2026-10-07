// The one comment the retro of a multi-repository PRD writes in a target (PRD 1130): on each read
// target's merged feature PR, the retro's link and that repository's findings, one line each, or
// `No finding for this repository.` It is the only thing the App writes in a target.
//
//   step "comment-target-<name>"   per read target, as that target's installation; the day-14 run's
//                                  is "comment-target-<name>-day-14"
//
// The comment is found by its marker, `<!-- <markers.prefix>-retro-target -->`, and rewritten in place
// (`upsertComment`), so a replay and the day-14 run never add a second one. A target not read gets no
// comment; a PRD of one repository has no target, and so no step. A write GitHub refuses (401, 403 or
// 404: the App may read a target without writing to it) is saved as refused with its status, and the
// retro goes on: a thinner retro, never a failed one.
import { z } from 'zod';
import { CommentIdSchema, PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { savedStep, type StepRun } from '../saved-step.ts';
import { upsertComment } from '../verdict-comment/verdict-comment.ts';
import type { IssueLinks, Octokit, PrdFacts, SheetFinding, TargetRead } from './retro.types.ts';

/** The marker the target comment is found by. */
export const targetMarker = (prefix: string): string => `<!-- ${prefix}-retro-target -->`;

/** What the step "comment-target-<name>" saves: each merged feature PR's comment, or the status GitHub refused it with. */
const TargetCommentedSchema = z.union([
  z.object({ comments: z.array(z.object({ prNumber: PrNumberSchema, commentId: CommentIdSchema, created: z.boolean() })) }),
  z.object({ refused: z.number() }),
]);
type TargetCommented = z.infer<typeof TargetCommentedSchema>;

/** Where the retro is read: its PR when one was published, else the merged plan PR its verdict comment is on. */
export type RetroLink = { label: string; url: string | null };

/** The comment's text: the retro's link, then the target's findings, one line each, with their issue when one was opened. */
export function targetComment({
  prd,
  repo,
  link,
  findings,
  issues,
}: {
  prd: Pick<PrdFacts, 'number' | 'title'>;
  repo: string;
  link: RetroLink;
  findings: readonly SheetFinding[];
  issues: IssueLinks;
}): string {
  const own = findings.filter((finding) => finding.repo === repo);
  const where = link.url ? `[${link.label}](${link.url})` : link.label;
  const lines = own.map((finding) => {
    const issue = issues[finding.id];
    const title = finding.title.startsWith(`${repo}: `) ? finding.title.slice(repo.length + 2) : finding.title;
    return `- ${finding.ref} · ${title}${issue ? ` · [#${issue.number}](${issue.url})` : ''}`;
  });
  return [
    `**Retro of PRD ${prd.number}** · ${prd.title}`,
    '',
    `The whole retro, across every repository of the PRD: ${where}.`,
    '',
    `### Findings in ${repo}`,
    '',
    ...(lines.length > 0 ? lines : ['No finding for this repository.']),
  ].join('\n');
}

type CommentInput = {
  step: StepRun;
  octokitFor: OctokitFor<Octokit>;
  /** The id of a step of this run: the merge run's as named, the day-14 run's with its run after it. */
  id: (name: string) => string;
  targets: readonly TargetRead[];
  prefix: string;
  prd: Pick<PrdFacts, 'number' | 'title'>;
  link: RetroLink;
  findings: readonly SheetFinding[];
  issues: IssueLinks;
};

/** One comment on each read target's merged feature PRs, each target in its own step; nothing for a target not read. */
export async function commentTargets({ step, octokitFor, id, targets, prefix, ...text }: CommentInput): Promise<Record<string, TargetCommented>> {
  const out: Record<string, TargetCommented> = {};
  for (const target of targets) {
    if (!target.read) continue;
    const [owner = '', repo = ''] = target.repo.split('/');
    const body = targetComment({ ...text, repo: target.repo });
    out[target.name] = await savedStep(step, id(`comment-target-${target.name}`), TargetCommentedSchema, () =>
      refusedAs(async () => {
        const octokit = await octokitFor(target.installationId);
        const comments = [];
        for (const pull of target.featurePrs.filter((one) => one.merged)) {
          const written = await upsertComment(octokit, { owner, repo, prNumber: pull.number, marker: targetMarker(prefix), text: body });
          comments.push({ prNumber: pull.number, ...written });
        }
        return { comments };
      }),
    );
  }
  return out;
}

/** The comments written, or the status GitHub refused the write with (401, 403 or 404); anything else is thrown, so the step is retried. */
async function refusedAs(write: () => Promise<TargetCommented>): Promise<TargetCommented> {
  try {
    return await write();
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
    if (status === 401 || status === 403 || status === 404) return { refused: status };
    throw error;
  }
}
