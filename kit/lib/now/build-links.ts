// What the background refresh writes as the links of a PRD or a fix (PRD 1208's spec, "Links", slice
// s4), in this order:
//
// - **A PRD:** `PRD page` (its dossier's link, as `omni dossier link <n>` asks it), `feature PR #<k>`
//   (the open pull request from its feature branch, else the latest), `phase-0 PR #<k>` while one
//   from its phase-0 branch is open.
// - **A bug or visual fix:** `fix page` (`omni dossier link <n> --kind <kind>`), `fix PR #<k>` while
//   one from its fix branch is open: that link is what reads the fix's stage as `fix PR open`.
//
// The topic is read from the work's folder (the inbox or shipped for a PRD, `bugs/` or `visual/` for a
// fix) in the checkout, else on the base. The pull requests are read through the injected `LoopReads`
// (PRD 1665: the Omni page), the page's links through the injected `page`; a link that cannot be had (no
// folder, no sign-in, offline, no such pull request) is left out, and nothing here throws.
import { fillBranch } from '../board.ts';
import { bugRoot } from '../bug/verdict.ts';
import type { Context, ExecText } from '../context.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import type { LoopChange } from '../loop-reads/contract.ts';
import type { LoopReads } from '../loop-reads/port.ts';
import { parseFolderName } from '../layout.ts';
import { visualRoot } from '../visual/verdict.ts';
import { FIX_PR } from './now.ts';
import type { FixKind, NowLink } from './now.ts';
import { baseOf, foldersAt } from './tree.ts';

/** The Omni page's link for the `kind` work numbered `n`, or `null` when it has none. */
export type PageOf = (kind: 'prd' | FixKind, n: PrdNumber | IssueNumber) => Promise<string | null>;

/** What building the links reads through: the pull requests, the Omni page's links, and git. */
type LinkReads = { reads: LoopReads; page: PageOf; exec: ExecText };

/** Whether `change` is still open: a draft is too. */
const isOpen = (change: LoopChange): boolean => change.state === 'open' || change.state === 'draft';

/** The topic of the work numbered `n` among the folders under `dirs`, in the checkout or on the base. */
function topicOf(ctx: Context, dirs: readonly string[], n: PrdNumber | IssueNumber, exec: ExecText): string | null {
  const base = baseOf(ctx, exec);
  for (const dir of dirs) {
    const { checkout, base: onBase } = foldersAt(ctx, dir, base, exec);
    const parsed = [...checkout, ...onBase].map(parseFolderName).find((folder) => folder?.prd === n);
    if (parsed) return parsed.topic;
  }
  return null;
}

/** The pull requests from `head` (newest first); none without a repository slug, or when they cannot be read. */
async function prsFrom(ctx: Context, reads: LoopReads, head: string, state: 'open' | 'all'): Promise<LoopChange[]> {
  const repo = ctx.config.repo.slug;
  if (!repo) return [];
  try {
    return await reads.changes({ repo, head, state });
  } catch {
    return [];
  }
}

/** The link to `pr`, labelled `<label> #<k>`. */
const prLink = (label: string, pr: LoopChange | undefined): NowLink[] => (pr ? [{ label: `${label} #${pr.number}`, href: pr.url }] : []);

/** The Omni page's link, labelled `label`; none when it cannot be had. */
async function pageLink(page: PageOf, kind: 'prd' | FixKind, n: PrdNumber | IssueNumber, label: string): Promise<NowLink[]> {
  try {
    const href = await page(kind, n);
    return href ? [{ label, href }] : [];
  } catch {
    return [];
  }
}

/** The links of PRD `n`: its page, its feature PR and its phase-0 PR while open. */
async function prdLinks(ctx: Context, n: PrdNumber | IssueNumber, { reads, page, exec }: LinkReads): Promise<NowLink[]> {
  const links = await pageLink(page, 'prd', n, 'PRD page');
  const topic = topicOf(ctx, [ctx.layout.dirs.inbox, ctx.layout.dirs.shipped], n, exec);
  if (topic === null) return links;
  const features = await prsFrom(ctx, reads, fillBranch(ctx.config.branches.feature, { topic }), 'all');
  const feature = features.find(isOpen) ?? features[0];
  const phase0 = (await prsFrom(ctx, reads, fillBranch(ctx.config.branches.phase0, { topic }), 'open'))[0];
  return [...links, ...prLink('feature PR', feature), ...prLink('phase-0 PR', phase0)];
}

/** The links of the `kind` fix of issue `n`: its page, and its pull request while open. */
async function fixLinks(ctx: Context, kind: FixKind, n: PrdNumber | IssueNumber, { reads, page, exec }: LinkReads): Promise<NowLink[]> {
  const links = await pageLink(page, kind, n, 'fix page');
  const topic = topicOf(ctx, [kind === 'bug' ? bugRoot(ctx) : visualRoot(ctx)], n, exec);
  if (topic === null) return links;
  return [...links, ...prLink(FIX_PR, (await prsFrom(ctx, reads, fillBranch(ctx.config.branches.fix, { topic }), 'open'))[0])];
}

/** The links of the `kind` work numbered `n` in the checkout of `ctx`, in the spec's order. */
export function buildLinks(ctx: Context, kind: 'prd' | FixKind, n: PrdNumber | IssueNumber, io: LinkReads): Promise<NowLink[]> {
  return kind === 'prd' ? prdLinks(ctx, n, io) : fixLinks(ctx, kind, n, io);
}
