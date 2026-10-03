import 'server-only';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_FILE, loadConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.ts';
import { readGraph } from 'vertuo-omni-plan/kit/lib/knowledge/graph.ts';
import { firstPart } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { withPrd, type KnowledgeGraph } from './knowledge';

// The knowledge map's data (PRD 149): the knowledge of the checkout the app is deployed from, read at
// request time through the kit's one parser — no Supabase table, no GitHub call. The config and the
// knowledge folder reach a deployment because next.config.mjs traces them. When either cannot be
// read, the map is out of reach: no graph, and one line in the log saying why.

/** The nearest folder at or above `from` that holds the Omni Loop config, or `null`. */
export function checkoutRoot(from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    if (dirname(dir) === dir) return null;
  }
}

/** The graph of the checkout at or above `cwd`, or `null` with one line logged. */
export function loadKnowledge({ cwd = process.cwd(), log = console.error }: { cwd?: string; log?: (line: string) => void } = {}): KnowledgeGraph | null {
  const outOfReach = (why: string) => { log(`knowledge map: out of reach — ${why}`); return null; };
  const root = checkoutRoot(cwd);
  if (root === null) return outOfReach(`no ${CONFIG_FILE} in ${cwd} or above`);
  try {
    const ctx = createContext(root, loadConfig(root));
    // A path known only at request time: left out of the trace, which would otherwise take in the whole
    // repository. next.config.mjs traces the files the kit reads here.
    const folder = join(/*turbopackIgnore: true*/ root, ctx.layout.knowledgeRoot);
    if (!existsSync(/*turbopackIgnore: true*/ folder)) return outOfReach(`${ctx.layout.knowledgeRoot} is missing in ${root}`);
    // The kit's one parser reads the folder; the map reads the version it knows, and nothing else.
    const { version, ...graph } = readGraph({ ctx });
    if (version !== 1) return outOfReach(`the kit's graph is version ${version}, the map reads version 1`);
    return { ...graph, entries: graph.entries.map(withPrd), version };
  } catch (err) {
    return outOfReach(err instanceof Error ? firstPart(err.message, '\n') : String(err));
  }
}
