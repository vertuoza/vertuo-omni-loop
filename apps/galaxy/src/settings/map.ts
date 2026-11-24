// The one map of Settings (PRD 3216): the only place that says what Settings holds. Sections, each
// with its pages, as data (no JSX) so the menu, the tab row, the trail and the search read the same
// thing. Within a section the pages go from what most people touch to what few do. Every address is
// the page's existing one; map.test.ts checks the map against the pages under app/app/settings/.

/** One settings page: where it lives and what a person might type to find it. */
export type SettingsPageEntry = {
  id: string;
  label: string;
  path: string;
  summary: string;
  keywords: readonly string[];
};

/** A group of settings pages, with a label and a one-line summary. */
export type SettingsSection = {
  id: string;
  label: string;
  summary: string;
  pages: readonly SettingsPageEntry[];
};

export const SETTINGS_MAP: readonly SettingsSection[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    summary: 'The people, repositories and business context your workspace runs on.',
    pages: [
      {
        id: 'fleets',
        label: 'Fleets',
        path: '/app/settings/fleets',
        summary: 'The fleets of agents that build for your workspace.',
        keywords: ['fleet', 'agents', 'runners', 'team'],
      },
      {
        id: 'repositories',
        label: 'Repositories',
        path: '/app/settings/repositories',
        summary: 'The repositories connected to your workspace.',
        keywords: ['repository', 'repo', 'github', 'connect'],
      },
      {
        id: 'business',
        label: 'Business',
        path: '/app/settings/business',
        summary: 'What your business is, in words the agents read.',
        keywords: ['business', 'personas', 'laws', 'glossary', 'company'],
      },
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    summary: 'How the agents decide and what rules they follow.',
    pages: [
      {
        id: 'jev',
        label: 'Jev',
        path: '/app/settings/jev',
        summary: 'What Jev decides for you, and what it leaves to a person.',
        keywords: ['jev', 'decide', 'automatic', 'risk'],
      },
      {
        id: 'playbook',
        label: 'Playbook',
        path: '/app/settings/playbook',
        summary: 'The rules every agent follows when it builds here.',
        keywords: ['playbook', 'rules', 'forms', 'conventions'],
      },
    ],
  },
  {
    id: 'developers',
    label: 'Developers',
    summary: 'Keys and access for tools that talk to Omni.',
    pages: [
      {
        id: 'api-keys',
        label: 'API keys',
        path: '/app/settings/api-keys',
        summary: 'The keys that let a terminal or a tool sign in as you.',
        keywords: ['api', 'key', 'token', 'terminal', 'mcp'],
      },
    ],
  },
];

/** Every page of the map, in menu order (section by section). */
export const settingsPages = (): SettingsPageEntry[] => SETTINGS_MAP.flatMap((section) => [...section.pages]);

/** Where /app/settings lands: the first page of the first section (Fleets). */
export const SETTINGS_LANDING_PATH: string = settingsPages()[0]?.path ?? '/app/settings/fleets';

const SETTINGS_PREFIX = '/app/settings/';

/** The directories (under app/app/settings/) that hold a page and have no entry in the map. */
export function uncoveredSettingsDirs(dirsWithPage: readonly string[]): string[] {
  const known = new Set(settingsPages().map((p) => p.path.slice(SETTINGS_PREFIX.length)));
  return dirsWithPage.filter((dir) => !known.has(dir));
}

/** The paths of the map's entries whose directory holds no page. */
export function entriesWithoutPage(hasPage: (dir: string) => boolean): string[] {
  return settingsPages()
    .filter((p) => !hasPage(p.path.slice(SETTINGS_PREFIX.length)))
    .map((p) => p.path);
}
