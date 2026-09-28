import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/docs/docs.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';
import { TopBar } from '../../src/nav/TopBar';

// /docs, the guide (PRD 346): public, indexed, and built statically, on the ask pages' reading surface
// exactly as /app and /releases are: their tokens as CSS custom properties, their faces from
// @omni/design's fonts.css, and their theme script as the root's first child, so the stored theme is
// applied before the first paint. The header is the app's one top bar, with Docs marked current.

export const metadata: Metadata = {
  title: { default: 'Docs · OMNI LOOP', template: '%s · Docs · OMNI LOOP' },
  description: 'How to start with Omni Loop: install it, invade a repository, and ship a first PRD.',
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <TopBar sub="Docs" current="docs" />
        <main className="ask-main docs-main">{children}</main>
      </div>
    </>
  );
}
