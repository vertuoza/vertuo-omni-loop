import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/ask/page/share.css';
import '../../src/ask/page/history.css';
import { TOKENS } from '../../src/ask/theme-tokens';

// Every /ask page: a reading surface apart from the arcade. The tokens come first as CSS custom
// properties; the theme script is the ask root's first child, so it marks the root with the stored
// theme before anything in it is parsed, and before the first paint. The faces, all from
// @omni/design's fonts.css and served from this origin: Atkinson Hyperlegible Next to read,
// JetBrains Mono for previews, and the pixel face for the wordmark only. The frame is the route
// group's (PRD 1705): (shell)/layout.tsx puts the Questions pages inside the app shell (PRD 438), and
// (doorway)/layout.tsx puts the two terminal sign-ins, /ask/signin and /ask/device, in the doorway,
// with no part of the app around them.

export const metadata: Metadata = {
  title: 'Ask · OMNI LOOP',
  description: 'Your agent’s questions, on a page made for reading.',
  robots: { index: false, follow: false },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
