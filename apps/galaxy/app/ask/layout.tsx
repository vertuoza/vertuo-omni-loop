import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/ask/page/share.css';
import '../../src/ask/page/history.css';
import { TOKENS } from '../../src/ask/theme-tokens';
import { AppShell } from '../../src/nav/AppShell';
import { viewerLive } from '../../src/nav/viewer';

// Every /ask page: a reading surface apart from the arcade. The tokens come first as CSS custom
// properties; the theme script is the ask root's first child, so it marks the root with the stored
// theme before anything in it is parsed, and before the first paint. The faces, all from
// @omni/design's fonts.css and served from this origin: Atkinson Hyperlegible Next to read,
// JetBrains Mono for previews, and the pixel face for the wordmark only. The page sits inside the app
// shell (PRD 438): the sidebar holds Questions, For me, with how many questions a teammate shared that
// still wait for the person looking, and History (PRD 144); the top bar the page's title, the theme
// switch and Game mode.

export const metadata: Metadata = {
  title: 'Ask · OMNI LOOP',
  description: 'Claude’s questions, on a page made for reading.',
  robots: { index: false, follow: false },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default async function AskLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()}>{children}</AppShell>;
}
