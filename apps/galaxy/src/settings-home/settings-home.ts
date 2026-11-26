// The settings home model (omni-loop-32 s1): the settings map's groups and pages as the home shows them,
// each page with its one-line description, who may change it and a status chip (or none). Pure: the map
// and the statuses come in, the cards come out; the status reads are the service's (s2).
import type { SettingsGroup } from '../nav/settings-map';

/** The chip words of each page that has something to set up, by the page's address. A page absent here has none. */
export type SettingsStatus = Readonly<Record<string, string | undefined>>;

export interface SettingsHomeCard {
  label: string;
  path: string;
  description: string;
  changedBy: string;
  /** What needs attention on the page, or null when nothing does. */
  chip: string | null;
}

export interface SettingsHomeGroup {
  label: string;
  pages: readonly SettingsHomeCard[];
}

export const settingsHome = (map: readonly SettingsGroup[], status: SettingsStatus): SettingsHomeGroup[] =>
  map.map((group) => ({
    label: group.label,
    pages: group.pages.map((page) => ({
      label: page.label,
      path: page.path,
      description: page.holds,
      changedBy: page.changedBy,
      chip: status[page.path] || null,
    })),
  }));
