// The knowledge of the other repositories a workspace has set up with Omni Loop, for the knowledge
// map's repository picker. Read as the Omni Loop App (omni-loop-invader), through the installation a
// workspace owns: the repositories that installation reaches, of which only those carrying the loop's
// config (a `.omni-loop/config.yml` on their default branch, as `omni init` and /omni:invade leave it)
// are listed; and one listed repository's knowledge folder, read at its default branch's tip and built
// into a graph by the kit's own parser (graphOfTexts), so nothing here reads a register's Markdown.
// GitHub's GraphQL API checks fifty repositories' configs in one call and reads a knowledge folder in
// one more. An installation token is kept in server memory until a minute before it expires, and never
// leaves this module. The listing is kept five minutes per installation, a graph one minute per
// repository; a repository the installation's listing does not hold is never read.
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { graphOfTexts } from 'vertuo-omni-plan/kit/lib/knowledge/graph.ts';
import { z } from 'zod';
import type { KnowledgeGraph } from '../data/knowledge';
import type { WorkspaceGithub } from '../data/workspace';
import { githubApp, reachedRepositories, type AppCredentials, type InstallationToken } from '../signup/github-app';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
export const CONFIG_PATH = '.omni-loop/config.yml';
/** How long an installation's listing is kept. */
export const LISTING_TTL_MS = 5 * 60_000;
/** How long a repository's graph is kept. */
export const GRAPH_TTL_MS = 60_000;
/** A token is renewed this long before it expires. */
const TOKEN_MARGIN_MS = 60_000;
/** Repositories whose configs one GraphQL call checks. */
export const CONFIG_BATCH = 50;
const Blob = z.object({ text: z.string().nullable().optional(), isTruncated: z.boolean().optional() });
const Entry = z.object({ name: z.string(), type: z.string(), object: Blob.nullable().optional() });
/** A folder, as the `files` fragment reads it; `entries` is absent when the path is not a folder. */
const Folder = z.object({ entries: z.array(Entry).optional().default([]) }).nullable().optional();
const Knowledge = z.object({
  repository: z.object({
    product: Folder,
    domains: z.object({
      entries: z.array(z.object({ name: z.string(), type: z.string(), object: Folder })).optional().default([]),
    }).nullable().optional(),
    cross: Folder,
  }).nullable(),
});

const KNOWLEDGE_QUERY = `query($owner: String!, $name: String!, $product: String!, $domains: String!, $cross: String!) {
  repository(owner: $owner, name: $name) {
    product: object(expression: $product) { ...files }
    domains: object(expression: $domains) { ... on Tree { entries { name type object { ...files } } } }
    cross: object(expression: $cross) { ...files }
  }
}
fragment files on GitObject { ... on Tree { entries { name type object { ... on Blob { text isTruncated } } } } }`;

/** One GraphQL call checking each repository's config: `r<i>` answers for `repos[i]`. The slugs are
 * checked against REPO first, so each one is a plain string literal. */
