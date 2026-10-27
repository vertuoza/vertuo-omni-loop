import 'server-only';
import type { Metadata } from 'next';
import '../../../../src/omni-settings/omni-settings.css';
import { memberSession } from '../../../../src/data/member-session';
import { loadSettingsPage } from '../../../../src/omni-settings/load';
import { settingsPagesFor } from '../../../../src/omni-settings/omni-settings-pages-live';
import { PlaybookScreen, playbookScreenOf, type PlaybookScreenView } from '../../../../src/omni-settings/PlaybookScreen';

// /app/settings/playbook (PRD 2417 s6): the workspace's settings repository's tech playbook, page by
// page, each page's text and whether it is the settings repository's own file or the kit's first
// default, under the app's shared top bar (app/app/layout.tsx). Any member reads it; its owner also
// proposes a change to a page, which opens a pull request in the settings repository (s7, through
// /api/omni-settings/proposal); nothing is stored here. Rendered per request, as the signed-in person,
// so row-level security decides which workspace is read; the repository's files are read as the Omni
// app, server side only. In development (or OMNI_LOOP_DEMO=1), the demo, seen as an owner: one page of
// the settings repository's own and one still on the kit's first default, whose edit opens nothing, and
// the Settings repository line starting in "Plan repository by default" (PRD 2543 s3), kept in memory.

export const metadata: Metadata = { title: 'Playbook · OMNI LOOP' };

const DEMO: PlaybookScreenView = {
  kind: 'playbook',
  editing: { kind: 'demo' },
  repository: 'acme/plans',
  commit: '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4',
  reason: null,
  // As an owner who has not chosen yet: the plan repository is the default, and Keep it stores it in memory.
  choice: { chosen: null, plan: 'acme/plans', listed: ['acme/app', 'acme/plans', 'acme/playbook'] },
  pages: [
    {
      form: 'review', source: 'settings',
      text: '---\nform: review\n---\n\n# Review\n\n## Fix\nFix a comment that is right and cheap to act on.\n\n## Push back\nSay why, in one line, when the comment is wrong.\n\n## Ask\nAsk a person when the comment is a product decision.',
    },
    {
      form: 'definition-of-done', source: 'kit',
      text: '---\nform: definition-of-done\n---\n\n# Definition of done\n\n## Done means\nThe change is tested, reviewed and merged by a person.',
    },
  ],
};

async function viewOf(): Promise<PlaybookScreenView> {
  const session = await memberSession();
  if (session.kind === 'demo') return DEMO;
  if (session.kind !== 'signed-in') return session;
  return playbookScreenOf(await loadSettingsPage(session.db, session.user, settingsPagesFor(session.db)));
}

export default async function PlaybookRoute() {
  return <PlaybookScreen view={await viewOf()} />;
}
