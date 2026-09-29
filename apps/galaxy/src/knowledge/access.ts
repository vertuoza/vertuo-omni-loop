import type { KnowledgeGraph } from '../data/knowledge';
import type { ArcadeMode } from '../data/mode';

// Who reads the knowledge map (PRD 149), and which repository's: exactly who gets the galaxy. With a
// database, a person signed out gets the sign-in card, a person signed in without a crew account gets
// the crew-only notice, and the crew gets the map. Without one, development plays the demo on the
// local checkout's knowledge, and any other build says the map is not open here. The viewer is asked
// for, and the knowledge read, only when the answer depends on them: nobody's page carries a graph they
// may not read.
//
// The map opens on the checkout this app is deployed from. The crew may also pick, from a menu, any
// repository of their workspaces set up with Omni Loop that the App is installed on: `?repo=<owner/name>`
// reads that one from GitHub, and only a repository the menu offers is ever read.

export type Viewer = { signedIn: false } | { signedIn: true; crew: boolean };

/** A repository read from GitHub, and the App installation that reads it. */
export type InstalledRepo = { repo: string; installation: number };

/** One repository of the menu. `value` is what `?repo=` carries: '' for the deployed checkout, the
 * page's default (so its addresses stay as they were), a slug for any other. */
export interface RepoOption { value: string; label: string }

/** The repository menu: every repository offered, the deployed checkout first, and the one shown. */
export interface RepoMenu { options: RepoOption[]; current: string }

export type KnowledgeView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'crew-only' }
  | { kind: 'out-of-reach'; menu: RepoMenu | null }
  | { kind: 'not-offered'; repo: string; menu: RepoMenu | null }
  | { kind: 'map'; graph: KnowledgeGraph; menu: RepoMenu | null };

export interface AccessDeps {
  /** Who is asking: read from the session cookie, so only in a build with a database. */
  viewer: () => Promise<Viewer>;
  /** The checkout's knowledge, or `null` when it cannot be read (load-knowledge.ts logs why). */
  load: () => KnowledgeGraph | null;
  /** The other repositories the crew may pick: those of their workspaces' App installations that
   * carry the loop's config. Asked for only in a build with a database; `[]` when there are none or
   * they cannot be read (the log says why). */
  repos: () => Promise<InstalledRepo[]>;
  /** A picked repository's knowledge, read from GitHub; `null` when it cannot be read. */
  loadRepo: (repo: InstalledRepo) => Promise<KnowledgeGraph | null>;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The menu: offered only when there is a choice. */
function menuOf(home: string | null, others: InstalledRepo[], current: string): RepoMenu | null {
  if (others.length === 0) return null;
  const options = [{ value: '', label: home ?? 'This deployment' }, ...others.map(({ repo }) => ({ value: repo, label: repo }))];
  return { options, current };
}

/** What the page shows `wanted` (the address's `?repo=`, `null` or empty for the deployed checkout). */
export async function knowledgeAccess(mode: ArcadeMode, deps: AccessDeps, wanted: string | null = null): Promise<KnowledgeView> {
  if (mode === 'closed') return { kind: 'closed' };
  if (mode === 'supabase') {
    const who = await deps.viewer();
    if (!who.signedIn) return { kind: 'sign-in' };
    if (!who.crew) return { kind: 'crew-only' };
  }
  const local = deps.load();
  const home = local?.repo ?? null;
  const others = (mode === 'supabase' ? await deps.repos() : []).filter(({ repo }) => !(home && same(repo, home)));
  const asked = wanted?.trim() || null;

  if (!asked || (home && same(asked, home))) {
    const menu = menuOf(home, others, '');
    return local ? { kind: 'map', graph: local, menu } : { kind: 'out-of-reach', menu };
  }
  const picked = others.find(({ repo }) => same(repo, asked));
  if (!picked) return { kind: 'not-offered', repo: asked, menu: menuOf(home, others, '') };
  const menu = menuOf(home, others, picked.repo);
  const graph = await deps.loadRepo(picked);
  return graph ? { kind: 'map', graph, menu } : { kind: 'out-of-reach', menu };
}
