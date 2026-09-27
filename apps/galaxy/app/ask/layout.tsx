import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/ask/page/share.css';
import '../../src/ask/page/history.css';
import { AskBar } from '../../src/ask/page/AskBar';
import { ForMeLink } from '../../src/ask/page/ForMe';
import { HistoryLink } from '../../src/ask/page/WorkspaceHistory';
import { forMeCount } from '../../src/ask/page/for-me-live';
import { ThemeScript } from '../../src/ask/theme-script';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';

// Every /ask page: a reading surface apart from the arcade. The tokens come first as CSS custom
// properties; the theme script is the ask root's first child, so it marks the root with the stored
// theme before anything in it is parsed, and before the first paint. The faces, all from
// @omni/design's fonts.css and served from this origin: Atkinson Hyperlegible Next to read,
// JetBrains Mono for previews, and the pixel face for the wordmark only. The header (AskBar) links to
// the workspace's History and to For me (PRD 144), with how many questions a teammate shared that
// still wait for the person looking; its OMNI LOOP mark leads to /app, and it ends with Game mode
// (PRD 238).

export const metadata: Metadata = {
  title: 'Ask · OMNI LOOP',
  description: 'Claude’s questions, on a page made for reading.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: TOKENS.light.ground },
    { media: '(prefers-color-scheme: dark)', color: TOKENS.dark.ground },
  ],
  colorScheme: 'light dark',
};

export default async function AskLayout({ children }: { children: React.ReactNode }) {
  const waiting = await forMeCount(Date.now());
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <AskBar>
          <HistoryLink />
          <ForMeLink count={waiting ?? 0} />
        </AskBar>
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}
