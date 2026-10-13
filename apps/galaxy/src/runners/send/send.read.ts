import type { Board } from '../runners.contract';
import { sendOptions, type SendSetup } from './targets';

// What Send to terminal reads on a page (PRD 1830 s4), on the server: the Runners page's read of the
// workspace (its runners and what the viewer may do), turned into the picker's choices for the page's
// repository. Anything short of choices hides the button and leaves the page as it was: no runners here
// (no service role), a viewer the read refuses, a read that fails (logged), or no runner they may use.

/** The Runners page's read, as the service answers it. */
type BoardRead = (caller: string, workspaceId: string) => Promise<{ ok: true; value: Pick<Board, 'runners' | 'viewer'> } | { ok: false }>;

/** Send to terminal's setup for `caller` on a page of `repo` in `workspaceId`; null when it shows nowhere. */
export async function sendSetupOf(board: BoardRead | null, caller: string, workspaceId: string, repo: string, log: (error: unknown) => void): Promise<SendSetup | null> {
  if (!board) return null;
  try {
    const read = await board(caller, workspaceId);
    const options = read.ok ? sendOptions(read.value, repo) : [];
    return options.length ? { repo, options } : null;
  } catch (error) {
    log(error);
    return null;
  }
}
