// The top bar's menu (PRD 346): what every page of the normal app reaches, whatever section it is in.
// The person's own sections stay as cards on /app (src/switch/switch.ts's SECTIONS). A new menu item
// is one entry here. PRDs comes first since PRD 413: every page reaches the PRD list at /prd.

/** One item of the top bar's menu. */
export interface MenuItem {
  /** What a page passes as `current` to mark this item as the one being shown. */
  id: 'prds' | 'releases' | 'docs';
  label: string;
  /** The page the item opens, from the site's root. */
  path: string;
}

export type MenuId = MenuItem['id'];

/** The menu, in order. */
export const MENU: readonly MenuItem[] = [
  { id: 'prds', label: 'PRDs', path: '/prd' },
  { id: 'releases', label: 'Release notes', path: '/releases' },
  { id: 'docs', label: 'Docs', path: '/docs' },
];
