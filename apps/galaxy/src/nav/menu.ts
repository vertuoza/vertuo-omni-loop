// The public bar's menu (PRD 346, reshaped by PRD 438): Omni's own pages, on /docs and /releases.
// The workspace's work (PRDs, Questions, Knowledge, Fleets) lives in the app's sidebar (sidebar.ts),
// so PRDs, which PRD 413 put first here, left this menu. A new Omni page is one entry here.

/** One item of the public bar's menu. */
export interface MenuItem {
  /** What a page passes as `current` to mark this item as the one being shown. */
  id: 'releases' | 'docs';
  label: string;
  /** The page the item opens, from the site's root. */
  path: string;
}

export type MenuId = MenuItem['id'];

/** The menu, in order. */
export const MENU: readonly MenuItem[] = [
  { id: 'releases', label: 'Release notes', path: '/releases' },
  { id: 'docs', label: 'Docs', path: '/docs' },
];
