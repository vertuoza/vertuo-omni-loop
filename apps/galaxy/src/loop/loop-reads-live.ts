import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { serviceDb } from '../data/sign-in-live';
import { githubStore } from '../dossier/github/server';
import { serverEnv } from '../env';
import { appCredentials, installUrl } from '../signup/github-app';
import { githubLoopHost, type TimedLoopHost } from './github';
import type { LoopReadsDeps } from './loop.controller';
import { loopRepository } from './loop.repository';
import { loopService } from './loop.service';
import { loopTiming, timedWorkspaces } from './timing';

// The loop's reads' real dependencies (PRD 1665, s1), for /api/loop/changes: the sign-in is checked
// acting as the caller's access token; where a repository belongs is asked of repo_workspace() as the
// service role, which alone may call it; the repository is read as the Omni Loop App, one host per
// server so its tokens are shared by every request, its ETags and budget kept in Supabase as the PRD
// page's are (../dossier/github/server.ts). Without Supabase configured every call answers 503, and so
// does every read without the App's GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY. Each call makes the
// request's own timing (./timing.ts), its setup the first step, which the host and the workspace check
// add to and the answer's Server-Timing header reads.

let host: TimedLoopHost | null | undefined;

function loopHost(): TimedLoopHost | null {
  if (host !== undefined) return host;
  try {
    host = githubLoopHost({ creds: appCredentials(serverEnv().githubApp), store: githubStore() });
  } catch (error) {
    console.error(`loop: ${error instanceof Error ? error.message : String(error)}`);
    host = null;
  }
  return host;
}

export function loopReadsDeps(): LoopReadsDeps {
  const timing = loopTiming();
  return timing.timeSync('setup', () => {
    const log = (line: string) => { console.error(line); };
    const installLink = installUrl(serverEnv().githubAppSlug);
    if (!supabaseEnv()) return { connect: null, service: null, installLink, log, timing };
    const found = loopHost();
    return {
      connect: (token) => supabaseAs(token),
      service: found && serverEnv().serviceRole ? loopService(timedWorkspaces(loopRepository(serviceDb()), timing), found.timed(timing)) : null,
      installLink,
      log,
      timing,
    };
  });
}
