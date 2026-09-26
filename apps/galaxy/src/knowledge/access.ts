import type { KnowledgeGraph } from '../data/knowledge';
import type { ArcadeMode } from '../data/mode';

// Who reads the knowledge map (PRD 149): exactly who gets the galaxy. With a database, a person
// signed out gets the sign-in card, a person signed in without a crew account gets the crew-only
// notice, and the crew gets the map. Without one, development plays the demo on the local checkout's
// knowledge, and any other build says the map is not open here. The viewer is asked for, and the
// knowledge read, only when the answer depends on them: nobody's page carries a graph they may not
// read.

export type Viewer = { signedIn: false } | { signedIn: true; crew: boolean };

export type KnowledgeView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'crew-only' }
  | { kind: 'out-of-reach' }
  | { kind: 'map'; graph: KnowledgeGraph };

export interface AccessDeps {
  /** Who is asking: read from the session cookie, so only in a build with a database. */
  viewer: () => Promise<Viewer>;
  /** The checkout's knowledge, or `null` when it cannot be read (load-knowledge.ts logs why). */
  load: () => KnowledgeGraph | null;
}

export async function knowledgeAccess(mode: ArcadeMode, { viewer, load }: AccessDeps): Promise<KnowledgeView> {
  if (mode === 'closed') return { kind: 'closed' };
  if (mode === 'supabase') {
    const who = await viewer();
    if (!who.signedIn) return { kind: 'sign-in' };
    if (!who.crew) return { kind: 'crew-only' };
  }
  const graph = load();
  return graph ? { kind: 'map', graph } : { kind: 'out-of-reach' };
}
