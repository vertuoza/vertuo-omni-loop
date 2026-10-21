import 'server-only';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { repoReader } from '../business/draft/github';
import { githubStore } from '../dossier/github/server';
import { appCredentials, githubApp } from '../signup/github-app';
import { installationOf } from './load';
import { repositoriesRepository } from './repositories.repository';
import { skillsReader } from './skills';
import type { SkillsDeps } from './skills-api';

// The runner skills read's real dependencies (PRD 2313 s3), for /api/repositories/skills: the signed-in
// person's own Supabase session (their cookies), so row-level security decides which workspace lists the
// repository and who reads the allowances; the Omni App's installation, the workspace's stored one else its
// org's or the person's own; and the live GitHub read as the App, its token never leaving the server.
// Without Supabase configured (the demo galaxy, a closed build) every call answers 503.

let reader: ReturnType<typeof skillsReader> | undefined;
const skills = () => (reader ??= skillsReader(repoReader(appCredentials(), fetch, Date.now, githubStore())));

export function skillsDeps(): SkillsDeps {
  if (!supabaseEnv()) return { connect: null, installation: () => Promise.resolve(null), read: () => Promise.reject(new Error('no database')) };
  return {
    async connect() {
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      if (!user) return null;
      const store = repositoriesRepository(db);
      return {
        workspaceOf: (repository) => store.workspaceOf(repository),
        allowed: (workspace, repository) => store.allowedSkills(workspace, repository),
        logins: (workspace, users) => store.logins(workspace, users),
      };
    },
    async installation(workspace) {
      const db = await supabaseServer();
      const github = await repositoriesRepository(db).github(workspace);
      const stored = github.github_installation_id === null ? null : Number(github.github_installation_id);
      return (await installationOf(github, stored, githubApp(appCredentials())))?.id ?? null;
    },
    read: (installation, repository) => skills().read(installation, repository),
  };
}
