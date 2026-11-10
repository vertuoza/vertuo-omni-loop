import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv } from '../env';
import { lawsModelFromEnv } from './model';
import { verdictsRepository, type VerdictsDb } from './verdicts.repository';
import { standingAnswer, verdictService, type LawsAnswer, type LawsView, type VerdictService } from './verdicts.service';

// The business laws' verdicts on their real dependencies (PRD 2632 s4): the service role keeps a verdict and
// reads what the judge needs (SUPABASE_SERVICE_ROLE_KEY), OpenRouter judges (OPENROUTER_API_KEY; without it
// every spec is not judged, and says why), and the caller's own client says whether they may see a dossier's
// verdict at all. Without the service role nothing is judged and nothing is shown: Approve stays as it was,
// and the database still refuses a red it holds.

function liveService(): VerdictService | null {
  try {
    return verdictService({ service: verdictsRepository(serviceDb()), ask: lawsModelFromEnv(serverEnv().openrouter) });
  } catch {
    return null;
  }
}

/** What the PRD's page shows of dossier `dossier`'s business laws, for the member `caller` reads as. */
export function lawsForPage(caller: VerdictsDb, dossier: string): Promise<LawsView> {
  const service = liveService();
  if (!service) return Promise.resolve({ show: 'nothing' });
  return service.lawsOf(dossier, () => verdictsRepository(caller).standing(dossier));
}

/** The verdict kept on dossier `dossier`'s spec version `version` (the approved one), as the member `caller`
 * reads it; nothing to show when there is none, or it cannot be read. Never judges. */
export async function lawsOfApproved(caller: VerdictsDb, dossier: string, version: string): Promise<LawsView> {
  try {
    const read = await verdictsRepository(caller).standing(dossier, version);
    return read?.verdict ? { show: 'verdict', verdict: read.verdict } : { show: 'nothing' };
  } catch (error) {
    log.error({ event: 'business-laws', outcome: 'failed', error });
    return { show: 'nothing' };
  }
}

/** Where dossier `dossier`'s latest spec stands with its business laws, as the member `caller` reads it, for
 * the terminal (bug #2696); null where nothing is judged, or it cannot be read. Never judges: a push does. */
export async function lawsForTerminal(caller: VerdictsDb, dossier: string): Promise<LawsAnswer | null> {
  try {
    return standingAnswer(await verdictsRepository(caller).standing(dossier));
  } catch (error) {
    log.error({ event: 'business-laws', outcome: 'failed', error });
    return null;
  }
}

/** Judges dossier `dossier`'s latest spec when the caller may see it and it has no verdict yet: before Approve. */
export async function judgeBeforeApprove(caller: VerdictsDb, dossier: string): Promise<void> {
  await lawsForPage(caller, dossier);
}

/** Judges dossier `dossier`'s latest spec after a push, once; a failure is only logged. */
export async function judgeAfterPush(dossier: string): Promise<void> {
  const service = liveService();
  if (!service) return;
  try {
    await service.ensure(dossier);
  } catch (error) {
    log.error({ event: 'business-laws', outcome: 'failed', error });
  }
}
