// The app's sidebar (PRD 438): where a person can go from any app page (/app, /prd, /ask, /knowledge).
// Since omni-loop-22 it opens on Inbox (/app/inbox, no group label: everything that waits on the person;
// its Done and Workspace pages, and the question rounds under /ask, fall under it), then two groups, then
// the foot. Dashboard: the boards (Home, Fleet, the workspace's Loop, its Runners, Workspace, Engineering).
// Work: the workspace's work (Products, Roadmaps, Ideas, Concepts, PRDs, Bug Fixes, Visual Updates,
// Knowledge). At the foot one Settings entry, at /app/settings, which lands on Fleets (SETTINGS_LANDING),
// then Omni's own pages, Docs and Release notes, which leave the app for the public ones. Each section
// names its sprite. A new section is one entry here. An entry's pages (Inbox's Done and Workspace,
// Settings' Fleets and Repositories) are not menu lines: their pages show them as tabs, and they only
// fall under the entry. Two pure reads of a path: the entry it falls under, by the longest matching path
// (so /app/fleet is Fleet, not Home), and the top bar's trail (issue 704): the group (the Inbox and the
// foot have none), the entry, then the page, with the entry's sprite. The query and the hash never count.
// Only two entries carry a badge (badgeOf): Inbox, the waiting total, the only filled one, and Runners
// (PRD 2255), the workspace's jobs waiting for an answer, as quiet grey digits.
import { at, defined } from 'omni-loop/kit/lib/narrow.ts';
import { boardPath } from '../ideas/model';
import type { WaitingCounts } from '../waiting/waiting';
import { SETTINGS_MAP_PAGES } from './settings-map';

export type SidebarId = 'inbox' | 'ai-fleet' | 'home' | 'fleet' | 'loop' | 'runners' | 'workspace' | 'engineering' | 'products' | 'roadmaps' | 'ideas' | 'concepts' | 'prds' | 'bugs' | 'visual' | 'knowledge' | 'settings' | 'docs' | 'releases' | 'anti-dashboard' | 'anti-work';

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
  /** Other paths that fall under the entry, with no page of their own in the menu: a question round's
   * page sits under the Inbox (omni-loop-22). */
  alsoUnder?: readonly string[];
  /** It opens one of Omni's public pages, outside the app. */
  leavesApp?: boolean;
  /** The 16×16 sprite of @omni/design drawn before its name (issue 653): every entry but Omni's. */
  sprite?: string;
}

export interface SidebarGroup {
  id: 'inbox' | 'dashboard' | 'work' | 'anti';
  /** The group's name, or null for the Inbox's, which has none (omni-loop-22). */
  label: string | null;
  items: readonly SidebarItem[];
}

/** Where every ideas board lives (PRD 1246): /ideas/<owner>/<repo>. */
const IDEAS_PATH = '/ideas';

/** Where a workspace with no repository makes its first board: Settings › Repositories. */
const REPOSITORIES_PATH = '/app/settings/repositories';

