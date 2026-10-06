import { describe, expect, it } from 'vitest';
import { fileLabel, pageLabel, repoFiles, type RepoListing } from './sources';

// Which files a draft reads in one repository (PRD 774, decision 3): the README, the top-level docs and,
// with the kit layout only, the ten latest shipped PRD specs; twelve files per repository at most.

const listing = (over: Partial<RepoListing> = {}): RepoListing => ({ root: ['README.md', 'package.json'], docs: [], delivery: null, shipped: [], ...over });
const shipped = (n: number) => Array.from({ length: n }, (_, i) => `${String(i + 1).padStart(4, '0')}-topic-${i + 1}`);

describe('repoFiles', () => {
  it('reads the README and the top-level markdown docs, by name', () => {
    expect(repoFiles(listing({ root: ['readme.MD'], docs: ['setup.md', 'about.md', 'logo.png'] }))).toEqual([
      { path: 'readme.MD', kind: 'readme' },
      { path: 'docs/about.md', kind: 'doc' },
      { path: 'docs/setup.md', kind: 'doc' },
    ]);
  });

  it('reads no PRD spec without the kit layout, whatever folders there are', () => {
    expect(repoFiles(listing({ shipped: shipped(3) })).map((f) => f.kind)).toEqual(['readme']);
  });

  it('reads the ten latest shipped PRD specs with the kit layout, the highest number first', () => {
    const files = repoFiles(listing({ root: [], delivery: '.omni-loop/delivery', shipped: [...shipped(14), 'notes', '.gitkeep'] }));
    expect(files).toHaveLength(10);
    expect(files[0]).toEqual({ path: '.omni-loop/delivery/shipped/0014-topic-14/spec.md', kind: 'prd' });
    expect(files.at(-1)?.path).toBe('.omni-loop/delivery/shipped/0005-topic-5/spec.md');
  });

  it('caps a repository at twelve files: the README, then the docs, then the specs', () => {
    const files = repoFiles(listing({ docs: ['a.md', 'b.md', 'c.md'], delivery: 'loop', shipped: shipped(20) }));
    expect(files).toHaveLength(12);
    expect(files.map((f) => f.kind)).toEqual(['readme', 'doc', 'doc', 'doc', ...Array<string>(8).fill('prd')]);
  });

  it('reads nothing in a repository with neither README nor docs nor kit layout', () => {
    expect(repoFiles(listing({ root: ['main.go'] }))).toEqual([]);
  });
});

describe('labels', () => {
  it('names a file by its repository and path, and a page without its scheme', () => {
    expect(fileLabel('vertuoza/vertuo-app', 'README.md')).toBe('vertuo-app · README.md');
    expect(pageLabel('https://vertuoza.com/pricing/')).toBe('vertuoza.com/pricing');
  });
});
