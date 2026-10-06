// A repository's flow, resolved (PRD 1089): the `flow` section of the config, #1086's aliases folded
// in, its patterns compiled, each area's rules and hooks with what it inherits from the default area,
// and the area each path belongs to. Pure: it reads the parsed config and nothing else.
//
// - A path belongs to the first area, in declared order, whose `paths` match it; otherwise to the
//   default area (the root of `flow`).
// - An area inherits the default area's rules and hooks unless it says `inherit: false`. Inherited,
//   a limit keeps the strictest value, `requireChecks` is the union, `approval` and
//   `territory: block` stick; the area's own `merge` and its own `replace` win over the default's.
// - A slice belongs to every area its territory touches, and its rules combine the same way across
//   them. Two different `merge` methods, or two different `replace` hooks at one point, are kept as
//   conflicts for `omni plan check` to refuse, never settled here.
// - `landings.alone: [<re>]` reads as an area named `landings.alone`, after the declared ones, with
//   those paths and `landing: alone`; `pr.openWith: <command>` as the default area's `pr.open`
//   replace hook, marked `alias: claude`.
import type { Config } from '../types.ts';
import { FLOW_POINTS } from './points.ts';
import { CLAUDE_ALIAS, DEFAULT_AREA, hooksByMode, type FlowHooks, type FlowRules, type HookRef, MERGE_METHODS, type PlanRule } from './schema.ts';

type MergeMethod = (typeof MERGE_METHODS)[number];

/** An area's rules, every one present: `null` or `false` where nothing asks for it. */
export type AreaRules = {
  plan: { alone: boolean; maxFiles: number | null; waveFirst: boolean; blocksAll: boolean; landingAlone: boolean };
  subPr: {
    merge: MergeMethod | null;
    requireChecks: string[];
    approval: 'person' | null;
    territory: 'report' | 'block' | null;
    maxOpen: number | null;
  };
};

/** One hook, as the skill follows it: the area that declared it, the file (or Claude-only command) and its alias. */
export type ResolvedHook = { area: string; path: string; alias: typeof CLAUDE_ALIAS | null };

/** What runs at one point: every `before`, then the kit's step or the `replace` hook, then every `after`. */
export type PointHooks = { before: ResolvedHook[]; replace: ResolvedHook | null; after: ResolvedHook[] };

export type ResolvedArea = {
  name: string;
  /** The compiled `paths`; `[]` for the default area, which takes every path no other area claims. */
  patterns: RegExp[];
  knowledge: string | null;
  inherit: boolean;
  /** Its rules, with what it inherits. */
  rules: AreaRules;
  /** Its hooks, by point, with what it inherits; a point with none is absent. */
  hooks: Record<string, PointHooks>;
};

export type ResolvedFlow = { defaultArea: ResolvedArea; areas: ResolvedArea[] };

/** What a slice's territory meets: its areas, its combined rules and hooks, and what conflicts across them. */
export type TerritoryFlow = {
  /** The areas the territory touches, the default area first, then the declared order, each with its own paths. */
  areas: { name: string; paths: string[]; rules: AreaRules }[];
  rules: AreaRules;
  /** Every point of the catalog, in its order. */
  hooks: Record<string, PointHooks>;
  conflicts: {
    /** Each area declaring a `merge` method, when they declare more than one. */
    merge: { area: string; method: MergeMethod }[];
    /** Each point where more than one `replace` hook applies, with every one. */
    replace: { point: string; hooks: ResolvedHook[] }[];
  };
};

const LANDINGS_ALIAS_AREA = 'landings.alone';

const noRules = (): AreaRules => ({
  plan: { alone: false, maxFiles: null, waveFirst: false, blocksAll: false, landingAlone: false },
  subPr: { merge: null, requireChecks: [], approval: null, territory: null, maxOpen: null },
});

const stricter = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.min(a, b));
const stickier = (a: 'report' | 'block' | null, b: 'report' | 'block' | null) => (a === 'block' || b === 'block' ? 'block' : (a ?? b));

