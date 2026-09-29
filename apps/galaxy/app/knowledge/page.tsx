import { loadKnowledge } from '../../src/data/load-knowledge';
import { arcadeMode } from '../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../src/data/supabase-server';
import { memberGithub, memberWorkspace } from '../../src/data/workspace';
import { knowledgeAccess, type KnowledgeView, type Viewer } from '../../src/knowledge/access';
import { knowledgeGithub } from '../../src/knowledge/github-server';
import { KnowledgeScreen } from '../../src/knowledge/KnowledgeScreen';
import { installedRepos } from '../../src/knowledge/repos';

// /knowledge: a knowledge base as a map (PRD 149): the checkout this app is deployed from, or, with
// `?repo=<owner/name>`, another repository of the crew's workspaces set up with Omni Loop, read from
// GitHub as the Omni Loop App (src/knowledge/github.ts) and picked from the page's repository menu.
// Rendered per request, never prerendered: it reads the address and, with a database, the session
// cookie. Gated like the galaxy (src/knowledge/access.ts): signed out, the sign-in card that comes
// back here through /knowledge/callback; signed in without a workspace, the crew-only notice; the
// crew (a member of a workspace, as in the arcade: src/data/arcade.ts), the map. The database out of
// reach, the knowledge is too: nobody is turned away as an outsider when their workspace is unknown.
// Without a database it shows the local checkout's knowledge in development, and says the map is not
// open here in any other build.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function KnowledgePage({ searchParams }: Props) {
  const query = await searchParams;
  const env = supabaseEnv();
  let userId: string | null = null;

  async function viewer(): Promise<Viewer> {
    const db = await supabaseServer();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { signedIn: false };
    userId = user.id;
    return { signedIn: true, crew: (await memberWorkspace(db, user.id)) !== null };
  }
  const workspaces = async () => (userId ? memberGithub(await supabaseServer(), userId) : []);

  let view: KnowledgeView;
  try {
    view = await knowledgeAccess(arcadeMode(process.env), {
      viewer,
      load: () => loadKnowledge(),
      repos: () => installedRepos(knowledgeGithub(), workspaces),
      loadRepo: async ({ repo, installation }) => (await knowledgeGithub()?.graph(installation, repo)) ?? null,
    }, one(query.repo));
  } catch (err) {
    console.error(err);
    view = { kind: 'out-of-reach', menu: null };
  }
  return (
    <KnowledgeScreen
      view={view}
      wanted={{ repo: one(query.repo), domain: one(query.domain), entry: one(query.entry) }}
      supabase={env}
      signinError={one(query.signin_error)}
    />
  );
}
