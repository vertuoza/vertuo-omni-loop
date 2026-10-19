/**
 * **`omni kb graph push`** (PRD 1798, s2): builds the whole repository's graph, as P5's code builds
 * it, and sends it to the Omni page with the repository's slug and its `HEAD` commit.
 *
 * - The product knowledge cache (Legal and Glossary) is refreshed first, best effort: a repository in
 *   no product, or a page that does not answer, leaves the cache as it was and the push goes on.
 * - The commit named must be the commit the graph was built from, so a knowledge folder
 *   (`paths.knowledge`) with uncommitted changes is refused before anything is read or sent.
 * - Every refusal is one line and a failed push (`ok: false`): no `ask.url`, no repository slug, no
 *   sign-in, the server unreachable or its refusal with its reason.
 */
import { join } from 'node:path';
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import type { askClient } from '../ask/client.ts';
import type { Context } from '../context.ts';
import { readScreens } from '../design/screens.ts';
import { designScreensDir } from '../config.ts';
import { messageOf } from '../narrow.ts';
import { readDecisions } from '../playbook/decisions.ts';
import { productKnowledge, readCachedKnowledge } from '../product/knowledge.ts';
import { buildRepositoryGraph } from './neighbourhood.ts';
import { readKnowledge } from './registers.ts';

type Client = ReturnType<typeof askClient>;

/** What `git` prints for `args` in `cwd`: the kit's `exec` seam, so a test hands a stub. */
export type GitReader = (args: readonly string[]) => string;

/** What the push says, one line each, and whether it went through. */
export type Pushed = { ok: boolean; lines: string[] };

const FAIL = (line: string): Pushed => ({ ok: false, lines: [line] });

/** The server's answer to a push: the commit it stored and the products the graph is served in. */
type Reply = { nodes: number; edges: number; products: { key: string | null; href: string }[] };

const ReplySchema = z.object({ nodes: z.number(), edges: z.number(), products: z.array(z.unknown()) });
const ProductSchema = z.object({ key: z.unknown(), href: z.string() });

function replyOf(value: unknown): Reply | null {
  const read = ReplySchema.safeParse(value);
  if (!read.success) return null;
  const { nodes, edges, products } = read.data;
  const served = products.flatMap((product) => {
    const one = ProductSchema.safeParse(product);
    if (!one.success) return [];
    const { key, href } = one.data;
    return [{ key: typeof key === 'string' ? key : null, href }];
  });
  return { nodes, edges, products: served };
}

/** The one line a failed call prints: the server unreachable, or its refusal with its reason. */
function refusal(error: unknown): Pushed {
  if (!(error instanceof AskCallError)) return FAIL(`kb graph push: ${messageOf(error)}`);
  if (error.status === null) return FAIL('kb graph push: the server is unreachable');
  return FAIL(`kb graph push: the server refused (${error.status}): ${error.reason ?? error.message}`);
}

/** Pushes the graph of `ctx`'s repository at `HEAD` through `client`; `null` client means no sign-in. */
export async function pushKnowledgeGraph({ ctx, git, client, now }: {
  ctx: Context;
  git: GitReader;
  client: Client | null;
  now: () => Date;
}): Promise<Pushed> {
  const askUrl = ctx.config.ask.url;
  const repo = ctx.config.repo.slug;
  if (!askUrl) return FAIL('kb graph push: ask.url is not set, so there is no Omni page to push to');
  if (!repo) return FAIL('kb graph push: no repository slug — set repo.slug in the config');
  if (client === null) return FAIL('kb graph push: no sign-in for the Omni page (omni signin)');

  const folder = ctx.config.paths.knowledge;
  if (git(['status', '--porcelain', '--', folder]).trim() !== '') {
    return FAIL(`kb graph push: ${folder} has uncommitted changes — commit them first, the graph is pushed at a commit`);
  }
  const commit = git(['rev-parse', 'HEAD']).trim();

  try {
    await productKnowledge({ repo, root: ctx.root, now, fetchBusiness: () => client.readBusiness(repo) });
  } catch {
    // best effort: the cache stays as it was
  }
  const cache = readCachedKnowledge(ctx.root);
  const screensDir = designScreensDir(ctx.config);
  const graph = buildRepositoryGraph({
    entries: readKnowledge({ ctx }).entries,
    records: readDecisions({ ctx }).records,
    screens: readScreens(join(ctx.root, screensDir)).screens,
    screensDir,
    legal: cache.state === 'cached' ? cache.legal : [],
    glossary: cache.state === 'cached' ? cache.glossary : [],
  });

  let reply: Reply | null;
  try {
    reply = replyOf(await client.pushKnowledgeGraph({ repo, commit, graph }));
  } catch (error) {
    return refusal(error);
  }
  if (reply === null) return FAIL('kb graph push: the server answered something that is not a push result');
  const where = reply.products.length === 0
    ? ['in products: none']
    : reply.products.map(({ key, href }) => `in products: ${key === null ? href : `${key} · see ${href}`}`);
  return { ok: true, lines: [`pushed ${repo}@${commit.slice(0, 7)} · ${reply.nodes} nodes, ${reply.edges} edges`, ...where] };
}
