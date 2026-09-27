import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/ask/page/share.css';
import '../../src/dossier/page/dossier.css';
import { HISTORY_PATH } from '../../src/dossier/page/history';
import { ThemeScript } from '../../src/ask/theme-script';
import { ThemeSwitch } from '../../src/ask/theme-switch';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';

// Every /prd page (PRD 216): the ask pages' reading surface, apart from the arcade. Their tokens come
// first as CSS custom properties; their theme script is the root's first child, so it marks the root
// with the stored theme before anything in it is parsed, and before the first paint; their switch
// offers system, light and dark. Their faces, from @omni/design's fonts.css, served from this origin.
// The header links to /prd, every PRD of the workspace. The before/after page's sandboxed route is a
// route handler: no layout wraps it.

export const metadata: Metadata = {
  title: 'PRD · OMNI LOOP',
  description: 'A PRD’s dossier: its before/after page, its spec, its plan and every version of each.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: TOKENS.light.ground },
    { media: '(prefers-color-scheme: dark)', color: TOKENS.dark.ground },
  ],
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
        <header className="ask-bar">
          <span className="ask-brand">
            <span className="ask-mark">OMNI LOOP</span>
            <span className="ask-brand-sub">PRD dossier</span>
          </span>
          <span className="ask-bar-end">
            <a className="ask-for-me-nav" href={HISTORY_PATH}>All PRDs</a>
            <ThemeSwitch />
          </span>
        </header>
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}
