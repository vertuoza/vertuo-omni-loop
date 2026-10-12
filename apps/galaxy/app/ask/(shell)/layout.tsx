import { AppShell } from '../../../src/nav/AppShell';
import { viewerLive } from '../../../src/nav/viewer';

// The Questions pages, /ask, /ask/for-me, /ask/history, /ask/q/<round> and a shared /ask/<session>,
// inside the app shell (PRD 438): the sidebar holds Questions, with how many questions wait for the
// person looking; each page but a single question starts with the Questions tabs, Open questions ·
// Shared with me · History (PRD 733); the top bar the page's title, the theme switch and Game mode.
// A new /ask page lands here unless it is put in the doorway on purpose (PRD 1705).

export default async function AskShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()}>{children}</AppShell>;
}
