// The `flow` section of `.omni-loop/config.yml` (PRD 1089): a repository's rules, its areas and its
// hooks. Nothing in it is code: rules are data, hooks are Markdown files named by their repository
// path. This schema refuses what can be refused from the text alone (a regex that does not compile,
// an unknown point, a `replace` the catalog does not allow, a hook path that leaves the repository,
// `flow.on`); `hookFileViolations` refuses what needs the files (a hook that does not exist, or is
// too big). `kit/lib/config.ts` reads the section through `FlowSchema`.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { FLOW_POINTS, flowPoint } from './points.ts';

/** The one alias a hook may carry: it names something only Claude Code reads (a slash command, a file under `.claude/`). */
export const CLAUDE_ALIAS = 'claude';
/** The name the root of `flow` goes by when an area is named: every path no declared area claims. */
export const DEFAULT_AREA = 'default';
/** The size a hook file may reach when `limits.hookMaxBytes` is not set. */
export const DEFAULT_HOOK_MAX_BYTES = 20480;

const text = z.string().min(1);
/** A regex source over repository paths: refused when it does not compile. `kit/lib/config.ts` uses it too. */
export const regexSource = z.string().refine((source) => {
  try { new RegExp(source); return true; } catch { return false; }
}, 'not a valid regular expression');

const hookRef = z.union([text, z.object({ path: text, alias: z.literal(CLAUDE_ALIAS) }).strict()]);
const hookRefs = z.union([hookRef, z.array(hookRef).min(1)]);
const pointHooks = z.union([
  hookRef,
  z.object({ before: hookRefs.optional(), after: hookRefs.optional(), replace: hookRef.optional() }).strict(),
]);

/** A hook as the file names it: a path, or `{ path, alias: claude }`. */
export type HookRef = z.infer<typeof hookRef>;
type PointHooks = z.infer<typeof pointHooks>;
type Mode = 'before' | 'replace' | 'after';

