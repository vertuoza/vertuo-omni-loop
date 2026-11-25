// The rows of section tabs (PRD 733): the pages a menu entry opens, one tab each. Questions opens Open
// questions, Shared with me and History (Settings has no tabs since omni-loop-27: its layout draws
// the grouped navigation from the settings map). The tab rows are drawn by SectionTabs.tsx; the counts are the ones the menu's badges carried (PRD 499).

/** One tab: a link to its page, and how many things wait there (shown only above 0). */
export type SectionTab = { href: string; label: string; count?: number };

export const QUESTIONS_TABS: readonly SectionTab[] = [
  { href: '/app/inbox', label: 'Open questions' },
  { href: '/app/inbox?from=shared', label: 'Shared with me' },
  { href: '/app/inbox/done', label: 'History' },
];

/** The Questions tabs with their waiting counts: every open question the person may answer, less
 * the ones shared with them, on Open questions; the shared ones on Shared with me. */
export function withCounts(tabs: readonly SectionTab[], { questions, shared }: { questions: number; shared: number }): SectionTab[] {
  const counts: Record<string, number> = { '/app/inbox': Math.max(0, questions - shared), '/app/inbox?from=shared': shared };
  return tabs.map((tab) => {
    const count = counts[tab.href];
    return count === undefined ? tab : { ...tab, count };
  });
}

/** A count as the tab shows it: only above 0. */
export const shownCount = (tab: SectionTab): number | null => (tab.count && tab.count > 0 ? tab.count : null);

/** A tab's accessible name when it shows a count, as the menu says its badges; otherwise its text. */
export const spokenTab = (tab: SectionTab): string | undefined => {
  const count = shownCount(tab);
  return count === null ? undefined : `${tab.label}: ${count} waiting`;
};
