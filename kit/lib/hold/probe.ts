/**
 * **A merged provider's probe** (PRD 2746, slice s3): what the provider repository says "served"
 * means, at the point `merge-after.served` of its default area. Read from its committed
 * `.omni-loop/config.yml` and the hook files it names, as the caller's reader hands them (through `gh`,
 * from the provider's default branch), and never run: the agent follows each hook and hands its output
 * to `omni flow verdict`. Pure: it reads only through `read`.
 */
import { parse } from 'yaml';
import { messageOf, propertyOf } from '../narrow.ts';
import { hookRefProblem, hooksByMode, PointHooksSchema, type HookRef } from '../flow/schema.ts';
import { parseHookFile } from '../flow/show.ts';

/** The point a provider declares its probe at. */
const SERVED_POINT = 'merge-after.served';
/** Where a provider commits its config. */
const PROVIDER_CONFIG = '.omni-loop/config.yml';

/** A file of the provider, as read: its text, not there, or why it could not be read. */
export type FileRead = { text: string } | { missing: true } | { failure: string };

/** What a probe hook is handed, by input name (`provider`, `pr`, `merge-sha`, `consumer`), as the text it fills in. */
export type ProbeInputs = Readonly<Record<string, string>>;

/** One hook to follow: `<owner/repo>:<path>`, its mode, and its text with the inputs filled in. */
export type Probe = { hook: string; mode: 'replace' | 'after'; text: string };

/** The provider's probes, in the order they run (`[]`: merged is enough), or why they could not be read. */
export type ProbeRead = { probes: Probe[] } | { failure: string };

const fill = (text: string, inputs: ProbeInputs): string => text.replace(/\{([\w-]+)\}/g, (whole, name: string) => inputs[name] ?? whole);

/** The hooks the config text declares at the point, replace first; `[]` when none; a string when they do not parse. */
function declaredHooks(repo: string, configText: string): { mode: Probe['mode']; ref: HookRef }[] | string {
  let data: unknown;
  try {
    data = parse(configText);
  } catch (error) {
    return `the config of ${repo} does not parse: ${messageOf(error).split('\n')[0] ?? ''}`;
  }
  const value = propertyOf(propertyOf(propertyOf(data, 'flow'), 'hooks'), SERVED_POINT);
  if (value === undefined) return [];
  const hooks = PointHooksSchema.safeParse(value);
  if (!hooks.success) return `the ${SERVED_POINT} hooks of ${repo} do not parse`;
  const { replace, after } = hooksByMode(hooks.data);
  return [...(replace === null ? [] : [{ mode: 'replace' as const, ref: replace }]), ...after.map((ref) => ({ mode: 'after' as const, ref }))];
}

/** Why the hook at `path` cannot be read through `read`, or its text. */
function hookText(ref: HookRef, read: (path: string) => FileRead): { text: string } | { why: string } {
  const path = typeof ref === 'string' ? ref : ref.path;
  if (typeof ref !== 'string' && path.startsWith('/')) return { why: 'a slash command runs only in its own repository' };
  const problem = hookRefProblem(ref);
  if (problem !== null) return { why: problem };
  const file = read(path);
  if ('missing' in file) return { why: 'it does not exist' };
  if ('failure' in file) return { why: file.failure };
  return { text: file.text };
}

/** The probes `repo` declares at `merge-after.served`, each read and filled, or the first reason one cannot be. */
export function readProbes(repo: string, inputs: ProbeInputs, read: (path: string) => FileRead): ProbeRead {
  const config = read(PROVIDER_CONFIG);
  if ('missing' in config) return { probes: [] };
  if ('failure' in config) return { failure: `could not read the config of ${repo}: ${config.failure}` };
  const declared = declaredHooks(repo, config.text);
  if (typeof declared === 'string') return { failure: declared };
  const probes: Probe[] = [];
  for (const { mode, ref } of declared) {
    const path = typeof ref === 'string' ? ref : ref.path;
    const hook = hookText(ref, read);
    if ('why' in hook) return { failure: `the probe ${path} of ${repo} cannot be read: ${hook.why}` };
    probes.push({ hook: `${repo}:${path}`, mode, text: fill(parseHookFile(hook.text).body, inputs) });
  }
  return { probes };
}