/** `a` and `b` together, the strictest of each limit; `b`'s `merge` wins when it has one. */
function combineRules(a: AreaRules, b: AreaRules): AreaRules {
  return {
    plan: {
      alone: a.plan.alone || b.plan.alone,
      maxFiles: stricter(a.plan.maxFiles, b.plan.maxFiles),
      waveFirst: a.plan.waveFirst || b.plan.waveFirst,
      blocksAll: a.plan.blocksAll || b.plan.blocksAll,
      landingAlone: a.plan.landingAlone || b.plan.landingAlone,
    },
    subPr: {
      merge: b.subPr.merge ?? a.subPr.merge,
      requireChecks: [...new Set([...a.subPr.requireChecks, ...b.subPr.requireChecks])],
      approval: a.subPr.approval ?? b.subPr.approval,
      territory: stickier(a.subPr.territory, b.subPr.territory),
      maxOpen: stricter(a.subPr.maxOpen, b.subPr.maxOpen),
    },
  };
}

/** `plan` with one more `rules.plan` entry applied. */
function withPlanRule(plan: AreaRules['plan'], rule: PlanRule): AreaRules['plan'] {
  if ('slice' in rule) {
    return { ...plan, alone: plan.alone || rule.slice.alone === true, maxFiles: stricter(plan.maxFiles, rule.slice.maxFiles ?? null) };
  }
  if ('wave' in rule) return { ...plan, waveFirst: true };
  if ('blocks' in rule) return { ...plan, blocksAll: true };
  return { ...plan, landingAlone: true };
}

/** The rules a `rules` section declares, by themselves. */
function ownRules(rules: FlowRules | undefined): AreaRules {
  const { merge = null, requireChecks = [], approval = null, territory = null, maxOpen = null } = rules?.subPr ?? {};
  return {
    plan: (rules?.plan ?? []).reduce(withPlanRule, noRules().plan),
    subPr: { merge, requireChecks: [...new Set(requireChecks)], approval, territory, maxOpen },
  };
}

const toResolved = (area: string, ref: HookRef): ResolvedHook =>
  typeof ref === 'string' ? { area, path: ref, alias: null } : { area, path: ref.path, alias: ref.alias };

/** The hooks a `hooks` section declares, by point, each marked with `area`. */
function ownHooks(area: string, hooks: FlowHooks | undefined): Record<string, PointHooks> {
  const resolved: Record<string, PointHooks> = {};
  for (const [point, value] of Object.entries(hooks ?? {})) {
    const { before, after, replace } = hooksByMode(value);
    resolved[point] = {
      before: before.map((ref) => toResolved(area, ref)),
      replace: replace === null ? null : toResolved(area, replace),
      after: after.map((ref) => toResolved(area, ref)),
    };
  }
  return resolved;
}

/** `b`'s hooks after `a`'s, point by point; `b`'s `replace` wins when it has one. */
function addHooks(a: Record<string, PointHooks>, b: Record<string, PointHooks>): Record<string, PointHooks> {
  const added: Record<string, PointHooks> = { ...a };
  for (const [point, hooks] of Object.entries(b)) {
    const before = a[point];
    added[point] = before
      ? { before: [...before.before, ...hooks.before], replace: hooks.replace ?? before.replace, after: [...before.after, ...hooks.after] }
      : hooks;
  }
  return added;
}

/** The repository's flow, resolved from its config: with no `flow` and no alias, one default area with no rule and no hook. */
export function resolveFlow(config: Pick<Config, 'flow' | 'landings' | 'pr'>): ResolvedFlow {
  const flow = config.flow;
  let defaultHooks = ownHooks(DEFAULT_AREA, flow?.hooks);
  if (config.pr.openWith !== null) {
    defaultHooks = addHooks(defaultHooks, {
      'pr.open': { before: [], replace: { area: DEFAULT_AREA, path: config.pr.openWith, alias: CLAUDE_ALIAS }, after: [] },
    });
  }
  const defaultArea: ResolvedArea = {
    name: DEFAULT_AREA,
    patterns: [],
    knowledge: null,
    inherit: false,
    rules: ownRules(flow?.rules),
    hooks: defaultHooks,
  };
  const declared = Object.entries(flow?.areas ?? {}).map(([name, area]) => {
    const inherit = area.inherit ?? true;
    const rules = ownRules(area.rules);
    const hooks = ownHooks(name, area.hooks);
    return {
      name,
      patterns: area.paths.map((source) => new RegExp(source)),
      knowledge: area.knowledge ?? null,
      inherit,
      rules: inherit ? combineRules(defaultArea.rules, rules) : rules,
      hooks: inherit ? addHooks(defaultArea.hooks, hooks) : hooks,
    };
  });
  const aliased: ResolvedArea[] = config.landings.alone.length === 0
    ? []
    : [{
        name: LANDINGS_ALIAS_AREA,
        patterns: config.landings.alone.map((source) => new RegExp(source)),
        knowledge: null,
        inherit: true,
        rules: combineRules(defaultArea.rules, { ...noRules(), plan: { ...noRules().plan, landingAlone: true } }),
        hooks: defaultArea.hooks,
      }];
  return { defaultArea, areas: [...declared, ...aliased] };
}

