// `plan-archive`: the Inngest function that keeps a plan repository's GitHub `archived` flag equal to what
// its product says (PRD 2011 s17, spec "5. Archiving the plan repository"). A product's owner presses
// Archive on its Repositories tab (galaxy, as a person, through product_plan_archive()); that records
// `products.plan_archived_at` and nothing more. This function, which holds the GitHub App's key and is the
// only place that does (N-PRODUCT-17), makes the repository read-only on GitHub, and writable again on
// Undo. It runs every 5 minutes:
//
//   step "plans"             every product's plan repository and whether its product says archived
//   step "plan-<owner/name>" one per repository: the App's installation on it, the flag GitHub shows, and,
//                            when they differ, the one write that makes GitHub say what the product says
//
// A repository the App is not installed on, or whose write GitHub refuses (403: the App lacks the
// `administration: write` permission), is left as it is and named in the log, and the next run tries
// again; it never fails the others. It writes nothing but that flag and never merges anything
// (N-PRODUCT-15).
import type { Inngest } from 'inngest';
import { z } from 'zod';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import { savedStep } from '../saved-step.ts';
import { installationOf, isArchived, setArchived, statusOf, type Request } from './github.ts';
import type { PlanStore } from './store.ts';

export const PLAN_ARCHIVE_FUNCTION_ID = 'plan-archive';
export const EVERY_5_MINUTES = '*/5 * * * *';

const PlansSchema = z.array(z.object({ repository: z.string().min(1), archived: z.boolean() }));

/** What one repository's step did. */
const OutcomeSchema = z.object({
  repository: z.string(),
  did: z.enum(['archived', 'unarchived', 'in-step', 'left']),
  why: z.string().nullable(),
});
type Outcome = z.infer<typeof OutcomeSchema>;

/** The App's own client, signed with its JWT: what looks up its installation on a repository. */
export type AppRequest = () => Promise<Request> | Request;

export function createPlanArchive({
  client,
  octokitFor,
  appOctokit,
  store,
  log = noteTo('plan-archive'),
}: {
  client: Inngest.Any;
  octokitFor: OctokitFor<Request>;
  /** The App's own client; null when the App cannot look up its installations here, which changes nothing. */
  appOctokit: AppRequest | null;
  /** The plan repositories' database; null when the App cannot reach the server here, which changes nothing. */
  store: PlanStore | null;
  log?: (line: string) => void;
}) {
  return client.createFunction(
    {
      id: PLAN_ARCHIVE_FUNCTION_ID,
      name: 'omni-loop · plan archive',
      triggers: [{ cron: EVERY_5_MINUTES }],
      concurrency: { limit: 1 },
      retries: 2,
    },
    async ({ step }) => {
      if (!store || !appOctokit) {
        log('plan archive: the App cannot reach the server or look up its installations here, so nothing is changed');
        return { skipped: 'no store' };
      }
      const plans = await savedStep(step, 'plans', PlansSchema, () => store.plans());
      const outcomes: Outcome[] = [];
      for (const plan of plans) {
        // Logged inside the step, so a replay of the run does not say it twice.
        const outcome = await savedStep(step, `plan-${plan.repository}`, OutcomeSchema, async () => {
          const done = await reconcile(plan, { octokitFor, appOctokit });
          if (done.why !== null) log(`plan archive: ${plan.repository} left as it is: ${done.why}`);
          else if (done.did !== 'in-step') log(`plan archive: ${plan.repository} ${done.did} on GitHub`);
          return done;
        });
        outcomes.push(outcome);
      }
      return { plans: outcomes };
    },
  );
}

/** Makes GitHub's flag for one plan repository say what its product says. */
async function reconcile(
  { repository, archived }: { repository: string; archived: boolean },
  { octokitFor, appOctokit }: { octokitFor: OctokitFor<Request>; appOctokit: AppRequest },
): Promise<Outcome> {
  const left = (why: string): Outcome => ({ repository, did: 'left', why });
  const [owner = '', repo = ''] = repository.split('/');
  try {
    const installation = await installationOf(await appOctokit(), owner, repo);
    if (installation === null) return left('the App is not installed there');
    const octokit = await octokitFor(installation);
    if ((await isArchived(octokit, owner, repo)) === archived) return { repository, did: 'in-step', why: null };
    await setArchived(octokit, owner, repo, archived);
    return { repository, did: archived ? 'archived' : 'unarchived', why: null };
  } catch (error) {
    const status = statusOf(error);
    if (status === 403) return left('GitHub refused (403): the App needs the administration permission');
    if (status === 404) return left('GitHub does not show the repository to the App (404)');
    throw error;
  }
}