/** Why `ref` cannot name a hook of this repository, or `null` when it can. */
export function hookRefProblem(ref: HookRef): string | null {
  const path = typeof ref === 'string' ? ref : ref.path;
  const claude = typeof ref !== 'string';
  if (claude && /^\/[\w.:-]+$/.test(path)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return `${path} is a URL — name a file of this repository by its path`;
  if (path.startsWith('/') || path.startsWith('\\')) return `${path} is an absolute path — name a file of this repository by its path from the root`;
  if (path.split(/[\\/]/).includes('..')) return `${path} holds .. — name a file of this repository by its path from the root`;
  if (!claude && (path === '.claude' || path.startsWith('.claude/'))) {
    return `${path} sits under .claude/ — mark it { path: ${path}, alias: claude }, or move it out of .claude/`;
  }
  return null;
}

const asList = (refs: HookRef | HookRef[] | undefined): HookRef[] => (refs === undefined ? [] : Array.isArray(refs) ? refs : [refs]);
const isBare = (value: PointHooks) => typeof value === 'string' || 'path' in value;

/** A point's hooks, by mode: a bare path is `after`. */
export function hooksByMode(value: PointHooks): { before: HookRef[]; after: HookRef[]; replace: HookRef | null } {
  if (typeof value === 'string' || 'path' in value) return { before: [], after: [value], replace: null };
  return { before: asList(value.before), after: asList(value.after), replace: value.replace ?? null };
}

/** A point's hooks one by one, in the order they run, each with the key that names it from the point. */
function eachHook(point: string, value: PointHooks): { key: string[]; mode: Mode; ref: HookRef }[] {
  const { before, after, replace } = hooksByMode(value);
  const one = (mode: Mode, ref: HookRef) => ({ key: isBare(value) ? [point] : [point, mode], mode, ref });
  return [
    ...before.map((ref) => one('before', ref)),
    ...(replace === null ? [] : [one('replace', replace)]),
    ...after.map((ref) => one('after', ref)),
  ];
}

const KNOWN_POINTS = FLOW_POINTS.map(({ point }) => point).join(', ');

const hooksSection = z.record(z.string(), pointHooks).superRefine((hooks, issues) => {
  for (const [name, value] of Object.entries(hooks)) {
    const point = flowPoint(name);
    if (!point) {
      issues.addIssue({ code: 'custom', path: [name], message: `not a point of the catalog (${KNOWN_POINTS})` });
      continue;
    }
    for (const { key, mode, ref } of eachHook(name, value)) {
      if (mode === 'replace' && !point.modes.includes('replace')) {
        issues.addIssue({ code: 'custom', path: key, message: `${name} takes before and after hooks only: its act is never replaced` });
      }
      const problem = hookRefProblem(ref);
      if (problem) issues.addIssue({ code: 'custom', path: key, message: problem });
    }
  }
});

const planRule = z.union([
  z.object({ slice: z.object({ alone: z.boolean().optional(), maxFiles: z.number().int().positive().optional() }).strict() }).strict(),
  z.object({ wave: z.literal('first') }).strict(),
  z.object({ blocks: z.literal('all') }).strict(),
  z.object({ landing: z.literal('alone') }).strict(),
]);

export const MERGE_METHODS = Object.freeze(['squash', 'merge', 'rebase'] as const);

const subPrRules = z
  .object({
    merge: z.enum(MERGE_METHODS).optional(),
    requireChecks: z.array(text).optional(),
    approval: z.literal('person').optional(),
    territory: z.enum(['report', 'block']).optional(),
    maxOpen: z.number().int().positive().optional(),
  })
  .strict();

const rulesSection = z.object({ plan: z.array(planRule).optional(), subPr: subPrRules.optional() }).strict();

const area = z
  .object({
    paths: z.array(regexSource).min(1, 'at least one path pattern'),
    knowledge: text.optional(),
    inherit: z.boolean().optional(),
    rules: rulesSection.optional(),
    hooks: hooksSection.optional(),
  })
  .strict();

const AREA_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const FlowSchema = z
  .object({
    rules: rulesSection.optional(),
    hooks: hooksSection.optional(),
    areas: z.record(z.string(), area).optional(),
    // Reserved for events, which a later PRD defines: refused until then, never read.
    on: z.unknown().optional(),
  })
  .strict()
  .superRefine((flow, issues) => {
    if (flow.on !== undefined) {
      issues.addIssue({ code: 'custom', path: ['on'], message: 'reserved for events, which a later PRD defines — remove it' });
    }
    for (const name of Object.keys(flow.areas ?? {})) {
      if (name === DEFAULT_AREA) {
        issues.addIssue({ code: 'custom', path: ['areas', name], message: `${DEFAULT_AREA} names the root of flow — call this area something else` });
      } else if (!AREA_NAME.test(name)) {
        issues.addIssue({ code: 'custom', path: ['areas', name], message: 'an area is named by one kebab-case word, such as kernel' });
      }
    }
  });

/** The `flow` section, parsed. */
export type Flow = z.infer<typeof FlowSchema>;
export type FlowRules = z.infer<typeof rulesSection>;
export type FlowHooks = z.infer<typeof hooksSection>;
type PlanRule = z.infer<typeof planRule>;
export type { PlanRule };

type HookFile = { key: string; path: string };

/** The file `ref` names, keyed from `scope`; none for a slash command, which Claude Code resolves. */
function hookFile(scope: string, key: string[], ref: HookRef): HookFile[] {
  const path = typeof ref === 'string' ? ref : ref.path;
  return typeof ref !== 'string' && path.startsWith('/') ? [] : [{ key: [scope, ...key].join('.'), path }];
}

/** Every hook file `flow` names, with the key that names it: `flow.areas.kernel.hooks.do-work.test.replace`. */
function namedHookFiles(flow: Flow): HookFile[] {
  const scopes: [string, FlowHooks | undefined][] = [
    ['flow.hooks', flow.hooks],
    ...Object.entries(flow.areas ?? {}).map(([name, { hooks }]): [string, FlowHooks | undefined] => [`flow.areas.${name}.hooks`, hooks]),
  ];
  return scopes.flatMap(([scope, hooks]) =>
    Object.entries(hooks ?? {}).flatMap(([point, value]) => eachHook(point, value).flatMap(({ key, ref }) => hookFile(scope, key, ref))),
  );
}

/**
 * What the hook files `flow` names break, as `<key>: <why>` lines: a file that does not exist under
 * `root`, or is larger than `maxBytes`. `[]` when every one is there and small enough.
 */
export function hookFileViolations(root: string, flow: Flow | undefined, maxBytes: number = DEFAULT_HOOK_MAX_BYTES): string[] {
  if (!flow) return [];
  const violations: string[] = [];
  for (const { key, path } of namedHookFiles(flow)) {
    const file = join(root, path);
    if (!existsSync(file) || !statSync(file).isFile()) {
      violations.push(`${key}: ${path} does not exist`);
      continue;
    }
    const size = statSync(file).size;
    if (size > maxBytes) violations.push(`${key}: ${path} is ${size} bytes, over limits.hookMaxBytes (${maxBytes})`);
  }
  return violations;
}
