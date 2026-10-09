import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv } from '../env';
import { liveChannels } from '../notify/notify-live';
import { reachRepository } from './approvals.repository';
import { voidReachRepository, voidRepository } from './void.repository';
import { tellVoids } from './void.service';

// Telling an approver of a void, for real (PRD 1322 s6). The voids are read as the caller who pushed,
// with the client the push ran on, so the database checks who reads. How the approver is reached is
// read as the service role (SUPABASE_SERVICE_ROLE_KEY), which alone may, and so is a gone device
// forgotten; without it the void stands and nobody is told, said in the log. The channels are this
// deployment's VAPID and Resend keys, the push contact its own address.

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
  }, dossier, origin);
}
