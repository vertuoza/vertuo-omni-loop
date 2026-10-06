// The `rules.plan` of a repository's flow, graded on a plan's slices (PRD 1089): what `omni plan
// check` refuses on top of its own checks. Pure: the slices and the resolved flow in, one line per
// refusal out, each naming the slice, the area and the rule.
//
// - `slice.alone`: a slice touching the area touches no path outside it.
// - `slice.maxFiles`: at most n paths in the slice's territory, the strictest limit of its areas.
// - `wave: first`: the area's slices sit before every slice outside it, landing then wave.
// - `blocks: all`: a slice outside the area lists one of the area's slices in `blocked by`, directly
//   or through another slice; a slice in a later landing than one of the area's is after it already.
// - `landing: alone`: #1086's rule, scoped to the areas that ask for it (`landings.alone` is one, and
//   keeps its wording): a slice touching such an area touches nothing else, and a landing holding a
//   slice that lands alone holds only such slices.
// - Two `merge` methods, or two `replace` hooks at one point, on one slice: the slice is split.
//
// A slice belongs to every area its territory touches (`resolveTerritory`); an area's rules are its
// own with what it inherits from the default area.
import type { Slice } from '../types.ts';
import { areaOf, resolveTerritory, type AreaRules, type ResolvedFlow, type TerritoryFlow } from './resolve.ts';

/** The area `landings.alone` reads as: its refusals keep #1086's wording. */
const LANDINGS_ALIAS_AREA = 'landings.alone';

type Graded = { slice: Slice; territory: TerritoryFlow };

/** Every refusal the flow's plan rules make of `slices`, per slice first, then across slices. */
export function planRuleViolations(slices: readonly Slice[], flow: ResolvedFlow): string[] {
  const graded = slices.map((slice) => ({ slice, territory: resolveTerritory(flow, slice.territory) }));
  const areas = [flow.defaultArea, ...flow.areas];
  return [
    ...graded.flatMap(sliceViolations),
    ...areas.filter(({ rules }) => rules.plan.waveFirst).flatMap(({ name }) => waveFirstViolations(graded, name)),
    ...areas.filter(({ rules }) => rules.plan.blocksAll).flatMap(({ name }) => blocksAllViolations(graded, name)),
    ...landingAloneViolations(slices, flow),
  ];
}

/** What one slice breaks by itself: `slice.alone`, `slice.maxFiles`, and a merge or replace conflict. */
function sliceViolations(graded: Graded): string[] {
  return [...aloneViolations(graded), ...maxFilesViolations(graded), ...conflictViolations(graded)];
}

/** `slice.alone`: one line per area that asks for it when the slice touches another area too. */
function aloneViolations({ slice: { id }, territory }: Graded): string[] {
  if (territory.areas.length < 2) return [];
  return territory.areas
    .filter((area) => area.rules.plan.alone)
    .map((area) => {
      const other = territory.areas.filter(({ name }) => name !== area.name).flatMap(({ paths }) => paths);
      return `flow: ${id} touches ${area.paths.join(', ')} (area ${area.name}) and also ${other.join(', ')} — ${area.name}: slice alone, a slice of this area touches no path outside it.`;
    });
}

/** `slice.maxFiles`: the strictest limit of the slice's areas, named by the area that sets it. */
function maxFilesViolations({ slice, territory }: Graded): string[] {
  const max = territory.rules.plan.maxFiles;
  if (max === null || slice.territory.length <= max) return [];
  const setter = territory.areas.find(({ rules }) => rules.plan.maxFiles === max)?.name ?? '';
  return [`flow: ${slice.id} touches ${slice.territory.length} paths — ${setter}: slice maxFiles ${max}, at most ${max} ${max === 1 ? 'path' : 'paths'} in a slice of this area.`];
}

/** Two `merge` methods, or two `replace` hooks at one point, on one slice. */
function conflictViolations({ slice: { id }, territory }: Graded): string[] {
  const { merge, replace } = territory.conflicts;
  const methods = merge.map(({ area, method }) => `${area}: merge ${method}`).join(', ');
  return [
    ...(merge.length > 0 ? [`flow: ${id} meets more than one merge method (${methods}) — split the slice so each part merges one way.`] : []),
    ...replace.map(({ point, hooks }) => {
      const named = hooks.map(({ area, path }) => `${area}: ${path}`).join(', ');
      return `flow: ${id} meets more than one replace hook at ${point} (${named}) — split the slice so one hook replaces the step.`;
    }),
  ];
}

const touches = ({ territory }: Graded, area: string) => territory.areas.some(({ name }) => name === area);

/** Whether `a` merges strictly before `b`: an earlier landing, or the same landing and an earlier wave. */
function before(a: Slice, b: Slice): boolean {
  // `Number` keeps the plan check's reading: a `null` wave reads as 0.
  return a.landing < b.landing || (a.landing === b.landing && Number(a.wave) < Number(b.wave));
}

