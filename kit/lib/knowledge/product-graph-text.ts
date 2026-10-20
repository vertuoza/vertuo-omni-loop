/**
 * **`omni kb graph --product <key> <id>`** (PRD 1798, s5): asks the Omni page for a product's knowledge
 * graph around one node (`GET /api/products/<key>/knowledge/graph?id=…&depth=…`), checks the answer
 * with P5's reader (`readNeighbourhood`, version 1 or 2) and prints it as P5 prints a neighbourhood,
 * each repository node's short name before its id, under one header line per repository. `--json`
 * prints the answer as the server sent it. Every refusal is one line and a failed read (`ok: false`).
 */
import { AskCallError } from '../ask/client.ts';
import type { askClient } from '../ask/client.ts';
import { messageOf } from '../narrow.ts';
import { neighbourhoodBody } from './neighbourhood.ts';
import { readNeighbourhood, type ReadNeighbourhood, type RepositoryStanding } from './product-graph.ts';

type Client = ReturnType<typeof askClient>;

/** What the command says, one line each, and whether it went through. */
export type ProductRead = { ok: boolean; lines: string[] };

const FAIL = (line: string): ProductRead => ({ ok: false, lines: [line] });

/** `2026-10-13T14:02:00.000Z` as `2026-10-13 14:02` (UTC). */
const when = (iso: string): string => new Date(iso).toISOString().slice(0, 16).replace('T', ' ');

/** A repository's header line: its commit, push time and pusher, or that it never pushed. */
function repositoryLine({ repo, commit, pushedAt, pushedBy }: RepositoryStanding): string {
  if (commit === null || pushedAt === null) return `${repo} · never pushed`;
  return `${repo} @${commit.slice(0, 7)} · pushed ${when(pushedAt)}${pushedBy === null ? '' : ` by @${pushedBy}`}`;
}

/** The last line: where the product's Legal and Glossary come from. */
function productLine({ state, key, cachedOn }: ReadNeighbourhood['product']): string {
  if (state === 'server') return `product knowledge: server (${key ?? 'no key'}).`;
  if (state === 'cached') return `product knowledge: cached ${cachedOn ?? 'on an unknown day'} (${key ?? 'no key'}).`;
  if (state === 'offline') return 'product knowledge: offline.';
  return 'product knowledge: none.';
}

/** The answer as text: a header per repository, the neighbourhood, the unresolved ends, the product line. */
function productGraphText(read: ReadNeighbourhood): string[] {
  const unresolved = read.unresolved.map(({ repo, node, id }) => `unresolved: ${repo} ${node} → ${id}`);
  return [...read.repositories.map(repositoryLine), ...neighbourhoodBody(read, []), ...unresolved, productLine(read.product)];
}

/** One line for a failed call: the server unreachable, or its refusal with its reason. */
function refusal(error: unknown): ProductRead {
  if (!(error instanceof AskCallError)) return FAIL(`kb graph: ${messageOf(error)}`);
  if (error.status === null) return FAIL('kb graph: the server is unreachable');
  return FAIL(`kb graph: the server refused (${error.status}): ${error.reason ?? error.message}`);
}

/** Reads the product's graph around `id` through `client` (`null`: no sign-in) and renders it. */
export async function readProductGraph({ askUrl, client, key, id, depth, json }: {
  askUrl: string | null;
  client: Client | null;
  key: string;
  id: string;
  depth: number | null;
  json: boolean;
}): Promise<ProductRead> {
  if (!askUrl) return FAIL('kb graph: ask.url is not set, so there is no Omni page to ask');
  if (client === null) return FAIL('kb graph: no sign-in for the Omni page (omni signin)');
  let answer: unknown;
  try {
    answer = await client.readKnowledgeGraph({ key, id, depth });
  } catch (error) {
    return refusal(error);
  }
  const read = readNeighbourhood(answer);
  if (read === null) return FAIL('kb graph: the server answered something that is not a knowledge graph');
  return { ok: true, lines: json ? [JSON.stringify(answer, null, 2)] : productGraphText(read) };
}