/** The area `path` belongs to: the first, in declared order, whose patterns match it, else the default area. */
export function areaOf(flow: ResolvedFlow, path: string): ResolvedArea {
  return flow.areas.find(({ patterns }) => patterns.some((pattern) => pattern.test(path))) ?? flow.defaultArea;
}

/** What a slice whose territory is `territory` meets: its areas, its rules and hooks combined, and their conflicts. */
export function resolveTerritory(flow: ResolvedFlow, territory: readonly string[]): TerritoryFlow {
  const order = [flow.defaultArea, ...flow.areas];
  const pathsOf = new Map<string, string[]>();
  for (const path of territory) {
    const { name } = areaOf(flow, path);
    pathsOf.set(name, [...(pathsOf.get(name) ?? []), path]);
  }
  const touched = order.filter(({ name }) => pathsOf.has(name));
  const areas = touched.map(({ name, rules }) => ({ name, paths: pathsOf.get(name) ?? [], rules }));

  const merges = touched.flatMap(({ name, rules }) => (rules.subPr.merge === null ? [] : [{ area: name, method: rules.subPr.merge }]));
  const hooks: Record<string, PointHooks> = {};
  const replace: { point: string; hooks: ResolvedHook[] }[] = [];
  for (const { point } of FLOW_POINTS) {
    const at = hooksAt(touched, point);
    hooks[point] = at.hooks;
    if (at.conflict.length > 0) replace.push({ point, hooks: at.conflict });
  }
  return {
    areas,
    rules: combinedRules(touched),
    hooks,
    conflicts: { merge: new Set(merges.map(({ method }) => method)).size > 1 ? merges : [], replace },
  };
}

/** The rules of `touched` together. Across areas the first declared `merge` stands; a conflict is reported beside it, never settled. */
function combinedRules(touched: readonly ResolvedArea[]): AreaRules {
  return touched.reduce((combined, area) => {
    const next = combineRules(combined, area.rules);
    return { ...next, subPr: { ...next.subPr, merge: combined.subPr.merge ?? area.rules.subPr.merge } };
  }, noRules());
}

/** `hooks` with each area's file kept once, in order. */
const uniqueHooks = (hooks: readonly ResolvedHook[]): ResolvedHook[] =>
  hooks.filter((hook, index) => hooks.findIndex(({ area, path }) => area === hook.area && path === hook.path) === index);

/** What runs at `point` for a slice in `touched`, and the areas' own `replace` hooks when more than one applies. */
function hooksAt(touched: readonly ResolvedArea[], point: string): { hooks: PointHooks; conflict: ResolvedHook[] } {
  const at = touched.flatMap(({ hooks }) => hooks[point] ?? []);
  const replaces = uniqueHooks(at.flatMap(({ replace }) => (replace ? [replace] : [])));
  // An area's own `replace` wins over the default area's; two areas' own are a conflict.
  const own = replaces.filter(({ area }) => area !== DEFAULT_AREA);
  return {
    hooks: {
      before: uniqueHooks(at.flatMap(({ before }) => before)),
      replace: own[0] ?? replaces[0] ?? null,
      after: uniqueHooks(at.flatMap(({ after }) => after)),
    },
    conflict: new Set(own.map(({ path }) => path)).size > 1 ? own : [],
  };
}
