import type { ReactNode } from 'react';
import { ThemeScript } from '../ask/theme-script';
import { themeCss } from '../ask/theme-tokens';
import { AppShell } from '../nav/AppShell';
import { TopBar } from '../nav/TopBar';
import type { ViewerView } from '../nav/viewer-view';
import { IDEAS } from './words';

// The frame around an ideas board (issue 1996). A signed-in person reaches it from Work › Ideas, so it
// stays inside the app shell (PRD 438), the sidebar with Ideas marked current, as every other Work page.
// A visitor on a shared link keeps the public page, on the ask pages' reading surface as /releases: their
// tokens, their theme script as the root's first child, and the app's one top bar, its sub-title Ideas.

export function IdeasFrame({ viewer, children }: { viewer: ViewerView; children: ReactNode }) {
  if (viewer.signedIn) return <AppShell viewer={viewer}>{children}</AppShell>;
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
