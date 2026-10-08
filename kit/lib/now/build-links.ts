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
// fix) in the checkout, else on the base. GitHub is asked through the injected `gh`, the Omni page
// through the injected `page`; a link that cannot be had (no folder, no sign-in, offline, no such pull
// request) is left out, and nothing here throws.
import { z } from 'zod';
import { fillBranch } from '../board.ts';
import { bugRoot } from '../bug/verdict.ts';
import type { Context, ExecText } from '../context.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { parseFolderName } from '../layout.ts';
import { visualRoot } from '../visual/verdict.ts';
import { FIX_PR } from './now.ts';
import type { FixKind, NowLink } from './now.ts';
import { attempt, baseOf, foldersAt } from './tree.ts';

/** `gh` run with `args`: its standard output. */
export type Gh = (args: readonly string[]) => string;

/** The Omni page's link for the `kind` work numbered `n`, or `null` when it has none. */
export type PageOf = (kind: 'prd' | FixKind, n: PrdNumber | IssueNumber) => Promise<string | null>;


const ListedPrSchema = z.object({ number: z.number().int().positive(), url: z.string().min(1), state: z.string().catch('') });
/** The pull requests `gh pr list` answered: one that does not read is left out. */
const ListedPrsSchema = z.array(z.unknown()).transform((prs) => prs.flatMap((pr) => {
  const read = ListedPrSchema.safeParse(pr);
  return read.success ? [read.data] : [];
}));
type ListedPr = z.infer<typeof ListedPrSchema>;

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

/** The pull requests from `head`, as GitHub lists them (newest first); none when it cannot be asked. */
function prsFrom(ctx: Context, gh: Gh, head: string, state: 'open' | 'all'): ListedPr[] {
  const slug = ctx.config.repo.slug;
  const args = ['pr', 'list', ...(slug ? ['--repo', slug] : []), '--head', head, '--state', state, '--json', 'number,url,state', '--limit', '20'];
  const listed = attempt((): unknown => JSON.parse(gh(args)), []);
  return ListedPrsSchema.safeParse(listed).data ?? [];
}

/** The link to `pr`, labelled `<label> #<k>`. */
const prLink = (label: string, pr: ListedPr | undefined): NowLink[] => (pr ? [{ label: `${label} #${pr.number}`, href: pr.url }] : []);

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
async function prdLinks(ctx: Context, n: PrdNumber | IssueNumber, { gh, page, exec }: { gh: Gh; page: PageOf; exec: ExecText }): Promise<NowLink[]> {
  const links = await pageLink(page, 'prd', n, 'PRD page');
  const topic = topicOf(ctx, [ctx.layout.dirs.inbox, ctx.layout.dirs.shipped], n, exec);
  if (topic === null) return links;
  const features = prsFrom(ctx, gh, fillBranch(ctx.config.branches.feature, { topic }), 'all');
  const feature = features.find((pr) => pr.state === 'OPEN') ?? features[0];
  const phase0 = prsFrom(ctx, gh, fillBranch(ctx.config.branches.phase0, { topic }), 'open')[0];
  return [...links, ...prLink('feature PR', feature), ...prLink('phase-0 PR', phase0)];
}

/** The links of the `kind` fix of issue `n`: its page, and its pull request while open. */
async function fixLinks(ctx: Context, kind: FixKind, n: PrdNumber | IssueNumber, { gh, page, exec }: { gh: Gh; page: PageOf; exec: ExecText }): Promise<NowLink[]> {
  const links = await pageLink(page, kind, n, 'fix page');
  const topic = topicOf(ctx, [kind === 'bug' ? bugRoot(ctx) : visualRoot(ctx)], n, exec);
  if (topic === null) return links;
  return [...links, ...prLink(FIX_PR, prsFrom(ctx, gh, fillBranch(ctx.config.branches.fix, { topic }), 'open')[0])];
}

/** The links of the `kind` work numbered `n` in the checkout of `ctx`, in the spec's order. */
export function buildLinks(ctx: Context, kind: 'prd' | FixKind, n: PrdNumber | IssueNumber, io: { gh: Gh; page: PageOf; exec: ExecText }): Promise<NowLink[]> {
  return kind === 'prd' ? prdLinks(ctx, n, io) : fixLinks(ctx, kind, n, io);
}
