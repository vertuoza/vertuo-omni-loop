// `omni prd <key>-<n> --landed-in <ref> [--repo <owner/repo>] [--clone <dir>]` (bug #3371): whether a product PRD's merged work is in
// `<ref>`, the base a build reads. `/omni:ultra-yolo` asks it of each PRD the spec says it is `blocked-by`, never the page state
// alone (a product PRD's state reads `inbox` whether or not its work merged) and never a path the plan guessed.
//
// It reads the PRD's merged pull requests through `gh` in `--repo` (the repository's own slug by default): those whose body says
// `Part of <key>-<n>`, and those whose head is such a pull request's base (a mission branch, merged onward by its mission's pull
// request). Then `git merge-base --is-ancestor` in `--clone` (this checkout by default) says whether a merge commit is in `<ref>`, which
// the caller has fetched. `../../lib/ultra/landed.ts` decides.
//
// It prints one line: `landed: yes · <ref> holds #83 into <branch>, then #118 into main`, exit 0; `landed: no · <why>`, or `landed: unknown · gh failed: <its last line>`, exit 1.
// It needs no sign-in: it never calls the Omni page.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { z } from 'zod';
import type { Context } from '../../lib/context.ts';
import type { ProductPrdId } from '../../lib/ids.ts';
import { landedIn, saysPartOf, type MergedPull } from '../../lib/ultra/landed.ts';
import { println } from '../args.ts';
import type { Exec, Out } from '../io.ts';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };

/** `gh pr list --json number,body,baseRefName,headRefName,mergeCommit`. */
const ListedSchema = z.array(z.looseObject({
  number: z.number().int().positive(),
  body: z.string().nullish(),
  baseRefName: z.string(),
  headRefName: z.string(),
  mergeCommit: z.looseObject({ oid: z.string() }).nullish(),
}));
type Listed = z.infer<typeof ListedSchema>[number];

const mergedOf = (one: Listed): MergedPull[] => (one.mergeCommit == null ? [] : [{ number: one.number, base: one.baseRefName, head: one.headRefName, merge: one.mergeCommit.oid }]);

export type LandedArgs = { id: ProductPrdId; ref: string; repo: string | null; clone: string | null };

/** The last line of what a failed process wrote. */
const lastLine = (error: unknown): string => {
  const read = z.looseObject({ stderr: z.unknown() }).safeParse(error);
  const stderr = read.success ? read.data.stderr : undefined;
  const text = typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString('utf8') : error instanceof Error ? error.message : String(error);
  return text.trim().split('\n').at(-1) ?? '';
};

/** `omni prd <key>-<n> --landed-in <ref>`: one line, exit 0 when landed. */
export async function productLanded({ id, ref, repo, clone }: LandedArgs, { ctx, exec, stdout }: { ctx: Context; exec: Exec; stdout: Out }): Promise<number> {
  const slug = repo ?? ctx.config.repo.slug;
  if (slug === null) {
    println(stdout, 'landed: unknown · no repository to read: pass --repo <owner/repo>');
    return 1;
  }
  const cwd = clone ?? ctx.root;
  const list = (extra: string[]): Listed[] =>
    ListedSchema.parse(JSON.parse(exec('gh', ['pr', 'list', '--repo', slug, '--state', 'merged', ...extra, '--limit', '50', '--json', 'number,body,baseRefName,headRefName,mergeCommit'], { cwd, ...QUIET })));
  try {
    const found = await landedIn(id, {
      partOf: (prd) => list(['--search', `"Part of ${prd}" in:body`]).filter((one) => saysPartOf(one.body, prd)).flatMap(mergedOf),
      from: (head) => list(['--head', head]).flatMap(mergedOf),
      within: (sha) => {
        try {
          exec('git', ['merge-base', '--is-ancestor', sha, ref], { cwd, ...QUIET });
          return true;
        } catch {
          return false;
        }
      },
    });
    println(stdout, found.landed ? `landed: yes · ${ref} holds ${found.via}` : `landed: no · ${found.why} (${ref})`);
    return found.landed ? 0 : 1;
  } catch (error) {
    println(stdout, `landed: unknown · gh failed: ${lastLine(error)}`);
    return 1;
  }
}
