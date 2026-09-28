import type { ReactNode } from 'react';
import { ThemeScript } from '../ask/theme-script';
import { themeCss } from '../ask/theme-tokens';
import { AppBar } from './AppBar.tsx';
import { DrawerProvider } from './drawer-context';
import { Sidebar } from './Sidebar.tsx';
import type { ViewerView } from './viewer-view';

// The one layout wrapper of the app's pages, /app, /prd, /ask and /knowledge (PRD 438), in order: the
// ask pages' tokens as CSS custom properties; the ask root, its theme script its first child, so the
// stored theme is applied before the first paint; the sidebar; the top bar; then the page. The
// layouts read the viewer and hand it here; a page's own stylesheet rules go in `css`, its own
// classes on the root in `className`. The sidebar and the top bar share the phone drawer: below
// 900 px the bar's ☰ opens the sidebar over the page.

export interface AppShellProps {
  viewer: ViewerView;
  children: ReactNode;
  /** More CSS after the tokens (the knowledge kinds' colours). */
  css?: string;
  /** The page's own classes on the ask root. */
  className?: string;
}

export function AppShell({ viewer, children, css, className }: AppShellProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css ? `${themeCss()}\n${css}` : themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className={['ask app-shell', className].filter(Boolean).join(' ')} suppressHydrationWarning>
        <ThemeScript />
        <DrawerProvider>
          <Sidebar viewer={viewer} />
          <AppBar viewer={viewer} />
        </DrawerProvider>
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}
