// The app's sidebar (PRD 438): where a person can go from any app page (/app, /prd, /ask,
// /knowledge). The Work group holds the workspace's work, the Omni group Omni's own pages, which
// leave the app for the public ones. A new section is one entry here. Two pure reads of a path: the
// item it falls under, by the longest matching path (so /app/fleets is Fleets, not Home), and the top
// bar's title, a nested item's parent first. The query and the hash never count. An item that counts
// what waits for the person (PRD 499) carries its count as a badge, none at 0.
import type { WaitingCounts } from '../waiting/waiting';

export type SidebarId = 'home' | 'prds' | 'questions' | 'for-me' | 'history' | 'knowledge' | 'fleets' | 'docs' | 'releases';

/** One item of the sidebar. */
export interface SidebarItem {
  id: SidebarId;
  label: string;
  /** The page the item opens, from the site's root. */
  path: string;
  /** The items nested under it, in order. */
  children?: readonly SidebarItem[];
  /** It opens one of Omni's public pages, outside the app. */
  leavesApp?: boolean;
}

export interface SidebarGroup {
  id: 'work' | 'omni';
  label: string;
  items: readonly SidebarItem[];
}

/** The sidebar, in order. */
export const SIDEBAR: readonly SidebarGroup[] = [
  {
    id: 'work',
    label: 'Work',
    items: [
      { id: 'home', label: 'Home', path: '/app' },
      { id: 'prds', label: 'PRDs', path: '/prd' },
      {
        id: 'questions',
        label: 'Questions',
        path: '/ask',
        children: [
          { id: 'for-me', label: 'Shared with me', path: '/ask/for-me' },
          { id: 'history', label: 'History', path: '/ask/history' },
        ],
      },
      { id: 'knowledge', label: 'Knowledge', path: '/knowledge' },
      { id: 'fleets', label: 'Fleets', path: '/app/fleets' },
    ],
  },
  {
    id: 'omni',
    label: 'Omni',
    items: [
      { id: 'docs', label: 'Docs', path: '/docs', leavesApp: true },
      { id: 'releases', label: 'Release notes', path: '/releases', leavesApp: true },
    ],
  },
];

type Entry = { item: SidebarItem; parent: SidebarItem | null };

const ENTRIES: readonly Entry[] = SIDEBAR.flatMap((group) =>
  group.items.flatMap((item) => [{ item, parent: null }, ...(item.children ?? []).map((child) => ({ item: child, parent: item }))]),
);

const bare = (pathname: string) => pathname.split(/[?#]/)[0].replace(/(.)\/+$/, '$1');

function entryOf(pathname: string | null | undefined): Entry | null {
  if (!pathname) return null;
  const path = bare(pathname);
  let best: Entry | null = null;
  for (const entry of ENTRIES) {
    const p = entry.item.path;
    if ((path === p || path.startsWith(`${p}/`)) && (!best || p.length > best.item.path.length)) best = entry;
  }
  return best;
}

/** The id of the item the path falls under, or null when it falls under none. */
export function currentItem(pathname: string | null | undefined): SidebarId | null {
  return entryOf(pathname)?.item.id ?? null;
}

/** The top bar's title for the path ("Questions / For me"), or null when it falls under no item. */
export function pageTitle(pathname: string | null | undefined): string | null {
  const entry = entryOf(pathname);
  if (!entry) return null;
  return entry.parent ? `${entry.parent.label} / ${entry.item.label}` : entry.item.label;
}

/** The badge an item carries: Questions the Questions part, Shared with me the shared questions, PRDs
 * the Outbox part; null at 0, and for an item that counts nothing. */
export function badgeOf(id: SidebarId, counts: WaitingCounts): number | null {
  const count = id === 'questions' ? counts.questions : id === 'for-me' ? counts.shared : id === 'prds' ? counts.outbox : 0;
  return count > 0 ? count : null;
}
