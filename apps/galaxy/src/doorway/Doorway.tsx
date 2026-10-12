import type { ReactNode } from 'react';
import { logoSvg, OMNI_LOOP } from '@omni/design';
import { ThemeScript } from '../ask/theme-script';
import { themeCss } from '../ask/theme-tokens';
import { CREST_FORM, starfieldSvg } from '../home/poster/art';
import './doorway.css';

// The doorway (PRD 1705; the `doorway` screen and its mockup): the frame of the pages a person meets
// before they are inside the app, /ask/device, /ask/signin and /signup. In order: the ask pages'
// tokens as CSS custom properties; the ask root, its theme script its first child, so the stored theme
// is applied before the first paint; HOME's starfield behind everything (hidden under Light, by
// doorway.css); then the column: the crest's full form linking to HOME, the page's card, and a Docs
// link. No sidebar, no top bar, no theme switch. It reads no session: someone at a doorway may not be
// signed in yet.

/** The crest's full form at 3×; doorway.css draws it at 2× below 900 px. */
const MARK = logoSvg(CREST_FORM, { scale: 3, title: OMNI_LOOP.name });

export function Doorway({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask doorway" suppressHydrationWarning>
        <ThemeScript />
        <div className="doorway-stars" aria-hidden="true" dangerouslySetInnerHTML={{ __html: starfieldSvg() }} />
        <main className="ask-main doorway-main">
          <a className="doorway-mark" href="/" dangerouslySetInnerHTML={{ __html: MARK }} />
          <div className="doorway-card">{children}</div>
          <p className="doorway-foot"><a href="/docs">Docs</a></p>
        </main>
      </div>
    </>
  );
}