/** `wave: first` for `area`: one line per slice of the area that does not sit before a slice outside it. */
function waveFirstViolations(graded: readonly Graded[], area: string): string[] {
  const inside = graded.filter((one) => touches(one, area)).map(({ slice }) => slice);
  const outside = graded.filter((one) => !touches(one, area)).map(({ slice }) => slice);
  return inside.flatMap((slice) =>
    outside
      .filter((other) => !before(slice, other))
      .map(
        (other) =>
          `flow: ${slice.id} (wave ${slice.wave}) touches area ${area} and does not sit before ${other.id} (wave ${other.wave}), which does not — ${area}: wave first, the area's slices sit in a wave before every other slice.`,
      ),
  );
}

/** Every slice `id` waits for, directly or through another. */
function blockersOf(id: string, byId: ReadonlyMap<string, Slice>): Set<string> {
  const seen = new Set<string>();
  const queue = [...(byId.get(id)?.blockedBy ?? [])];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...(byId.get(next)?.blockedBy ?? []));
  }
  return seen;
}

/** `blocks: all` for `area`: one line per slice outside it that waits for none of the area's slices. */
function blocksAllViolations(graded: readonly Graded[], area: string): string[] {
  const inside = graded.filter((one) => touches(one, area)).map(({ slice }) => slice);
  if (inside.length === 0) return [];
  const byId = new Map(graded.map(({ slice }) => [slice.id, slice]));
  const ids = inside.map(({ id }) => id).join(', ');
  return graded
    .filter((one) => !touches(one, area))
    .map(({ slice }) => slice)
    .filter((slice) => !inside.some((member) => member.landing < slice.landing))
    .filter((slice) => {
      const waits = blockersOf(slice.id, byId);
      return !inside.some(({ id }) => waits.has(id));
    })
    .map((slice) => `flow: ${slice.id} is blocked by no slice of area ${area} (${ids}), directly or through another — ${area}: blocks all.`);
}

type AloneSplit = { alone: string[]; other: string[]; areas: string[] };

/** A slice's territory split by the areas that land alone: its paths in one, the rest, and those areas. */
function aloneSplit(slice: Slice, flow: ResolvedFlow): AloneSplit {
  const split: AloneSplit = { alone: [], other: [], areas: [] };
  for (const path of slice.territory) {
    const area = areaOf(flow, path);
    if (!landsAlone(area.rules)) {
      split.other.push(path);
      continue;
    }
    split.alone.push(path);
    if (!split.areas.includes(area.name)) split.areas.push(area.name);
  }
  return split;
}

const landsAlone = (rules: AreaRules) => rules.plan.landingAlone;

/** ` (area migrations)` for the named areas a slice lands alone in; nothing for `landings.alone`'s. */
function areaNote(areas: readonly string[]): string {
  const named = areas.filter((name) => name !== LANDINGS_ALIAS_AREA);
  if (named.length === 0) return '';
  return ` (${named.length === 1 ? 'area' : 'areas'} ${named.join(', ')})`;
}

/** The land-alone rule: a slice touching a land-alone path touches nothing else, and a landing
 * holding a land-alone slice holds no slice that touches none. A slice that mixes the two is refused
 * once, by the first rule. `[]` when no area lands alone. */
function landingAloneViolations(slices: readonly Slice[], flow: ResolvedFlow): string[] {
  if (![flow.defaultArea, ...flow.areas].some(({ rules }) => landsAlone(rules))) return [];
  const split = new Map(slices.map((slice) => [slice.id, aloneSplit(slice, flow)]));
  const violations: string[] = [];
  for (const slice of slices) {
    const { alone, other, areas } = split.get(slice.id) ?? { alone: [], other: [], areas: [] };
    if (alone.length > 0 && other.length > 0) {
      violations.push(
        `landing: ${slice.id} (landing ${slice.landing}) touches ${alone.join(', ')}, which lands alone${areaNote(areas)}, and also ${other.join(', ')} — a slice touching a land-alone path touches nothing else.`,
      );
    }
  }
  for (const landing of new Set(slices.map((slice) => slice.landing))) {
    const members = slices.filter((slice) => slice.landing === landing);
    const lone = members.filter((slice) => split.get(slice.id)?.other.length === 0 && slice.territory.length > 0);
    const rest = members.filter((slice) => split.get(slice.id)?.alone.length === 0);
    if (lone.length > 0 && rest.length > 0) {
      violations.push(
        `landing: landing ${landing} holds ${lone.map((slice) => slice.id).join(', ')}, which land alone, and ${rest.map((slice) => slice.id).join(', ')}, which do not — a landing holding a land-alone slice holds only land-alone slices.`,
      );
    }
  }
  return violations;
}
