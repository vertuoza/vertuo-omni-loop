// The knowledge pack end to end against a stubbed GitHub (PRD 2011 s11, acceptance 7): a signed delivery
// of a merged pull request in, the webhook's merge event out, and the `knowledge-pack` function run on it
// against a GitHub holding the repository at its merge commit and a database that keeps packs as
// knowledge_pack_put() does. No test calls GitHub or Supabase.
import { createHash, createHmac } from 'node:crypto';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { HARVEST_EVENT, inngest, type AppEvent } from '../inngest-client.ts';
import { MAX_FILES } from '../snapshot/snapshot.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { CONCURRENCY, createKnowledgePack, KNOWLEDGE_PACK_FUNCTION_ID, PRIORITY } from './knowledge-pack.ts';
import type { PackPut, PackStore, PutAnswer } from './store.ts';

const SECRET = 'shh-test-secret';
const MERGE_SHA = 'c'.repeat(40);
const MERGED_AT = '2026-10-16T09:00:00Z';

const CONFIG = [
  'kit: 1',
  'flow:',
  '  hooks:',
  '    do-work.test:',
  '      replace: .agents/hooks/tests.md',
  '    pr.open:',
  '      before: { path: /create-pr, alias: claude }',
  '',
].join('\n');

/** The repository at the merge commit. */
const TREE: Record<string, string | Buffer> = {
  '.omni-loop/config.yml': CONFIG,
  '.omni-loop/knowledge/product/rules.md': '# Rules\n\n- BR-1 · Été — a rule.\n',
  '.omni-loop/knowledge/adr/0001-packs.md': '# ADR-0001\n',
  '.omni-loop/knowledge/playbook/testing.md': '# Testing\n',
  '.omni-loop/delivery/inbox/7-x/spec.md': '# Spec\n',
  '.agents/hooks/tests.md': 'Run the tests.\n',
  'src/app.ts': 'export {};\n',
};

const sha256 = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');

type Request = { route: string; params: Record<string, unknown> };
type Entry = { path: string; mode: string; type: 'blob' | 'tree'; sha: string; size?: number };

/**
 * A stubbed GitHub holding `files` at the merge commit, and pull request #number, merged there or not,
 * that changed `changed`. It answers the routes the function reads, records every request, and answers
 * anything else 404.
 */
function github({ files = TREE, changed, merged = true }: { files?: Record<string, string | Buffer>; changed: { filename: string; previous_filename?: string }[]; merged?: boolean }) {
  const requests: Request[] = [];
  const blobs = new Map<string, Buffer>();
  const trees = new Map<string, Entry[]>();
  const build = (prefix: string): string => {
    const names = new Set<string>();
    for (const path of Object.keys(files)) if (path.startsWith(prefix)) names.add(path.slice(prefix.length).split('/')[0] ?? '');
    const entries = [...names].sort().map((name): Entry => {
      const path = prefix + name;
      const content = files[path];
      if (content === undefined) return { path: name, mode: '040000', type: 'tree', sha: build(`${path}/`) };
      const bytes = Buffer.from(content);
      const sha = `blob-${sha256(bytes).slice(0, 12)}`;
      blobs.set(sha, bytes);
      return { path: name, mode: '100644', type: 'blob', sha, size: bytes.length };
    });
    const sha = `tree-${prefix || '/'}`;
    trees.set(sha, entries);
    return sha;
  };
  const root = build('');
  const flat = (sha: string, prefix = ''): Entry[] =>
    (trees.get(sha) ?? []).flatMap((entry) => (entry.type === 'tree' ? [{ ...entry, path: prefix + entry.path }, ...flat(entry.sha, `${prefix}${entry.path}/`)] : [{ ...entry, path: prefix + entry.path }]));
  const pull = { merged, merged_at: merged ? MERGED_AT : null, merge_commit_sha: merged ? MERGE_SHA : null, merged_by: { login: 'ada' } };
  const treeOf = (params: Record<string, unknown>) => {
    const sha = params.tree_sha === MERGE_SHA ? root : String(params.tree_sha);
    return trees.has(sha) ? { sha, truncated: false, tree: params.recursive ? flat(sha) : trees.get(sha) } : undefined;
  };
  const blobOf = (params: Record<string, unknown>) => {
    const bytes = blobs.get(String(params.file_sha));
    return bytes && { content: bytes.toString('base64'), encoding: 'base64' };
  };
  const routes: Record<string, (params: Record<string, unknown>) => unknown> = {
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': () => pull,
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/files': (params) => (Number(params.page ?? 1) === 1 ? changed : []),
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': treeOf,
    'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': blobOf,
  };
  const octokit = {
    request(route: string, params: Record<string, unknown> = {}) {
      requests.push({ route, params });
      const data = routes[route]?.(params);
      return data === undefined ? Promise.reject(Object.assign(new Error(`Not Found: ${route}`), { status: 404 })) : Promise.resolve({ data });
    },
  };
  return { octokit, requests };
}

