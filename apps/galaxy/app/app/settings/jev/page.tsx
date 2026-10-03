import type { Metadata } from 'next';
import '../../../../src/jev/settings/jev.css';
import { memberSession } from '../../../../src/data/member-session';
import { loadJevPage } from '../../../../src/jev/settings/load';
import { JevScreen, type JevScreenView } from '../../../../src/jev/settings/JevScreen';
import { masterKey } from '../../../../src/jev/secret-box';
import { saveJevDecision } from './actions';
import { serverEnv } from '../../../../src/env';

// /app/settings/jev (PRD 812 s1): the workspace's Jev settings, under the app's shared top bar
// (app/app/layout.tsx). Its owner switches Jev on with a TypeSafe key, tested with one call and saved
// only then, through /api/jev/key; every other member reads whether Jev is on, never the key. Without
// SECRETS_MASTER_KEY the page says Jev is not available here. Rendered per request, as the signed-in
// person. In development (or OMNI_LOOP_DEMO=1), the demo: an owner with no key, whose changes stay in
// the page. Each decision's row carries its record over the last 30 days (PRD 812 s4).

export const metadata: Metadata = { title: 'Jev · OMNI LOOP' };

async function viewOf(): Promise<JevScreenView> {
  const session = await memberSession();
  if (session.kind === 'demo') {
    return { kind: 'jev', source: { kind: 'demo' }, owner: true, keyStatus: { stored: false, lastFour: null, setAt: null }, decisions: [] };
  }
  if (session.kind !== 'signed-in') return session;
  const load = await loadJevPage(session.db, session.user);
  if (load.kind !== 'jev') return load;
  if (!masterKey(serverEnv().secretsMasterKey)) return { kind: 'unavailable' };
  return {
    kind: 'jev',
    source: { kind: 'database', workspace: load.workspace.id, saveDecision: saveJevDecision },
    owner: load.owner,
    keyStatus: load.keyStatus,
    decisions: load.decisions,
    records: load.records,
  };
}

export default async function JevRoute() {
  return <JevScreen view={await viewOf()} />;
}
