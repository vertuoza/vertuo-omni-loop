import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { githubStore } from '../dossier/github/server';
import { serverEnv } from '../env';
import { mainWatchStore } from '../main-watch/store.repository';
import { runnersRepository } from '../runners/runners.repository';
import { runnersService } from '../runners/runners.service';
import { appCredentials } from '../signup/github-app';
import { kitIssueOpener } from './kit-issue';
import type { DecisionDeps, RewindDeps } from './rewind.controller';
import { decisionRepository, rewindRepository } from './rewind.repository';
import { decisionService, rewindService, type DecisionService, type Sent } from './rewind.service';

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
    workspaceOfFinding: (id) => repository.workspaceOfFinding(id),
    recordOutcome: (workspace, id, body) => repository.recordOutcome(workspace, id, body),
  });
  return { auth: client.auth, service };
}

const clock = {
  now: () => new Date(),
  sleep: (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
};

/** Queues `line` on any runner of the workspace, sent by the member `userId`, through the runners' own rules
 * (who may send, which skills run, which repository): the service role writes the job, as the Runners page's
 * Send does. Without the service key, nothing is queued and the card says so. */
async function queueAs(userId: string, repository: string, line: string): Promise<Sent> {
  if (serverEnv().serviceRole === null) return { ok: false, error: 'This deployment cannot queue a runner job.' };
  const sent = await runnersService(runnersRepository(serviceDb()), clock).send(userId, { line, repo: repository, target: { kind: 'any' } });
  return sent.ok ? { ok: true, link: '/app/runners' } : { ok: false, error: sent.error };
}

/** The issue on the kit's repository, as the omni-loop App; the App's keys read only when one is opened. */
function openKitIssue(title: string, body: string): Promise<Sent> {
  return kitIssueOpener({ creds: appCredentials(), fetch, store: githubStore() })(title, body);
}

/** The decision as the page's signed-in person (PRD 2410, s7): their own session's client, so the database's
 * functions know who decides and who proposes; null when nobody is signed in. */
async function decisionAsSession(): Promise<DecisionService | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const repository = decisionRepository(db);
  return decisionService({
    finding: (id) => repository.finding(id),
    approve: (workspace, id) => repository.approve(workspace, id),
    reject: (workspace, id, reason) => repository.reject(workspace, id, reason),
    queue: (repo, line) => queueAs(user.id, repo, line),
    propose: async (workspace, repo, plan) => {
      const filed = await repository.propose(repo, workspace, plan);
      return filed.ok ? { ok: true, link: `/app/products/${filed.product}/knowledge` } : filed;
    },
    openIssue: openKitIssue,
    log: (message) => { log.error({ event: 'rewind', outcome: 'failed', message }); },
  });
}

/** POST /api/rewind/decide's dependencies: the page's session, or none without a database. */
export function decisionDeps(): DecisionDeps {
  return {
    session: supabaseEnv() ? decisionAsSession : null,
    log: (message) => { log.error({ event: 'rewind', outcome: 'failed', message }); },
  };
}

export function rewindDeps(): RewindDeps {
  return {
    connect: supabaseEnv() && serverEnv().serviceRole ? asCaller : null,
    log: (message) => { log.error({ event: 'rewind', outcome: 'failed', message }); },
  };
}