/** A database keeping packs as knowledge_pack_put() does, for one workspace that holds `held`. */
function packDb(held: string[] = ['acme/api']) {
  const puts: PackPut[] = [];
  const kept = new Set<string>();
  const store: PackStore = {
    held: (repository) => Promise.resolve(held.includes(repository.toLowerCase())),
    put: (pack) => {
      puts.push(pack);
      const key = `${pack.repository.toLowerCase()}@${pack.sha}`;
      const created = !kept.has(key);
      kept.add(key);
      const answer: PutAnswer = { repository: pack.repository.toLowerCase(), sha: pack.sha, packs: [{ workspace: 'w-1', packId: 'k-1', created, newest: true, files: pack.files.length }] };
      return Promise.resolve(answer);
    },
  };
  return { store, puts };
}

/** A signed delivery of pull request #number of acme/api, closed into `base`: the events the webhook sent. */
async function deliver({ number = 12, merged = true, base = 'main' }: { number?: number; merged?: boolean; base?: string } = {}) {
  const payload = {
    action: 'closed',
    number,
    installation: { id: 4242 },
    repository: { name: 'api', full_name: 'acme/api', owner: { login: 'acme' }, default_branch: 'main' },
    pull_request: {
      number,
      body: null,
      merged,
      merged_at: merged ? MERGED_AT : null,
      merge_commit_sha: merged ? MERGE_SHA : null,
      closed_at: MERGED_AT,
      updated_at: MERGED_AT,
      head: { sha: 'abc123', ref: 'docs/knowledge-x' },
      base: { ref: base },
    },
  };
  const text = JSON.stringify(payload);
  const sent: AppEvent[] = [];
  await receiveWebhook({
    body: text,
    headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(text).digest('hex')}` },
    secret: SECRET,
    send: (events) => Promise.resolve(sent.push(...events)),
    forward: () => Promise.resolve(),
  });
  return sent.filter((event) => event.name === HARVEST_EVENT);
}

/** Runs the function on each event; its results, and the lines it logged. */
async function run({ store, octokit, events }: { store: PackStore | null; octokit: ReturnType<typeof github>['octokit']; events: AppEvent[] }) {
  const log: string[] = [];
  const fn = createKnowledgePack({ client: inngest, octokitFor: () => octokit, store, log: (line) => log.push(line) });
  const results: unknown[] = [];
  for (const event of events) {
    const { result, error } = await new InngestTestEngine({ function: fn, events: [event as never] }).execute();
    expect(error).toBeUndefined();
    results.push(result);
  }
  return { results, log };
}

/** Why the one run of `results` made no pack, for acme/api#12. */
function skipOf(results: unknown[]): string {
  expect(results).toHaveLength(1);
  const [result] = results;
  expect(result).toMatchObject({ pull: 'acme/api#12' });
  return String((result as { skipped?: unknown }).skipped);
}

const PACKED = ['.agents/hooks/tests.md', '.omni-loop/config.yml', '.omni-loop/knowledge/adr/0001-packs.md', '.omni-loop/knowledge/playbook/testing.md', '.omni-loop/knowledge/product/rules.md'];

describe('knowledge-pack — a merge touching the knowledge makes a pack (PRD 2011 s11, acceptance 7)', () => {
  it('a merge touching the knowledge folder writes a pack whose files hash to that commit\'s files', async () => {
    const db = packDb();
    const repo = github({ changed: [{ filename: '.omni-loop/knowledge/product/rules.md' }] });
    const events = await deliver();
    expect(events).toHaveLength(1);
    const { results, log } = await run({ store: db.store, octokit: repo.octokit, events });
    expect(db.puts).toHaveLength(1);
    const [put] = db.puts;
    expect(put).toMatchObject({ repository: 'acme/api', sha: MERGE_SHA, committedAt: MERGED_AT });
    expect(put?.files.map((file) => file.path)).toEqual(PACKED);
    for (const file of put?.files ?? []) {
      expect(file.sha256).toBe(sha256(TREE[file.path] ?? ''));
      expect(file.content).toBe(TREE[file.path]);
    }
    expect(results).toEqual([{ pull: 'acme/api#12', sha: MERGE_SHA, committedAt: MERGED_AT, files: 5, left: [], packs: [{ workspace: 'w-1', created: true, newest: true }] }]);
    expect(log).toEqual([`knowledge pack: acme/api#12 pack ccccccc of 5 files, new in 1 of 1 workspaces`]);
  });

  it('reads only the merge, its files, the config and the pack\'s paths, and writes nothing on GitHub', async () => {
    const repo = github({ changed: [{ filename: '.omni-loop/knowledge/product/rules.md' }] });
    await run({ store: packDb().store, octokit: repo.octokit, events: await deliver() });
    expect(repo.requests.every((request) => request.route.startsWith('GET '))).toBe(true);
    const blobsRead = repo.requests.filter((request) => request.route.endsWith('/git/blobs/{file_sha}')).length;
    // The config once to qualify, then the five files of the pack: never the delivery folder or the code.
    expect(blobsRead).toBe(1 + PACKED.length);
  });

  it('a merge changing the flow config alone, the config or a hook it names, makes a pack too', async () => {
    for (const filename of ['.omni-loop/config.yml', '.agents/hooks/tests.md']) {
      const db = packDb();
      await run({ store: db.store, octokit: github({ changed: [{ filename }] }).octokit, events: await deliver() });
      expect(db.puts.map((put) => put.files.length)).toEqual([PACKED.length]);
    }
  });

  it('a file renamed out of the knowledge folder makes a pack, by its old path', async () => {
    const db = packDb();
    await run({ store: db.store, octokit: github({ changed: [{ filename: 'docs/rules.md', previous_filename: '.omni-loop/knowledge/old.md' }] }).octokit, events: await deliver() });
    expect(db.puts).toHaveLength(1);
  });

  it('other merges write none: code, the delivery folder, a folder that only shares the prefix', async () => {
    const db = packDb();
    const repo = github({ changed: [{ filename: 'src/app.ts' }, { filename: '.omni-loop/delivery/inbox/7-x/spec.md' }, { filename: '.omni-loop/knowledge-old/a.md' }] });
    const { results, log } = await run({ store: db.store, octokit: repo.octokit, events: await deliver() });
    expect(db.puts).toEqual([]);
    expect(results).toEqual([{ pull: 'acme/api#12', skipped: 'it touches neither the knowledge folder nor the flow config' }]);
    expect(log).toEqual(['knowledge pack: acme/api#12 makes no pack: it touches neither the knowledge folder nor the flow config']);
    expect(repo.requests.filter((request) => request.route.endsWith('/git/blobs/{file_sha}'))).toHaveLength(1);
  });

  it('a repository no product holds spends nothing: no GitHub call, no pack', async () => {
    const db = packDb([]);
    const repo = github({ changed: [{ filename: '.omni-loop/knowledge/product/rules.md' }] });
    const { results } = await run({ store: db.store, octokit: repo.octokit, events: await deliver() });
    expect(results).toEqual([{ pull: 'acme/api#12', skipped: 'no product holds acme/api' }]);
    expect(repo.requests).toEqual([]);
    expect(db.puts).toEqual([]);
  });

  it('a pull request closed unmerged, or merged into another branch, sends no merge event', async () => {
    expect(await deliver({ merged: false })).toEqual([]);
    expect(await deliver({ base: 'feat/x' })).toEqual([]);
  });

  it('a pull request read as not merged makes no pack', async () => {
    const db = packDb();
    const { results } = await run({ store: db.store, octokit: github({ changed: [], merged: false }).octokit, events: await deliver() });
    expect(results).toEqual([{ pull: 'acme/api#12', skipped: 'it was closed, not merged' }]);
    expect(db.puts).toEqual([]);
  });

  it('a commit with no config, or one that does not parse, makes no pack, saying why', async () => {
    const bare = Object.fromEntries(Object.entries(TREE).filter(([path]) => path !== '.omni-loop/config.yml'));
    const none = await run({ store: packDb().store, octokit: github({ files: bare, changed: [{ filename: '.omni-loop/knowledge/a.md' }] }).octokit, events: await deliver() });
    expect(none.results).toEqual([{ pull: 'acme/api#12', skipped: 'it has no .omni-loop/config.yml' }]);
    const broken = await run({ store: packDb().store, octokit: github({ files: { ...TREE, '.omni-loop/config.yml': 'kit: [' }, changed: [{ filename: '.omni-loop/config.yml' }] }).octokit, events: await deliver() });
    expect(skipOf(broken.results)).toMatch(/^its config does not parse: \.omni-loop\/config\.yml: not valid YAML/);
  });

  it('leaves out a file the pack cannot hold as it is, naming it, and packs the rest', async () => {
    const db = packDb();
    const files = { ...TREE, '.omni-loop/knowledge/design/mockup.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]) };
    const { results, log } = await run({ store: db.store, octokit: github({ files, changed: [{ filename: '.omni-loop/knowledge/design/mockup.png' }] }).octokit, events: await deliver() });
    expect(db.puts[0]?.files.map((file) => file.path)).toEqual(PACKED);
    expect(results).toEqual([expect.objectContaining({ files: 5, left: ['.omni-loop/knowledge/design/mockup.png: not UTF-8 text'] })]);
    expect(log[0]).toBe('knowledge pack: acme/api#12 left out of pack ccccccc: .omni-loop/knowledge/design/mockup.png: not UTF-8 text');
  });

  it('a knowledge base past the snapshot\'s bound makes no pack, saying so, and is not retried', async () => {
    const db = packDb();
    const files: Record<string, string> = { '.omni-loop/config.yml': CONFIG };
    for (let at = 0; at <= MAX_FILES; at += 1) files[`.omni-loop/knowledge/many/${String(at)}.md`] = `${String(at)}\n`;
    const { results } = await run({ store: db.store, octokit: github({ files, changed: [{ filename: '.omni-loop/knowledge/many/1.md' }] }).octokit, events: await deliver() });
    expect(skipOf(results)).toMatch(/^its knowledge is too large to pack: The snapshot holds 2,002 files/);
    expect(db.puts).toEqual([]);
  });

  it('a redelivered merge keeps nothing twice: the database answers the pack as already kept', async () => {
    const db = packDb();
    const repo = github({ changed: [{ filename: '.omni-loop/knowledge/product/rules.md' }] });
    const events = await deliver();
    await run({ store: db.store, octokit: repo.octokit, events });
    const { results } = await run({ store: db.store, octokit: repo.octokit, events });
    expect(results).toEqual([expect.objectContaining({ packs: [{ workspace: 'w-1', created: false, newest: true }] })]);
  });
});

