import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/knowledge/knowledge.css';
import { TOKENS } from '../../src/ask/theme-tokens';
import { kindCss } from '../../src/knowledge/kinds';
import { AppShell } from '../../src/nav/AppShell';
import { viewerLive } from '../../src/nav/viewer';

// The knowledge map (PRD 149), on the ask pages' reading surface: their tokens as CSS custom
// properties (and each kind's colour from them), their faces (from @omni/design's fonts.css, served
// from this origin), and their theme script as the root's
// first child, so the stored theme is applied before the first paint. It sits inside the app shell
// (PRD 438): the sidebar and the top bar; the page names the repository it reads in its own heading.

export const metadata: Metadata = {
  title: 'Knowledge map · OMNI LOOP',
  description: 'The knowledge base as a map: every principle, rule and invariant, and what serves what.',
  robots: { index: false, follow: false },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default async function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()} css={kindCss()} className="km-root">{children}</AppShell>;
}
