import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import { mainWatchStore } from '../main-watch/store.repository';
import type { RewindDeps } from './rewind.controller';
import { rewindRepository } from './rewind.repository';
import { rewindService } from './rewind.service';

// The rewind's real dependencies (PRD 2410, s5), for /api/rewind/*: one Supabase client per call, acting as
// the caller's access token, so row-level security keeps every read to the caller's workspaces. A finding is
// inserted by the service role (SUPABASE_SERVICE_ROLE_KEY), the only role the table lets write, and only
// after the service found the PRD's watch among the caller's own. Without Supabase, or without the service
// key, every call answers 503. A failure is one JSON log line (ADR-0102).

/** The rewind as the person whose access token `token` is. */
function asCaller(token: string) {
  const client = supabaseAs(token);
  const repository = rewindRepository(client, serviceDb);
  const watches = mainWatchStore(client);
  const service = rewindService({
    workspaceOf: (repo, prd) => repository.workspaceOf(repo, prd),
    mainWatch: (workspace_id, repo, prd) => watches.mainWatchOf({ workspace_id, repository: repo, prd }),
    findings: (workspace, repo, prd) => repository.findings(workspace, repo, prd),
    insert: (workspace, repo, prd, found) => repository.insert(workspace, repo, prd, found),
  });
  return { auth: client.auth, service };
}

export function rewindDeps(): RewindDeps {
  return {
    connect: supabaseEnv() && serverEnv().serviceRole ? asCaller : null,
    log: (message) => { log.error({ event: 'rewind', outcome: 'failed', message }); },
  };
}
