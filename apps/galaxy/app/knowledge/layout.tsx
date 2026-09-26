import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/knowledge/knowledge.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';
import { kindCss } from '../../src/knowledge/kinds';

// The knowledge map (PRD 149), on the ask pages' reading surface: their tokens as CSS custom
// properties (and each kind's colour from them), their faces (from @omni/design's fonts.css, served
// from this origin), and their theme script as the root's
// first child, so the stored theme is applied before the first paint. The page draws its own top bar,
// which names the repository it reads.

export const metadata: Metadata = {
  title: 'Knowledge map · OMNI LOOP',
  description: 'The knowledge base as a map: every principle, rule and invariant, and what serves what.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: TOKENS.light.ground },
    { media: '(prefers-color-scheme: dark)', color: TOKENS.dark.ground },
  ],
  colorScheme: 'light dark',
};

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${themeCss()}\n${kindCss()}` }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask km-root" suppressHydrationWarning>
        <ThemeScript />
        {children}
      </div>
    </>
  );
}
