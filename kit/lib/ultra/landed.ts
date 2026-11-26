/**
 * Whether a product PRD's merged work is in a base (bug #3371): what `/omni:ultra-yolo` reads of each PRD its spec says it is
 * `blocked-by` (through `omni prd <key>-<m> --landed-in <ref>`), and what a mission reads of a PRD outside its scope that a build
 * ended held on.
 *
 * A product PRD's work reaches a branch through its target feature pull requests, each one's body saying `Part of <key>-<n>`. Such a
 * pull request may have merged into a mission branch, and that mission branch then into the default branch through the mission's own
 * pull request, squashed or not: the target pull request's own merge commit is then on no branch but the mission's. So the PRD is
 * landed in `ref` when, for one of its merged target pull requests, its merge commit is in `ref`, or the merge commit of a merged pull
 * request whose head is that target pull request's base is.
 *
 * The page state alone never answers it: a product PRD's state is read from its approval, and reads `inbox` whether or not its work
 * merged. No path, folder or file of the PRD is ever guessed: only its merged pull requests are read.
 *
 * Pure: the reads are handed in (`gh` and `git` for the kit's command, GitHub's REST API for the Omni App).
 */
import type { ProductPrdId } from '../ids.ts';

/** A merged pull request: its number, the branch it merged into, its head branch and its merge commit. */
export type MergedPull = { number: number; base: string; head: string; merge: string };

/** What the answer reads, each sync or async. */
export type LandedReads = {
  /** The merged pull requests whose body says `Part of <prd>` (`saysPartOf`). */
  partOf: (prd: ProductPrdId) => readonly MergedPull[] | Promise<readonly MergedPull[]>;
  /** The merged pull requests whose head is branch `head`. */
  from: (head: string) => readonly MergedPull[] | Promise<readonly MergedPull[]>;
  /** Whether commit `sha` is in the base read against. */
  within: (sha: string) => boolean | Promise<boolean>;
};

/** Whether the PRD is landed, with the pull requests that carried it into the base (`#83`, `#83 into <branch>, then #118 into main`), or why not. */
export type Landed = { landed: true; via: string } | { landed: false; why: string };

/** Whether a pull request's body says it is part of product PRD `prd`: a line `Part of <prd>`, alone or followed by ` · <link>`. */
export function saysPartOf(body: string | null | undefined, prd: ProductPrdId): boolean {
  const line = `Part of ${prd}`;
  return (body ?? '').split('\n').some((one) => {
    const trimmed = one.trim();
    return trimmed === line || trimmed.startsWith(`${line} `);
  });
}

const pr = (number: number): string => `#${String(number)}`;

/** Whether product PRD `prd`'s merged work is in the base `reads.within` reads, and through which pull requests. */
export async function landedIn(prd: ProductPrdId, reads: LandedReads): Promise<Landed> {
  const pulls = await reads.partOf(prd);
  if (pulls.length === 0) return { landed: false, why: `no merged pull request says Part of ${prd}` };
  for (const one of pulls) {
    if (await reads.within(one.merge)) return { landed: true, via: pr(one.number) };
    for (const onward of await reads.from(one.base)) {
      if (await reads.within(onward.merge)) return { landed: true, via: `${pr(one.number)} into ${one.base}, then ${pr(onward.number)} into ${onward.base}` };
    }
  }
  const where = pulls.map((one) => `${pr(one.number)} into ${one.base}`).join(', ');
  return { landed: false, why: `${where}, not in the base yet` };
}
