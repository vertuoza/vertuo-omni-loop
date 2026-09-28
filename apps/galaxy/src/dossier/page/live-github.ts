'use server';
import { supabaseServer } from '../../data/supabase-server';
import { dossierGithub } from '../github/server';
import { dossierList } from '../store';
import { liveGithub, type GithubPulse } from './live';
import { isDossierId } from './source';

// The GitHub part of the open page's change check (PRD 426, part 5), asked by LiveRefresh at most
// every GITHUB_EVERY_MS: the stage and the open outbox count of a dossier the signed-in person may
// read (row-level security decides, through dossier_list()), from the server's one GitHub reader and
// its 60-second cache, so the browser never calls GitHub and GitHub is read at most once a minute per
// dossier. A signed-out visitor, a dossier they may not read and a draft get nothing, and ask nothing.

export async function readLiveGithub(id: string): Promise<GithubPulse | undefined> {
  if (!isDossierId(id)) return undefined;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return undefined;
  const [row] = await dossierList(db, id);
  return liveGithub(row ?? null, dossierGithub());
}
