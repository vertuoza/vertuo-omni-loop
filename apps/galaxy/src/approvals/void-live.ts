import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { approvedUnlabeler } from '../approval/label';
import { githubStore } from '../dossier/github/server';
import { serverEnv } from '../env';
import { appCredentials } from '../signup/github-app';
import { liveChannels } from '../notify/notify-live';
import { reachRepository } from './approvals.repository';
import { voidReachRepository, voidRepository } from './void.repository';
import { tellVoids } from './void.service';

// Telling an approver of a void, for real (PRD 1322 s6). The voids are read as the caller who pushed,
// with the client the push ran on, so the database checks who reads. How the approver is reached is
// read as the service role (SUPABASE_SERVICE_ROLE_KEY), which alone may, and so is a gone device
// forgotten; without it the void stands and nobody is told, said in the log. The channels are this
// deployment's VAPID and Resend keys, the push contact its own address. PRD 1612 s2: the voided PRD's
// approved label is removed as the omni-loop App (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY); without the
// App the removal throws and is one log line.

const log = (line: string) => { console.error(line); };

/** The push route's `tellVoids`. */
export function liveTellVoids(db: Parameters<typeof voidRepository>[0], dossier: string, origin: string): Promise<void> {
  const service = serverEnv().serviceRole !== null ? serviceDb() : null;
  const reach = service ? reachRepository(service) : null;
  const forget = (device: string) => (reach ? reach.forget(device) : Promise.resolve());
  return tellVoids({
    voids: voidRepository(db),
    reach: service ? voidReachRepository(service) : null,
    channels: (contact) => liveChannels(contact, forget),
    log,
    unlabel: (repo, prd) => approvedUnlabeler({ creds: appCredentials(), fetch, store: githubStore() })(repo, prd),
  }, dossier, origin);
}
