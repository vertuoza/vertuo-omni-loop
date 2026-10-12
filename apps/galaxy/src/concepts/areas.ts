// A concept's Areas tab (PRD 1272, s3): its areas in build order, the wedge (the first) marked. An area
// with a PRD links to that PRD's dossier page when the concept's workspace has one, else to the PRD's
// issue on the concept's home repository. The first area without a PRD carries the line that starts it,
// `/omni:brainstorm --concept <n> <area>`, for the page's copy button. Which PRDs have a page is read by
// `readAreaPages`, as the viewer, one lookup per PRD the areas name; a lookup that fails links the issue.
import type { ConceptArea } from 'vertuo-omni-plan/kit/lib/concept/parse.ts';
import type { IssueNumber, PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { DossierReader } from '../dossier/store';
import { workPath } from '../dossier/page/work';

/** Where an area's PRD links: its dossier page, or its issue when it has none. */
export type AreaPrd = { number: PrdNumber; href: string; to: 'page' | 'issue' };

export type AreaView = {
  id: string;
  area: string;
  brief: string;
  /** The first area, the one the concept is built from. */
  wedge: boolean;
  prd: AreaPrd | null;
  /** The line that starts this area: the first area without a PRD only, else null. */
  next: string | null;
};

/** The line that brainstorms area `area` of concept `concept`. */
const brainstormLine = (concept: IssueNumber, area: string) => `/omni:brainstorm --concept ${concept} ${area}`;

/** An issue on GitHub: the concept's own, or a PRD's. */
export const issueLink = (repo: string, issue: IssueNumber) =>
  `https://github.com/${repo.split('/').map(encodeURIComponent).join('/')}/issues/${issue}`;

/** The areas of concept `concept` (null when the dossier carries no number) in `repo`, in build order;
 * `pages` gives the dossier id of each PRD that has a page. */
export function areaViews(areas: readonly ConceptArea[], concept: IssueNumber | null, repo: string, pages: ReadonlyMap<PrdNumber, string>): AreaView[] {
  const next = areas.find((area) => area.prd === null);
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
