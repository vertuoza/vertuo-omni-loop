// The pack job adds the `knowledge-embed` job once its pack is kept, and only then (PRD 2728 s4), against a stubbed
// GitHub holding a fictional repository at one commit and a fake pack store. No test calls GitHub or Supabase.
import { describe, expect, it } from 'vitest';
import type { PackStore, PutAnswer } from '../knowledge-pack/store.ts';
import { embedJob } from './embed.ts';
import type { ClaimedJob, NewJob } from './ledger.ts';
import { packHandler, packJob } from './pack.ts';

const SHA = 'd'.repeat(40);
const AT = '2026-11-12T09:00:00Z';

const FILES: Record<string, string> = {
  '.omni-loop/config.yml': 'kit: 1\n',
  '.omni-loop/knowledge/product/rules.md': '# Rules\n\n## BR-PRODUCT-1\nA quote shows its total.\n',
  'src/app.ts': 'export {};\n',
};

type Entry = { path: string; mode: string; type: 'blob' | 'tree'; sha: string; size?: number };

/** A GitHub holding FILES at SHA: its trees, each folder its own, and its blobs; anything else 404. */
function github() {
  const blobs = new Map<string, string>();
  const trees = new Map<string, Entry[]>();
  const build = (prefix: string): string => {
    const names = [...new Set(Object.keys(FILES).filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length).split('/')[0] ?? ''))].sort();
    const entries = names.map((name): Entry => {
      const content = FILES[prefix + name];
      if (content === undefined) return { path: name, mode: '040000', type: 'tree', sha: build(`${prefix}${name}/`) };
      const sha = `blob-${prefix}${name}`;
      blobs.set(sha, content);
      return { path: name, mode: '100644', type: 'blob', sha, size: Buffer.byteLength(content) };
    });
    const sha = `tree-${prefix || '/'}`;
    trees.set(sha, entries);
    return sha;
  };
  const root = build('');
  const flat = (sha: string, prefix = ''): Entry[] =>
    (trees.get(sha) ?? []).flatMap((entry) => (entry.type === 'tree' ? [{ ...entry, path: prefix + entry.path }, ...flat(entry.sha, `${prefix}${entry.path}/`)] : [{ ...entry, path: prefix + entry.path }]));
  return {
    request(route: string, params: Record<string, unknown> = {}) {
      if (route === 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}') {
        const sha = params.tree_sha === SHA ? root : String(params.tree_sha);
        if (trees.has(sha)) return Promise.resolve({ data: { sha, truncated: false, tree: params.recursive ? flat(sha) : trees.get(sha) } });
      }
      const blob = route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}' ? blobs.get(String(params.file_sha)) : undefined;
      if (blob !== undefined) return Promise.resolve({ data: { content: Buffer.from(blob).toString('base64'), encoding: 'base64' } });
      return Promise.reject(Object.assign(new Error(`Not Found: ${route}`), { status: 404 }));
    },
  };
}

/** A pack store keeping the pack in `workspaces`, none of them when empty. */
function store(workspaces: string[]): PackStore {
  return {
    held: () => Promise.resolve(workspaces.length > 0),
    put: (pack) => {
      const answer: PutAnswer = {
        repository: pack.repository.toLowerCase(),
        sha: pack.sha,
        packs: workspaces.map((workspace) => ({ workspace, packId: `k-${workspace}`, created: true, newest: true, files: pack.files.length })),
      };
      return Promise.resolve(answer);
    },
  };
}

const claimed = (job: NewJob): ClaimedJob => ({ id: 'j-1', kind: job.kind, key: job.key, subject: job.subject, payload: job.payload, tries: 1, claim: 'c-1', claimedUntil: AT });

async function run(workspaces: string[], { addJob = true }: { addJob?: boolean } = {}) {
  const added: NewJob[] = [];
  const handler = packHandler({
    octokitFor: () => github(),
    store: store(workspaces),
    ...(addJob ? { addJob: (job: NewJob) => Promise.resolve(added.push(job)) } : {}),
    log: () => undefined,
  });
  const result = await handler(claimed(packJob({ installationId: 7, owner: 'Acme', repo: 'Widgets', sha: SHA, committedAt: AT })));
  return { result, added };
}

describe('the pack job adds the knowledge-embed job (PRD 2728 s4)', () => {
  it('adds one, keyed as the pack job, once the pack is kept', async () => {
    const { result, added } = await run(['w-1', 'w-2']);
    expect(result).toEqual({ outcome: 'done' });
    expect(added).toEqual([embedJob({ repository: 'acme/widgets', sha: SHA })]);
    expect(added[0]?.key).toBe(packJob({ installationId: 7, owner: 'Acme', repo: 'Widgets', sha: SHA, committedAt: AT }).key);
  });

  it('adds none when no workspace keeps the pack', async () => {
    const { added } = await run([]);
    expect(added).toEqual([]);
  });

  it('adds none when the pack job is given no ledger', async () => {
    const { result } = await run(['w-1'], { addJob: false });
    expect(result).toEqual({ outcome: 'done' });
  });
});
