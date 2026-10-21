// What `omni check config` says of the knowledge map (PRD 2346): a contract kind or a target role
// that is no canonical word, and a `layers` or flow-area pattern that matches no tracked file. Pure:
// the caller hands over the tracked files.
import { isLayer, isRole, layerList, roleList } from './layers.ts';

export type MapConfig = {
  contracts: { kinds: readonly string[] };
  layers?: Readonly<Record<string, readonly string[]>> | undefined;
  flow?: { areas?: Readonly<Record<string, { paths: readonly string[] }>> | undefined } | undefined;
  plan?: { targets: ReadonlyArray<{ repo: string; role: string }> } | undefined;
};

/** One line per word the config holds that the canonical lists do not, and per pattern that matches nothing. */
export function mapViolations(config: MapConfig, files: readonly string[]): string[] {
  const out: string[] = [];
  for (const kind of config.contracts.kinds) {
    if (!isLayer(kind)) out.push(`contracts.kinds: ${kind} is not a layer (${layerList()}) — replace it`);
  }
  for (const { repo, role } of config.plan?.targets ?? []) {
    if (!isRole(role)) out.push(`plan.targets: ${repo} has the role ${role}, which is not a role (${roleList()}) — pick one`);
  }
  const unmatched = (where: string, patterns: readonly string[]) => {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern);
      if (!files.some((file) => regex.test(file))) out.push(`${where}: ${pattern} matches no tracked file — fix or remove it`);
    }
  };
  for (const [layer, patterns] of Object.entries(config.layers ?? {})) unmatched(`layers.${layer}`, patterns);
  for (const [area, { paths }] of Object.entries(config.flow?.areas ?? {})) unmatched(`flow.areas.${area}.paths`, paths);
  return out;
}
