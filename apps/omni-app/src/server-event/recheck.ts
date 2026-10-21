// `server-event`: the Inngest function a server event runs (PRD 1548 s4 and s8, acceptance 8). An
// approval, a void, an outbox item opened or one settled on the server re-posts both checks,
// `omni/approved` and the outbox check, on every open target pull request of that product PRD:
//
//   step "targets"             its open pull requests, read from the database (./targets.ts), never
//                              listed from GitHub
//   step "pull <owner/name#n>" each one read (one `GET` of that pull request, never a list): kept when
//                              its body names the PRD (`Part of mobile-12`), with its head
//   step "recheck"             one outbox check event per kept pull request (OUTBOX_CHECK_EVENT), the one the
//                              webhook sends, which the outbox check (../outbox-check/outbox-check.ts) and
//                              the approved check (../approved-check/approved-check.ts) both run, the inbox
//                              check too, and the budgets check (../budgets-check/budgets-check.ts), so an
//                              `item-settled` that answers a ceiling's raise turns `omni / budgets` green
//                              with no new push (PRD 1679): each verdict is that function's alone
//
// Debounced per PRD: the burst of events one approval or one push makes re-checks once, from the last.
// The installation's GitHub budget is shared with galaxy (PRD 902): a read it refuses is never sent; the
// step logs one line and is retried once the pause or the window ends.
import { RetryAfterError, type Inngest } from 'inngest';
import { GithubDeferred, GithubPaused } from '@omni/github';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { productPrdOf } from '../approved-check/state.ts';
import { OUTBOX_CHECK_EVENT, type CheckRequest } from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readPull, type GitHubClient } from '../outbox-check/github.ts';
import { noteTo } from '../run-log/run-log.ts';
import { SERVER_EVENT, ServerEventSchema } from './server-event.ts';
import type { OpenPull, TargetsReader } from './targets.ts';

export const SERVER_EVENT_FUNCTION_ID = 'server-event';

/** The trigger the checks are told they run for. */
export const SERVER_EVENT_TRIGGER = 'server-event';

const SERVER_EVENT_DEBOUNCE = Object.freeze({ key: 'event.data.dossier', period: '5s', timeout: '1m' });

/** What a run re-checked when it re-checked nothing. */
const NONE: readonly string[] = Object.freeze([]);

/** A pull request kept: it names the PRD, at this head. */
type Kept = { repository: string; number: number; headSha: string };

/** The budget's refusal `error` is, or wraps a few causes deep; null when it is none. */
function refusalIn(error: unknown, depth = 0): GithubPaused | GithubDeferred | null {
  if (error instanceof GithubPaused || error instanceof GithubDeferred) return error;
  return error instanceof Error && depth < 3 ? refusalIn(error.cause, depth + 1) : null;
}

/** Whether `pull`'s body names product PRD `prdId`, and its head; null when it names another or none. */
async function keptOf(octokit: GitHubClient, pull: OpenPull, prdId: string): Promise<Kept | null> {
  const [owner = '', repo = ''] = pull.repository.split('/');
  const read = await readPull(octokit, { owner, repo, prNumber: parsePr(pull.number) });
  return productPrdOf(read.body)?.id === prdId ? { ...pull, headSha: read.headSha } : null;
}

export function createServerEventRecheck({
  client,
  octokitFor,
  readTargets,
  log = noteTo('server-event-recheck'),
}: {
  client: Inngest;
  octokitFor: OctokitFor<GitHubClient>;
  /** The targets' reader; null when the App cannot read the server here, which re-checks nothing. */
  readTargets: TargetsReader | null;
  log?: (line: string) => void;
}) {
  return client.createFunction(
    { id: SERVER_EVENT_FUNCTION_ID, name: 'omni-loop · server event', triggers: [{ event: SERVER_EVENT }], debounce: SERVER_EVENT_DEBOUNCE, retries: 3 },
    async ({ event, step }) => {
      const { event: what, dossier } = ServerEventSchema.parse(event.data);
      if (!readTargets) {
        log(`server event: the ${what} of dossier ${dossier} re-checks nothing: the App cannot read the server here`);
        return { rechecked: NONE };
      }
      const targets = await step.run('targets', () => readTargets(dossier));
      if (!targets) return { rechecked: NONE };

      const kept: Kept[] = [];
      for (const pull of targets.pulls) {
        const where = `${pull.repository}#${pull.number}`;
        const found = await step.run(`pull ${where}`, async () => {
          try {
            return await keptOf(await octokitFor(targets.installationId), pull, targets.prdId);
          } catch (error) {
            const refused = refusalIn(error);
            if (!refused) throw error;
            log(`server event: ${where} waits for the GitHub budget: ${refused.message}`);
            throw new RetryAfterError(refused.message, new Date(refused.until), { cause: refused });
          }
        });
        if (found) kept.push(found);
      }
      if (kept.length === 0) return { prd: targets.prdId, rechecked: NONE };

      const events: CheckRequest[] = kept.map(({ repository, number, headSha }) => {
        const [owner = '', repo = ''] = repository.split('/');
        return {
          name: OUTBOX_CHECK_EVENT,
          data: { installationId: targets.installationId, owner, repo, repository, prNumber: parsePr(number), headSha, trigger: SERVER_EVENT_TRIGGER },
        };
      });
      await step.sendEvent('recheck', events);
      return { prd: targets.prdId, rechecked: kept.map((pull) => `${pull.repository}#${pull.number}`) };
    },
  );
}
