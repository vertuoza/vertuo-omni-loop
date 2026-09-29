import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import { recountLive } from '../outbox/live';
import { stageStore } from '../store';
import type { StageEventDeps } from './event';
import { workspacesOwning } from './workspaces';

// The event route's real deps: STAGE_EVENT_SECRET (server only, shared with omni-app) and the service
// role's client (SUPABASE_SERVICE_ROLE_KEY), the one role that writes stages. Each is read per call.
// PRD 657 (s5): each PRD placed has its open outbox questions recounted (../outbox/live.ts).
export function stageEventDeps(): StageEventDeps {
  return {
    secret: process.env.STAGE_EVENT_SECRET || undefined,
    store: () => stageStore(serviceDb()),
    workspacesOf: (repository) => workspacesOwning(serviceDb(), repository),
    recount: recountLive,
  };
}
