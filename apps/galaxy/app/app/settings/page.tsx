import 'server-only';
import type { Metadata } from 'next';
import { memberSession } from '../../../src/data/member-session';
import { memberWorkspace } from '../../../src/data/workspace';
import { SettingsHomeStreamed } from '../../../src/settings-home/SettingsHome';
import { settingsStatusOf } from '../../../src/settings-home/settings-status.service';

// /app/settings, the menu's Settings entry (omni-loop-32 s4): the settings home, every group and page of
// the settings map as a card. The page awaits nothing: the status read starts here and streams behind a
// Suspense, so the first paint holds the cards and the chips arrive after. A read that fails, the demo and
// a person with no workspace have no chip. The old landing, SETTINGS_LANDING (the Fleets page), still answers.

export const metadata: Metadata = { title: 'Settings · OMNI LOOP' };

async function statusOf() {
  const session = await memberSession();
  if (session.kind !== 'signed-in') return {};
  const workspace = await memberWorkspace(session.db, session.user.id);
  return workspace ? settingsStatusOf(session.db, workspace.id) : {};
}

export default function SettingsPage() {
  return <SettingsHomeStreamed status={statusOf()} />;
}
