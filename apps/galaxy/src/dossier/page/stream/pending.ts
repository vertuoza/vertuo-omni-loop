import type { DossierView } from '../view';

// A PRD's page before GitHub has answered (PRD 657 s4): everything read from the database (the
// header, the stored stage, the tabs, the shown version, the questions) as it will stay, and the parts
// only GitHub knows (the Outbox and Retro tabs, their badges, the stage's GitHub links) saying they are
// being read, never "empty" or "could not be read". ./DossierStream.tsx sends it at once and swaps in
// the whole page when the GitHub summary arrives.

export const GITHUB_PENDING = 'Reading GitHub…';

/** The GitHub-owned tabs: their badge counts what GitHub holds. */
const FROM_GITHUB = new Set<DossierView['tabs'][number]['kind']>(['outbox', 'retro']);

/** `view`, drawn without a GitHub summary, with what GitHub owns marked as being read. */
export function pendingView(view: DossierView): DossierView {
  return {
    ...view,
    outbox: { ...view.outbox, state: 'empty', words: GITHUB_PENDING, answerUrl: null, open: [], adopted: [], settled: [], ledger: 0 },
    retro: { state: 'empty', words: GITHUB_PENDING, prUrl: null, text: null },
    tabs: view.tabs.map((tab) => (FROM_GITHUB.has(tab.kind) ? { ...tab, badge: null } : tab)),
    stage: view.stage && { ...view.stage, links: [] },
  };
}
