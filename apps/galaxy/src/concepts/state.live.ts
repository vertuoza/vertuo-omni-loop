import 'server-only';
import { after } from 'next/server';
import { serviceDb } from '../data/sign-in-live';
import type { ConceptFacts } from '../dossier/github/fix';
import type { FixRef } from '../dossier/github/reader';
import { dossierGithub } from '../dossier/github/server';
import { conceptFacts } from '../dossier/page/fix-facts';
import type { Db } from '../dossier/page/source';
import { mergeConceptFacts } from '../fixes/facts/refresh';
import { conceptFactsStore } from '../fixes/facts/store';

// A concept's facts on its page (PRD 1272, s4), as a fix's page reads its own (../dossier/page/fix-facts.ts):
// the stored ones, read as the viewer, at once, refreshed after the response while the concept PR has not
// merged; with none stored, one interactive read through the server's reader, stored after. What the page
// read is written back as the service role, each part it could not read kept as stored. Any failure is
// logged and leaves the facts as they were, or none: the page renders whatever happens.

/** A concept dossier whose facts are read: numbered by its issue, in its workspace. */
export type ConceptDossier = FixRef & { workspace_id: string };

export type ConceptFactsRead = (db: Pick<Db, 'from'>, dossier: ConceptDossier) => Promise<ConceptFacts | null>;

/** Stores what the page read, each part it could not read kept as stored; logs a failure. */
async function keep(dossier: ConceptDossier, read: ConceptFacts): Promise<void> {
  try {
    const store = conceptFactsStore(serviceDb());
    const stored = (await store.readFacts(dossier.workspace_id, [dossier.id])).get(dossier.id) ?? null;
    await store.writeFacts([{ dossier_id: dossier.id, workspace_id: dossier.workspace_id, facts: mergeConceptFacts(stored, read) }]);
  } catch (error) {
    console.error(error);
  }
}

export const liveConceptFacts: ConceptFactsRead = (db, dossier) => {
  const reader = dossierGithub();
  return conceptFacts({
    stored: async () => (await conceptFactsStore(db).readFacts(dossier.workspace_id, [dossier.id])).get(dossier.id) ?? null,
    read: (priority) => (reader ? reader.concept(dossier, { priority }).catch((error: unknown) => {
      console.error(error);
      return null;
    }) : Promise.resolve(null)),
    keep: (facts) => keep(dossier, facts),
    later: (task) => { after(task); },
  });
};
