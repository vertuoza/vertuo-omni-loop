// @ts-nocheck
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_BYTES, MAX_FILES, SnapshotBoundError, snapshot } from './snapshot.ts';

// A stubbed Octokit holding one repository as a tree of `{ path: content }` at one ref. It answers
// the two Git Data routes `snapshot` may use — trees and blobs — and records every request, so a
// test can prove nothing outside the listed paths is fetched.
function stubRepo(files, { ref = 'abc123', sizes = {} } = {}) {
  const blobs = new Map();
  const trees = new Map();
  let nextSha = 0;
  const sha = (kind) => `${kind}-${nextSha++}`;

  // Build nested trees from the flat file list.
  const root = { entries: new Map() };
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      if (!node.entries.has(dir)) node.entries.set(dir, { entries: new Map() });
      node = node.entries.get(dir);
    }
    node.entries.set(parts.at(-1), { content, path });
  }
  const register = (node) => {
    const treeSha = sha('tree');
    const entries = [];
    for (const [name, child] of node.entries) {
      if (child.entries) {
        entries.push({ path: name, mode: '040000', type: 'tree', sha: register(child), _node: child });
      } else {
        const blobSha = sha('blob');
        const bytes = Buffer.from(child.content);
        blobs.set(blobSha, bytes);
        entries.push({ path: name, mode: '100644', type: 'blob', sha: blobSha, size: sizes[child.path] ?? bytes.length });
      }
    }
    trees.set(treeSha, entries);
    return treeSha;
  };
  const rootSha = register(root);

  const flatten = (treeSha, prefix = '') =>
    trees.get(treeSha).flatMap((entry) => {
      const path = prefix + entry.path;
      const own = { ...entry, path, _node: undefined };
      return entry.type === 'tree' ? [own, ...flatten(entry.sha, `${path}/`)] : [own];
    });

  const requests = [];
  const octokit = {
    async request(route, params) {
      requests.push({ route, ...params });
      if (route === 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}') {
        const treeSha = params.tree_sha === ref ? rootSha : params.tree_sha;
        if (!trees.has(treeSha)) throw Object.assign(new Error('Not Found'), { status: 404 });
        const tree = params.recursive
          ? flatten(treeSha)
          : trees.get(treeSha).map(({ _node, ...entry }) => entry);
        return { data: { sha: treeSha, tree, truncated: false } };
      }
      if (route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}') {
        const bytes = blobs.get(params.file_sha);
        return { data: { content: bytes.toString('base64'), encoding: 'base64', size: bytes.length } };
      }
      throw new Error(`unexpected route ${route}`);
    },
  };
  return { octokit, requests };
}