/** The sidebar's two groups, in order. */
export const SIDEBAR: readonly SidebarGroup[] = [
  {
    id: 'inbox',
    label: null,
    items: [
      {
        id: 'inbox',
        label: 'Inbox',
        path: '/app/inbox',
        sprite: 'menu-inbox',
        pages: [
          { label: 'Done', path: '/app/inbox/done' },
          { label: 'Workspace', path: '/app/inbox/workspace' },
        ],
        // A question round's page, and a terminal session's: they sit under the Inbox.
        alsoUnder: ['/ask'],
      },
      // PRD 3233 s3: the fleets of agents, right under Inbox; no badge, Inbox and Runners already count what waits.
      { id: 'ai-fleet', label: 'AI Fleet', path: '/app/ai-fleet', sprite: 'menu-ai-fleet' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    items: [
      { id: 'home', label: 'Home', path: '/app', sprite: 'menu-home' },
      { id: 'fleet', label: 'Fleet', path: '/app/fleet', sprite: 'menu-fleet' },
      { id: 'loop', label: 'Loop', path: '/app/loop', sprite: 'menu-loop' },
      { id: 'runners', label: 'Runners', path: '/app/runners', sprite: 'item-box' },
      { id: 'workspace', label: 'Workspace', path: '/app/workspace', sprite: 'menu-workspace' },
      { id: 'engineering', label: 'Engineering', path: '/app/engineering', sprite: 'menu-engineering' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      { id: 'products', label: 'Products', path: '/app/products', sprite: 'coin' },
      { id: 'roadmaps', label: 'Roadmaps', path: '/roadmaps', sprite: 'menu-roadmaps' },
      { id: 'ideas', label: 'Ideas', path: IDEAS_PATH, sprite: 'tile-block' },
      { id: 'concepts', label: 'Concepts', path: '/concepts', sprite: 'menu-concepts' },
      { id: 'prds', label: 'PRDs', path: '/prd', sprite: 'menu-prds' },
      { id: 'bugs', label: 'Bug Fixes', path: '/bugs', sprite: 'menu-bugs' },
      { id: 'visual', label: 'Visual Updates', path: '/visual', sprite: 'menu-visual' },
      { id: 'knowledge', label: 'Knowledge', path: '/knowledge', sprite: 'menu-knowledge' },
    ],
  },
];

/** The anti-loop mode's one group (PRD 2490), drawn in place of Dashboard and Work on /anti and
 * /anti/work; the foot stays. */
export const ANTI_SIDEBAR: readonly SidebarGroup[] = [
  {
    id: 'anti',
    label: 'Anti-loop',
    items: [
      { id: 'anti-dashboard', label: 'Anti-dashboard', path: '/anti', sprite: 'menu-home' },
      { id: 'anti-work', label: 'Anti-work', path: '/anti/work', sprite: 'menu-engineering' },
    ],
  },
];

/** Where /app/settings lands (PRD 733): its Fleets page. */
export const SETTINGS_LANDING = '/app/settings/fleets';

/** The foot's Settings entry (PRD 733), above Docs and Release notes; its pages are the settings map's. */
export const SETTINGS: SidebarItem = {
  id: 'settings',
  label: 'Settings',
  path: '/app/settings',
  sprite: 'menu-settings',
  // Built from the settings map (omni-loop-27 s1): the order of its groups.
  pages: SETTINGS_MAP_PAGES.map(({ label, path }) => ({ label, path })),
};

/** Where an entry's link goes: its path, but for Ideas (PRD 1246) the board of the workspace's
 * repository the viewer read, or Settings › Repositories when it lists none. */
export function hrefOf(item: SidebarItem, ideasBoard: string | null): string {
  if (item.id !== 'ideas') return item.path;
  return ideasBoard ? boardPath(ideasBoard) : REPOSITORIES_PATH;
}

/** Omni's own pages, in the foot's unlabelled row: they leave the app. */
export const OMNI: readonly SidebarItem[] = [
  { id: 'docs', label: 'Docs', path: '/docs', leavesApp: true },
  { id: 'releases', label: 'Release notes', path: '/releases', leavesApp: true },
];

type Entry = { item: SidebarItem; page: SidebarPage | null; group: SidebarGroup | null; path: string };

const ENTRIES: readonly Entry[] = [
  ...[...SIDEBAR, ...ANTI_SIDEBAR].flatMap((group) => group.items.map((item) => ({ item, group }))),
  ...[SETTINGS, ...OMNI].map((item) => ({ item, group: null })),
].flatMap(({ item, group }) => [
  { item, page: null, group, path: item.path },
  ...(item.alsoUnder ?? []).map((path) => ({ item, page: null, group, path })),
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

/** The noun of an item page under an entry (omni-loop-20 s6): what the trail's last crumb says until the
 * page names its item. */
const ITEM_NOUNS: Partial<Record<SidebarId, string>> = { prds: 'PRD', bugs: 'Bug fix', visual: 'Visual update' };

/** A dossier's id, as its page's address carries it. */
const ITEM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The page of a PRD's review screen, after the PRD in the trail. */
const REVIEW_CRUMB = 'Review for approval';

/** The crumbs of an item page under an entry: `/prd/<id>` names the item, `/prd/<id>/review` the item
 * then the review screen; none for any other path. */
function itemCrumbs(entry: Entry, path: string, item: string | null): Crumb[] {
  const noun = ITEM_NOUNS[entry.item.id];
  const [id = '', ...rest] = path.slice(entry.path.length + 1).split('/');
  if (!noun || !ITEM_ID.test(id)) return [];
  const name = item ?? noun;
  const sub = rest.join('/');
  if (sub === '') return [{ label: name }];
  return entry.item.id === 'prds' && sub === 'review' ? [{ label: name, path: `${entry.path}/${id}` }, { label: REVIEW_CRUMB }] : [];
}

/** The top bar's trail for the path ("Work › Questions › Shared with me", "Settings › Fleets"), or null
 * when it falls under no entry. A group has no page to link; the entry and its page each link back only
 * from a page under them. An item's page (a PRD's, a fix's) ends on the item, named `item` once its page
 * gave its name, and a PRD's review screen on Review for approval (omni-loop-20 s6). */
export function pageTrail(pathname: string | null | undefined, item: string | null = null): Trail | null {
  const entry = entryOf(pathname);
  if (!entry) return null;
  const { item: section, page, group } = entry;
  const path = bare(defined(pathname, 'the path'));
  const here = path === entry.path;
  const last = page ?? section;
  // PRD 3233 s3: an AI fleet's page names the fleet after the entry: `AI Fleet › <name>`.
  if (section.id === 'ai-fleet' && here && item !== null) return { crumbs: [{ label: section.label, path: section.path }, { label: item }], sprite: section.sprite ?? null };
  const items = here || page ? [] : itemCrumbs(entry, path, item);
  return {
    crumbs: [
      ...(group?.label ? [{ label: group.label }] : []),
      ...(page ? [{ label: section.label, path: section.path }] : []),
      here ? { label: last.label } : { label: last.label, path: last.path },
      ...items,
    ],
    sprite: section.sprite ?? null,
  };
}

/** The badge an entry carries: Inbox the waiting total (questions, approvals, outbox items, reviews: the
 * number the tab's title shows, omni-loop-22), the only filled one; Runners the workspace's jobs waiting for
 * an answer (PRD 2255), quiet; null at 0, and for an entry that counts nothing. */
export function badgeOf(id: SidebarId, counts: WaitingCounts): number | null {
  const count = id === 'inbox' ? counts.total : id === 'runners' ? counts.runners : 0;
  return count > 0 ? count : null;
}

/** Whether an entry's badge is quiet grey digits with no fill, and no dot in the rail: every count but the
 * Inbox's. */
export const isQuiet = (id: SidebarId): boolean => id !== 'inbox';
