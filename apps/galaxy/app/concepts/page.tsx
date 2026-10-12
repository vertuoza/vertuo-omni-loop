import 'server-only';
import type { Metadata } from 'next';
import { ConceptListScreen } from '../../src/concepts/ConceptList';
import { conceptListState } from '../../src/concepts/list';
import { dossierSession } from '../../src/dossier/page/route-gate';
import { serverEnv } from '../../src/env';

// /concepts (PRD 1272, s2): every concept of the signed-in person's workspaces, newest first
// (src/concepts/list.ts), read per request as the signed-in person, so row-level security decides.
// Without a database it plays the demo, which holds no concept: the page shows how to start one.

export const metadata: Metadata = { title: 'Concepts · OMNI LOOP' };

export default async function ConceptsRoute() {
  return <ConceptListScreen state={await conceptListState(serverEnv().mode, dossierSession)} />;
}
