import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceGithub } from '../data/workspace';
import type { KnowledgeReader } from './github';
import { installedRepos } from './repos';

// The repositories the knowledge map's menu offers: those of every workspace the person belongs to,
// read through each workspace's App installation, with a stubbed reader.

const ACME: WorkspaceGithub = { slug: 'acme', github_org: 'acme', github_installation_id: 2 };
const VERTUOZA: WorkspaceGithub = { slug: 'vertuoza', github_org: 'vertuoza', github_installation_id: null };
const SOLO: WorkspaceGithub = { slug: 'solo', github_org: null, github_installation_id: null };

function reader(repos: Record<number, string[] | Error>, installations: Record<string, number | null> = { vertuoza: 1 }): KnowledgeReader {
  return {
    installationFor: vi.fn(async (w) => w.github_installation_id ?? (w.github_org ? installations[w.github_org] ?? null : null)),
    repos: vi.fn(async (id: number) => {
      const found = repos[id];
      if (found instanceof Error) throw found;
      return found ?? [];
    }),
    graph: vi.fn(),
  };
}

describe('installedRepos — the repositories the menu offers', () => {
  it('gives every workspace\'s repositories by name, each with the installation that reads it', async () => {
    const read = reader({ 1: ['vertuoza/vertuo-core', 'vertuoza/Api'], 2: ['acme/widgets'] });
    expect(await installedRepos(read, async () => [ACME, VERTUOZA, SOLO])).toEqual([
      { repo: 'acme/widgets', installation: 2 },
      { repo: 'vertuoza/Api', installation: 1 },
      { repo: 'vertuoza/vertuo-core', installation: 1 },
    ]);
  });

  it('offers a repository two installations reach once', async () => {
    const read = reader({ 1: ['acme/widgets'], 2: ['Acme/Widgets'] });
    expect(await installedRepos(read, async () => [ACME, VERTUOZA])).toEqual([{ repo: 'Acme/Widgets', installation: 2 }]);
  });

  it('keeps the other workspaces\' repositories when one installation cannot be read, saying why', async () => {
    const log = vi.fn();
    const read = reader({ 1: new Error('GitHub answered 502 to /installation/repositories'), 2: ['acme/widgets'] });
    expect(await installedRepos(read, async () => [ACME, VERTUOZA], log)).toEqual([{ repo: 'acme/widgets', installation: 2 }]);
    expect(log).toHaveBeenCalledWith('knowledge map: the repositories of vertuoza could not be read from GitHub — GitHub answered 502 to /installation/repositories');
  });

  it('offers none without the App\'s credentials, or when the workspaces cannot be read', async () => {
    const workspaces = vi.fn(async () => [ACME]);
    expect(await installedRepos(null, workspaces)).toEqual([]);
    expect(workspaces).not.toHaveBeenCalled();

    const log = vi.fn();
    expect(await installedRepos(reader({ 2: ['acme/widgets'] }), async () => { throw new Error('Supabase: down'); }, log)).toEqual([]);
    expect(log).toHaveBeenCalledWith('knowledge map: no other repository is offered, the workspaces cannot be read — Supabase: down');
  });
});
