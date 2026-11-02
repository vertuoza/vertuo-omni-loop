import { describe, expect, it } from 'vitest';
import { readRepositoryFolders, repositoriesToRead, type PackFiles } from './found-domains-read';

// How Not on the list reads a product's repositories (PRD 2583 s3), over fake ports. Fictional data.

const file = (path: string) => ({ path, content: '' });
const PACKS: Record<string, { path: string; content: string }[] | null> = {
  'acme/api': [file('.omni-loop/knowledge/domains/planning/rules.md')],
  'acme/plan': [file('.omni-loop/knowledge/domains/planning/rules.md'), file('.omni-loop/knowledge/domains/stock/rules.md')],
  'acme/web': null,
};
const pack: PackFiles = (repository) => Promise.resolve({ ok: true, files: PACKS[repository] ?? null });
const held = (plan: string | null, repositories: string[]) => () => Promise.resolve({ plan, repositories });

describe('the repositories to read', () => {
  it('are the product\'s then its plan repository, each once', () => {
    expect(repositoriesToRead({ plan: 'acme/plan', repositories: ['acme/api', 'acme/plan'] })).toEqual(['acme/api', 'acme/plan']);
    expect(repositoriesToRead({ plan: null, repositories: ['acme/api'] })).toEqual(['acme/api']);
  });
});

describe('reading the folders of a product\'s repositories', () => {
  it('reads each repository and the plan repository, a repository with no pack as not read yet', async () => {
    const read = await readRepositoryFolders(held('acme/plan', ['acme/api', 'acme/web']), pack);
    expect(read?.map((r) => [r.repository, r.folders === null ? null : [...r.folders.keys()]])).toEqual([
      ['acme/api', ['planning']], ['acme/web', null], ['acme/plan', ['planning', 'stock']],
    ]);
  });

  it('reads nothing of a product that cannot be read, and fails whole when one pack cannot', async () => {
    expect(await readRepositoryFolders(() => Promise.resolve(null), pack)).toBeNull();
    const broken: PackFiles = (repository) => Promise.resolve(repository === 'acme/web' ? { ok: false } : { ok: true, files: [] });
    expect(await readRepositoryFolders(held(null, ['acme/api', 'acme/web']), broken)).toBeNull();
  });

  it('holds no folder for a product with no repository', async () => {
    expect(await readRepositoryFolders(held(null, []), pack)).toEqual([]);
  });
});
