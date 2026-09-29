import { describe, it, expect } from 'vitest';
import type { KnowledgeGraph } from '../data/knowledge';
import { knowledgeAccess, type InstalledRepo, type Viewer } from './access';
import { GRAPH } from './fixture';

// Who reads the knowledge map, and which repository's: exactly who gets the galaxy. The viewer is
// asked for, and a graph read, only when the answer depends on them; a repository is read from
// GitHub only when the crew's menu offers it.

const WIDGETS: InstalledRepo = { repo: 'acme/widgets', installation: 2 };
const ANVILS: InstalledRepo = { repo: 'acme/Anvils', installation: 2 };
const OTHER: KnowledgeGraph = { ...GRAPH, repo: 'acme/Anvils' };

function deps(viewer: Viewer, graph = GRAPH as KnowledgeGraph | null, others: InstalledRepo[] = [], remote = OTHER as KnowledgeGraph | null) {
  const calls = { viewer: 0, load: 0, repos: 0, loadRepo: [] as InstalledRepo[] };
  return {
    calls,
    viewer: async () => { calls.viewer += 1; return viewer; },
    load: () => { calls.load += 1; return graph; },
    repos: async () => { calls.repos += 1; return others; },
    loadRepo: async (repo: InstalledRepo) => { calls.loadRepo.push(repo); return remote; },
  };
}

const CREW: Viewer = { signedIn: true, crew: true };
/** The menu the crew gets with `acme/Anvils` beside the deployed checkout (`acme/widgets`, GRAPH's). */
const MENU = [{ value: '', label: 'acme/widgets' }, { value: 'acme/Anvils', label: 'acme/Anvils' }];

describe('knowledgeAccess — who reads the knowledge map', () => {
  it('gives the demo the local checkout’s graph, without asking who is there nor offering a menu', async () => {
    const d = deps({ signedIn: false }, GRAPH, [ANVILS]);
    expect(await knowledgeAccess('demo', d)).toEqual({ kind: 'map', graph: GRAPH, menu: null });
    expect(d.calls).toEqual({ viewer: 0, load: 1, repos: 0, loadRepo: [] });
  });

  it('says the map is not open in a build with no database, and reads nothing', async () => {
    const d = deps(CREW);
    expect(await knowledgeAccess('closed', d)).toEqual({ kind: 'closed' });
    expect(d.calls).toEqual({ viewer: 0, load: 0, repos: 0, loadRepo: [] });
  });

  it('asks a visitor who is signed out to sign in, and reads no knowledge for them', async () => {
    const d = deps({ signedIn: false });
    expect(await knowledgeAccess('supabase', d, 'acme/Anvils')).toEqual({ kind: 'sign-in' });
    expect(d.calls).toEqual({ viewer: 1, load: 0, repos: 0, loadRepo: [] });
  });

  it('tells a person signed in without a crew account that the map is for the crew, and reads nothing', async () => {
    const d = deps({ signedIn: true, crew: false });
    expect(await knowledgeAccess('supabase', d, 'acme/Anvils')).toEqual({ kind: 'crew-only' });
    expect(d.calls).toEqual({ viewer: 1, load: 0, repos: 0, loadRepo: [] });
  });

  it('gives the crew the map, with no menu when their workspaces offer no other repository', async () => {
    const d = deps(CREW);
    expect(await knowledgeAccess('supabase', d)).toEqual({ kind: 'map', graph: GRAPH, menu: null });
    expect(d.calls).toEqual({ viewer: 1, load: 1, repos: 1, loadRepo: [] });
  });

  it('says the knowledge is out of reach when the graph cannot be read, for the crew and the demo alike', async () => {
    expect(await knowledgeAccess('supabase', deps(CREW, null))).toEqual({ kind: 'out-of-reach', menu: null });
    expect(await knowledgeAccess('demo', deps({ signedIn: false }, null))).toEqual({ kind: 'out-of-reach', menu: null });
  });
});

describe('knowledgeAccess — the repository menu', () => {
  it('opens on the deployed checkout, offering it first and every other repository of the crew\'s workspaces', async () => {
    const d = deps(CREW, GRAPH, [ANVILS]);
    expect(await knowledgeAccess('supabase', d)).toEqual({ kind: 'map', graph: GRAPH, menu: { options: MENU, current: '' } });
    expect(await knowledgeAccess('supabase', d, '  ')).toEqual({ kind: 'map', graph: GRAPH, menu: { options: MENU, current: '' } });
    expect(d.calls.loadRepo).toEqual([]);
  });

  it('offers the deployed checkout once, even when an installation reaches it too, and reads it off disk', async () => {
    const d = deps(CREW, GRAPH, [ANVILS, WIDGETS]);
    const view = await knowledgeAccess('supabase', d, 'ACME/Widgets');
    expect(view).toEqual({ kind: 'map', graph: GRAPH, menu: { options: MENU, current: '' } });
    expect(d.calls.loadRepo).toEqual([]);
  });

  it('shows a repository the menu offers, read from GitHub through its installation, whatever the case asked', async () => {
    const d = deps(CREW, GRAPH, [ANVILS]);
    expect(await knowledgeAccess('supabase', d, 'acme/anvils')).toEqual({ kind: 'map', graph: OTHER, menu: { options: MENU, current: 'acme/Anvils' } });
    expect(d.calls.loadRepo).toEqual([ANVILS]);
  });

  it('shows a picked repository set up without knowledge yet as its empty map, so the page can say so', async () => {
    const EMPTY: KnowledgeGraph = { ...OTHER, domains: [], entries: [], links: [], loose: [], unserved: [] };
    const d = deps(CREW, GRAPH, [ANVILS], EMPTY);
    expect(await knowledgeAccess('supabase', d, 'acme/Anvils')).toEqual({ kind: 'map', graph: EMPTY, menu: { options: MENU, current: 'acme/Anvils' } });
  });

  it('says a picked repository is out of reach when GitHub cannot be read, keeping the menu on it', async () => {
    const d = deps(CREW, GRAPH, [ANVILS], null);
    expect(await knowledgeAccess('supabase', d, 'acme/Anvils')).toEqual({ kind: 'out-of-reach', menu: { options: MENU, current: 'acme/Anvils' } });
  });

  it('never reads a repository the menu does not offer', async () => {
    const d = deps(CREW, GRAPH, [ANVILS]);
    expect(await knowledgeAccess('supabase', d, 'other/secret')).toEqual({ kind: 'not-offered', repo: 'other/secret', menu: { options: MENU, current: '' } });
    expect(await knowledgeAccess('supabase', deps(CREW), 'other/secret')).toEqual({ kind: 'not-offered', repo: 'other/secret', menu: null });
    expect(d.calls.loadRepo).toEqual([]);
  });

  it('names the deployed checkout plainly when its knowledge cannot be read, and still offers the others', async () => {
    const d = deps(CREW, null, [ANVILS]);
    expect(await knowledgeAccess('supabase', d)).toEqual({
      kind: 'out-of-reach',
      menu: { options: [{ value: '', label: 'This deployment' }, MENU[1]], current: '' },
    });
    expect(await knowledgeAccess('supabase', d, 'acme/Anvils')).toMatchObject({ kind: 'map', graph: OTHER });
  });
});
