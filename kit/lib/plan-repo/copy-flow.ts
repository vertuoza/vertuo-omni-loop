// A target's flow, as a plan repository knows it (PRD 1089, s6). `/omni:mega-invade` copies an
// imported target's flow beside the rest of its copy, under `<paths.knowledge>/repos/<name>/flow/`:
//
// - `flow/config.yml` holds the keys of the target's committed `.omni-loop/config.yml` that make its
//   flow: `flow`, and `landings` and `pr` when the target uses #1086's aliases. Any other key is
//   ignored, so a whole config copied there reads the same.
// - every hook file that flow names sits at its own repository path under `flow/`:
//   `flow/.omni-loop/flow/kernel/tests.md` for the target's `.omni-loop/flow/kernel/tests.md`.
//
// `omni plan check` grades each `repo: <name>` row against that copy (`targetFlows`), `omni flow show
// --repo <name>` reads it, and `omni targets` compares it with the target's committed flow. The copy
// is read, never followed: a target's hooks are followed only in its own worktree.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { parseConfig } from '../config.ts';
import { resolveFlow } from '../flow/resolve.ts';
import { at, messageOf } from '../narrow.ts';
import type { Config } from '../types.ts';

/** The folder, inside a copy, that holds the target's flow. */
export const COPY_FLOW_DIR = 'flow';
/** The file, inside that folder, that holds the target's flow section. */
export const COPY_FLOW_FILE = 'config.yml';

/** What makes a repository's flow: its `flow` section and the two aliases it reads. */
export type FlowConfig = Pick<Config, 'flow' | 'landings' | 'pr'>;

/** One target's flow as the plan check reads it: the copy's, or why the copy cannot be read. */
export type TargetFlow = { ok: true; config: FlowConfig } | { ok: false; file: string; reason: string };

/** A repository with no `flow`, no `landings.alone` and no `pr.openWith`: the kit's defaults. */
export const NO_FLOW: FlowConfig = Object.freeze({ landings: { alone: [] }, pr: { openWith: null } });

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The flow of a config's text: its `flow`, `landings` and `pr` keys, validated as the config validates
 * them; every other key is ignored. Throws the config's own error, naming `file`, on one it refuses.
 */
export function parseFlowConfig(source: string, file: string): FlowConfig {
  let raw: unknown;
  try {
    raw = parse(source) ?? {};
  } catch (error) {
    throw new Error(`${file}: not valid YAML — ${messageOf(error).split('\n')[0]}`);
  }
  const all = isRecord(raw) ? raw : {};
  const picked: Record<string, unknown> = { kit: 1 };
  if (all.flow !== undefined) picked.flow = all.flow;
  if (all.landings !== undefined) picked.landings = all.landings;
  if (isRecord(all.pr) && all.pr.openWith !== undefined) picked.pr = { openWith: all.pr.openWith };
  const { flow, landings, pr } = parseConfig(stringify(picked), file);
  return flow === undefined ? { landings, pr } : { flow, landings, pr };
}

/** Whether `config` changes anything from the kit's defaults. */
export function hasFlow(config: FlowConfig): boolean {
  return config.flow !== undefined || config.landings.alone.length > 0 || config.pr.openWith !== null;
}

/** The same flow, written the same way whatever the key order: what `omni targets` compares. */
export function flowKey(config: FlowConfig): string {
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, sorted(value[key])]));
  };
  return JSON.stringify(sorted({ flow: config.flow ?? null, landings: config.landings, pr: config.pr }));
}

/** Every hook file `config` names, by its repository path, each once; a Claude-only command names none. */
export function hookPaths(config: FlowConfig): string[] {
  const { defaultArea, areas } = resolveFlow(config);
  const paths = [defaultArea, ...areas].flatMap(({ hooks }) =>
    Object.values(hooks).flatMap(({ before, replace, after }) => [...before, ...(replace ? [replace] : []), ...after]),
  );
  return [...new Set(paths.filter(({ path, alias }) => !(alias !== null && path.startsWith('/'))).map(({ path }) => path))];
}

type Where = { root: string; config: Pick<Config, 'paths'> };

/** The folder holding a target's imported copy: `<paths.knowledge>/repos/<name>`. */
export function copyFolder(repo: string, { ctx }: { ctx: { config: { paths: { knowledge: string } } } }): string {
  return join(ctx.config.paths.knowledge, 'repos', at(repo.split('/'), 1, `the name of ${repo}`)); // a target's repo is an owner/name slug (the config checks it)
}

/** The folder holding `repo`'s copied flow: `<paths.knowledge>/repos/<name>/flow`. */
export function copyFlowFolder(repo: string, { config }: Pick<Where, 'config'>): string {
  return join(copyFolder(repo, { ctx: { config } }), COPY_FLOW_DIR);
}

/**
 * `repo`'s copied flow: `null` when its copy holds no `flow/config.yml`, else its flow and a reader of
 * the hook files copied beside it (`null` for one that is not there). Throws, naming the file, when
 * the copy's flow cannot be read.
 */
export function readCopyFlow(repo: string, { root, config }: Where): { folder: string; config: FlowConfig; readHook: (path: string) => string | null } | null {
  const folder = copyFlowFolder(repo, { config });
  const file = join(folder, COPY_FLOW_FILE);
  if (!existsSync(join(root, file))) return null;
  const flow = parseFlowConfig(readFileSync(join(root, file), 'utf8'), file);
  const readHook = (path: string): string | null => {
    const hook = join(root, folder, path);
    return existsSync(hook) && statSync(hook).isFile() ? readFileSync(hook, 'utf8') : null;
  };
  return { folder, config: flow, readHook };
}

/** The part of an `owner/name` slug after the `/`: the name a plan's `repo` column uses. */
const shortName = (slug: string): string => slug.slice(slug.indexOf('/') + 1);

/**
 * Each target's flow, by the short name a plan's `repo` column uses, for `omni plan check`: an
 * `imported` target's copied flow when its copy holds one. A target with no copied flow (an `own` or
 * `none` target, or a copy without `flow/`) is absent: its rows meet the kit's defaults. A copy whose
 * flow cannot be read is `{ ok: false }`, for the plan check to refuse. Empty outside a plan repository.
 */
export function targetFlows({ root, config }: { root: string; config: Pick<Config, 'paths' | 'plan'> }): Map<string, TargetFlow> {
  const flows = new Map<string, TargetFlow>();
  for (const { repo, knowledge } of config.plan?.targets ?? []) {
    if (knowledge !== 'imported') continue;
    try {
      const copy = readCopyFlow(repo, { root, config });
      if (copy) flows.set(shortName(repo), { ok: true, config: copy.config });
    } catch (error) {
      flows.set(shortName(repo), { ok: false, file: join(copyFlowFolder(repo, { config }), COPY_FLOW_FILE), reason: messageOf(error) });
    }
  }
  return flows;
}
