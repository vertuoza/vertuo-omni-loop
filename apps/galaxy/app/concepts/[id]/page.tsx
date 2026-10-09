import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConceptPageScreen } from '../../../src/concepts/ConceptPage';
import { conceptPageState } from '../../../src/concepts/ConceptPage.read';
import { readConceptPick } from '../../../src/concepts/ConceptPage.view';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { dossierSession } from '../../../src/dossier/page/route-gate';
import { serverEnv } from '../../../src/env';

// /concepts/<id> (PRD 1272, s3): one concept's page (src/concepts/ConceptPage.tsx), read per request as
// the signed-in person, so row-level security decides. Anyone outside its workspace, an id that is no
// dossier's and a dossier of another kind get the not-found page, in the same words. `?tab=` picks the
// tab, `?round=` the board on Boards.

export const metadata: Metadata = { title: 'Concept · OMNI LOOP' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConceptRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const state = await conceptPageState(serverEnv().mode, dossierSession, id, readConceptPick(query));
  if (state.kind === 'not-found') notFound();
  const error = Array.isArray(query.signin_error) ? query.signin_error[0] : query.signin_error;
  return <ConceptPageScreen state={state} id={id} supabase={supabaseEnv()} error={error ?? null} />;
}
