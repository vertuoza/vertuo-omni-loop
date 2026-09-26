import { loadKnowledge } from '../../src/data/load-knowledge';
import { arcadeMode } from '../../src/data/mode';
import { isCrewEmail, supabaseEnv, supabaseServer } from '../../src/data/supabase-server';
import { knowledgeAccess, type Viewer } from '../../src/knowledge/access';
import { KnowledgeScreen } from '../../src/knowledge/KnowledgeScreen';

// /knowledge: the knowledge base of the checkout this app is deployed from, as a map (PRD 149).
// Rendered per request, never prerendered: it reads the address and, with a database, the session
// cookie. Gated like the galaxy (src/knowledge/access.ts): signed out, the sign-in card that comes
// back here through /knowledge/callback; signed in without a crew account, the crew-only notice; the
// crew, the map. Without a database it shows the local checkout's knowledge in development, and says
// the map is not open here in any other build.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

async function viewer(): Promise<Viewer> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? { signedIn: true, crew: isCrewEmail(user.email) } : { signedIn: false };
}

export default async function KnowledgePage({ searchParams }: Props) {
  const query = await searchParams;
  const env = supabaseEnv();
  const view = await knowledgeAccess(arcadeMode(process.env), { viewer, load: () => loadKnowledge() });
  return (
    <KnowledgeScreen
      view={view}
      wanted={{ domain: one(query.domain), entry: one(query.entry) }}
      supabase={env}
      signinError={one(query.signin_error)}
    />
  );
}
