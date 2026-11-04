// Where `omni kb business-laws` reads the laws from (PRD 2632): in the product's law home, the files of this
// checkout; anywhere else, the newest pack of the law home (`omni kb pack get`), which says so when the page
// is unreachable and the pack printed is the last one fetched. A product with no law home, a page that cannot
// be asked or a repository that is the home reads this checkout's own files, as before.
import { basename } from 'node:path';
import { readBusinessLaws, type BusinessLaw } from './business-laws.ts';
import type { KnowledgeCtx } from './registers.ts';
import type { PackGetResult } from './packs/get.ts';

/** The laws, and the lines to print beside them (empty when they are this checkout's own). */
export type LawsAt = { laws: BusinessLaw[]; notes: string[] } | { laws: null; errors: string[] };

/** Whether `repo` is the law home `home`, whatever the case of either. */
const isHome = (home: string, repo: string | null): boolean => repo !== null && repo.toLowerCase() === home.toLowerCase();

/** The commit a pack folder (`<name>@<sha>`) holds, in seven characters. */
const shaOf = (folder: string): string => basename(folder).split('@')[1]?.slice(0, 7) ?? '';

/** The business laws this checkout reads: its own files, or the pack of the law home `home` when it is elsewhere. */
export async function businessLawsAt({ ctx, repo, home, getPack }: {
  ctx: KnowledgeCtx;
  repo: string | null;
  home: string | null;
  getPack: (home: string) => Promise<PackGetResult>;
}): Promise<LawsAt> {
  if (home === null || isHome(home, repo)) return { laws: readBusinessLaws({ ctx }), notes: [] };
  const pack = await getPack(home);
  const folder = pack.out[0];
  if (pack.code !== 0 || folder === undefined) return { laws: null, errors: pack.err.length > 0 ? pack.err : [`no pack of ${home}`] };
  const held = pack.out.slice(1);
  return {
    laws: readBusinessLaws({ ctx: { root: folder, layout: ctx.layout } }),
    notes: [`law home: ${home} — read from its pack ${shaOf(folder)}`, ...held, ...pack.err],
  };
}