describe('knowledge-pack — the function', () => {
  const event = { name: HARVEST_EVENT, data: { installationId: 1, owner: 'acme', repo: 'api', repository: 'acme/api', prNumber: 12 } };

  it('is the `knowledge-pack` function, on the merge event, one run per repository at a time, at background priority, retried', () => {
    const fn = createKnowledgePack({ client: inngest, octokitFor: () => github({ changed: [] }).octokit, store: null });
    expect(fn.opts).toMatchObject({ id: KNOWLEDGE_PACK_FUNCTION_ID, triggers: [{ event: HARVEST_EVENT }], concurrency: CONCURRENCY, priority: PRIORITY, retries: 3 });
    expect(KNOWLEDGE_PACK_FUNCTION_ID).toBe('knowledge-pack');
    expect(CONCURRENCY).toEqual({ key: 'event.data.repository', limit: 1 });
    expect(Number(PRIORITY.run)).toBeLessThan(0);
  });

  it('keeps nothing, saying why, when the App cannot reach the server here, and reads no GitHub', async () => {
    const repo = github({ changed: [] });
    const { results, log } = await run({ store: null, octokit: repo.octokit, events: [event as never] });
    expect(results).toEqual([{ pull: 'acme/api#12', skipped: 'the App cannot reach the server here' }]);
    expect(log).toEqual(['knowledge pack: acme/api#12 makes no pack: the App cannot reach the server here']);
    expect(repo.requests).toEqual([]);
  });

  it('fails the run, for Inngest to retry, when the database refuses', async () => {
    const store: PackStore = { held: () => Promise.resolve(true), put: () => Promise.reject(new Error('the database refused: down')) };
    const fn = createKnowledgePack({ client: inngest, octokitFor: () => github({ changed: [{ filename: '.omni-loop/config.yml' }] }).octokit, store });
    const { error } = await new InngestTestEngine({ function: fn, events: [event as never] }).execute();
    expect(String((error as Error | undefined)?.message)).toContain('the database refused: down');
  });

  it('refuses an event out of shape by its field, reading and keeping nothing', async () => {
    const db = packDb();
    const repo = github({ changed: [] });
    const fn = createKnowledgePack({ client: inngest, octokitFor: () => repo.octokit, store: db.store });
    const { error } = await new InngestTestEngine({ function: fn, events: [{ name: HARVEST_EVENT, data: { installationId: 1, owner: 'acme', repo: 'api', prNumber: 12 } } as never] }).execute();
    expect(String((error as Error | undefined)?.message)).toContain('The merge event is malformed: repository');
    expect(repo.requests).toEqual([]);
    expect(db.puts).toEqual([]);
  });
});
