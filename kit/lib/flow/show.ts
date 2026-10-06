// What `omni flow show` prints (PRD 1089), as data: a point's hooks for a slice or a path, a path's
// area with its rules and hooks, or what the repository changes from the kit's defaults. Pure: it
// reads the resolved flow, and the hook files only through the `readHook` it is handed.
//
// A point's view is self-sufficient: an agent that knows nothing of the kit follows every `before`,
// then the kit's step (`kitStep: run`) or the `replace` hook (`kitStep: replaced`), then every
// `after`, each hook's text with the slice's inputs filled in, and ends each with the verdict line.
// Fail closed: a hook file that is not there, or whose front matter names another point, is a
// problem the command refuses on, never a hook skipped.
import { parse } from 'yaml';
import { propertyOf } from '../narrow.ts';
import type { FlowPoint } from './points.ts';
import { areaOf, resolveTerritory, type AreaRules, type PointHooks, type ResolvedArea, type ResolvedFlow, type ResolvedHook } from './resolve.ts';
import { DEFAULT_AREA } from './schema.ts';
import { expectedVerdict } from './verdict.ts';

/** A hook file, read: what its front matter declares, and the rest. */
export type HookFile = { omniHook: string | null; inputs: string[] | null; verdict: string | null; body: string };

/** One hook as an agent follows it. `text` is `null` for a Claude-only command, or a file that is not there. */
export type ShownHook = {
  area: string;
  mode: 'before' | 'replace' | 'after';
  path: string;
  alias: string | null;
  inputs: Record<string, string | null>;
  text: string | null;
  verdict: string;
};

export type PointView = {
  point: string;
  /** The areas the slice or path meets, the default area first; only the default area with neither. */
  areas: string[];
  /** The slice's or path's territory; `null` when neither was given. */
  territory: string[] | null;
  /** The point's inputs, as the caller gave them; `null` where it gave none. */
  inputs: Record<string, string | null>;
  before: ShownHook[];
  replace: ShownHook | null;
  after: ShownHook[];
  kitStep: 'run' | 'replaced';
  /** The line each hook's output ends with. */
  verdict: string;
  /** What stops the point: a hook file not there, or one naming another point. */
  problems: string[];
};

export type PathView = {
  path: string;
  area: string;
  /** The area's own patterns; `[]` for the default area. */
  paths: string[];
  knowledge: string | null;
  rules: AreaRules;
  /** Every point with a hook there, each by mode. */
  hooks: Record<string, { before: string[]; replace: string | null; after: string[] }>;
};

export type AreaDifference = { area: string; paths: string[]; inherit: boolean; rules: string[]; hooks: { point: string; mode: string; path: string }[] };

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const PARAGRAPH = /^((?:[\w-]+:[^\n]*\n?)+)(?:\r?\n|$)/;

