// A concept's Areas tab (PRD 1272, s3): its areas in build order, the wedge (the first) marked. An area
// with a PRD links to that PRD's dossier page when the concept's workspace has one, else to the PRD's
// issue on the concept's home repository. The first area without a PRD carries the line that starts it,
// `/omni:brainstorm --concept <n> <area>`, for the page's copy button. Which PRDs have a page is read by
// `readAreaPages`, as the viewer, one lookup per PRD the areas name; a lookup that fails links the issue.
import type { ConceptArea } from 'omni-loop/kit/lib/concept/parse.ts';
import type { IssueNumber, PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { DossierReader } from '../dossier/store';
import { workPath } from '../dossier/page/work';
import { STAGE_LABELS, type StoredStage } from '../stages/stage';
import { hasShipped, storedStage } from './state';

/** Where an area's PRD links: its dossier page, or its issue when it has none. */
export type AreaPrd = { number: PrdNumber; href: string; to: 'page' | 'issue' };

export type AreaView = {
  id: string;
  area: string;
  brief: string;
  /** The first area, the one the concept is built from. */
  wedge: boolean;
  prd: AreaPrd | null;
  /** Its PRD's stage in the words of the PRDs tab, `syncing` while none is stored; null with no PRD. On a
   * concept shipped by a person, `not built` for an area whose PRD has not shipped, or that has none. */
  stage: string | null;
  /** The line that starts this area: the first area without a PRD only, else null. */
  next: string | null;
};

/** A PRD's stage in the words of the PRDs tab; `syncing` while none is stored. */
const NOT_BUILT = 'not built';

const stageWords = (stage: StoredStage | null) => (stage === null ? 'syncing' : STAGE_LABELS[stage]);

/** An area's stage line: its PRD's words, `not built` on a concept a person shipped when the PRD has not, or has none. */
function stageOf(prd: PrdNumber | null, stages: ReadonlyMap<string, StoredStage>, repo: string, byPerson: boolean): string | null {
  const stage = prd === null ? null : storedStage(stages, repo, prd);
  if (byPerson && !hasShipped(stage)) return NOT_BUILT;
  return prd === null ? null : stageWords(stage);
}

/** The line that brainstorms area `area` of concept `concept`. */
const brainstormLine = (concept: IssueNumber, area: string) => `/omni:brainstorm --concept ${concept} ${area}`;

/** An issue on GitHub: the concept's own, or a PRD's. */
export const issueLink = (repo: string, issue: IssueNumber) =>
  `https://github.com/${repo.split('/').map(encodeURIComponent).join('/')}/issues/${issue}`;

/** The areas of concept `concept` (null when the dossier carries no number) in `repo`, in build order;
 * `pages` gives the dossier id of each PRD that has a page, `stages` the stored stage of each PRD (by `prdKey`);
 * a `shipped` concept offers no brainstorm line, and one shipped by a person (`byPerson`) reads `not built`
 * on each area without a shipped PRD (PRD 2213). */
export function areaViews(areas: readonly ConceptArea[], concept: IssueNumber | null, repo: string, pages: ReadonlyMap<PrdNumber, string>,
  stages: ReadonlyMap<string, StoredStage> = new Map(), shipped = false, byPerson = false,
): AreaView[] {
  const next = shipped ? undefined : areas.find((area) => area.prd === null);
  return areas.map((area, index) => {
    const page = area.prd === null ? undefined : pages.get(area.prd);
    return {
      id: area.id,
      area: area.area,
      brief: area.brief,
      wedge: index === 0,
      prd: area.prd === null ? null : page === undefined
        ? { number: area.prd, href: issueLink(repo, area.prd), to: 'issue' }
        : { number: area.prd, href: workPath('prd', page), to: 'page' },
      stage: stageOf(area.prd, stages, repo, byPerson),
      next: area === next && concept !== null ? brainstormLine(concept, area.id) : null,
    };
  });
}

/** The dossier id of each PRD in `prds` that has a page in `repo` the viewer may read. */
export async function readAreaPages(reader: Pick<DossierReader, 'numbered'>, repo: string, prds: readonly PrdNumber[]): Promise<Map<PrdNumber, string>> {
  const found = await Promise.all([...new Set(prds)].map(async (prd): Promise<[PrdNumber, string] | null> => {
    try {
      const id = await reader.numbered(repo, prd, 'prd');
      return id === null ? null : [prd, id];
    } catch (error) {
      console.error(error);
      return null;
    }
  }));
  return new Map(found.filter((entry) => entry !== null));
}
