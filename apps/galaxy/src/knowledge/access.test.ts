import { describe, it, expect } from 'vitest';
import { knowledgeAccess, type Viewer } from './access';
import { GRAPH } from './fixture';

// Who reads the knowledge map: exactly who gets the galaxy. The viewer is asked for, and the graph
// read, only when the answer depends on them.

function deps(viewer: Viewer, graph = GRAPH as typeof GRAPH | null) {
  const calls = { viewer: 0, load: 0 };
  return {
    calls,
    viewer: async () => { calls.viewer += 1; return viewer; },
    load: () => { calls.load += 1; return graph; },
  };
}

describe('knowledgeAccess — who reads the knowledge map', () => {
  it('gives the demo the local checkout’s graph, without asking who is there', async () => {
    const d = deps({ signedIn: false });
    expect(await knowledgeAccess('demo', d)).toEqual({ kind: 'map', graph: GRAPH });
    expect(d.calls).toEqual({ viewer: 0, load: 1 });
  });

  it('says the map is not open in a build with no database, and reads nothing', async () => {
    const d = deps({ signedIn: true, crew: true });
    expect(await knowledgeAccess('closed', d)).toEqual({ kind: 'closed' });
    expect(d.calls).toEqual({ viewer: 0, load: 0 });
  });

  it('asks a visitor who is signed out to sign in, and reads no knowledge for them', async () => {
    const d = deps({ signedIn: false });
    expect(await knowledgeAccess('supabase', d)).toEqual({ kind: 'sign-in' });
    expect(d.calls).toEqual({ viewer: 1, load: 0 });
  });

  it('tells a person signed in without a crew account that the map is for the crew, and reads nothing', async () => {
    const d = deps({ signedIn: true, crew: false });
    expect(await knowledgeAccess('supabase', d)).toEqual({ kind: 'crew-only' });
    expect(d.calls).toEqual({ viewer: 1, load: 0 });
  });

  it('gives the crew the map', async () => {
    const d = deps({ signedIn: true, crew: true });
    expect(await knowledgeAccess('supabase', d)).toEqual({ kind: 'map', graph: GRAPH });
    expect(d.calls).toEqual({ viewer: 1, load: 1 });
  });

  it('says the knowledge is out of reach when the graph cannot be read, for the crew and the demo alike', async () => {
    expect(await knowledgeAccess('supabase', deps({ signedIn: true, crew: true }, null))).toEqual({ kind: 'out-of-reach' });
    expect(await knowledgeAccess('demo', deps({ signedIn: false }, null))).toEqual({ kind: 'out-of-reach' });
  });
});
