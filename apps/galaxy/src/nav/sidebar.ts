// The app's sidebar (PRD 438): where a person can go from any app page (/app, /prd, /ask,
// /knowledge). Since PRD 572 it has three groups, then Omni: Dashboard (the boards: Home, your
// fleet's, the workspace's, and since PRD 612 Engineering's, at /app/engineering), Work (the workspace's
// work: PRDs, then, since PRD 627, Bug Fixes and Visual Updates, then Questions and Knowledge), Settings
// (Fleets, at /app/settings/fleets; and Repositories, at /app/settings/repositories, since PRD 612),
// and Omni's own pages, which leave the app for the public ones. Since issue 653 each Dashboard and Work
// section names its sprite. A new section is one entry here. Two
// pure reads of a path: the item it falls under, by the longest matching path (so
// /app/settings/fleets is Fleets and /app/fleet is Fleet, not Home), and the top
// bar's trail (issue 704): the group, a nested item's parent, then the item, with the section's sprite.
// The query and the hash never count. An item that counts
// what waits for the person (PRD 499) carries its count as a badge, none at 0.
import type { WaitingCounts } from '../waiting/waiting';

export type SidebarId = 'home' | 'fleet' | 'workspace' | 'engineering' | 'prds' | 'bugs' | 'visual' | 'questions' | 'for-me' | 'history' | 'knowledge' | 'fleets' | 'repositories' | 'docs' | 'releases';

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
  /** The 16×16 sprite of @omni/design drawn before its name (issue 653): Dashboard and Work sections only. */
  sprite?: string;
}

export interface SidebarGroup {
  id: 'dashboard' | 'work' | 'settings' | 'omni';
  label: string;
  items: readonly SidebarItem[];
}

/** The sidebar, in order. */
export const SIDEBAR: readonly SidebarGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    items: [
      { id: 'home', label: 'Home', path: '/app', sprite: 'menu-home' },
      { id: 'fleet', label: 'Fleet', path: '/app/fleet', sprite: 'menu-fleet' },
      { id: 'workspace', label: 'Workspace', path: '/app/workspace', sprite: 'menu-workspace' },
      { id: 'engineering', label: 'Engineering', path: '/app/engineering', sprite: 'menu-engineering' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      { id: 'prds', label: 'PRDs', path: '/prd', sprite: 'menu-prds' },
      { id: 'bugs', label: 'Bug Fixes', path: '/bugs', sprite: 'menu-bugs' },
      { id: 'visual', label: 'Visual Updates', path: '/visual', sprite: 'menu-visual' },
      {
        id: 'questions',
        label: 'Questions',
        path: '/ask',
        sprite: 'menu-questions',
        children: [
          { id: 'for-me', label: 'Shared with me', path: '/ask/for-me' },
          { id: 'history', label: 'History', path: '/ask/history' },
        ],
      },
      { id: 'knowledge', label: 'Knowledge', path: '/knowledge', sprite: 'menu-knowledge' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'fleets', label: 'Fleets', path: '/app/settings/fleets' },
      { id: 'repositories', label: 'Repositories', path: '/app/settings/repositories' },
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

type Entry = { item: SidebarItem; parent: SidebarItem | null; group: SidebarGroup };

const ENTRIES: readonly Entry[] = SIDEBAR.flatMap((group) =>
  group.items.flatMap((item) => [{ item, parent: null, group }, ...(item.children ?? []).map((child) => ({ item: child, parent: item, group }))]),
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

/** One step of the top bar's trail: a link back to its page, or none for a group and the page itself. */
export interface Crumb {
  label: string;
  path?: string;
}

/** The top bar's trail (issue 704): the crumbs, and the sprite of the section the path falls under. */
export interface Trail {
  crumbs: readonly Crumb[];
  sprite: string | null;
}

/** The top bar's trail for the path ("Work › Questions › Shared with me"), or null when it falls under
 * no item. A group has no page to link; the item links back only from a page under it. */
export function pageTrail(pathname: string | null | undefined): Trail | null {
  const entry = entryOf(pathname);
  if (!entry) return null;
  const { item, parent, group } = entry;
  const here = bare(pathname!) === item.path;
  return {
    crumbs: [
      { label: group.label },
      ...(parent ? [{ label: parent.label, path: parent.path }] : []),
      here ? { label: item.label } : { label: item.label, path: item.path },
    ],
    sprite: (parent ?? item).sprite ?? null,
  };
}

/** The badge an item carries: Questions the Questions part, Shared with me the shared questions, PRDs
 * the Outbox part; null at 0, and for an item that counts nothing. */
export function badgeOf(id: SidebarId, counts: WaitingCounts): number | null {
  const count = id === 'questions' ? counts.questions : id === 'for-me' ? counts.shared : id === 'prds' ? counts.outbox : 0;
  return count > 0 ? count : null;
}
