import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import { READING_VIEWPORT } from '../../src/ask/reading-viewport';
import { AppShell } from '../../src/nav/AppShell';
import { viewerLive } from '../../src/nav/viewer';

// Every /roadmaps page (PRD 1162), as every /bugs page: the ask pages' reading surface, apart from the
// arcade, inside the app shell (PRD 438): the sidebar, Roadmaps marked current, and the top bar.

export const metadata: Metadata = {
  title: 'Roadmaps · OMNI LOOP',
  description: 'The roadmaps of the workspace: each milestone, the PRDs that deliver it and what blocks them.',
  robots: { index: false, follow: false },
};

// The reading surface's viewport: Omni's ground for the browser's bar (PRD 284), and zoom (bug 1826).
export const viewport: Viewport = READING_VIEWPORT;

export default async function RoadmapsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()}>{children}</AppShell>;
}
