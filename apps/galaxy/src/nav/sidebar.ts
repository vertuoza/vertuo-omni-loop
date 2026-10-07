// The app's sidebar (PRD 438): where a person can go from any app page (/app, /prd, /ask,
// /knowledge). Since PRD 733 it has two groups, then the foot: Dashboard (the boards: Home, your
// fleet's, since PRD 1139 the workspace's loops beside it, at /app/loop, the workspace's, and since PRD 612
// Engineering's, at /app/engineering), Work (the workspace's
// work: PRDs, then, since PRD 627, Bug Fixes and Visual Updates, then Questions and Knowledge), and at
// the foot one Settings entry, at /app/settings, which lands on Fleets (SETTINGS_LANDING), then Omni's
// own pages, Docs and Release notes, which leave the app for the public ones. Since issue 653 each
// Dashboard and Work section names its sprite, and since PRD 733 Settings too. A new section is one
// entry here. An entry's pages (Questions' Shared with me and History, Settings' Fleets and
// Repositories) are not menu lines: their pages show them as tabs, and they only fall under the entry.
// Two pure reads of a path: the entry it falls under, by the longest matching path (so /app/fleet is
// Fleet, not Home, and /app/settings/fleets is Settings), and the top bar's trail (issue 704): the
// group (the foot has none), the entry, then the page, with the entry's sprite. The query and the hash
// never count. An entry that counts what waits for the person (PRD 499) carries its count as a badge,
// none at 0.
import { at, defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { WaitingCounts } from '../waiting/waiting';

export type SidebarId = 'home' | 'fleet' | 'loop' | 'workspace' | 'engineering' | 'prds' | 'bugs' | 'visual' | 'questions' | 'knowledge' | 'settings' | 'docs' | 'releases';

/** A page under an entry, shown as a tab on its pages, never as a menu line (PRD 733). */
export interface SidebarPage {
  label: string;
  /** The page's address, from the site's root. */
  path: string;
}

/** One entry of the sidebar. */
export interface SidebarItem {
  id: SidebarId;
  label: string;
  /** The page the entry opens, from the site's root. */
  path: string;
  /** The pages that fall under it, in order: the trail names them, the menu does not. */
  pages?: readonly SidebarPage[];
  /** It opens one of Omni's public pages, outside the app. */
  leavesApp?: boolean;
  /** The 16×16 sprite of @omni/design drawn before its name (issue 653): every entry but Omni's. */
  sprite?: string;
}

export interface SidebarGroup {
  id: 'dashboard' | 'work';
  label: string;
  items: readonly SidebarItem[];
}

/** The sidebar's two groups, in order. */
export const SIDEBAR: readonly SidebarGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    items: [
      { id: 'home', label: 'Home', path: '/app', sprite: 'menu-home' },
      { id: 'fleet', label: 'Fleet', path: '/app/fleet', sprite: 'menu-fleet' },
      { id: 'loop', label: 'Loop', path: '/app/loop', sprite: 'menu-loop' },
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
        pages: [
          { label: 'Shared with me', path: '/ask/for-me' },
          { label: 'History', path: '/ask/history' },
        ],
      },
      { id: 'knowledge', label: 'Knowledge', path: '/knowledge', sprite: 'menu-knowledge' },
    ],
  },
];

/** Where /app/settings lands (PRD 733): its Fleets page. */
export const SETTINGS_LANDING = '/app/settings/fleets';

/** The foot's Settings entry (PRD 733), above Docs and Release notes. */
export const SETTINGS: SidebarItem = {
  id: 'settings',
  label: 'Settings',
  path: '/app/settings',
  sprite: 'menu-settings',
  pages: [
    { label: 'Fleets', path: SETTINGS_LANDING },
    { label: 'Repositories', path: '/app/settings/repositories' },
    { label: 'Business', path: '/app/settings/business' },
    { label: 'Products', path: '/app/settings/products' },
    { label: 'Jev', path: '/app/settings/jev' },
  ],
};

/** Omni's own pages, in the foot's unlabelled row: they leave the app. */
export const OMNI: readonly SidebarItem[] = [
  { id: 'docs', label: 'Docs', path: '/docs', leavesApp: true },
  { id: 'releases', label: 'Release notes', path: '/releases', leavesApp: true },
];

type Entry = { item: SidebarItem; page: SidebarPage | null; group: SidebarGroup | null; path: string };

const ENTRIES: readonly Entry[] = [
  ...SIDEBAR.flatMap((group) => group.items.map((item) => ({ item, group }))),
  ...[SETTINGS, ...OMNI].map((item) => ({ item, group: null })),
].flatMap(({ item, group }) => [
  { item, page: null, group, path: item.path },
  ...(item.pages ?? []).map((page) => ({ item, page, group, path: page.path })),
]);

const bare = (pathname: string) => at(pathname.split(/[?#]/), 0, 'the path').replace(/(.)\/+$/, '$1');

function entryOf(pathname: string | null | undefined): Entry | null {
  if (!pathname) return null;
  const path = bare(pathname);
  let best: Entry | null = null;
  for (const entry of ENTRIES) {
    const p = entry.path;
    if ((path === p || path.startsWith(`${p}/`)) && (!best || p.length > best.path.length)) best = entry;
  }
  return best;
}

/** The id of the entry the path falls under, or null when it falls under none. */
export function currentItem(pathname: string | null | undefined): SidebarId | null {
  return entryOf(pathname)?.item.id ?? null;
}

/** One step of the top bar's trail: a link back to its page, or none for a group and the page itself. */
export interface Crumb {
  label: string;
  path?: string;
}

/** The top bar's trail (issue 704): the crumbs, and the sprite of the entry the path falls under. */
export interface Trail {
  crumbs: readonly Crumb[];
  sprite: string | null;
}

/** The top bar's trail for the path ("Work › Questions › Shared with me", "Settings › Fleets"), or null
 * when it falls under no entry. A group has no page to link; the entry and its page each link back only
 * from a page under them. */
export function pageTrail(pathname: string | null | undefined): Trail | null {
  const entry = entryOf(pathname);
  if (!entry) return null;
  const { item, page, group } = entry;
  const here = bare(defined(pathname, 'the path')) === entry.path;
  const last = page ?? item;
  return {
    crumbs: [
      ...(group ? [{ label: group.label }] : []),
      ...(page ? [{ label: item.label, path: item.path }] : []),
      here ? { label: last.label } : { label: last.label, path: last.path },
    ],
    sprite: item.sprite ?? null,
  };
}

/** The badge an entry carries: Questions the Questions part, the shared ones included, PRDs the Outbox
 * part; null at 0, and for an entry that counts nothing. */
export function badgeOf(id: SidebarId, counts: WaitingCounts): number | null {
  const count = id === 'questions' ? counts.questions : id === 'prds' ? counts.outbox : 0;
  return count > 0 ? count : null;
}