const REPO = { owner: 'vertuoza', repo: 'widget' };
const created = [];
const dest = () => {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-test-'));
  created.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const FILES = {
  '.omni-loop/config.yml': 'kit: 1\n',
  '.omni-loop/delivery/inbox/0042-widget/spec.md': '# spec\n',
  '.omni-loop/delivery/outbox/0042-widget/s1-01-colour.md': '# item\n',
  'src/secret-code.mjs': 'export const x = 1;\n',
  'README.md': '# readme\n',
};

describe('snapshot — only the listed paths', () => {
  it('writes the listed file and the listed folder, and nothing else', async () => {
    const { octokit } = stubRepo(FILES);
    const folder = await snapshot(octokit, {
      ...REPO,
      ref: 'abc123',
      paths: ['.omni-loop/config.yml', '.omni-loop/delivery'],
      dest: dest(),
    });
    expect(readFileSync(join(folder, '.omni-loop/config.yml'), 'utf8')).toBe('kit: 1\n');
    expect(readFileSync(join(folder, '.omni-loop/delivery/inbox/0042-widget/spec.md'), 'utf8')).toBe('# spec\n');
    expect(existsSync(join(folder, '.omni-loop/delivery/outbox/0042-widget/s1-01-colour.md'))).toBe(true);
    expect(existsSync(join(folder, 'src'))).toBe(false);
    expect(existsSync(join(folder, 'README.md'))).toBe(false);
  });

  it('fetches no blob and no tree outside the listed paths', async () => {
    const { octokit, requests } = stubRepo(FILES);
    await snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['.omni-loop/config.yml'], dest: dest() });
    const blobs = requests.filter((r) => r.route.endsWith('/git/blobs/{file_sha}'));
    expect(blobs).toHaveLength(1);
    // Never the whole repository's tree at once: recursion only below a listed folder.
    const recursiveRoot = requests.filter((r) => r.tree_sha === 'abc123' && r.recursive);
    expect(recursiveRoot).toHaveLength(0);
    for (const request of requests) {
      expect(request).toMatchObject(REPO);
    }
  });

  it('reads the tree at the ref it was given', async () => {
    const { octokit, requests } = stubRepo(FILES, { ref: 'main' });
    await snapshot(octokit, { ...REPO, ref: 'main', paths: ['.omni-loop/config.yml'], dest: dest() });
    expect(requests[0]).toMatchObject({ route: 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}', tree_sha: 'main' });
  });

  it('leaves out a listed path the ref does not hold — an inactive repository has no config', async () => {
    const { octokit } = stubRepo({ 'README.md': '# readme\n' });
    const folder = await snapshot(octokit, {
      ...REPO,
      ref: 'abc123',
      paths: ['.omni-loop/config.yml', '.omni-loop/delivery'],
      dest: dest(),
    });
    expect(existsSync(join(folder, '.omni-loop'))).toBe(false);
  });

  it('creates its own folder under the temp directory when none is given', async () => {
    const { octokit } = stubRepo(FILES);
    const folder = await snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['README.md'] });
    created.push(folder);
    expect(folder.startsWith(tmpdir())).toBe(true);
    expect(readFileSync(join(folder, 'README.md'), 'utf8')).toBe('# readme\n');
  });

  it('refuses a path that climbs out of the snapshot', async () => {
    const { octokit } = stubRepo(FILES);
    await expect(snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['../etc'], dest: dest() })).rejects.toThrow(
      /not a repository path/,
    );
  });
});

describe('snapshot — the bound', () => {
  it(`fails naming the file bound past ${MAX_FILES} files, before fetching any blob`, async () => {
    const many = {};
    for (let i = 0; i <= MAX_FILES; i += 1) many[`.omni-loop/delivery/f${i}.md`] = 'x';
    const { octokit, requests } = stubRepo(many);
    const run = snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['.omni-loop/delivery'], dest: dest() });
    await expect(run).rejects.toThrow(SnapshotBoundError);
    await expect(
      snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['.omni-loop/delivery'], dest: dest() }),
    ).rejects.toThrow(/2,000 files/);
    expect(requests.some((r) => r.route.endsWith('/git/blobs/{file_sha}'))).toBe(false);
  });

  it('accepts exactly the file bound', async () => {
    const many = {};
    for (let i = 0; i < MAX_FILES; i += 1) many[`d/f${i}.md`] = 'x';
    const { octokit } = stubRepo(many);
    await expect(snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['d'], dest: dest() })).resolves.toBeTruthy();
  });

  it('fails naming the byte bound past 20 MB, before fetching any blob', async () => {
    const { octokit, requests } = stubRepo(
      { 'd/a.md': 'a', 'd/b.md': 'b' },
      { sizes: { 'd/a.md': MAX_BYTES, 'd/b.md': 1 } },
    );
    const run = snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['d'], dest: dest() });
    await expect(run).rejects.toThrow(SnapshotBoundError);
    await expect(snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['d'], dest: dest() })).rejects.toThrow(/20 MB/);
    expect(requests.some((r) => r.route.endsWith('/git/blobs/{file_sha}'))).toBe(false);
  });

  it('counts the bound across every listed path together', async () => {
    const { octokit } = stubRepo(
      { 'a/x.md': 'a', 'b/y.md': 'b' },
      { sizes: { 'a/x.md': MAX_BYTES / 2 + 1, 'b/y.md': MAX_BYTES / 2 } },
    );
    await expect(snapshot(octokit, { ...REPO, ref: 'abc123', paths: ['a', 'b'], dest: dest() })).rejects.toThrow(
      SnapshotBoundError,
    );
  });
});
