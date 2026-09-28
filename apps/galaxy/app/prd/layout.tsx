import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/ask/page/share.css';
import '../../src/dossier/page/dossier.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';
import { TopBar } from '../../src/nav/TopBar';

// Every /prd page (PRD 216): the ask pages' reading surface, apart from the arcade. Their tokens come
// first as CSS custom properties; their theme script is the root's first child, so it marks the root
// with the stored theme before anything in it is parsed, and before the first paint; their switch
// offers Omni, Light and Dark. Their faces, from @omni/design's fonts.css, served from this origin.
// The header is the app's one top bar (TopBar, PRD 346), its menu's PRDs marked current (PRD 413),
// which replaced the "All PRDs" extra. The before/after page's sandboxed route is a
// route handler: no layout wraps it.

export const metadata: Metadata = {
  title: 'PRD · OMNI LOOP',
  description: 'A PRD’s dossier: its before/after page, its spec, its plan and every version of each.',
  robots: { index: false, follow: false },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default function DossierLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <TopBar sub="PRD dossier" current="prds" />
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}
