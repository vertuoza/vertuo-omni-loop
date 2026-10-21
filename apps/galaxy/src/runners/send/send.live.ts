import 'server-only';
import { runnersDeps } from '../runners.live';
import { sendSetupOf } from './send.read';
import type { SendSetup } from './targets';

// Send to terminal's real read (PRD 1830 s4): the Runners page's read through the runners' service as
// the service role (../runners.live.ts), for the signed-in person the page already checked.

/** Send to terminal's setup for `caller` on a page of `repo` in `workspaceId`; null when it shows nowhere. */
export function liveSendSetup(caller: string, workspaceId: string, repo: string): Promise<SendSetup | null> {
  const service = runnersDeps().service;
  return sendSetupOf(
    service ? (who, workspace) => service.board(who, workspace) : null, caller, workspaceId, repo, (error) => { console.error(error); },
    service ? (who, workspace, named) => service.allowedSkills(who, workspace, named) : undefined,
  );
}
