import type { Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import '../../src/ideas/ideas.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { READING_VIEWPORT } from '../../src/ask/reading-viewport';
import { themeCss } from '../../src/ask/theme-tokens';
import { TopBar } from '../../src/nav/TopBar';
import { IDEAS } from '../../src/ideas/words';

// /ideas/<owner>/<repo> (PRD 1246, s1), public, on the ask pages' reading surface exactly as /releases
// is: their tokens as CSS custom properties, their faces from @omni/design's fonts.css, and their theme
// script as the root's first child, so the stored theme is applied before the first paint. The header
// is the app's one top bar (TopBar), its sub-title Ideas. Each board's title and preview are its page's
// own metadata (./[owner]/[repo]/page.tsx).

export const viewport: Viewport = READING_VIEWPORT;

export default function IdeasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <TopBar sub={IDEAS.sub} />
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}
