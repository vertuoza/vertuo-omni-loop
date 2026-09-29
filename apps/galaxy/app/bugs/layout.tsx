import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/ask/page/share.css';
import '../../src/dossier/page/dossier.css';
import { TOKENS } from '../../src/ask/theme-tokens';
import { AppShell } from '../../src/nav/AppShell';
import { viewerLive } from '../../src/nav/viewer';

// Every /bugs page (PRD 627), as every /prd page (PRD 216): the ask pages' reading surface, apart from the arcade. Their tokens come
// first as CSS custom properties; their theme script is the root's first child, so it marks the root
// with the stored theme before anything in it is parsed, and before the first paint; their switch
// offers Omni, Light and Dark. Their faces, from @omni/design's fonts.css, served from this origin.
// They sit inside the app shell (PRD 438): the sidebar, Bug Fixes marked current, and the top bar. The
// before/after page's sandboxed route is a route handler: no layout wraps it.

export const metadata: Metadata = {
  title: 'Bug Fixes · OMNI LOOP',
  description: 'A bug fix: its bug record.',
  robots: { index: false, follow: false },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default async function FixLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()}>{children}</AppShell>;
}
