import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import { stageStore } from '../store';
import type { StageEventDeps } from './event';
import { workspacesOwning } from './workspaces';

// The event route's real deps: STAGE_EVENT_SECRET (server only, shared with omni-app) and the service
// role's client (SUPABASE_SERVICE_ROLE_KEY), the one role that writes stages. Each is read per call.
export function stageEventDeps(): StageEventDeps {
  return {
    secret: process.env.STAGE_EVENT_SECRET || undefined,
    store: () => stageStore(serviceDb()),
    workspacesOf: (repository) => workspacesOwning(serviceDb(), repository),
  };
}