/** The front matter of `text`, fenced by `---` or as a first paragraph of `key: value` lines. */
export function parseHookFile(text: string): HookFile {
  const fenced = FENCE.exec(text);
  const block = fenced ?? PARAGRAPH.exec(text);
  const none: HookFile = { omniHook: null, inputs: null, verdict: null, body: text };
  if (!block) return none;
  let data: unknown;
  try {
    data = parse(block[1] ?? '');
  } catch {
    return none;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return none;
  const str = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
  const listed = propertyOf(data, 'inputs');
  const inputs = Array.isArray(listed) ? listed.filter((one): one is string => typeof one === 'string') : null;
  return {
    omniHook: str(propertyOf(data, 'omni-hook')),
    inputs,
    verdict: str(propertyOf(data, 'verdict')),
    body: text.slice(block[0].length).replace(/^\r?\n/, ''),
  };
}

/** `text` with each `{name}` the values carry filled in; any other brace left as written. */
const fill = (text: string, values: Record<string, string | null>) =>
  text.replace(/\{([\w-]+)\}/g, (whole, name: string) => values[name] ?? whole);

type ShowOptions = {
  /** The slice's territory, or a path's, when one is given. */
  territory?: readonly string[];
  /** The point's inputs, by name. */
  values?: Record<string, string>;
  /** A hook file's text by its repository path, or `null` when it is not there. */
  readHook: (path: string) => string | null;
};

/** What runs at `point` for the territory given, or for the default area alone. */
export function showPoint(flow: ResolvedFlow, point: FlowPoint, { territory, values = {}, readHook }: ShowOptions): PointView {
  const resolved = territory === undefined ? null : resolveTerritory(flow, territory);
  const hooks: PointHooks = resolved?.hooks[point.point] ?? flow.defaultArea.hooks[point.point] ?? { before: [], replace: null, after: [] };
  const inputs = Object.fromEntries(point.inputs.map((name) => [name, values[name] ?? null]));
  const problems: string[] = [];
  const verdict = expectedVerdict(point.point);

  const show = (mode: ShownHook['mode'], hook: ResolvedHook): ShownHook => {
    const shown: ShownHook = { area: hook.area, mode, path: hook.path, alias: hook.alias, inputs, text: null, verdict };
    if (hook.alias !== null && hook.path.startsWith('/')) return shown;
    const where = `${hook.path} (${hook.area}, ${mode})`;
    const raw = readHook(hook.path);
    if (raw === null) {
      problems.push(`${where} does not exist`);
      return shown;
    }
    const file = parseHookFile(raw);
    if (file.omniHook !== null && file.omniHook !== point.point) problems.push(`${where} says omni-hook: ${file.omniHook}, not ${point.point}`);
    const declared = file.inputs ?? point.inputs;
    return { ...shown, inputs: Object.fromEntries(declared.map((name) => [name, values[name] ?? null])), text: fill(file.body, values) };
  };

  const before = hooks.before.map((hook) => show('before', hook));
  const replace = hooks.replace === null ? null : show('replace', hooks.replace);
  const after = hooks.after.map((hook) => show('after', hook));
  return {
    point: point.point,
    areas: resolved === null || resolved.areas.length === 0 ? [DEFAULT_AREA] : resolved.areas.map(({ name }) => name),
    territory: territory === undefined ? null : [...territory],
    inputs,
    before,
    replace,
    after,
    kitStep: replace === null ? 'run' : 'replaced',
    verdict,
    problems,
  };
}

const refs = (hooks: readonly ResolvedHook[]) => hooks.map(({ path }) => path);

/** An area's patterns as the config wrote them: a compiled pattern escapes each `/`, which means the same unescaped. */
const sources = (area: ResolvedArea) => area.patterns.map(({ source }) => source.replaceAll('\\/', '/'));

/** The points with a hook in `area`, each by mode. */
function areaHooks(area: ResolvedArea): PathView['hooks'] {
  return Object.fromEntries(
    Object.entries(area.hooks).map(([point, { before, replace, after }]) => [point, { before: refs(before), replace: replace?.path ?? null, after: refs(after) }]),
  );
}

/** The area `path` belongs to, with every rule and hook that applies there. */
export function showPath(flow: ResolvedFlow, path: string): PathView {
  const area = areaOf(flow, path);
  return {
    path,
    area: area.name,
    paths: sources(area),
    knowledge: area.knowledge,
    rules: area.rules,
    hooks: areaHooks(area),
  };
}

/** `rules` as the lines that differ from the kit's defaults, in the config's own words. */
export function ruleLines({ plan, subPr }: AreaRules): string[] {
  const lines: string[] = [];
  if (plan.alone) lines.push('slice alone');
  if (plan.maxFiles !== null) lines.push(`slice maxFiles ${plan.maxFiles}`);
  if (plan.waveFirst) lines.push('wave first');
  if (plan.blocksAll) lines.push('blocks all');
  if (plan.landingAlone) lines.push('landing alone');
  // squash and report are the kit's own: naming them changes nothing.
  if (subPr.merge !== null && subPr.merge !== 'squash') lines.push(`merge ${subPr.merge}`);
  if (subPr.requireChecks.length > 0) lines.push(`requireChecks ${subPr.requireChecks.join(', ')}`);
  if (subPr.approval !== null) lines.push(`approval ${subPr.approval}`);
  if (subPr.territory === 'block') lines.push('territory block');
  if (subPr.maxOpen !== null) lines.push(`maxOpen ${subPr.maxOpen}`);
  return lines;
}

/** `area`'s hooks, one per line, each with its point and mode. */
function hookLines(area: ResolvedArea): AreaDifference['hooks'] {
  return Object.entries(area.hooks).flatMap(([point, { before, replace, after }]) => [
    ...before.map(({ path }) => ({ point, mode: 'before', path })),
    ...(replace === null ? [] : [{ point, mode: 'replace', path: replace.path }]),
    ...after.map(({ path }) => ({ point, mode: 'after', path })),
  ]);
}

/** What the repository changes from the kit's defaults, area by area: the default area first, then each declared one. `[]` when nothing. */
export function flowDifferences(flow: ResolvedFlow): AreaDifference[] {
  return [flow.defaultArea, ...flow.areas]
    .map((area) => ({
      area: area.name,
      paths: sources(area),
      inherit: area.inherit,
      rules: ruleLines(area.rules),
      hooks: hookLines(area),
    }))
    .filter(({ area, rules, hooks }) => area !== DEFAULT_AREA || rules.length > 0 || hooks.length > 0);
}
