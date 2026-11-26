import { SETTINGS_MAP, type SettingsPage } from './settings-map';

// The settings navigation's model (omni-loop-27 s2): the map's groups, each page marked current or
// not for the address showing. Pure, so which page is current is tested without a browser.

export interface SettingsNavPage extends SettingsPage {
  current: boolean;
}

export interface SettingsNavGroup {
  label: string;
  pages: SettingsNavPage[];
}

export interface SettingsNavModel {
  groups: SettingsNavGroup[];
  /** The page showing, or null on an address outside the map (/app/settings itself, a redirect). */
  current: SettingsPage | null;
}

/** Whether `pathname` is the page's address or one under it, ignoring a trailing slash. */
export const isCurrent = (pathname: string | null, path: string): boolean => {
  if (!pathname) return false;
  const here = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return here === path || here.startsWith(`${path}/`);
};

export function settingsNav(pathname: string | null): SettingsNavModel {
  let current: SettingsPage | null = null;
  const groups = SETTINGS_MAP.map((group) => ({
    label: group.label,
    pages: group.pages.map((page) => {
      const isHere = isCurrent(pathname, page.path);
      if (isHere) current = page;
      return { ...page, current: isHere };
    }),
  }));
  return { groups, current };
}