export function configQuery(repos: readonly string[]): string {
  const expression = JSON.stringify(`HEAD:${CONFIG_PATH}`);
  const fields = repos.map((repo, i) => {
    const [owner, name] = repo.split('/');
    return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { object(expression: ${expression}) { ... on Blob { text } } }`;
  });
  return `query {\n  ${fields.join('\n  ')}\n}`;
}

/** Where a config puts the knowledge folder, as a path from the repository's root. */
function knowledgeRootOf(text: string, repo: string): string {
  const config = parseConfig(text, `${repo}:${CONFIG_PATH}`) as unknown as { paths: { knowledge: string } };
  return config.paths.knowledge.replace(/^\.\/+/, '').replace(/\/+$/, '');
}

/** A repository's name ordering, whatever its case. */
const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });

export type KnowledgeReader = {
  /** The installation a workspace owns: the one it stored, else the App's installation on its GitHub
   * account (a workspace made before sign-up recorded one); null when there is none. */
  installationFor(workspace: Pick<WorkspaceGithub, 'github_org' | 'github_installation_id'>): Promise<number | null>;
  /** The repositories installation `id` reaches that carry the loop's config, by name. */
  repos(id: number): Promise<string[]>;
  /** `repo`'s knowledge, when installation `id` lists it; null when it is not listed or cannot be read
   * (the log says why). */
  graph(id: number, repo: string): Promise<KnowledgeGraph | null>;
};

export function knowledgeReader(
  creds: AppCredentials,
  fetchImpl: Fetch = fetch,
  clock: () => number = Date.now,
  log: (line: string) => void = console.error,
): KnowledgeReader {
  const app = githubApp(creds, fetchImpl, clock);
  const tokens = new Map<number, InstallationToken>();
  const accounts = new Map<string, { at: number; value: number | null }>();
  const listings = new Map<number, { at: number; value: Map<string, string> }>();
  const graphs = new Map<string, { at: number; value: KnowledgeGraph | null }>();

  async function tokenFor(id: number): Promise<string> {
    const kept = tokens.get(id);
    if (kept && clock() < kept.expiresAt - TOKEN_MARGIN_MS) return kept.token;
    const token = await app.installationToken(id);
    tokens.set(id, token);
    return token.token;
  }

  const headers = (token: string) => ({ authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' });

  async function graphql(token: string, query: string, variables: Record<string, string> = {}): Promise<unknown> {
    const res = await fetchImpl(`${GITHUB}/graphql`, {
      method: 'POST',
      headers: { ...headers(token), 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to a GraphQL query`);
    const body = (await res.json()) as { data?: unknown; errors?: { message?: string }[] } | null;
    if (!body?.data) throw new Error(`GitHub's GraphQL answer holds no data${body?.errors?.[0]?.message ? `: ${body.errors[0].message}` : ''}`);
    return body.data;
  }

  /** The listed repositories of installation `id`, each with its knowledge folder's path. */
  async function listing(id: number): Promise<Map<string, string>> {
    const kept = listings.get(id);
    if (kept && clock() - kept.at < LISTING_TTL_MS) return kept.value;
    const token = await tokenFor(id);
    const all = await reachedRepositories(token, fetchImpl);
    const found = new Map<string, string>();
    for (let from = 0; from < all.length; from += CONFIG_BATCH) {
      const batch = all.slice(from, from + CONFIG_BATCH);
      const data = (await graphql(token, configQuery(batch))) as Record<string, { object?: { text?: string | null } | null } | null>;
      batch.forEach((repo, i) => {
        const text = data[`r${i}`]?.object?.text;
        if (typeof text !== 'string') return;
        try {
          found.set(repo, knowledgeRootOf(text, repo));
        } catch (error) {
          log(`knowledge map: ${repo} is left out, its config cannot be read — ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        }
      });
    }
    const value = new Map([...found.entries()].sort(([a], [b]) => byName(a, b)));
    listings.set(id, { at: clock(), value });
    return value;
  }

  /** The texts of `repo`'s knowledge folder at `root`, by path from the repository's root. */
  async function texts(id: number, repo: string, root: string): Promise<Record<string, string>> {
    const [owner, name] = repo.split('/') as [string, string]; // ts-allow: a repository is named owner/name
    const data = Knowledge.parse(await graphql(await tokenFor(id), KNOWLEDGE_QUERY, {
      owner,
      name,
      product: `HEAD:${root}/product`,
      domains: `HEAD:${root}/domains`,
      cross: `HEAD:${root}/cross-domain`,
    }));
    if (!data.repository) throw new Error(`${repo} cannot be read`);
    const out: Record<string, string> = {};
    const put = (dir: string, folder: z.infer<typeof Folder>) => {
      for (const file of folder?.entries ?? []) {
        if (file.type !== 'blob' || typeof file.object?.text !== 'string') continue;
        if (file.object.isTruncated) throw new Error(`${dir}/${file.name} is too large to read`);
        out[`${dir}/${file.name}`] = file.object.text;
      }
    };
    put(`${root}/product`, data.repository.product);
    for (const domain of data.repository.domains?.entries ?? []) {
      if (domain.type === 'tree') put(`${root}/domains/${domain.name}`, domain.object);
    }
    put(`${root}/cross-domain`, data.repository.cross);
    return out;
  }

  return {
    async installationFor({ github_org, github_installation_id }) {
      if (github_installation_id !== null) return github_installation_id;
      if (!github_org) return null;
      const key = github_org.toLowerCase();
      const kept = accounts.get(key);
      if (kept && clock() - kept.at < LISTING_TTL_MS) return kept.value;
      const found = (await app.orgInstallation(github_org)) ?? (await app.userInstallation(github_org));
      const value = found?.id ?? null;
      accounts.set(key, { at: clock(), value });
      return value;
    },

    async repos(id) {
      return [...(await listing(id)).keys()];
    },

    async graph(id, repo) {
      const key = `${id} ${repo.toLowerCase()}`;
      const kept = graphs.get(key);
      if (kept && clock() - kept.at < GRAPH_TTL_MS) return kept.value;
      let value: KnowledgeGraph | null = null;
      try {
        const listed = [...(await listing(id)).entries()].find(([name]) => name.toLowerCase() === repo.toLowerCase());
        if (!listed) {
          log(`knowledge map: ${repo} is not a repository of installation ${id} that carries ${CONFIG_PATH}`);
        } else {
          const [name, root] = listed;
          value = graphOfTexts({ texts: await texts(id, name, root), knowledgeRoot: root, repo: name }) as KnowledgeGraph;
        }
      } catch (error) {
        log(`knowledge map: ${repo} could not be read from GitHub — ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
      }
      graphs.set(key, { at: clock(), value });
      return value;
    },
  };
}
