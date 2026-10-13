import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/ask/page/share.css';
import '../../src/dossier/page/dossier.css';
import { READING_VIEWPORT } from '../../src/ask/reading-viewport';
import { AppShell } from '../../src/nav/AppShell';
import { viewerLive } from '../../src/nav/viewer';

// Every /prd page (PRD 216): the ask pages' reading surface, apart from the arcade. Their tokens come
// first as CSS custom properties; their theme script is the root's first child, so it marks the root
// with the stored theme before anything in it is parsed, and before the first paint; their switch
// offers Omni, Light and Dark. Their faces, from @omni/design's fonts.css, served from this origin.
// They sit inside the app shell (PRD 438): the sidebar, PRDs marked current, and the top bar. The
// before/after page's sandboxed route is a route handler: no layout wraps it.

export const metadata: Metadata = {
  title: 'PRD · OMNI LOOP',
  description: 'A PRD’s dossier: its before/after page, its spec, its plan and every version of each.',
  robots: { index: false, follow: false },
};

// The reading surface's viewport: Omni's ground for the browser's bar (PRD 284), and zoom (bug 1826).
export const viewport: Viewport = READING_VIEWPORT;

export default async function DossierLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()}>{children}</AppShell>;
}
