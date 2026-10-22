import 'server-only';
import { after } from 'next/server';
import { serviceDb } from '../data/sign-in-live';
import { dossierGithub } from '../dossier/github/server';
import { snapshotStore } from '../dossier/snapshot/store';
import type { SnapshotDeps } from '../dossier/snapshot/snapshot';
import { serverEnv } from '../env';
import { stageStore } from '../stages/store';
import { workspacesOwning } from '../stages/event/workspaces';
import { conceptFactsStore } from '../fixes/facts/store';
import { refreshConceptFacts } from '../fixes/facts/refresh';
import { continuationsRepository, runnersRepository } from '../runners/runners.repository';
import { continuationsService } from '../runners/runners.service';
import { conceptOf, snapshotsOf } from './store';
import type { TouchedDeps } from './touched';

// The touch route's real deps (PRD 902, s3): STAGE_EVENT_SECRET (shared with omni-app, as the stage
// event's), the service role's client for the workspaces, prd_topics and dossier_github, the server's one
// GitHub reader, and Next's after() for the refreshes that run once the response is sent. A concept's
// issue (PRD 2213, s2) refreshes the concept's stored facts through the same reader. A PRD whose asked
// items are all answered after the read (PRD 2270, s1) is continued by the runners' rules, over the same
// service role's client.

const NO_READER: SnapshotDeps['reader'] = { summary: () => Promise.resolve(null), forget: () => {} };

export function touchedDeps(): TouchedDeps {
  const db = serviceDb();
  const continuations = continuationsService(runnersRepository(db), continuationsRepository(db));
  return {
    continueAnswered: async ({ workspace, repository, prd, stand }) =>
      (await continuations.continueAnswered({ workspaceId: workspace, repo: repository, prd, stand })).queued?.id ?? null,
    secret: serverEnv().stageEventSecret ?? undefined,
    workspacesOf: (repository) => workspacesOwning(db, repository),
    prdByTopic: (workspace, repository, topic) => stageStore(db).prdByTopic(workspace, repository, topic),
    snapshotsOf: (workspace, repository) => snapshotsOf(db, workspace, repository),
    conceptOf: (workspace, repository, issue) => conceptOf(db, workspace, repository, issue),
    refreshConcept: async (workspace, concept) => {
      const github = dossierGithub();
      if (!github) throw new Error('the Omni Loop App has no credentials here');
      await refreshConceptFacts(workspace, [concept], {
        reader: { concept: (ref) => github.concept(ref, { priority: 'background' }) },
        store: conceptFactsStore(db),
        log: (error) => { throw error instanceof Error ? error : new Error(String(error)); },
      });
    },
    snapshot: {
      store: snapshotStore(db),
      reader: dossierGithub() ?? NO_READER,
      pausedUntil: () => Promise.resolve(null),
      now: Date.now,
      later: (task) => { after(task); },
    },
  };
}
