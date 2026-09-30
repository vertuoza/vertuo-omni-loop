// Two repositories each with a PRD 88 (PRD 728): the ledger the arcade's tests read when a planet is
// keyed by `<home>#<n>`, not by its number alone. Every repository, login and fleet is invented.
import { buildGalaxy, type GalaxyView, type LedgerEvent, type Projects } from '@omni/galaxy';

export const TWIN_NOW = new Date('2026-09-23T14:00:00Z');

const TWIN_PROJECTS: Projects = {
  sectors: { plan: { repos: ['acme/plan'] }, tools: { repos: ['acme/tools'] } },
  teams: { beaver: { home: 'plan' }, octopod: { home: 'tools' } },
};

/** One PRD `prd` of `home`: charted, surveyed in its home, one zone secured by `who` of `team`. */
export function twinEvents(home: string, team: string, who: string, prd = 88, extra: Partial<LedgerEvent>[] = []): LedgerEvent[] {
  const e = (id: string, at: string, type: string, rest: Partial<LedgerEvent> = {}): LedgerEvent =>
    ({ id, at, type, planet: prd, home, data: {}, ...rest });
  return [
    e(`planet:${home}#${prd}:charted`, '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { data: { captain: who, ownerTeam: team, title: `${prd} of ${home}` } }),
    e(`region:${home}:${home}#${prd}:surveyed`, '2026-09-02T08:00:00Z', 'REGION_SURVEYED', { region: home }),
    e(`zone:${home}:${home}#${prd}:s1:opened`, '2026-09-21T08:00:00Z', 'ZONE_OPENED', { region: home, data: { wave: 1 } }),
    e(`zone:${home}:${home}#${prd}:s1:secured`, '2026-09-21T12:00:00Z', 'ZONE_SECURED', { region: home, contributor: who, team }),
    ...extra.map((x) => e(x.id!, x.at!, x.type!, x)),
  ];
}

/** Both PRD 88s: acme/plan's, owned by beaver and secured by bob; acme/tools', by octopod and alice. */
function twinEventsBoth(): LedgerEvent[] {
  return [...twinEvents('acme/plan', 'beaver', 'bob'), ...twinEvents('acme/tools', 'octopod', 'alice')];
}

/** The galaxy both PRD 88s make: two planets. */
export function twinGalaxy(events: LedgerEvent[] = twinEventsBoth()): GalaxyView {
  return buildGalaxy(events, { projects: TWIN_PROJECTS, now: TWIN_NOW, source: 'demo' });
}
