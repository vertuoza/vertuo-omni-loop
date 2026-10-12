import 'server-only';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { serverEnv, type GithubOAuthEnv } from '../../env';
import { sendOpen } from '../../outbox/open';
import { githubUser } from '../../outbox/send';
import { roadmapReader } from '../store';
import { tickGitHub, type TickDeps, type TickStore } from './tick';

// Mark as done's real dependencies (./tick.ts, PRD 1218 s7): the signed-in person's own Supabase session,
// so row-level security decides which roadmap they read and its prerequisites; and GitHub, as the
// omni-loop App's user authorisation, the outbox send's client (GITHUB_APP_CLIENT_ID and
// GITHUB_APP_CLIENT_SECRET, both server-only). Open exactly where the outbox send is (../../outbox/open.ts).

type Reader = ReturnType<typeof roadmapReader>;

function tickStore(reader: Pick<Reader, 'roadmap' | 'prerequisites'>): TickStore {
  return {
    async target(roadmapId) {
      const row = await reader.roadmap(roadmapId);
      if (!row) return null;
      const prerequisites = await reader.prerequisites(row.id);
      return { roadmapId: row.id, repo: row.repo, number: row.number, rows: Object.fromEntries(prerequisites.map((p) => [p.row_id, p.who])) };
    },
  };
}

const NO_CLIENT: GithubOAuthEnv = { clientId: '', clientSecret: '' };

export function tickDeps(): TickDeps {
  const client = sendOpen() ? serverEnv().githubOAuth : null;
  return {
    clientId: client?.clientId ?? null,
    async store() {
      if (!supabaseEnv()) return null;
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? tickStore(roadmapReader(db)) : null;
    },
    github: () => tickGitHub(githubUser({ ...(client ?? NO_CLIENT), fetch })),
  };
}
